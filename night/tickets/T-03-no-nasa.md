---
id: T-03
title: Remove the word NASA from the repository and the web
model: sonnet
effort: medium
depends: ["T-01", "T-02"]
files: ["README.md", "resources.md", "resources.json", "tools_available.md", "docs/**/*.md", "data/README.md", "data/*.json", "data/processed/*.json", "app/README.md", "app/src/**", "app/index.html", "app/public/data/indicators_antequera.json", "pipeline/**/*.py", "pipeline/sql/**", "app/public/brand/*.svg", "app/public/brand/README.md", "data/rotation_content.json", "tests/**/*.py"]
maxAttempts: 2
timeoutMin: 90
---
## Goal
The hackathon rules do not allow mentioning the organiser's name. The word "NASA" (any case)
and direct references to it must disappear from text in the repository and from the web app.
Using their open data and tools is fine.

## Rules
- Remove or rephrase the WORD, not the resources. Keep URLs, hostnames, API endpoints and
  identifiers in code that point to real services (for example `gibs.earthdata.nasa.gov`,
  `power.larc.nasa.gov`) exactly as they are.
- Replace product names in prose neutrally: "NASA POWER" → "POWER (agroclimatology data)",
  "NASA GIBS" → "GIBS imagery service", "NASA Earthdata" → "Earthdata", "MODIS (NASA)" →
  "MODIS". Remove sentences such as "NASA does not endorse this project"; keep the data credits
  without the name (e.g. "Climate data: POWER Project, Langley Research Center").
- Generated JSON (`data/processed/indicators.json`, `app/public/data/indicators_antequera.json`,
  `data/manifest.json` descriptions): replace the word in human-readable string values only,
  never in URLs or keys; also change the producing code in `pipeline/` so a re-run does not
  bring it back.
- The brand assets: edit the TEXT inside `app/public/brand/*.svg` (e.g. "SPACE APPS CHALLENGE
  2026", "POWER · SOILGRIDS · MODIS · SIGPAC") and `app/public/brand/README.md`; the PNG/GIF/WEBP
  exports are images and stay as they are (list them in the report for the designers).
- Binary files and the official hackathon folders under `docs/[...]` (PDF/PNG whose names
  contain the word) are a human decision: do not touch them, list them in the report.

## Acceptance criteria
- [ ] `git grep -niI "nasa" -- . ':!night'` only returns URLs/hostnames/identifiers of real
      services (list each remaining match type in the report) plus the ignored binary folders.
      The `night/` tooling is exempt (its contracts must name the word); it is cleaned up when
      the night shift is retired.
- [ ] The web app shows the word nowhere (search `app/src` and `app/index.html`).
- [ ] Calculator check still 0 differences; build passes.
