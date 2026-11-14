# Step-by-step guide (48 h)

This guide assumes a team of 3–4 people and a weekend hackathon. The times are
indicative; what matters is the order and the deliverables.

## Golden rule

Do not start with the UI or with an AI model. First fix the use case, the rotations
and the data. If by Saturday afternoon you do not have a rotation table with
evidence, the demo will be a mock-up.

Each phase ends with a concrete deliverable and a "done" criterion. If it is not
met, do not move on to the next one.

---

## Phase 0 — Scope and use case (2–3 h)

**Goal:** choose a place, a farm profile and a concrete decision.

### Tasks

1. **Choose a US county.** Recommended: central Iowa (for example Story, Boone or
   Marshall). Reason: CDL, SSURGO, PRISM, NAIP and NWIS coincide, and there is a
   satellite signal. Do not choose a country without soil or crop data.
2. **Define a farm profile.** Example: 200 ha, rainfed, silt loam soil, corn–soybean
   rotation, no livestock, no-till seeding machinery.
3. **Define the decision.** "Which rotation do I propose for the next 3–4 years if my
   priority is X?" Not "predict the yield".
4. **Fix the constraints.** Available water, machinery, market, labour, sowing
   window, risk tolerance.
5. **Write the scope on one page.** Template:

```text
AOI: bbox and county
Profile: area, soil, climate, irrigation, machinery
Current rotation: ...
Alternatives: ...
Priorities: water / soil / profitability / risk
Constraints: ...
Decision supported: ...
Out of scope: ...
```

### Deliverable

`docs/alcance.md` with the template filled in.

### "Done" criterion

Any team member can explain in 30 seconds: who the user is, what decision they make
and which three rotations are compared.

---

## Phase 1 — Rotations and evidence (3–4 h)

**Goal:** turn agronomy into a comparable table, not a list of slogans.

### Tasks

1. **Define the current rotation.** In Iowa: corn–soybean.
2. **Define three alternatives.** One per mechanism:
   - **Diversity with a small grain + legume:** corn–soybean–oat + red clover.
   - **Winter cover:** corn–soybean–wheat + rye as a cover crop.
   - **Deep legume:** corn–soybean–alfalfa (2–3 years).
3. **Fill in one sheet per rotation** with the five fields the challenge requires:
   - Why it is suggested.
   - What evidence backs it (mechanism + source).
   - What benefits it offers.
   - Where there are data gaps.
   - What risks require local review.
4. **Separate what is computable from what is qualitative.** Do not invent a number
   for the market or for pest breaking if you have no data.
5. **Use the template in [rotaciones.md](rotaciones.md).**

### Deliverable

Table with 4 rotations × 5 fields, plus a list of indicators.

### "Done" criterion

Each rotation has at least two cited sources and one honest sentence saying "we
cannot compute this with the available data".

---

## Phase 2 — Minimum data and access (4–6 h)

**Goal:** have a downloaded, reproducible AOI, not a list of links.

### Tasks

1. **Choose the minimum package without credentials:**

   | Data | Source | What for |
   | --- | --- | --- |
   | Daily climate | POWER | Rain, temperature, frost, radiation |
   | Soil | SSURGO via Soil Data Access | Texture, drainage, water retention |
   | Land cover | NLCD | Context and baseline |
   | Base map and layers | GIBS WMTS | Visualisation |
   | Historical crop | CDL | Current rotation and diversity |
   | Local climate | PRISM | Cross-check with POWER |
   | Surface water | NWIS | Basin context |

2. **Verify each endpoint** with the commands in [acceso-datos.md](acceso-datos.md).
   Save the HTTP code and the date.
3. **Download the AOI** and store it in `data/raw/{source}/`.
4. **Write a manifest** with URL, date, bbox, variable and hash.
5. **Do not put secrets in the repo.** If you use Earthdata, CDS or an API key, use
   environment variables or `~/.netrc`.

### Deliverable

`data/raw/` + `data/manifest.json` + a script that reproduces the download.

### "Done" criterion

Another person can delete `data/raw/`, run one command and obtain the same files. You
know what is cached and what is not.

---

## Phase 3 — Pipeline and harmonisation (8–10 h)

**Goal:** go from raw files to indicators per rotation, with units and provenance.

### Tasks

1. **Fix a common grid.** For Iowa, `EPSG:5070` (Albers, equal area). Resolution:
   - 30 m for soil, cover and slope.
   - 250 m for aggregated climate.
   - Do not resample the fine to the coarse to "improve" the climate; aggregate the
     coarse towards the fine only for visualisation.
2. **Clip, reproject and aggregate.** Document the method: area-weighted mean,
   nearest neighbour or bilinear. Do not mix methods without saying so.
3. **Compute indicators.** Proposal:

   | Indicator | Calculation | Source | Type |
   | --- | --- | --- | --- |
   | Season rainfall | Sum of `PRECTOTCORR`, Apr–Sep | POWER | Modelled observation |
   | Heat days | Days with `T2M_MAX` > 32 °C | POWER | Configurable threshold |
   | Frost days | Days with `T2M_MIN` < 0 °C | POWER | Configurable threshold |
   | Water retention | SSURGO AWC, weighted by component | SSURGO | Soil proxy |
   | Slope | SRTM or 3DEP, mean and p90 | SRTM | Observation |
   | Cover | Months with living cover or residue | CDL/NLCD | Proxy |
   | Diversity | Shannon index of crops over 4 years | CDL | Computable |
   | Erosion risk | Slope × rainfall intensity × cover factor | SRTM + POWER | Proxy, not RUSLE |
   | Legume N | Years with legume × local credit | Rotation + literature | Qualitative |
   | Market fit | Price/volume or farmer's answer | QuickStats/AMS or input | Qualitative |

