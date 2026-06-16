"""The shared data contract for the whole project.

Every advisor returns an `AdvisorResponse`. The orchestrator collects those
and produces a `BoardResult`. This file is the single source of truth that
all five workstreams (debate engine, RAG, API, UI, export) build against —
agree on it first, change it deliberately.

Because these are Pydantic models, they double as:
  * the structure the LLM is asked to fill (via `with_structured_output`),
  * the JSON the API returns,
  * the shape the React dashboard renders.
"""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class AdvisorResponse(BaseModel):
    """One advisor's contribution in one round of the debate.

    This is a *collaborative perspective*, not a vote. An advisor contributes
    its lens — what it sees, what must be true (conditions), and what it
    recommends — and the chairman synthesizes all perspectives into a decision.

    THIS is the contract a teammate's advisor must produce. If every advisor
    returns exactly this, the orchestrator can run any number of them without
    knowing anything about who they are.
    """

    advisor: str = Field(
        description="The advisor's name/role, e.g. 'CFO' or 'Legal'."
    )
    relevant: bool = Field(
        default=True,
        description="Whether this decision actually falls within this advisor's "
        "domain. Set False when it genuinely doesn't — then `perspective` is one "
        "short line saying so, and conditions/recommendations stay empty. Do NOT "
        "force an opinion on something outside your lens.",
    )
    perspective: str = Field(
        description="The advisor's headline take in 1-2 sentences — its honest "
        "view through its own lens. Not a vote, a viewpoint.",
    )
    conditions: List[str] = Field(
        default_factory=list,
        description="What must be true for this to work — prerequisites, "
        "requirements, or guardrails. Licensing/permits/compliance needs go HERE "
        "as conditions to satisfy, never as reasons to oppose.",
    )
    recommendations: List[str] = Field(
        default_factory=list,
        description="Concrete, actionable suggestions from this advisor's lens.",
    )
    reasoning: str = Field(
        description="The fuller argument: the analysis behind the perspective.",
    )
    responds_to: Optional[str] = Field(
        default=None,
        description="In round 2 only: the name of the advisor whose point you are "
        "directly engaging or building on (e.g. 'CFO'). Null in round 1.",
    )


class Stance(str, Enum):
    """The chairman's final call on the decision itself."""

    PROCEED = "proceed"         # go ahead
    AGAINST = "against"         # do not
    CONDITIONAL = "conditional" # go ahead, but only if conditions are met


class Tension(BaseModel):
    """A point of friction the chairman identified between two advisors'
    perspectives. Powers the tension map (replaces vote-derived edges)."""

    between: List[str] = Field(
        description="The two advisors in tension, by name, e.g. ['CFO', 'Market'].",
    )
    over: str = Field(
        description="A short phrase naming what they pull against, e.g. "
        "'pace of expansion vs. cash runway'.",
    )
    severity: str = Field(
        default="low",
        description="'high' for a real clash, 'low' for mild divergence.",
    )


class ChairmanVerdict(BaseModel):
    """The chairman's synthesis after weighing every advisor's perspective."""

    stance: Stance = Field(
        description="The final call on the decision: proceed, against, or "
        "conditional. A synthesis of the perspectives and the conditions raised.",
    )
    board_note: str = Field(
        description="ONE sentence on how the perspectives converged — where the "
        "board aligned and what tipped your call (e.g. 'all three align on the "
        "opportunity; the open question is sequencing, not whether').",
    )
    recommendation: str = Field(
        description="The final recommendation the leader should act on."
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in the recommendation, from 0.0 to 1.0.",
    )
    conflicts: List[str] = Field(
        default_factory=list,
        description="The key points where perspectives diverged.",
    )
    tensions: List[Tension] = Field(
        default_factory=list,
        description="Pairwise tensions between advisors, for the tension map.",
    )
    next_steps: List[str] = Field(
        default_factory=list,
        description="Concrete next actions for the leader.",
    )


class DiscoveryResult(BaseModel):
    """Questions the Chairman asks before the board convenes — to surface context
    that will sharpen the debate. Empty when the decision is already clear enough."""

    questions: list[str] = Field(
        default_factory=list,
        description=(
            "0-5 targeted discovery questions. Return an EMPTY list when the "
            "decision is already specific and well-scoped. Otherwise ask only what "
            "is genuinely missing (budget, timeline, competition, regulation, "
            "existing capabilities)."
        )
    )


class IntakeResult(BaseModel):
    """The Chairman's first read of the user's input: is it a question to answer,
    or a decision to debate?"""

    kind: str = Field(
        description="'question' if the user is asking for information/an opinion; "
        "'decision' if they are proposing a choice for the board to weigh."
    )
    answer: str = Field(
        default="",
        description="When kind=='question': a direct, concrete answer using the "
        "company context (cite figures if present). Empty for decisions.",
    )
    suggested_decision: str = Field(
        default="",
        description="When kind=='question': ONE specific business decision the board "
        "could deliberate next, phrased as a decision. Empty for decisions.",
    )
    questions: list[str] = Field(
        default_factory=list,
        description="When kind=='decision' AND the decision is vague and not covered "
        "by the context: up to 3 discovery questions. Empty otherwise.",
    )


class BoardResult(BaseModel):
    """The complete output of a board meeting — what the API returns and the
    dashboard renders. Assembled by the orchestrator, not by any one advisor.
    """

    decision: str = Field(
        description="The business decision the board was convened to weigh."
    )
    round1_analyses: List[AdvisorResponse] = Field(
        default_factory=list,
        description="Round 1 — each advisor's independent take.",
    )
    round2_rebuttals: List[AdvisorResponse] = Field(
        default_factory=list,
        description="Round 2 — each advisor's response after reading the others.",
    )
    verdict: ChairmanVerdict = Field(
        description="Round 3 — the chairman's final synthesis."
    )
