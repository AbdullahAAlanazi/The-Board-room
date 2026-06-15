"""Run a board meeting and dump the BoardResult as JSON for the presentation UI.

Usage:
    PYTHONPATH=src python scripts/export_result.py "Should we open a branch in Jeddah?" > presentation/sample_result.json
"""
from __future__ import annotations

import contextlib
import json
import sys

from boardroom.board import run_board


def main() -> None:
    decision = " ".join(sys.argv[1:]).strip() or "Should we open a new branch in Jeddah?"
    # run_board prints progress to stdout; redirect it to stderr so only JSON
    # lands on stdout.
    with contextlib.redirect_stdout(sys.stderr):
        result = run_board(decision)
    # Pydantic v2 -> plain JSON-able dict (enums become their .value)
    sys.stdout.write(
        json.dumps(result.model_dump(mode="json"), ensure_ascii=False, indent=2)
    )


if __name__ == "__main__":
    main()
