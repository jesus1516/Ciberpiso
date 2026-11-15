# Performance (T-05)

## Method

`app/e2e/perf.spec.ts`, run on a production build:

```bash
cd app
npm run build
PERF=1 E2E_BROWSER=chromium npx playwright test perf
# optional: PERF_CPU=6, PERF_OUT=perf.json, PERF_PROFILE="Open farm" PERF_PROFILE_OUT=farm.cpuprofile
```

- Chrome DevTools Protocol: CPU throttling ×4 and the DevTools "Fast 3G" network (562.5 ms RTT,
  1.44 Mbit/s down), cache disabled. Map imagery and elevation (third-party hosts) are answered
  locally, so only our own bundle and data go through the slow network.
- The journey at normal animation speed, 1440×900: Andalucía until interactive → Málaga →
  Antequera (29015, the largest municipality: 14,529 farms) → farm 2900059683 → back.
- Per phase: main-thread long tasks (`PerformanceObserver('longtask')`), the longest one, total
  blocking time (sum of each long task above 50 ms), frames longer than 50 ms
  (`requestAnimationFrame`), JS heap after a forced GC.
- Machine: Linux laptop, headless Chromium 159. **WebGL runs on SwiftShader (the CPU)** in headless
  mode, so everything the GPU would do (MapLibre drawing, three.js shader compilation) lands on
  the CPU here. Compare runs with each other, not with a real laptop.

## Results (CPU ×4, Fast 3G)

Longest main-thread task / total blocking time, in ms.

| Phase | Before | Data in workers | + no shader checks |
|---|---|---|---|
| Andalucía interactive | 198 / 368 | 189 / 365 | 186 / 369 |
| Transition to Málaga | 241 / 328 | 172 / 233 | 225 / 230 |
| Open Antequera (29015) | 2158 / 2396 | 1841 / 3338 | **1771** / 3194 |
| Open farm 2900059683 | 2755 / 7621 | 3647 / 9061 | **1867 / 5347** |
| Back to Antequera | 1183 / 1168 | 772 / 766 | **796 / 759** |

Runs vary by about ±15 %. A CPU profile of "Open farm" (before the last step) showed where the
time went: `getProgramInfoLog` 2.2 s, `getShaderInfoLog` 2.0 s, `getProgramParameter` 0.6 s,
`getImageData` 1.4 s, our own code about 1.6 s.

## What changed

1. **Farms parsed in a Web Worker** (`lib/farms.worker.ts`). The municipality file (Antequera:
   1.6 MB gzip, 9.8 MB of GeoJSON) is decompressed and parsed off the main thread. The main thread
   receives the farm properties, a bounding box per farm and each geometry as a JSON string that
   is parsed only when that farm is used (the open farm and its neighbours). MapLibre loads the
   GeoJSON in its own worker from a `blob:` URL instead of receiving a 14,529-feature object.
2. **Farm details parsed in a Web Worker** (`lib/detail.worker.ts`). The municipality detail file
   (up to 1.5 MB gzip / 16 MB of JSON) stays in the worker (the last 3 municipalities are kept);
   the main thread only receives the farms it asks for.
3. **No shader error checks in production** (`diorama.ts`, `clouds.ts`):
   `renderer.debug.checkShaderErrors` is on only in development. The checks call
   `getProgramInfoLog` / `getShaderInfoLog` for every shader, which wait for the compiler on the
   main thread. Opening a farm: longest task 3.6 s → 1.9 s, blocking 9.1 s → 5.3 s.

The visual result is unchanged (same data, same scene); the full e2e suite runs on these changes.

## What remains, and why

The acceptance target (no long task above 200 ms when opening a municipality or a farm with CPU
×4) is **not met in this headless setup**. What is left is GPU work done on the CPU by
SwiftShader:

- **Opening a farm**: three.js links each WebGL program on first use and reads its attributes
  (`getProgramParameter`, 3.1 s in the last profile), and the elevation tiles are read with
  `getImageData` (1.0 s). On a real GPU these are much shorter, but they still block.
  Next step: `renderer.compileAsync(scene, camera)` during the cloud transition (uses
  `KHR_parallel_shader_compile`), and decoding the elevation tiles with `createImageBitmap` +
  `OffscreenCanvas` in a worker.
- **Opening a municipality**: MapLibre draws 14,529 farm polygons and the hillshade; its tiling
  already runs in its worker.
- **Low-power mode** (not done): the Settings "3D off" switch already skips three.js entirely
  (flat map + data table); a mode that turns on by itself when the measured frame time is high
  would reuse it.
