// Colour maths for the palette checks (tokens.test.ts): WCAG contrast, colour-blindness simulation
// and perceptual distance. Pure functions, no dependencies; not part of the runtime bundle.

export const hexToRgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c: number) => { const x = Math.min(1, Math.max(0, c)); return x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055 }
const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(toGamma(c) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`

/** WCAG 2.x relative luminance. */
export function luminance(h: string): number {
  const [r, g, b] = hexToRgb(h).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** WCAG contrast ratio, 1 … 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
/** `fg` painted over `bg` with the given opacity (what the eye gets from a translucent layer; sRGB mix like CSS color-mix). */
export function over(fg: string, bg: string, opacity: number): string {
  const [f, b] = [hexToRgb(fg), hexToRgb(bg)]
  return `#${f.map((v, i) => Math.round((v * opacity + b[i] * (1 - opacity)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/** Machado, Oliveira & Fernandes (2009), severity 1.0 (complete dichromacy), applied in linear RGB. */
const MATRICES = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
} as const
export type Vision = 'normal' | keyof typeof MATRICES
export const VISIONS: Vision[] = ['normal', 'protanopia', 'deuteranopia', 'tritanopia']

export function simulate(h: string, vision: Vision): string {
  if (vision === 'normal') return h.toUpperCase()
  const lin = hexToRgb(h).map(toLinear)
  return toHex(MATRICES[vision].map((row) => row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]))
}

const toLab = (h: string): [number, number, number] => {
  const [r, g, b] = hexToRgb(h).map(toLinear)
  const [x, y, z] = [0.4124 * r + 0.3576 * g + 0.1805 * b, 0.2126 * r + 0.7152 * g + 0.0722 * b, 0.0193 * r + 0.1192 * g + 0.9505 * b]
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116)
  const [fx, fy, fz] = [f(x / 0.95047), f(y), f(z / 1.08883)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** CIEDE2000 colour difference: ≈ 2 is just noticeable, ≥ 10 is clearly different at a glance. */
export function deltaE(h1: string, h2: string): number {
  const [L1, a1, b1] = toLab(h1), [L2, a2, b2] = toLab(h2), rad = Math.PI / 180
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2)
  const hue = (b: number, a: number) => { const x = Math.atan2(b, a) / rad; return x < 0 ? x + 360 : x }
  const h1p = hue(b1, a1p), h2p = hue(b2, a2p)
  const dL = L2 - L1, dC = C2p - C1p
  let dh = 0
  if (C1p * C2p) { dh = h2p - h1p; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360 }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh * rad) / 2)
  const Lb = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2
  let hb = h1p + h2p
  if (C1p * C2p) hb = Math.abs(h1p - h2p) <= 180 ? (h1p + h2p) / 2 : h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad)
  const dt = 30 * Math.exp(-(((hb - 275) / 25) ** 2)), Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
  const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T
  const Rt = -Math.sin(2 * dt * rad) * Rc
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))
}

/** Smallest pairwise ΔE of a set of colours as seen with the given vision. */
export function minDistance(colors: Record<string, string>, vision: Vision): { d: number; pair: string } {
  const names = Object.keys(colors)
  let best = { d: Infinity, pair: '' }
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const d = deltaE(simulate(colors[names[i]], vision), simulate(colors[names[j]], vision))
    if (d < best.d) best = { d, pair: `${names[i]}/${names[j]}` }
  }
  return best
}
