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
from typing import List

from pydantic import BaseModel, Field


class Vote(str, Enum):
    """How an advisor lands on the decision. A plain str-enum so it
    serializes to clean JSON ("for" / "against" / "neutral")."""

    FOR = "for"
    AGAINST = "against"
    NEUTRAL = "neutral"


class AdvisorResponse(BaseModel):
    """One advisor's contribution in one round of the debate.

    THIS is the contract a teammate's advisor must produce. If every advisor
    returns exactly this, the orchestrator can run any number of them without
    knowing anything about who they are.
    """

    advisor: str = Field(
        description="The advisor's name/role, e.g. 'CFO' or 'Legal'."
    )
    vote: Vote = Field(
        description="This advisor's stance on the decision."
    )
    rationale: str = Field(
        description="One-line justification for the vote — short and punchy."
    )
    reasoning: str = Field(
        description="The fuller argument: the analysis behind the vote."
    )


class Stance(str, Enum):
    """The chairman's final call on the decision itself."""

    PROCEED = "proceed"         # go ahead
    AGAINST = "against"         # do not
    CONDITIONAL = "conditional" # go ahead, but only if conditions are met


class ChairmanVerdict(BaseModel):
    """The chairman's synthesis after weighing every advisor's argument."""

    stance: Stance = Field(
        description="The final call: proceed, against, or conditional. This is a "
        "synthesis of the arguments — NOT a majority vote count. You may overrule "
        "the majority if the stronger arguments point the other way.",
    )
    board_note: str = Field(
        description="ONE sentence explaining how your call relates to the advisors' "
        "votes — especially if you went against the majority, say why (e.g. their "
        "objections were conditional, not absolute).",
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
        description="The key points where advisors disagreed.",
    )
    next_steps: List[str] = Field(
        default_factory=list,
        description="Concrete next actions for the leader.",
    )


class DiscoveryResult(BaseModel):
    """Questions the Chairman asks before the board convenes — to surface context
    that will sharpen the debate. The API returns this from /api/discover."""

    questions: list[str] = Field(
        description=(
            "2-5 targeted, open-ended discovery questions. "
            "Each must target a different unknown (budget, timeline, competition, "
            "regulation, existing capabilities). Skip anything the decision already answers."
        )
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
