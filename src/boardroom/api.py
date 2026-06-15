"""Live board API for the presentation UI.

Wraps run_board() in a FastAPI endpoint so the frontend can ask its own
business decision and get a real, freshly-generated debate back.

Run it:
    PYTHONPATH=src python -m uvicorn boardroom.api:app --reload --port 8000
"""
from __future__ import annotations

import asyncio
import contextlib
import json as _json
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import boardroom.advisors  # ensure advisors are registered
from boardroom.board import (
    _chairman_synthesize,
    _format_round1,
    discover_questions,
    run_board,
)
from boardroom.registry import get_advisors
from boardroom.schema import BoardResult, DiscoveryResult

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
    fast: bool = False  # skip Round 2 for ~2x speed


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.post("/api/discover", response_model=DiscoveryResult)
def discover(req: BoardRequest) -> DiscoveryResult:
    language = _LANGUAGES.get(req.lang, "English")
    with contextlib.redirect_stdout(sys.stderr):
        return discover_questions(req.decision, language=language)


@app.post("/api/board", response_model=BoardResult)
def board(req: BoardRequest) -> BoardResult:
    language = _LANGUAGES.get(req.lang, "English")
    with contextlib.redirect_stdout(sys.stderr):
        return run_board(req.decision, req.context, language=language, fast=req.fast)


@app.post("/api/board/stream")
async def board_stream(req: BoardRequest) -> StreamingResponse:
    """SSE endpoint — yields each advisor response as it completes so the
    UI can show progressive results instead of waiting for all 7 LLM calls."""
    language = _LANGUAGES.get(req.lang, "English")
    advisors = get_advisors()

    async def generate():
        loop = asyncio.get_event_loop()

        # ── Round 1: all in parallel, yield as each finishes ─────────────
        r1_tasks = [
            loop.run_in_executor(None, adv.analyze, req.decision, req.context or "", language)
            for adv in advisors
        ]
        round1 = []
        for coro in asyncio.as_completed(r1_tasks):
            result = await coro
            round1.append(result)
            yield f"data: {_json.dumps({'type': 'r1', 'data': result.model_dump()})}\n\n"

        # ── Round 2 (skip in fast mode) ───────────────────────────────────
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
                yield f"data: {_json.dumps({'type': 'r2', 'data': result.model_dump()})}\n\n"
        else:
            round2 = round1

        # ── Chairman ──────────────────────────────────────────────────────
        verdict = await loop.run_in_executor(
            None, _chairman_synthesize, req.decision, round1, round2, language
        )
        yield f"data: {_json.dumps({'type': 'verdict', 'data': verdict.model_dump()})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
