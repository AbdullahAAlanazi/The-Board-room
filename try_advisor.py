"""Scratch tester for the BaseAdvisor chain. Not part of the skeleton —
delete it whenever. Run with:  PYTHONPATH=src .venv/bin/python try_advisor.py
"""

from boardroom.base import BaseAdvisor


class TestCFO(BaseAdvisor):
    name = "CFO"
    persona = (
        "You obsess over ROI, cash flow, and risk-adjusted return. "
        "You are skeptical of spending without a clear 12-month payback."
    )


cfo = TestCFO()
r = cfo.analyze("Should we open a new branch in Jeddah next quarter?")

print("advisor :", r.advisor)
print("vote    :", r.vote.value)
print("rationale:", r.rationale)
print("reasoning:", r.reasoning)
