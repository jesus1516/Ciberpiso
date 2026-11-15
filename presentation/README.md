# AgroSpace — presentation

7-slide deck for the Space Apps Challenge 2026 (Málaga) judges. No embedded video: the demo is shown with GIFs recorded from the live app, and the last slide has a QR code to it.

| File | What it is |
|---|---|
| `AgroSpace-ES.pptx` | **The deck to present (Spanish).** Opens with the problem; 2–3 min script in the speaker notes |
| `AgroSpace-ES-backup.pdf` | Static backup (still frames instead of GIFs) in case the room computer fails |
| `AgroSpace-EN.pptx` / `AgroSpace-EN-backup.pdf` | Earlier English version (previous slide order: title first, rigour slide) |

QR → https://agrospace-w8ej.onrender.com/

## Presenting

- Open it in **PowerPoint** (Windows or Mac, 2019 / Microsoft 365) and start the slideshow. Animations start on their own; click only to change slide.
- Morph needs PowerPoint 2019 or later. Keynote, LibreOffice and older versions fall back to a fade, and Keynote may show the GIFs as still images; the first frame of every GIF is readable on its own.
- Speaker notes (about one minute per slide) are in each slide's notes.
- Fonts are Georgia and Calibri, installed with Office, so nothing needs embedding.

## Slides (Spanish deck, ~2 min 20 s)

1. Hook — *la España vacía*: 3,834 municipalities lost population in 2023 alone (INE, Censo Anual de Población 1-1-2024) [~20 s]
2. The problem: a dryland farm in Antequera, 453 mm average rain, 302 mm in 2023, 792 mm water deficit; sowing blind [~25 s]
3. The reveal: AgroSpace, *From territory to farm* [~10 s]
4. The solution: Andalucía → Málaga → municipality → farm (cloud dive GIF) [~20 s]
5. The demo: landing on the farm in 3D [~20 s]
6. The decision: R0–R3 for farm 29:15:2:18 (R1 + chickpea, 70.1 vs 67.3) and the validated water score (AUC 0.723 vs 0.627) [~30 s]
7. QR to the live demo and team credits [~15 s]

## Rebuilding (`source/`)

The deck is generated with [PptxGenJS](https://github.com/gitbrent/PptxGenJS); transitions and animations are injected into the OOXML afterwards, because PptxGenJS cannot write them.

```bash
npm install pptxgenjs@3.12.0
node build.js                         # → build/agrospace-base.pptx (STATIC=1 for the backup version)
python3 tools/animate.py build/agrospace-base.pptx anim.json AgroSpace-ES.pptx
```

- `build.js` is the current Spanish deck. `build-en.js` and `tools/make_en.py` belong to the earlier English version and no longer match `build.js`.
- `anim.json` sets each slide's transition and entrance animations. Slides with Morph have no entrance animations on purpose: PowerPoint shows the end state during Morph, so an entrance effect would make the shape appear, vanish and animate in again.
- Shapes named `!!logo`, `!!mapa`, `!!frame` are matched by Morph across consecutive slides.
- `tools/record.py` records the demo with Playwright and `tools/mkgif.sh` turns the clips into GIFs (ffmpeg palette + `gifsicle --lossy`). Images and GIFs are not stored here: they are inside the `.pptx` (`ppt/media/`).
