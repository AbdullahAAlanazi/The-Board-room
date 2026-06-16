from __future__ import annotations
import time
from concurrent.futures import ThreadPoolExecutor
from langchain_core.prompts import ChatPromptTemplate

import boardroom.advisors
from boardroom.llm import get_llm
from boardroom.rag import build_retriever
from boardroom.registry import get_advisors
from boardroom.schema import (
    AdvisorResponse,
    BoardResult,
    ChairmanVerdict,
    DiscoveryResult,
)


def discover_questions(
    decision: str, language: str = "English", retriever=None
) -> DiscoveryResult:
    """The Chairman asks discovery questions ONLY when the decision is vague or
    missing context. Returns an empty list when it's already clear enough."""
    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are the Chairman of a business advisory board. Before convening the debate, "
         "judge whether the decision is specific enough to debate, or too vague.\n\n"
         "TEST: a decision is SPECIFIC if it names the concrete action AND at least the "
         "scope/scale, budget, or timeline. It is VAGUE if it's a bare one-liner missing the "
         "basics (what exactly / where / how big).\n\n"
         "• VAGUE (e.g. 'Should we expand?', 'Should we hire?', 'Should we go digital?') → ask "
         "2-3 short questions for the missing basics.\n"
         "• SPECIFIC (e.g. 'Should we open a 2nd Jeddah branch, 500k SAR, in 3 months?') → "
         "return an EMPTY list; do NOT ask about anything the decision already states.\n\n"
         "Never ask more than 3. One crisp sentence each, no preamble. Write in {language}."),
        ("human", "Decision: {decision}\n\nIf specific, return empty questions. If vague, ask the missing basics."),
    ])
    llm = get_llm(temperature=0.3, max_tokens=200)
    chain = prompt | llm.with_structured_output(DiscoveryResult)
    return chain.invoke({"decision": decision, "language": language})


def format_round_summary(responses: list[AdvisorResponse]) -> str:
    """Render a round's perspectives as context for the next round / the chairman."""
    lines = []
    for r in responses:
        if not r.relevant:
            lines.append(f"[{r.advisor}] (considers this outside their lens) {r.perspective}")
            continue
        block = [f"[{r.advisor}] {r.perspective}"]
        if r.conditions:
            block.append("  conditions: " + "; ".join(r.conditions))
        if r.recommendations:
            block.append("  recommends: " + "; ".join(r.recommendations))
        lines.append("\n".join(block))
    return "\n\n".join(lines)


def round2_context(round1: list[AdvisorResponse], context: str) -> str:
    """Build the context block an advisor sees in round 2."""
    return (
        "=== ROUND 2 — COLLABORATIVE DEBATE ===\n"
        "You have read your colleagues' Round 1 perspectives below. Now build the "
        "conversation forward:\n"
        "1. Do NOT repeat your own Round 1 perspective.\n"
        "2. Engage ONE colleague's point directly and name them — set `responds_to` to "
        "their name (e.g. 'CFO'). Build on it, refine it, or raise a respectful concern.\n"
        "3. Add something NEW: a consideration nobody raised, or a condition worth adding.\n"
        "4. Don't manufacture conflict. If you simply agree, say what you'd ADD.\n"
        "5. Keep it to ~3 sentences.\n\n"
        f"=== ROUND 1 PERSPECTIVES ===\n{format_round_summary(round1)}\n\n"
        f"=== COMPANY CONTEXT ===\n{context or 'None provided.'}"
    )


def run_round1(
    decision: str, context: str, language: str = "English", retriever=None
) -> list[AdvisorResponse]:
    """Round 1 — every advisor gives an independent perspective, in parallel."""
    advisors = get_advisors(retriever=retriever)
    with ThreadPoolExecutor(max_workers=max(1, len(advisors))) as pool:
        return list(pool.map(
            lambda adv: adv.analyze(decision, context, language=language),
            advisors,
        ))