4. **Quality controls:** units, `nodata`, range, AOI coverage and dates.
5. **Write `data/processed/indicators.json`** with one record per rotation and
   indicator, including `source`, `date`, `unit` and `confidence`.

### Deliverable

Executable pipeline + `indicators.json` + `map.geojson`.

### "Done" criterion

Every number in the app can be traced to a source, a date and a formula. If you
cannot explain an indicator in one sentence, remove it.

---

## Phase 4 — Recommendation model (6–8 h)

**Goal:** rank the rotations according to the farmer's priorities, with an
explanation that fits on a card.

### Tasks

1. **Start with rules, not machine learning.** A black-box model cannot be defended
   in 48 h.
2. **Normalise each indicator to 0–1** across the compared rotations. Invert those
   that are "less is better" (erosion, frost days).
3. **Weight according to priorities.** Example:

   ```text
   score(rotation) = 0.35·water + 0.30·soil + 0.20·profitability + 0.15·risk
   ```

   The weights come from the farmer's sliders and must sum to 1.
4. **Compute confidence** as `data_coverage × evidence_strength`. If CDL or SSURGO is
   missing, lower the confidence; do not hide it.
5. **Show the contribution of each indicator.** The user must see what pushes the
   recommendation up and what holds it back.
6. **Test three profiles:** water priority, soil priority, market priority. If the
   ranking changes, explain why.

### Deliverable

Pure function `score(rotation, profile) -> recommendation` with tests.

### "Done" criterion

For each rotation you can say: "it ranks high because of A and B, drops because of C,
and one data point is missing: D". Without that sentence, the model is not ready.

---

## Phase 5 — Interface (10–12 h)

**Goal:** a farmer understands the comparison without knowing what a pixel is.

### Tasks

1. **Main screen:** map on the left, rotation cards on the right.
2. **Priorities bar:** water, soil, profitability, risk. Simple sliders.
3. **Comparison:** select 2–3 rotations and show a side-by-side table.
4. **Rotation sheet:** the five mandatory fields, always visible:
   - Why it is suggested.
   - Evidence.
   - Benefits.
   - Data gaps.
   - Risks for local review.
5. **Plain-language glossary:** evapotranspiration, NDVI, anomaly, water balance,
   difference between satellite and field.
6. **Permanent notice:** "Support tool; does not replace local review".
7. **Accessibility:** keyboard, contrast, do not rely on colour alone, alternative
   texts on the map.
8. **Mobile:** the demo can be done on a laptop, but the sheet must be readable on a
   phone.

### Deliverable

Deployed app with precomputed data.

### "Done" criterion

A person outside the team opens the app and explains in under 2 minutes why one
rotation is ahead of another.

---

## Phase 6 — Validation and evidence (3–4 h)

**Goal:** know what you claim and what you do not.

### Tasks

1. **Sensitivity test:** move the weights and check whether the ranking changes too
   much. If everything changes with any adjustment, the model is fragile.
2. **Cross-check with local sources:** compare POWER rainfall with PRISM and, if
   available, with CoCoRaHS. Compare the crop calendar with CDL.
3. **Test with two people** outside the team. Note what they do not understand.
4. **Write `docs/validacion.md`:** what was checked, what was not, what is missing and
   what it would take to validate with an agronomist.
5. **Review the claims.** Change "this rotation reduces erosion by 30%" to "this
   rotation adds winter cover; the effect on erosion depends on slope and
   management".

### Deliverable

`docs/validacion.md` + list of limitations in the app.

### "Done" criterion

You can defend every number and every recommendation without exaggerating.

---

## Phase 7 — Demo and submission (3–4 h)

**Goal:** a 3-minute demo that works without a network.

### Script

| Time | What |
| --- | --- |
| 0:00–0:20 | The problem: rotation decisions with incomplete data. |
| 0:20–0:40 | The user and the decision: Iowa farm, water priority. |
| 0:40–1:40 | Demo: map, priorities, comparison of 3 rotations. |
| 1:40–2:10 | Evidence: source, date, benefit and gap of each one. |
| 2:10–2:30 | Uncertainty and local review. |
| 2:30–3:00 | Impact, limits and next step. |

### Tasks

1. **Freeze the data.** Tiles, JSON and screenshots stored locally. No live APIs.
2. **Prepare a plan B:** recorded video and screenshots in case the laptop fails.
3. **Clean the repo:** README, licence, credits, `.env.example`, instructions.
4. **Check the list in [checklist-evaluacion.md](checklist-evaluacion.md).**
5. **Rehearse twice with a timer.**

### "Done" criterion

The demo runs in airplane mode and the talk covers the four hard requirements.

---

## 48 h schedule

| Moment | Phase | Deliverable |
| --- | --- | --- |
| Friday night | 0–1 | Scope + rotation table |
| Saturday morning | 2 | Data downloaded and cached |
| Saturday afternoon | 3 | Indicators and base map |
| Saturday night | 4 | Scoring engine with tests |
| Sunday morning | 5 | UI and sheets |
| Sunday noon | 6 | Validation and limitations |
| Sunday afternoon | 7 | Demo, video and submission |

## If time runs out

Order of priority:

1. Three rotations with the five fields.
2. Map with real data and provenance.
3. Explainable comparison.
4. Uncertainty and local review.
5. Everything else: live data, ML, market, animations.

A small, honest demo is better than a huge dashboard without evidence.
