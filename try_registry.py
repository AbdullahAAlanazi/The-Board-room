"""Scratch tester for the registry. Not part of the skeleton — delete anytime.
Run with:  PYTHONPATH=src .venv/bin/python try_registry.py
"""

from boardroom.base import BaseAdvisor
from boardroom.registry import register, registered_classes, get_advisors


@register
class DummyA(BaseAdvisor):
    name = "DummyA"
    persona = "A placeholder advisor for testing the registry."


@register
class DummyB(BaseAdvisor):
    name = "DummyB"
    persona = "Another placeholder advisor."


# These two should now be on the board, without anyone importing them by name.
print("registered classes:", [c.__name__ for c in registered_classes()])

advisors = get_advisors()
print("instantiated advisors:", [a.name for a in advisors])
