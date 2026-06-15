# AI Board Room

A multi-agent decision-support tool. Submit a business decision and a virtual board of AI advisors analyzes it, debates across three rounds, and a chairman synthesizes a final recommendation.

## How it works

1. **Round 1** — each advisor independently analyzes the decision through their own lens
2. **Round 2** — advisors read each other's positions and respond
3. **Round 3** — the chairman weighs all arguments and produces a recommendation with a confidence score

## Setup

```bash
git clone https://github.com/AbdullahAAlanazi/The-Board-room.git
cd The-Board-room
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # add your OPENAI_API_KEY
```

## Run

```bash
PYTHONPATH=src python -m boardroom.main "Should we open a new branch in Jeddah?"
```

## Adding an advisor (teammates)

1. Copy `src/boardroom/advisors/cfo.py` → create `legal.py`, `market.py`, etc.
2. Change `name`, `persona`, and `focus` — that's all
3. Add one line to `src/boardroom/advisors/__init__.py`:
   ```python
   from . import legal
   ```

Do not edit `base.py`, `registry.py`, `schema.py`, or `board.py`.

## Project structure

```
src/boardroom/
├── schema.py        # shared data contract (AdvisorResponse, BoardResult)
├── base.py          # BaseAdvisor — subclass this to build an advisor
├── registry.py      # advisor auto-discovery
├── board.py         # 3-round orchestrator
├── main.py          # CLI entry point
└── advisors/
    ├── __init__.py  # advisor roster — add your import here
    └── cfo.py       # example advisor
```

## Workstreams

| Workstream | Build on |
|------------|---------|
| Advisors (Legal, Market, Customer) | copy `advisors/cfo.py` |
| RAG / context layer | inject a ChromaDB retriever into `BaseAdvisor.retriever` |
| Backend API | wrap `run_board()` in a FastAPI endpoint |
| Frontend | consume the `BoardResult` JSON schema |
