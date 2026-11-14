# Validation and limitations

> Validation done on 14 November 2026 on the real Málaga data. Only the water score
> is validated. Soil, risk and price remain expert rules and have no independent
> label to check them against.

## What was checked

| Claim | Source | Method | Result | Confidence |
| --- | --- | --- | --- | --- |
| The water score separates good and bad years | POWER + MODIS | 360 farm-seasons, leave-one-municipality-out validation | AUC 0.723; Spearman 0.494 with Jun–Aug NDVI | Medium |
| Water deficit (rain − ET0) predicts better than rain alone | POWER | Comparison with the old model | AUC 0.627 → 0.723 | Medium |
| The model does not depend on a particular municipality | POWER + MODIS | Leave-one-municipality-out (12 municipalities) | AUC 0.727 → 0.778 | Medium |
| The satellite arable class is useful for validation | MODIS | Negative control | AUC 0.54; no signal | Low |
| Soil, risk and price | — | No independent label | Not validated | Low |

## Validation data

- **360 rows** = 60 candidate farms × 6 seasons (2020–2025).
- **12 municipalities**, with Antequera, Campillos, Teba and Fuente de Piedra as the
  main groups.
- Main label: `exito_estival`, June–August NDVI ≥ 0.33 (44/360, 12%).
- Negative control: `clase_arable`, winter or summer herbaceous class (219/360, 61%).
  It is the balanced label, but it **does not discriminate**: AUC 0.54. That is why it
  is not used for calibration.

## Results

Old model: the water score depended only on rainfall and saturated above 450 mm. New
model: it uses the annual water deficit (`rain − ET0`).

| Metric | Rain | Water deficit |
| --- | --- | --- |
| AUC with `exito_estival` | 0.627 | **0.723** |
| Spearman with Jun–Aug NDVI | 0.256 | **0.494** |
| Spearman with maximum NDVI | 0.250 | **0.386** |
| AUC leaving one municipality out | 0.727 | **0.778** |
| Balanced accuracy leaving one municipality out | 0.680 | **0.734** |
| Best success threshold | 60.0 | 62.7 |
| Balanced accuracy at that threshold | 0.622 | **0.689** |

The improvement exceeds the minimums set in advance (AUC +0.05, Spearman +0.05 and
LOMO +0.03), so the deficit model is adopted with a reference of **900 mm**. That
reference only sets the scale: it is not fitted to the label and does not change the
order of the farms.

## Compliance audit

`python3 pipeline/audit.py` checks the complete output:

- 60 farms, 240 rotations and 960 indicators.
- 4/4 rotations ranked in the 3 profiles of the 60 farms, with no empty places.
- The five mandatory fields per rotation: why, evidence, benefits, gaps and local
  review risks.
- Source, date, unit, confidence and gap on every indicator.
- Consistent rankings: ties share a place and rotations with incomplete data are not
  ranked.
- Support-tool notice, glossary and sources in the JSON.

Current result: **0 failures**. R1 and R2 are no longer clones: vetch gives more
erosion protection and organic matter than chickpea. R2 uses the national grain vetch
price from MAPA (€48.79/100 kg in 2024) and is comparable; the limitation is that
there is no local market (lonja) price or Eurostat series.

## Decision on thresholds

The viability thresholds stay at **20 (block) and 40 (warning)**. The threshold that
maximises balanced accuracy (62.7) would change with any rescaling of the score, is
not stable across municipalities and the score is not a probability. It is documented
as a diagnostic, not used as a cut-off.

## What was not validated

- **Soil:** there is no independent soil quality label. The formula uses clay, pH and
  available water, but it is not checked against yield.
- **Risk:** it depends on heat, frost and drought; there is no series of observed
  damage.
- **Price:** Eurostat gives an annual national price for wheat, sunflower and chickpea;
  MAPA gives national annual grain vetch (2014–2024). There is no local lonja or
  provincial price. Without yields or costs a margin cannot be validated; the score is
  called “price/market”, not profitability.
- **Observed rotation:** `rotacion_estimada` is a 250 m NDVI estimate, not a declared
  crop. It does not tell wheat from sunflower or vetch from chickpea; the R1/R2
  separation comes from the crop parameters, not from the satellite.
- **Sample:** 60 farms and 44 summer successes. The confidence intervals are wide; the
  results are a signal, not definitive proof.

## What is missing for real validation

- Review with a local agronomist or extension officer.
- Management data: tillage, variety, sowing and harvest dates.
- Yields and costs per season.
- Declared crop from SIGPAC or an equivalent source.
- Field measurement or local sensor in at least one season.

## Reproduce

```bash
python3 pipeline/prepare_inputs.py   # 360 scenarios
python3 pipeline/calibrate.py        # metrics and decision
python3 pipeline/calculator.py       # indicators.json
python3 -m unittest discover -s tests -v
```

## Log

- **Date:** 2026-11-14
- **Data:** 60 candidates, seasons 2020–2025, Eurostat 2000–2024.
- **Decision:** adopt water deficit; keep thresholds 20/40.
- **Artefacts:** `data/calibration.json`, `data/processed/validation.json`.