def run_round2(
    decision: str,
    context: str,
    round1: list[AdvisorResponse],
    language: str = "English",
    retriever=None,
) -> list[AdvisorResponse]:
    """Round 2 — every advisor responds to the others, in parallel."""
    advisors = get_advisors(retriever=retriever)
    ctx = round2_context(round1, context)
    with ThreadPoolExecutor(max_workers=max(1, len(advisors))) as pool:
        return list(pool.map(
            lambda adv: adv.analyze(decision, context=ctx, language=language),
            advisors,
        ))


def run_board(
    decision: str,
    context: str | None = None,
    language: str = "English",
    fast: bool = False,
    retriever=None,
) -> BoardResult:
    """Run the full board meeting.

    fast=True: skip Round 2 (parallel R1 + chairman only) — cuts time in half.
    retriever: pre-built FAISS retriever; built fresh if not provided.
    """
    if retriever is None:
        retriever = build_retriever()
    advisors = get_advisors(retriever=retriever)
    if not advisors:
        raise RuntimeError("No advisors registered. Add at least one to advisors/__init__.py")

    t0 = time.time()
    print(f"\n[Round 1] {len(advisors)} advisors giving perspectives in parallel...")
    round1 = run_round1(decision, context or "", language=language, retriever=retriever)
    print(f"  [done] Round 1 in {time.time()-t0:.1f}s")

    if fast:
        print("  (fast mode: skipping Round 2)")
        round2 = round1  # reuse round1 for chairman input; UI shows empty R2
    else:
        t1 = time.time()
        print("\n[Round 2] Advisors responding in parallel...")
        round2 = run_round2(decision, context or "", round1, language=language, retriever=retriever)
        print(f"  [done] Round 2 in {time.time()-t1:.1f}s")

    t2 = time.time()
    print("\n[Round 3] Chairman synthesizing...")
    verdict = chairman_synthesize(decision, round1, round2, language=language)
    print(f"  [done] Chairman in {time.time()-t2:.1f}s  |  total {time.time()-t0:.1f}s")

    return BoardResult(
        decision=decision,
        round1_analyses=round1,
        round2_rebuttals=round2,
        verdict=verdict,
    )


def chairman_synthesize(
    decision: str,
    round1: list[AdvisorResponse],
    round2: list[AdvisorResponse],
    language: str = "English",
) -> ChairmanVerdict:
    """The chairman reads all perspectives and produces a final verdict."""

    all_arguments = "\n\n".join(
        [f"[{r.advisor} — Round 1]\n{format_round_summary([r])}" for r in round1]
        + [f"[{r.advisor} — Round 2]\n{format_round_summary([r])}" for r in round2]
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are the Chairman of the board — the decision-maker who synthesizes a "
         "panel of expert perspectives into one call.\n\n"
         "YOUR PROCESS:\n"
         "1. Read every advisor's perspective and the conditions they raised. Advisors "
         "do not vote — they contribute lenses. Your job is to converge them.\n"
         "2. Set `stance`: 'proceed' (clear go), 'against' (a genuine blocker makes this "
         "unwise), or 'conditional' (go ahead once the raised conditions are met). Most "
         "well-analyzed decisions are 'conditional' — that is a strength, not a hedge.\n"
         "3. Give ONE clear `recommendation` the leader can act on tomorrow.\n"
         "4. Write `board_note`: one sentence on how the perspectives converged — where "
         "they aligned and what the real open question is (e.g. 'all three see the "
         "opportunity; the question is sequencing, not whether').\n"
         "5. List `conflicts` (points of divergence) and `tensions` (pairwise: which two "
         "advisors pull against each other and over what, with severity high/low).\n"
         "6. Give concrete `next_steps`.\n\n"
         "STYLE: decisive, clear-eyed, no filler.\n\n"
         "Write board_note, recommendation, conflicts, tensions, and next_steps entirely "
         "in {language}."),
        ("human",
         "Business decision:\n{decision}\n\n"
         "Board perspectives:\n{arguments}\n\n"
         "Produce your final verdict."),
    ])

    llm = get_llm(temperature=0.3, max_tokens=500)
    chain = prompt | llm.with_structured_output(ChairmanVerdict)

    return chain.invoke({
        "decision": decision,
        "arguments": all_arguments,
        "language": language,
    })
