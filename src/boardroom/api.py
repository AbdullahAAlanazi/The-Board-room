"""FastAPI backend for AI Board Room.

Single-port app: serves the built React UI AND the API.

    GET  /health              — liveness check
    POST /onboard             — save company profile + PDFs, build RAG index
    POST /board/run           — run board (uses session profile + RAG)
    GET  /api/health          — liveness check (presentation UI)
    POST /api/discover        — chairman discovery questions (empty if decision is clear)
    POST /api/round           — SSE; one round, streams each advisor as it lands
    POST /api/verdict         — the chairman's synthesis
    POST /api/board           — one-shot full run (export / quick path)
    GET  /                    — onboarding page
    GET  /app, /app/*         — the built React board UI

Run it:
    PYTHONPATH=src python -m uvicorn boardroom.api:app --reload --port 8000
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import shutil
import sys
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

import boardroom.advisors  # ensure advisors are registered
from boardroom.board import (
    chairman_synthesize,
    discover_questions,
    intake,
    run_round1,
    run_round2,
    run_board,
)
from boardroom.rag import DOCUMENTS_DIR, build_retriever
from boardroom.registry import get_advisors
from boardroom.schema import (
    AdvisorResponse,
    BoardResult,
    ChairmanVerdict,
    DiscoveryResult,
    IntakeResult,
)

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


def _build_context(decision: str, extra: str = "") -> str:
    """Combine company profile, RAG chunks, and any extra context (discovery Q&A,
    interjections). Returns "" when there's nothing to add."""
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

    return "\n\n".join(parts)


# ── Request schemas ───────────────────────────────────────────────────────────

class RunRequest(BaseModel):
    decision: str


class BoardRequest(BaseModel):
    decision: str
    context: str = ""
    lang: str = "en"    # "en" | "ar"
    fast: bool = False  # one-shot /api/board only: skip Round 2


class RoundRequest(BaseModel):
    decision: str
    context: str = ""
    lang: str = "en"
    round: int = 1                      # 1 or 2
    prior: List[AdvisorResponse] = []   # round-1 results, when round == 2


class VerdictRequest(BaseModel):
    decision: str
    context: str = ""
    lang: str = "en"
    round1: List[AdvisorResponse] = []
    round2: List[AdvisorResponse] = []


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
    return run_board(
        decision=body.decision,
        context=context,
        retriever=_session.get("retriever"),
    )


# ── Presentation UI routes ────────────────────────────────────────────────────

@app.get("/api/health")
def api_health():
    return {"ok": True}


@app.post("/api/intake", response_model=IntakeResult)
def intake_route(req: BoardRequest):
    """First read of the user's input: answer a question (and suggest a decision),
    or route a decision to the board (with discovery only when vague)."""
    language = _LANGUAGES.get(req.lang, "English")
    context = _build_context(req.decision, extra=req.context)
    with contextlib.redirect_stdout(sys.stderr):
        return intake(req.decision, language=language, context=context)


@app.post("/api/discover", response_model=DiscoveryResult)
def discover(req: BoardRequest):
    language = _LANGUAGES.get(req.lang, "English")
    context = _build_context(req.decision, extra=req.context)
    with contextlib.redirect_stdout(sys.stderr):
        return discover_questions(req.decision, language=language, context=context)


@app.post("/api/round", response_model=List[AdvisorResponse])
def round_endpoint(req: RoundRequest) -> List[AdvisorResponse]:
    """Run one round (advisors in parallel) and return all perspectives as JSON.

    Plain JSON (not SSE) so it survives managed-host proxies that buffer/drop
    long-lived streaming responses. Each round is ~5s; the UI paces the reveal."""
    language = _LANGUAGES.get(req.lang, "English")
    retriever = _session.get("retriever")
    base_ctx = _build_context(req.decision, extra=req.context)
    with contextlib.redirect_stdout(sys.stderr):
        if req.round == 2:
            return run_round2(req.decision, base_ctx, req.prior, language=language, retriever=retriever)
        return run_round1(req.decision, base_ctx, language=language, retriever=retriever)


@app.post("/api/verdict", response_model=ChairmanVerdict)
def verdict(req: VerdictRequest) -> ChairmanVerdict:
    language = _LANGUAGES.get(req.lang, "English")
    round2 = req.round2 or req.round1
    with contextlib.redirect_stdout(sys.stderr):
        return chairman_synthesize(req.decision, req.round1, round2, language=language)


@app.post("/api/board", response_model=BoardResult)
def api_board(req: BoardRequest) -> BoardResult:
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
