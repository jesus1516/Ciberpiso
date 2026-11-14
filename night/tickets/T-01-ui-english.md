---
id: T-01
title: Translate the whole web app UI to English
model: sonnet
effort: high
depends: []
files: ["app/src/**", "app/index.html"]
maxAttempts: 2
timeoutMin: 120
---
## Goal
The hackathon delivery is in English and judged globally. Every word a user can see in the web
app must be English, and the code in `app/src` must read naturally in English (identifiers,
comments, file names when reasonable).

## Context
- The main interface is `app/src/explorer/` (written in Spanish): `textos.ts` (strings),
  `Explorer.tsx` (narrative per level, tooltips, breadcrumbs, toasts, loading texts),
  `FincaView.tsx` (farm view cards, timeline, rotation dock, legend, "Datos completos" panel),
  `controller.ts` (toasts such as "No es tierra de cultivo"), `escena.ts` (crop labels:
  "Trigo", "Cereal de invierno"...), `diorama.ts` and `explorer.css` (comments only).
- `app/src/lib/calculator.ts` has Spanish rotation names and blocker/warning messages; the
  other components (`components/`, `i18n/en.ts`) are already English.
- Numbers are formatted with `es-ES` (`1.234,5`). Use `en-GB` formatting (`1,234.5`).

## Task
1. Translate every visible string to clear, plain English for a farmer or an agronomist.
   Keep proper names in Spanish (Andalucía, Málaga, Antequera, municipality names, SIGPAC).
   Rotation names: "Wheat–Sunflower (current)", "+ Chickpea", "+ Vetch", "+ Fallow".
2. Rename `textos.ts` to `texts.ts` (update imports) and translate Spanish identifiers that are
   easy to rename safely (`Seleccion` → `Selection`, `escena` → `scene`, etc.). Do not change
   behaviour. Keep data keys that come from files as they are (`fenologia`, `suelo`, `celda`,
   `pct_cultivo`...).
3. Translate code comments in `app/src` to English.
4. `app/index.html`: `lang="en"` and English title/description (may already be done by T-00).
5. Keep `lib/calculator.ts` numerically identical: `node scripts/check-calculator.ts` must still
   report 0 differences (it compares numbers, not names).

## Acceptance criteria
- [ ] `grep -rniE "[áéíóúñ¿¡]|\b(finca|campaña|cultivo|suelo|riesgo|agua|volver|clic)\b" app/src`
      only matches proper names, data keys from files or crop codes; list any remaining match
      and why in the report.
- [ ] The app builds and the four levels and the farm view show English text (check the
      rendered strings in the code paths, and run `npm run build`).
- [ ] Number formatting uses English separators.
- [ ] No behaviour change; calculator check still 0 differences.
