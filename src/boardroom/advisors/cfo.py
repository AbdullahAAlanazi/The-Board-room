"""CFO Advisor — example advisor for teammates to copy.

To build your own advisor:
  1. Copy this file, rename it (e.g. legal.py, market.py, customer.py)
  2. Rename the class (e.g. LegalAdvisor, MarketAdvisor, CustomerAdvisor)
  3. Change name, persona, and focus to match your advisor's role
  4. Add the file's import to advisors/__init__.py so it gets registered
  5. That's it — the chain, retrieval, and schema handling are already done

DO NOT edit base.py, registry.py, or schema.py.
"""

from __future__ import annotations

# --- Boardroom imports (do not change these) ---
from boardroom.base import BaseAdvisor
from boardroom.registry import register


@register  # this line puts the advisor on the board — do not remove it
class CFOAdvisor(BaseAdvisor):
    # ------------------------------------------------------------------ #
    # CHANGE THESE THREE THINGS — everything else is handled for you      #
    # ------------------------------------------------------------------ #

    # The label shown in the debate and the final report
    name = "CFO"

    # The personality that drives every response.
    # Be specific about the advisor's priorities, biases, and blind spots.
    # The more distinct this is from the other advisors, the better the debate.
    persona = (
        "You are the CFO. Your sole priority is financial health: ROI, "
        "cash flow, and risk-adjusted return. You are deeply skeptical of "
        "any spending that does not have a clear 12-month payback. You push "
        "back hard on optimistic revenue projections and always ask: "
        "'What is the cost of failure?' and 'What is the 12-month return?' "
        "You are the voice of financial discipline on this board."
    )

    # Keywords that bias your advisor's document search toward its expertise.
    # When the RAG layer is live, this advisor will search company docs for
    # chunks related to these topics. Leave empty if no domain focus needed.
    focus = "ROI revenue cost cash flow budget payback financial risk investment"

    # ------------------------------------------------------------------ #
    # NOTHING BELOW THIS LINE NEEDS CHANGING                              #
    # The analyze() method, the chain, and the retrieval seam are         #
    # all inherited from BaseAdvisor.                                     #
    # ------------------------------------------------------------------ #
