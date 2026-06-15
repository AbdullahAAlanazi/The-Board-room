"""FastAPI backend for AI Board Room.

Endpoints:
    GET  /health       — liveness check
    POST /onboard      — save company profile + PDFs, build RAG index
    POST /board/run    — run a 3-round board debate on a decision
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from boardroom.board import run_board
from boardroom.rag import DOCUMENTS_DIR, build_retriever
from boardroom.schema import BoardResult

app = FastAPI(title="AI Board Room", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory session (single-user MVP) ──────────────────────────────────────
_session: dict = {"profile": None, "retriever": None}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _format_profile(profile: dict) -> str:
    """Turn the onboarding JSON into a plain-text context block for the LLM."""
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


def _build_context(decision: str) -> Optional[str]:
    """Combine the company profile with relevant RAG chunks."""
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

    return "\n\n".join(parts) if parts else None


# ── Schemas ──────────────────────────────────────────────────────────────────

class RunRequest(BaseModel):
    decision: str


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/onboard")
async def onboard(
    profile: str = Form(..., description="Onboarding JSON stringified"),
    files: list[UploadFile] = File(default=[]),
):
    """Accept the company profile and uploaded PDFs from the onboarding page.

    Saves PDFs to documents/, rebuilds the FAISS index, and caches the
    retriever for subsequent /board/run calls.
    """
    try:
        profile_data = json.loads(profile)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="profile must be valid JSON")

    _session["profile"] = profile_data

    # Clear old PDFs and save the new ones
    for old in DOCUMENTS_DIR.glob("*.pdf"):
        old.unlink()

    saved = []
    for upload in files:
        if upload.filename and upload.filename.lower().endswith(".pdf"):
            dest = DOCUMENTS_DIR / upload.filename
            with dest.open("wb") as f:
                shutil.copyfileobj(upload.file, f)
            saved.append(upload.filename)

    # Rebuild FAISS index (invalidates cache automatically via fingerprint)
    _session["retriever"] = build_retriever()

    return {
        "status": "ok",
        "company": profile_data.get("business_name", "Unknown"),
        "pdfs_saved": saved,
        "rag_ready": _session["retriever"] is not None,
    }


@app.post("/board/run", response_model=BoardResult)
def board_run(body: RunRequest):
    """Run a 3-round board debate on a business decision.

    Uses the company profile and uploaded documents (if any) as context.
    Returns the full BoardResult including all advisor responses and the
    chairman's verdict.
    """
    if not body.decision.strip():
        raise HTTPException(status_code=400, detail="decision cannot be empty")

    context = _build_context(body.decision)

    result = run_board(
        decision=body.decision,
        context=context,
        retriever=_session.get("retriever"),
    )
    return result
