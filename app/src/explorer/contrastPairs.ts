// Every text and UI colour pair of the explorer, with the real (opaque) background it sits on and
// the WCAG 2.x AA threshold it must meet. Shared by tokens.test.ts (which enforces it) and by the
// T-08 report. Translucent layers are composited the way the browser does it (`over`).
import { contrast, over } from './colorMath'
import { ACCENT, CROP_COLORS, CROP_INK, NEUTRAL as N, STATUS } from './tokens'

export type Pair = { use: string; fg: string; bg: string; min: number }
const TEXT = 4.5 // normal text
const LARGE = 3 // large text (≥ 24 px, or ≥ 18.66 px bold) and UI components / graphical objects

// Backgrounds, as painted: the column is n-800 → n-900 (97 % opaque); cards and tints sit on top of it;
// the glass panels are 92 % n-800 and are assumed over the lightest thing behind them (n-100).
const COL = N['n-800']
const COL_END = N['n-900']
const CARD = over(N['n-100'], COL, 0.035)
const CARD_HOT = over(N['n-100'], COL, 0.075)
const GLASS_WORST = over(N['n-800'], N['n-100'], 0.92)
const GLASS_DEEP = over(N['n-900'], N['n-100'], 0.9) // legend, callouts
const tint = (c: string, on: string = COL, a = 0.12) => over(c, on, a)

export const TEXT_PAIRS: Pair[] = [
  // Primary text
  { use: 'Primary text on the column', fg: N['n-100'], bg: COL, min: TEXT },
  { use: 'Primary text on the column bottom', fg: N['n-100'], bg: COL_END, min: TEXT },
  { use: 'Primary text on a hovered card', fg: N['n-100'], bg: CARD_HOT, min: TEXT },
  { use: 'Primary text on a raised surface (n-700)', fg: N['n-100'], bg: N['n-700'], min: TEXT },
  { use: 'Primary text on glass (tooltip, toast, crumbs)', fg: N['n-100'], bg: GLASS_WORST, min: TEXT },
  { use: 'Top insight headline on its tint', fg: N['n-100'], bg: tint(STATUS.warn), min: TEXT },
  // Secondary and tertiary text
  { use: 'Secondary text on the column', fg: N['n-200'], bg: COL, min: TEXT },
  { use: 'Secondary text on a hovered card', fg: N['n-200'], bg: CARD_HOT, min: TEXT },
  { use: 'Secondary text on glass', fg: N['n-200'], bg: GLASS_WORST, min: TEXT },
  { use: 'Secondary text on the emphasised card', fg: N['n-200'], bg: tint(ACCENT, COL, 0.09), min: TEXT },
  { use: 'Tertiary text on the column', fg: N['n-300'], bg: COL, min: TEXT },
  { use: 'Tertiary text on a hovered card', fg: N['n-300'], bg: CARD_HOT, min: TEXT },
  { use: 'Tertiary text on glass', fg: N['n-300'], bg: GLASS_WORST, min: TEXT },
  { use: 'Tertiary text on a raised surface (n-700)', fg: N['n-300'], bg: N['n-700'], min: TEXT },
  { use: 'Tertiary text on n-600', fg: N['n-300'], bg: N['n-600'], min: TEXT },
  // Accent as text
  { use: 'Accent text on the column', fg: ACCENT, bg: COL, min: TEXT },
  { use: 'Accent text on glass', fg: ACCENT, bg: GLASS_WORST, min: TEXT },
  { use: 'Accent text on the legend/callout panel', fg: ACCENT, bg: GLASS_DEEP, min: TEXT },
  { use: 'Accent text on a selected button (accent 18 %)', fg: ACCENT, bg: tint(ACCENT, N['n-900'], 0.18), min: TEXT },
  { use: 'Text on an accent fill (selected "Full data", marker number)', fg: N['n-900'], bg: ACCENT, min: TEXT },
  // Status as text
  ...(['good', 'warn', 'bad'] as const).flatMap((k): Pair[] => [
    { use: `Status "${k}" text on the column`, fg: STATUS[k], bg: COL, min: TEXT },
    { use: `Status "${k}" text on its insight tint (12 %)`, fg: STATUS[k], bg: tint(STATUS[k]), min: TEXT },
    { use: `Status "${k}" text on glass`, fg: STATUS[k], bg: GLASS_WORST, min: TEXT },
    { use: `Status "${k}" text on a hovered card`, fg: STATUS[k], bg: CARD_HOT, min: TEXT },
  ]),
  { use: 'Delta "up" chip (good on good 14 %)', fg: STATUS.good, bg: tint(STATUS.good, over(N['n-100'], COL, 0.035), 0.14), min: TEXT },
  { use: 'Delta "down" chip (warn on warn 14 %)', fg: STATUS.warn, bg: tint(STATUS.warn, over(N['n-100'], COL, 0.035), 0.14), min: TEXT },
  { use: 'Offline badge (warn on warn 10 %)', fg: STATUS.warn, bg: tint(STATUS.warn, GLASS_DEEP, 0.1), min: TEXT },
  { use: 'Text on a "best option" badge (good fill)', fg: N['n-900'], bg: STATUS.good, min: TEXT },
  // Crop letters on their fills (observed years are solid; projected years are hatched, up to 12 % darker)
  ...(Object.keys(CROP_COLORS) as (keyof typeof CROP_COLORS)[]).flatMap((g): Pair[] => [
    { use: `Crop letter on "${g}"`, fg: CROP_INK[g], bg: CROP_COLORS[g], min: TEXT },
    { use: `Crop letter on hatched "${g}"`, fg: CROP_INK[g], bg: over(N['n-900'], CROP_COLORS[g], 0.12), min: TEXT },
  ]),
]

export const UI_PAIRS: Pair[] = [
  { use: 'Control border (n-500) on the column', fg: N['n-500'], bg: COL, min: LARGE },
  { use: 'Control border (n-500) on glass', fg: N['n-500'], bg: GLASS_WORST, min: LARGE },
  { use: 'Focus ring (accent) on the column', fg: ACCENT, bg: COL, min: LARGE },
  { use: 'Focus ring (accent) on a card', fg: ACCENT, bg: CARD, min: LARGE },
  { use: 'Current-year ring (n-100) on the column', fg: N['n-100'], bg: COL, min: LARGE },
  { use: 'Score bar (accent) on its track', fg: ACCENT, bg: over(N['n-100'], COL, 0.1), min: LARGE },
  ...(Object.keys(CROP_COLORS) as (keyof typeof CROP_COLORS)[]).filter((g) => g !== 'permanent').map((g): Pair => ({ use: `Crop fill "${g}" on the dock`, fg: CROP_COLORS[g], bg: over(N['n-100'], COL, 0.035), min: LARGE })),
  // The dark-green fill is too close to the dock on its own, so every crop swatch has an n-300 outline.
  { use: 'Crop swatch outline (n-300) on the dock', fg: N['n-300'], bg: over(N['n-100'], COL, 0.035), min: LARGE },
  ...(['good', 'warn', 'bad'] as const).map((k): Pair => ({ use: `Status icon "${k}" on the column`, fg: STATUS[k], bg: COL, min: LARGE })),
  { use: 'Legend swatch outline (n-300) on glass', fg: N['n-300'], bg: GLASS_DEEP, min: LARGE },
  { use: 'Marker ring (accent) on the terrain cap', fg: ACCENT, bg: N['n-950'], min: LARGE },
]

export const ALL_PAIRS = [...TEXT_PAIRS, ...UI_PAIRS]
export const ratio = (p: Pair) => contrast(p.fg, p.bg)
