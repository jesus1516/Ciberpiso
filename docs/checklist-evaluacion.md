# Evaluation and demo checklist

The organisers do not publish a detailed rubric on the challenge page. This list is
based on the challenge requirements and on what a jury usually looks for at Space
Apps: a real problem, substantive use of Earth observation data, rigour, uncertainty
and communication.

> **Calculator status (14 Nov 2026):** it generates the five mandatory fields,
> sources/units per indicator, confidence, ties and custom constraints.
> `python3 pipeline/audit.py` gives **0 failures**. The app does not consume that JSON yet.

## Hard requirements

| Requirement | Where it is demonstrated | Evidence |
| --- | --- | --- |
| ≥ 3 rotations, including the current one | App comparison | R0 + R1 + R2 + R3 |
| Why it is suggested | Card of each rotation | Mechanism sentence |
| Evidence | Card + `docs/rotaciones.md` | Source and date |
| Benefits | Card | 2–4 bullets |
| Data gaps | Card + confidence panel | Explicit "No data" |
| Local review risks | Card | List of checks |
| Support tool | Notice + wording | "Does not replace..." |
| Users without geospatial training | Glossary + UI | Test with 2 people |
| Priorities and constraints | Sliders + profile | Demo screenshot |

## Product checklist

- [ ] At least 3 rotations can be compared at once.
- [ ] The current rotation is included and labelled.
- [ ] Each rotation has the five mandatory fields.
- [ ] Every number has a source, date and unit.
- [ ] There is a confidence indicator per recommendation.
- [ ] Gaps are shown, not hidden.
- [ ] The local review notice is visible.
- [ ] The glossary explains ET, NDVI, anomaly and water balance.
- [ ] The sliders change the ranking and the contribution is visible.
- [ ] The app works on mobile.
- [ ] The app works offline.
- [ ] The map has a legend and attribution.

## Data checklist

- [ ] The AOI is defined and documented.
- [ ] Every file is in `manifest.json`.
- [ ] Dates and units are normalised.
- [ ] `nodata` values are filtered.
- [ ] AOI coverage is computed.
- [ ] There is at least one cross-validation (POWER/PRISM, SSURGO/WSS, CDL/NAIP).
- [ ] Limitations are written down.
- [ ] There are no secrets in the repo.

## Demo script (3 minutes)

| Time | What to say | What to show |
| --- | --- | --- |
| 0:00–0:20 | The problem: rotations with incomplete data | Title and one sentence |
| 0:20–0:40 | The user and the decision | Farm profile |
| 0:40–1:40 | Demo: map, priorities, 3 rotations | Comparison |
| 1:40–2:10 | Evidence and gaps | R1/R2 card |
| 2:10–2:30 | Uncertainty and local review | Confidence and notices |
| 2:30–3:00 | Impact and next step | Closing |

**Tip:** do not read the screen. Tell the farmer's decision and use the UI as proof.

## Likely jury questions

**Why Iowa?**
Because public crop, soil, climate and water data coincide, and there is a satellite
signal. It is a reproducible case, not a generic example.

**Why these rotations?**
They cover three different mechanisms: diversity with a legume, winter cover and deep
roots. The current rotation is the baseline.

**What does space data add that a local CSV does not?**
Consistent, comparable series of climate, rainfall, moisture and vegetation; they also
allow scaling to regions without dense local data.

**How do you handle missing data?**
They are shown as gaps, lower the confidence and become a question for the farmer or
the agronomist. They are not filled with an assumption.

**Does this replace an agronomist?**
No. It orders options and makes the trade-offs explicit; the final decision is local.

**How did you validate?**
Rainfall against PRISM/CoCoRaHS, soil against WSS, crop against NAIP and a test with
two people outside the team. What was not validated is stated.

**Does it scale?**
The pipeline is reproducible per AOI. The limitation is the availability of local data
(CDL/SSURGO are US-only); for other countries the source has to change.

**What would you do with more time?**
Validate with an extension officer, add ET from OpenET/ECOSTRESS and test with real
farmers.

## Warning signs

- "The AI says that..." without an explanation.
- False precision: "reduces erosion by 30%" without a model or source.
- Promising plot scale with SMAP (9 km).
- Hiding that a data point is missing.
- Depending on a live API during the demo.
- More features than evidence.
- A pretty map without a comparison table.
- Not including the current rotation.

## Submission checklist

- [ ] README with purpose, demo and credits.
- [ ] `docs/` with sources, access, architecture and validation.
- [ ] `resources.json` updated.
- [ ] 3-minute video uploaded.
- [ ] Demo deployed and tested in airplane mode.
- [ ] Public repo or a link accessible to the jury.
- [ ] Licence and data attribution.
- [ ] Team credits.
- [ ] Link to the official challenge.

## Last minute

If one hour is left:

1. Freeze the data.
2. Record the video.
3. Test the demo offline.
4. Check that the five fields are in every rotation.
5. Do not add features.
