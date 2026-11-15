# AgroSpace — presentation

7-slide deck for the Space Apps Challenge 2026 (Málaga) judges. No embedded video: the demo is shown with GIFs recorded from the live app, and the last slide has a QR code to it.

| File | What it is |
|---|---|
| `AgroSpace-EN.pptx` | **The deck to present (English).** Morph transitions, entrance animations, GIFs, speaker notes |
| `AgroSpace-ES.pptx` | Same deck in Spanish |
| `AgroSpace-EN-backup.pdf` / `AgroSpace-ES-backup.pdf` | Static backup (still frames instead of GIFs) in case the room computer fails |

QR → https://agrospace-w8ej.onrender.com/

## Presenting

- Open it in **PowerPoint** (Windows or Mac, 2019 / Microsoft 365) and start the slideshow. Animations start on their own; click only to change slide.
- Morph needs PowerPoint 2019 or later. Keynote, LibreOffice and older versions fall back to a fade, and Keynote may show the GIFs as still images; the first frame of every GIF is readable on its own.
- Speaker notes (about one minute per slide) are in each slide's notes.
- Fonts are Georgia and Calibri, installed with Office, so nothing needs embedding.

## Slides

1. Title: animated logo, *From territory to farm*
2. The problem: dryland farm in Antequera (453 mm rain, 792 mm deficit)
3. The solution: Andalucía → Málaga → municipality → farm (cloud dive GIF)
4. The demo: landing on the farm in 3D (relief, orthophoto, soil, crops)
5. The decision: R0–R3 with real scores for farm 29:15:2:18 (R1 + chickpea wins, 70.1 vs 67.3)
6. The rigour: data sources, water-score AUC 0.723 vs 0.627, 0 app/pipeline differences, confidence shown per rotation
7. QR to the live demo and team credits

## Rebuilding (`source/`)

The deck is generated with [PptxGenJS](https://github.com/gitbrent/PptxGenJS); transitions and animations are injected into the OOXML afterwards, because PptxGenJS cannot write them.

```bash
npm install pptxgenjs@3.12.0
node build-en.js                     # → build/agrospace-en-base.pptx (STATIC=1 for the backup version)
python3 tools/animate.py build/agrospace-en-base.pptx anim.json AgroSpace-EN.pptx
```

- `build.js` is the Spanish source; `tools/make_en.py` regenerates `build-en.js` from it, failing if any string to translate is missing.
- `anim.json` sets each slide's transition and entrance animations. Slides with Morph have no entrance animations on purpose: PowerPoint shows the end state during Morph, so an entrance effect would make the shape appear, vanish and animate in again.
- Shapes named `!!logo`, `!!mapa`, `!!frame` are matched by Morph across consecutive slides.
- `tools/record.py` records the demo with Playwright and `tools/mkgif.sh` turns the clips into GIFs (ffmpeg palette + `gifsicle --lossy`). Images and GIFs are not stored here: they are inside the `.pptx` (`ppt/media/`).
