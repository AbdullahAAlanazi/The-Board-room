"""FastAPI backend for AI Board Room.

Endpoints:
    GET  /health              — liveness check
    POST /onboard             — save company profile + PDFs, build RAG index
    POST /board/run           — run board debate (uses session profile + RAG)
    GET  /api/health          — liveness check (presentation UI)
    POST /api/discover        — chairman discovery questions
    POST /api/board           — run board (direct, no session)
    POST /api/board/stream    — SSE streaming board run
    GET  /*                   — serves the built React frontend (frontend/dist/)
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import shutil
import sys
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

import boardroom.advisors  # ensure advisors are registered
from boardroom.board import (
    _chairman_synthesize,
    _format_round1,
    discover_questions,
    run_board,
)
from boardroom.rag import DOCUMENTS_DIR, build_retriever
from boardroom.registry import get_advisors
from boardroom.schema import BoardResult, DiscoveryResult

app = FastAPI(title="AI Board Room", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory session (single-user MVP) ──────────────────────────────────────
_session: dict = {"profile": None, "retriever": build_retriever()}  # load on startup if docs exist

_LANGUAGES = {"ar": "Arabic", "en": "English"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _format_profile(profile: dict) -> str:
    challenges = ", ".join(profile.get("challenges", [])) or "None specified"
    return (
        f"Company: {profile.get('business_name', 'Unknown')}\n"
        f"City: {profile.get('city', 'Unknown')}\n"
        f"Industry: {profile.get('industry', 'Unknown')}\n"
        f"Description: {profile.get('description', '')}\n"
        f"Team size: {profile.get('team_size', 'Unknown')}\n"
        f"Monthly revenue: {profile.get('revenue', 'Unknown')}\n"
        f"Risk tolerance: {profile.get('risk_tolerance', 'Unknown')}\n"
        f"Current challenges: {challenges}"
    )


def _build_context(decision: str, extra: str = "") -> Optional[str]:
    """Combine company profile, RAG chunks, and any extra context (e.g. discovery Q&A)."""
    profile = _session.get("profile")
    retriever = _session.get("retriever")

    parts = []
    if profile:
        parts.append(_format_profile(profile))
    if retriever:
        docs = retriever.invoke(decision)
        if docs:
            chunks = "\n\n".join(d.page_content for d in docs)
            parts.append(f"--- Relevant company documents ---\n{chunks}")
    if extra and extra.strip():
        parts.append(f"--- Additional context ---\n{extra.strip()}")

    return "\n\n".join(parts) if parts else None


# ── Request schemas ───────────────────────────────────────────────────────────

class RunRequest(BaseModel):
    decision: str


class BoardRequest(BaseModel):
    decision: str
    context: str = ""
    lang: str = "en"    # "en" | "ar"
    fast: bool = False  # skip Round 2 for ~2x speed


# ── Onboarding routes ─────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/onboard")
async def onboard(
    profile: str = Form(..., description="Onboarding JSON stringified"),
    files: list[UploadFile] = File(default=[]),
):
    """Accept company profile + PDFs, save to disk, rebuild RAG index."""
    try:
        profile_data = json.loads(profile)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="profile must be valid JSON")

    _session["profile"] = profile_data

    for old in DOCUMENTS_DIR.glob("*.pdf"):
        old.unlink()

    saved = []
    for upload in files:
        if upload.filename and upload.filename.lower().endswith(".pdf"):
            dest = DOCUMENTS_DIR / upload.filename
            with dest.open("wb") as f:
                shutil.copyfileobj(upload.file, f)
            saved.append(upload.filename)

    _session["retriever"] = build_retriever()

    return {
        "status": "ok",
        "company": profile_data.get("business_name", "Unknown"),
        "pdfs_saved": saved,
        "rag_ready": _session["retriever"] is not None,
    }


@app.post("/board/run", response_model=BoardResult)
def board_run(body: RunRequest):
    """Run a board debate using the current session profile and RAG context."""
    if not body.decision.strip():
        raise HTTPException(status_code=400, detail="decision cannot be empty")

    context = _build_context(body.decision)
    result = run_board(
        decision=body.decision,
        context=context,
        retriever=_session.get("retriever"),
    )
    return result


# ── Presentation UI routes ────────────────────────────────────────────────────

@app.get("/api/health")
def api_health():
    return {"ok": True}


@app.post("/api/discover", response_model=DiscoveryResult)
def discover(req: BoardRequest):
    language = _LANGUAGES.get(req.lang, "English")
    with contextlib.redirect_stdout(sys.stderr):
        return discover_questions(req.decision, language=language, retriever=_session.get("retriever"))


@app.post("/api/board", response_model=BoardResult)
def api_board(req: BoardRequest):
    language = _LANGUAGES.get(req.lang, "English")
    context = _build_context(req.decision, extra=req.context)
    with contextlib.redirect_stdout(sys.stderr):
        return run_board(
            decision=req.decision,
            context=context,
            language=language,
            fast=req.fast,
            retriever=_session.get("retriever"),
        )


@app.post("/api/board/stream")
async def board_stream(req: BoardRequest):
    """SSE endpoint — yields each advisor response as it completes."""
    language = _LANGUAGES.get(req.lang, "English")
    context = _build_context(req.decision, extra=req.context)
    advisors = get_advisors(retriever=_session.get("retriever"))

    async def generate():
        loop = asyncio.get_event_loop()

        r1_tasks = [
            loop.run_in_executor(None, adv.analyze, req.decision, context, language)
            for adv in advisors
        ]
        round1 = []
        for coro in asyncio.as_completed(r1_tasks):
            result = await coro
            round1.append(result)
            yield f"data: {json.dumps({'type': 'r1', 'data': result.model_dump()})}\n\n"

        if not req.fast:
            others = _format_round1(round1)

            def _r2(adv):
                ctx = (
                    "ROUND 2: Challenge a specific advisor by name. "
                    "No repeating Round 1. Max 3 sentences.\n\n"
                    f"Round 1 arguments:\n{others}\n\n"
                    f"Company context:\n{req.context or 'None.'}"
                )
                return adv.analyze(req.decision, context=ctx, language=language)

            r2_tasks = [loop.run_in_executor(None, _r2, adv) for adv in advisors]
            round2 = []
            for coro in asyncio.as_completed(r2_tasks):
                result = await coro
                round2.append(result)
                yield f"data: {json.dumps({'type': 'r2', 'data': result.model_dump()})}\n\n"
        else:
            round2 = round1

        verdict = await loop.run_in_executor(
            None, _chairman_synthesize, req.decision, round1, round2, language
        )
        yield f"data: {json.dumps({'type': 'verdict', 'data': verdict.model_dump()})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Serve static files and pages (must be last) ──────────────────────────────
FRONTEND_DIR = FRONTEND_DIST.parent  # frontend/

@app.get("/", include_in_schema=False)
async def root():
    return FileResponse(str(FRONTEND_DIR / "onboarding.html"))

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/app", include_in_schema=False)
    @app.get("/app/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str = ""):
        return FileResponse(str(FRONTEND_DIST / "index.html"))
