# Example rotations (central Iowa)

> These rotations are a **case study**, not a prescription. Agronomic evidence varies
> by soil, climate, market and management. Each card ends with the risks that a
> farmer or a local extension officer must review.

## Summary

| ID | Sequence | Main mechanism | Role in the comparison |
| --- | --- | --- | --- |
| R0 | Corn → soybean (2-year cycle) | Dominant baseline | Current rotation |
| R1 | Corn → soybean → oat + red clover (3-year cycle) | Diversity + N fixation | Legume alternative |
| R2 | Corn → soybean → wheat + rye (3-year cycle) | Winter cover | Erosion alternative |
| R3 | Corn → soybean → alfalfa → alfalfa (4–5-year cycle) | Deep root + N | Forage alternative |

All four are compared with the same indicators. If one cannot be computed, it is
marked as a gap; it is not invented.

---

## R0 — Corn–soybean (current)

**Sequence:** corn → soybean → corn → soybean.

**Why it is included:** it is the dominant rotation in Iowa and the reference against
which any change is measured. Without a baseline there is no comparison.

**Evidence:**
- Widely documented practice; CDL allows reconstructing the actual sequence.
- Alternating a grass and a legume breaks some pest cycles and reduces dependence on
  synthetic N compared with continuous corn.
- Sources: [Iowa State University Extension](https://crops.extension.iastate.edu/),
  [USDA NRCS — Soil Health](https://www.nrcs.usda.gov/conservation-basics/natural-resource-concerns/soil/soil-health).

**Benefits:**
- Liquid markets and standard machinery.
- Lower operational complexity than a rotation with three or four crops.
- Soybean adds N to the system and diversifies the sequence compared with continuous
  corn.

**Data gaps:**
- CDL does not say which tillage, variety or sowing date was used.
- There is no direct satellite data on compaction, organic matter or disease.
- Price and margin depend on the market and cannot be derived from the satellite.

**Risks for local review:**
- Pest and disease pressure associated with repeated alternation.
- Erosion and nutrient loss if there is bare soil in winter.
- Dependence on inputs and on the sowing window.

**Hypothesis for the model:** good on market and simplicity; worse on winter cover and
diversity. Erosion depends on management, not only on the sequence.

---

## R1 — Corn–soybean–oat + red clover

**Sequence:** corn → soybean → oat with red clover → corn.

**Why it is suggested:** it adds a small grain and a cover legume. It breaks the
corn–soybean alternation, covers the soil after the oat and can supply N to the
following corn.

**Evidence:**
- Small grains diversify the sequence and compete with weeds.
- Red clover fixes N and protects the soil; the credit depends on biomass and
  management.
- Sources: [USDA SARE — Cover Crops](https://www.sare.org/resources/cover-crops/),
  [Iowa State University Extension](https://crops.extension.iastate.edu/).

**Benefits:**
- Diversity of crops and of sowing/harvest dates.
- Living cover after the oat.
- Possible reduction of synthetic N and of erosion.
- Oat can have a forage or grain market.

**Data gaps:**
- Market and price of oat in the area.
- Establishment and persistence of red clover.
- Real N credit depending on biomass, climate and termination.
- Oat yield in the chosen county.

**Risks for local review:**
- Oat may have no buyer or insufficient margin.
- The clover must be terminated at the right time so it does not compete with corn.
- Water used by the cover may affect the following crop in dry years.
- Residual herbicides may prevent clover establishment.

**Hypothesis for the model:** better on soil and diversity; medium on water; the
market is the main unknown.

---

## R2 — Corn–soybean–wheat + rye

**Sequence:** corn → soybean → wheat with rye cover → corn.

**Why it is suggested:** wheat adds a winter cereal and rye covers the soil between
the harvest and the corn sowing. It tackles the problem of bare soil and erosion.

**Evidence:**
- Rye covers reduce erosion and runoff; the effect depends on biomass and termination
  date.
- Wheat as a winter cereal diversifies the sequence and can improve use of the sowing
  window.
- Sources: [USDA SARE — Cover Crops](https://www.sare.org/resources/cover-crops/),
  [USDA NRCS — Soil Health](https://www.nrcs.usda.gov/conservation-basics/natural-resource-concerns/soil/soil-health).

**Benefits:**
- Soil cover in winter and spring.
- Lower risk of erosion and nutrient loss.
- Weed suppression and residue input.
- Diversification of the sequence with a winter cereal.

**Data gaps:**
- Biomass and quality of the cover at field scale.
- Actual termination date and its effect on soil water.
- Market and profitability of wheat in Iowa.
- Interaction with herbicides and fertilisation.

**Risks for local review:**
- Rye can immobilise N if terminated late or with a high C/N ratio.
- Termination must coincide with the corn sowing window.
- Wheat needs a market and logistics that do not always exist.
- In dry years, the cover can use water the crop needs.

**Hypothesis for the model:** better on cover and erosion; water and market may
penalise it.

---

## R3 — Corn–soybean–alfalfa

**Sequence:** corn → soybean → alfalfa → alfalfa → corn (4–5 years).

**Why it is suggested:** alfalfa is a deep-rooted perennial legume. It can supply N,
improve soil structure and open a forage option.

**Evidence:**
- Perennial legumes fix N and leave root residue; the credit for the following crop
  depends on age and management.
- The deep root can improve infiltration and access to water in deep layers.
- Sources: [Iowa State University Extension](https://crops.extension.iastate.edu/),
  [Iowa State Ag Decision Maker](https://www.extension.iastate.edu/agdm/).

**Benefits:**
- N supply and reduced synthetic fertilisation.
- Improved soil structure, infiltration and cover.
- Forage option for livestock.
- Biological diversity and breaking of pest cycles.

**Data gaps:**
- Forage demand and local price.
- Establishment cost and risk of failure.
- N credit depending on alfalfa age.
- Water use and effect on the aquifer.

**Risks for local review:**
- Slow establishment, sensitive to drought.
- Needs a forage market or livestock; without it, the rotation is not viable.
- Machinery and management differ from corn/soybean.
- In dry years, alfalfa can compete for water.

**Hypothesis for the model:** better on soil and N; high uncertainty on market and
establishment.

---

## Priority matrix (hypotheses, not results)

| Priority | R0 | R1 | R2 | R3 |
| --- | --- | --- | --- | --- |
| Water | Medium | Medium | Medium | Medium-high |
| Soil health | Low-medium | High | High | High |
| Profitability | High | Medium | Medium | Medium |
| Operational risk | Low | Medium | Medium | High |
| Market | Very liquid | Limited | Limited | Depends on forage |

This table is for discussion, not for scoring. The model must compute each indicator
from data and show the uncertainty. If an indicator has no data, it is marked as a
gap.

---

## From mechanism to indicator

| Mechanism | Indicator | Source | How it is computed |
| --- | --- | --- | --- |
| Crop diversity | 4-year Shannon | CDL | Share of each crop in the window |
| Soil cover | Months with cover | CDL/NLCD | Count of months with crop or cover |
| N fixation | Years with legume | Rotation | Legume years × local credit |
| Erosion | Proxy of slope × rainfall × cover | SRTM + POWER | Normalise and combine |
| Water stress | Rainfall vs demand | POWER (+ OpenET) | Simplified, documented balance |
| Heat stress | Days > 32 °C | POWER | Count with configurable threshold |
| Frost | Days < 0 °C | POWER | Count with configurable threshold |
| Pest breaking | Years between same crop | CDL | Distance in the sequence |
| Soil | AWC and drainage | SSURGO | Weighted mean by component |
| Market | Price/volume or input | QuickStats/AMS/farmer | Qualitative or historical series |

## How to use it in the app

Each rotation must be rendered with the same structure:

1. **Why** (one sentence).
2. **Evidence** (mechanism + source + date).
3. **Benefits** (2–4 bullets).
4. **Gaps** (what is missing and how it affects).
5. **Local review** (what the farmer must check).

If a rotation lacks a section, the UI must show "no data" instead of inventing
content.
