from __future__ import annotations
import time
from concurrent.futures import ThreadPoolExecutor
from langchain_core.prompts import ChatPromptTemplate

import boardroom.advisors
from boardroom.llm import get_llm
from boardroom.registry import get_advisors
from boardroom.schema import (
    AdvisorResponse,
    BoardResult,
    ChairmanVerdict,
    DiscoveryResult,
)

def discover_questions(decision: str, language: str = "English") -> DiscoveryResult:
    """Generate 2-5 discovery questions the Chairman asks before the board convenes."""
    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are the Chairman of a business advisory board. A leader has brought a decision "
         "to the board. Before convening the full debate, your job is to ask 2-5 focused "
         "discovery questions that will give the advisors the context they need.\n\n"
         "RULES:\n"
         "• Ask ONLY what the decision statement doesn't already answer.\n"
         "• Target the biggest unknowns: budget/timeline constraints, existing capabilities, "
         "competitive landscape, regulatory situation, or stakeholder buy-in.\n"
         "• Be concise and direct — one crisp sentence per question, no preamble.\n"
         "• Write all questions entirely in {language}."),
        ("human", "Decision: {decision}\n\nGenerate your discovery questions."),
    ])
    llm = get_llm(temperature=0.4, max_tokens=250)
    chain = prompt | llm.with_structured_output(DiscoveryResult)
    return chain.invoke({"decision": decision, "language": language})


def _format_round1(responses: list[AdvisorResponse]) -> str:
    lines = []
    for r in responses:
        lines.append(f'[{r.advisor}] Vote: {r.vote.value}\n{r.reasoning}')
    return '\n\n'.join(lines)
    
def run_board(
    decision: str,
    context: str = "",
    language: str = "English",
    fast: bool = False,
) -> BoardResult:
    """Run the full board meeting.

    fast=True: skip Round 2 (parallel R1 + chairman only) — cuts time in half.
    """

    advisors = get_advisors()
    if not advisors:
        raise RuntimeError("No advisors regigstered. Add at least one to advisors/__init__.py")

    t0 = time.time()
    print(f"\n[Round 1] {len(advisors)} advisors analyzing in parallel...")

    # ── Round 1: all advisors run simultaneously ──────────────────────────
    def _r1(adv):
        print(f"  → {adv.name} thinking...")
        return adv.analyze(decision, context, language=language)

    with ThreadPoolExecutor(max_workers=len(advisors)) as pool:
        round1 = list(pool.map(_r1, advisors))
    print(f"  ✓ Round 1 done in {time.time()-t0:.1f}s")

    # ── Round 2: all advisors run simultaneously (they all read same R1) ──
    t1 = time.time()
    print("\n[Round 2] Advisors responding in parallel...")
    others_summary = _format_round1(round1)

    def _r2(adv):
        print(f"  → {adv.name} responding...")
        ctx = (
            "=== ROUND 2 INSTRUCTIONS ===\n"
            "You have read your colleagues' Round 1 positions. Respond as a seasoned "
            "board member who has heard them argue.\n"
            "STRICT RULES:\n"
            "1. Do NOT repeat or rephrase your Round 1 position.\n"
            "2. Directly challenge a SPECIFIC argument — name the advisor: "
            "'The CFO's claim that X ignores...'\n"
            "3. Bring NEW evidence or a genuine counterargument. No recycling.\n"
            "4. You MAY change your vote if the debate shifted your position — say so.\n"
            "5. Keep it punchy. Max 3 sentences.\n\n"
            f"=== ROUND 1 ARGUMENTS ===\n{others_summary}\n\n"
            f"=== COMPANY CONTEXT ===\n{context or 'None provided.'}"
        )
        return adv.analyze(decision, context=ctx, language=language)

    if fast:
        print("  (fast mode: skipping Round 2)")
        round2 = round1  # reuse round1 for chairman input; UI shows empty R2
    else:
        with ThreadPoolExecutor(max_workers=len(advisors)) as pool:
            round2 = list(pool.map(_r2, advisors))
        print(f"  ✓ Round 2 done in {time.time()-t1:.1f}s")

    t2 = time.time()
    print("\n[Round 3] Chairman synthesizing...")
    verdict = _chairman_synthesize(decision, round1, round2, language=language)
    print(f"  ✓ Chairman done in {time.time()-t2:.1f}s  |  total {time.time()-t0:.1f}s")

    return BoardResult(
        decision=decision,
        round1_analyses=round1,
        round2_rebuttals=round2,
        verdict=verdict,
    )

def _chairman_synthesize(
    decision: str,
    round1: list[AdvisorResponse],
    round2: list[AdvisorResponse],
    language: str = "English",
) -> ChairmanVerdict:
    """The chairman reads all arguments and produces a final verdict."""

    all_arguments = "\n\n".join([
        f"[{r.advisor} — Round 1] {r.reasoning}" for r in round1
    ] + [
        f"[{r.advisor} — Round 2] {r.reasoning}" for r in round2
    ])

    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are the Chairman of the board — not a mediator, a decision-maker.\n\n"
         "YOUR PROCESS:\n"
         "1. Identify the 2-3 arguments that actually moved the debate — ignore repetition "
         "and posturing.\n"
         "2. State explicitly why you weight them the way you do.\n"
         "3. Give ONE clear recommendation the leader can act on tomorrow.\n"
         "4. Set your `stance`: proceed / against / conditional.\n"
         "   This is a synthesis of the arguments, NOT a vote tally — you may and should "
         "   overrule the majority when the stronger arguments point the other way.\n"
         "5. Write `board_note` as a single blunt sentence explaining your call vs. the vote "
         "   split — especially if you went against the majority.\n\n"
         "STYLE: Write like a decisive CEO, not a consultant summarizing a memo. "
         "No hedging. No 'it's important to balance'. Call it.\n\n"
         "Write board_note, recommendation, conflicts, and next_steps entirely in {language}."),
        ("human",
         "Business decision:\n{decision}\n\n"
         "Board arguments:\n{arguments}\n\n"
         "Produce your final verdict."),
    ])

    llm = get_llm(temperature=0.3, max_tokens=350)
    chain = prompt | llm.with_structured_output(ChairmanVerdict)

    return chain.invoke({
        "decision": decision,
        "arguments": all_arguments,
        "language": language,
    })
