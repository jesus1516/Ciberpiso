---
id: T-05
title: Performance on slow computers
model: opus
effort: high
depends: ["T-04", "T-09"]
files: ["app/src/**", "app/vite.config.ts", "app/index.html", "app/package.json", "app/package-lock.json", "app/e2e/perf*", "docs/performance.md"]
maxAttempts: 2
timeoutMin: 180
---
## Goal
Users reported that the web feels slow and laggy on some computers. Measure, then fix the real
bottlenecks without losing the experience.

## Task
1. Measure first, with Playwright + Chrome DevTools Protocol, on a production build with CPU
   throttling ×4 and a "Fast 3G"-like network: time to interactive at Andalucía, each
   transition's frame rate (long frames > 50 ms), time to open Antequera (29015, the largest
   municipality) and to open farm 2900059683, main-thread long tasks, JS heap. Save the script
   as `app/e2e/perf.spec.ts` (or `perf.mjs`) and the numbers in `docs/performance.md`.
2. Known suspects to verify (fix only what the numbers confirm):
   - `lib/detalle.ts` parses the whole municipality detail file (up to 1.5 MB gzip, ~15 MB
     JSON) on the main thread → move decompression + parse to a Web Worker (if the data file
     format must change, do not regenerate data: write it under Handoff).
   - GeoJSON tiling of tens of thousands of farms in the MapLibre worker (see the comments in
     `explorer/controller.ts`); hillshade layer cost; map `pixelRatio` on high-DPI screens.
   - Main bundle size (~390 kB gzip): MapLibre, React, recharts already split; check for more.
   - 3D view: shadow map, terrain mesh resolution (220×220), tree count; the adaptive quality
     fallback in `diorama.ts`.
   - Cloud shader cost during transitions.
   - A "low power" mode that the settings from T-09 can toggle and that turns on automatically
     when the measured frame time is high (fewer effects, no hillshade, simpler 3D).
3. Re-measure after the changes; report before/after in `docs/performance.md`.

## Acceptance criteria
- [ ] Measurements before and after, with the method, in `docs/performance.md`.
- [ ] No long task > 200 ms on the main thread when opening a municipality or a farm with CPU ×4
      (or a documented explanation of what remains and why).
- [ ] Visual result unchanged on a fast computer; all checks pass.
