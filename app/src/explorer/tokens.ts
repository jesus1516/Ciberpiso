// Colour tokens of the explorer. The single source of truth for every colour used by the 3D
// scene (three.js) and the map layers (MapLibre), which cannot read CSS custom properties.
// The same values are declared as custom properties at the top of explorer.css (`.xp { --n-100 … }`);
// `tokens.test.ts` parses that file and fails if the two drift apart, and it also checks the
// contrast ratios and the colour-blind distances that make this palette accessible.
//
// Structure (deliberately small):
//   · one neutral scale  n-950 … n-100      (dark green-tinted greys, cream text)
//   · one accent         gold               (focus, selected, interactive, brand)
//   · three statuses     good / warn / bad  (blue / orange / magenta-red: distinguishable with
//                                            deuteranopia and protanopia; always paired with a word or icon)
//   · four crop groups   arable / legume / fallow / permanent  (each also has a letter)
//   · a few scene colours for the 3D materials (not UI, no text on them)

export const NEUTRAL = {
  'n-950': '#10170D', // deepest: terrain cap, shadows
  'n-900': '#141C11', // page background behind the terrain, text on accent fills
  'n-800': '#1E2A1A', // map and panel background
  'n-700': '#2E3B2A', // surfaces
  'n-600': '#3A4A34', // raised surfaces
  'n-500': '#7C8872', // component borders (≥ 3:1 on the panels)
  'n-300': '#B9BEA9', // tertiary text
  'n-200': '#D2CDBC', // secondary text
  'n-100': '#F4E9D8', // primary text
} as const

export const ACCENT = '#E9D58B'

export const STATUS = {
  good: '#6DB6FF', // blue
  warn: '#F0983A', // orange
  bad: '#FF6FA0', // magenta-red
} as const

/** Crop groups: similar classes share one colour; the letter on each crop tells them apart. */
export const CROP_COLORS = {
  arable: '#E3C25F',
  legume: '#6FB7A0',
  fallow: '#AD8B65',
  permanent: '#4C6B3C',
} as const
/** Text on a crop colour (dark on the light fills, cream on the dark green). */
export const CROP_INK = {
  arable: NEUTRAL['n-900'],
  legume: NEUTRAL['n-900'],
  fallow: NEUTRAL['n-900'],
  permanent: NEUTRAL['n-100'],
} as const

/** Land cover of the neighbouring fields (context only, nothing is read from their colour). */
export const COVER_TOKENS = {
  natural: '#8C9568', // pasture and scrub
  trees: CROP_COLORS.permanent, // tree cover looks like permanent crops
  built: '#C9C0B2', // urban and bare soil
  water: '#7FA9C9',
} as const

/** Soil texture bar: three tints of one brown (dark → light), so they differ by lightness; the bar is also labelled in words. */
export const SOIL_TEXTURE = { clay: '#8A5A3C', silt: '#B58E62', sand: '#D8C29A' } as const

/** Everything that colours the 3D materials. */
export const SCENE = {
  ground: '#8E8566',
  cap: '#211C14',
  sun: '#FFE7C4',
  skyLight: '#E4E6D6',
  skyGround: '#4A3E2C',
  treeDark: '#55663A',
  treeLight: '#7A8748',
  wall: '#F1ECE2',
  roof: '#B4623E',
  cypress: '#2E4A2E',
  outlineGlow: ACCENT,
  outlineCore: NEUTRAL['n-100'],
  shimmer: ACCENT,
} as const

const toRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
/** Linear mix in sRGB, the same as CSS `color-mix(in srgb, a (1-t), b t)`. */
export function mix(a: string, b: string, t: number): string {
  const [x, y] = [toRgb(a), toRgb(b)]
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}
/** `rgba()` string of a token with an alpha, for the places that need transparency (MapLibre, canvas). */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = toRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

/** Sequential ramp of the municipality choropleth: neutral surface → accent (lightness grows with the value). */
export const RAMP = [NEUTRAL['n-700'], mix(NEUTRAL['n-700'], ACCENT, 0.33), mix(NEUTRAL['n-700'], ACCENT, 0.66), ACCENT] as const

/** Map layers (MapLibre paint properties). */
export const MAP = {
  bg: NEUTRAL['n-800'],
  hillShadow: NEUTRAL['n-950'],
  hillHighlight: mix(NEUTRAL['n-100'], NEUTRAL['n-300'], 0.5),
  hillAccent: NEUTRAL['n-600'],
  rest: NEUTRAL['n-900'],
  focusMask: NEUTRAL['n-950'],
  province: NEUTRAL['n-700'],
  provinceHome: mix(NEUTRAL['n-700'], ACCENT, 0.4),
  provinceLine: alpha(NEUTRAL['n-100'], 0.55),
  restLine: alpha(NEUTRAL['n-100'], 0.12),
  muniLine: alpha(NEUTRAL['n-900'], 0.75),
  farm: NEUTRAL['n-100'],
  limited: NEUTRAL['n-950'],
  blocked: NEUTRAL['n-600'],
  highlight: NEUTRAL['n-100'], // candidate outline, hover and selection outline
  trace: mix(ACCENT, NEUTRAL['n-100'], 0.5),
  pulseBlocked: STATUS.bad,
} as const
