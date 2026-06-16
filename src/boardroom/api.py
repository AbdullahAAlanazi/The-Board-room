"""Live board API for the presentation UI.

The UI runs the board ROUND BY ROUND so the user can inject context between
rounds (the "pause & add during the session" interaction):

    POST /api/discover  → discovery questions (chat)
    POST /api/round     → SSE; streams each advisor's perspective as it lands
    POST /api/verdict   → the chairman's synthesis
    POST /api/board     → one-shot full run (export / quick path)

Run it:
    PYTHONPATH=src python -m uvicorn boardroom.api:app --reload --port 8000
"""
from __future__ import annotations

import asyncio
import contextlib
import json as _json
import sys
from typing import List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import boardroom.advisors  # ensure advisors are registered
from boardroom.board import (
    chairman_synthesize,
    discover_questions,
    round2_context,
    run_board,
)
from boardroom.registry import get_advisors
from boardroom.schema import (
    AdvisorResponse,
    BoardResult,
    ChairmanVerdict,
    DiscoveryResult,
)

app = FastAPI(title="AI Board Room API")

# The Vite dev server runs on 5173; allow it (and any localhost) to call us.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


_LANGUAGES = {"ar": "Arabic", "en": "English"}


class BoardRequest(BaseModel):
    decision: str
    context: str = ""
    lang: str = "en"   # "en" | "ar" — language the board should respond in
    fast: bool = False  # one-shot /api/board only: skip Round 2


class RoundRequest(BaseModel):
    decision: str
    context: str = ""
    lang: str = "en"
    round: int = 1                                  # 1 or 2
    prior: List[AdvisorResponse] = []              # round-1 results, when round == 2


class VerdictRequest(BaseModel):
    decision: str
    context: str = ""
    lang: str = "en"
    round1: List[AdvisorResponse] = []
    round2: List[AdvisorResponse] = []


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.post("/api/discover", response_model=DiscoveryResult)
def discover(req: BoardRequest) -> DiscoveryResult:
    language = _LANGUAGES.get(req.lang, "English")
    with contextlib.redirect_stdout(sys.stderr):
        return discover_questions(req.decision, language=language)


@app.post("/api/round")
async def round_stream(req: RoundRequest) -> StreamingResponse:
    """SSE — run one round, streaming each advisor's perspective as it completes."""
    language = _LANGUAGES.get(req.lang, "English")
    advisors = get_advisors()

    if req.round == 2:
        ctx = round2_context(req.prior, req.context)
    else:
        ctx = req.context

    async def generate():
        loop = asyncio.get_event_loop()
        tasks = [
            loop.run_in_executor(None, adv.analyze, req.decision, ctx, language)
            for adv in advisors
        ]
        for coro in asyncio.as_completed(tasks):
            result = await coro
            yield f"data: {_json.dumps({'type': 'advisor', 'data': result.model_dump()})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/verdict", response_model=ChairmanVerdict)
def verdict(req: VerdictRequest) -> ChairmanVerdict:
    language = _LANGUAGES.get(req.lang, "English")
    round2 = req.round2 or req.round1
    with contextlib.redirect_stdout(sys.stderr):
        return chairman_synthesize(req.decision, req.round1, round2, language=language)


@app.post("/api/board", response_model=BoardResult)
def board(req: BoardRequest) -> BoardResult:
    language = _LANGUAGES.get(req.lang, "English")
    with contextlib.redirect_stdout(sys.stderr):
        return run_board(req.decision, req.context, language=language, fast=req.fast)
