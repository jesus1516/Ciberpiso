---
id: T-02
title: Translate documentation, pipeline and tests to English
model: sonnet
effort: medium
depends: []
files: ["README.md", "resources.md", "tools_available.md", "docs/**/*.md", "data/README.md", "app/README.md", "pipeline/**/*.py", "tests/**/*.py"]
maxAttempts: 2
timeoutMin: 120
---
## Goal
Everything in the repository is English for the international judges.

## Task
1. Translate to English: `README.md`, `docs/*.md`, `data/README.md`, `app/README.md`,
   `resources.md`, `tools_available.md`.
2. In `pipeline/**/*.py` and `tests/**/*.py`: translate docstrings, comments, printed messages
   and argparse help. Do NOT rename data columns, CSV/JSON keys, file names or function names
   that other files import, and do NOT change any computation. Strings that end up inside
   generated data files (for example rotation explanations in `data/rotation_content.json` or
   texts written by `calculator.py`) stay as they are in this ticket: list them in the report
   under "Handoff" so a later ticket can decide.
3. Keep tables, commands, paths and links working. Keep proper names (Andalucía, Antequera,
   SIGPAC, Junta de Andalucía) as they are.

## Acceptance criteria
- [ ] No Spanish prose left in the listed files (proper names and data keys excepted).
- [ ] `python3 -m pytest tests -q` gives the same result as before your change
      (baseline: 15 passed, 5 skipped, 20 errors because `data/processed/scenarios.csv` is not
      versioned). State before/after numbers in the report.
- [ ] `python3 -m py_compile` passes for every changed `.py` file.
