"""Runnable entry point for the AI Board Room.

Usage:
    PYTHONPATH=src .venv/bin/python -m boardroom.main
    PYTHONPATH=src .venv/bin/python -m boardroom.main "your decision here"
"""

from __future__ import annotations

import sys

from boardroom.board import run_board


def main():
    if len(sys.argv) > 1:
        decision = " ".join(sys.argv[1:])
    else:
        decision = input("Enter a business decision: ").strip()
        if not decision:
            print("No decision entered. Exiting.")
            return

    print(f"\nConvening the board on: '{decision}'")
    print("=" * 60)

    result = run_board(decision)

    print("\n" + "=" * 60)
    print("BOARD RESULT")
    print("=" * 60)

    print("\n── Round 1: Independent Analysis ──")
    for r in result.round1_analyses:
        print(f"  {r.advisor}: [{r.vote.value.upper()}] {r.rationale}")

    print("\n── Round 2: Rebuttals ──")
    for r in result.round2_rebuttals:
        print(f"  {r.advisor}: [{r.vote.value.upper()}] {r.rationale}")

    print("\n── Chairman's Verdict ──")
    v = result.verdict
    print(f"  Recommendation : {v.recommendation}")
    print(f"  Confidence     : {int(v.confidence * 100)}%")
    print(f"  Conflicts      : {', '.join(v.conflicts)}")
    print(f"  Next steps     :")
    for step in v.next_steps:
        print(f"    - {step}")


if __name__ == "__main__":
    main()
