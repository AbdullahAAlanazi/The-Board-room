"""Advisor roster — import every advisor module here so @register fires.

When a teammate creates a new advisor file, they add one import line here.
That's the only "registration" step beyond the @register decorator itself.

Example: teammate adds legal.py → they add:
    from . import legal
"""

from . import cfo  # CFO advisor (example — replace/extend with real advisors)
