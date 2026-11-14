# Action plan

> Agreed on 14 November 2026. Replaces the Iowa case with a rainfed farm in the
> Campiña de Antequera (Málaga). It is the reference for updating the rest of the
> documents.

## The idea

The project has good research, but no data or application yet. We need to move from
documents to a small demonstration.

The tool does not analyse all of Andalucía: it analyses **one farm**. In Antequera, a
typical farm of 150–250 ha has between **5 and 20 plots**, which is perfectly
manageable.

## The case

A rainfed farm in the Campiña de Antequera, with wheat and sunflower. We compare
four ways of alternating the crops:

| ID | Rotation | Role |
| --- | --- | --- |
| R0 | Wheat–sunflower | The current one |
| R1 | Wheat–sunflower–chickpea | Legume |
| R2 | Wheat–sunflower–vetch | Cover crop / forage |
| R3 | Wheat–sunflower–fallow | Water conservation |

For each one we compute how much water it needs, how much it protects the soil, what
risk it carries in a dry year and what market it has. We use climate data from POWER,
the public catalogue of plots and crops of Andalucía, soil maps and public prices.

## The result

A simple page with four cards, a map and a clear explanation of what we know and what
we do not. The app would work without internet during the demo.

## First step

1. Confirm the Antequera farm (150–250 ha, 5–20 plots).
2. Download the climate and the crop history.
3. Compute the table of the four rotations.
4. Build the application on top of that table.

## Changes from the previous plan

- The Iowa case becomes Antequera.
- The corn–soybean–oat–alfalfa rotations become wheat–sunflower and alternatives.
- SSURGO, CDL, PRISM and QuickStats become SIGPAC, Andalucía soil data or SoilGrids,
  AEMET/SIAR and Lonja/MAPA.
- POWER and GIBS are kept.
- The architecture, the scoring engine and the app are reused.

## Status

- [ ] Farm and AOI confirmed.
- [ ] Climate and crop history downloaded.
- [ ] Indicator table computed.
- [ ] App built.
- [ ] Demo rehearsed offline.
