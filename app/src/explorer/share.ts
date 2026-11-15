// Shareable links: the view on screen lives in the URL fragment, so any static host serves it as is
// (the part after # never reaches the server) and nothing about the site's address changes.
//   #f=29:32:0:0:38:14&r=R2&p=soil&y=2027&v=model&x=3.5   a farm, with its rotation, priority, year…
//   #m=32                                                  a municipality (its SIGPAC code)
// Without a fragment the explorer starts exactly as before. Every value is checked: anything wrong is
// left out, and a link without a usable place is ignored.
import type { ProfileKey, RotationKey } from '../lib/indicators'
import { LAST_YEAR, type Mode, type ViewState } from './scene'
import { PROVINCE_CODE } from './sigpac'

export const FIRST_YEAR = 2020
export const RELIEF = [1, 2, 3.5]
const ROTATIONS: RotationKey[] = ['R0', 'R1', 'R2', 'R3']
const PROFILES: Record<string, ProfileKey> = { water: 'water_first', soil: 'soil_first', market: 'profit_first' }
const PROFILE_WORD = Object.fromEntries(Object.entries(PROFILES).map(([w, k]) => [k, w])) as Record<ProfileKey, string>
const MODES: Mode[] = ['satellite', 'model']

export type SharedView = Partial<ViewState>
export type Shared =
  | { kind: 'farm'; mun: number; pol: number; par: number; view: SharedView }
  | { kind: 'municipality'; mun: number }

const isInt = (s: string) => /^\d{1,6}$/.test(s)

/** SIGPAC reference of a Málaga farm: 29:mun:0:0:pol:par or 29:mun:pol:par. */
function parseRef(text: string) {
  const parts = text.split(':')
  if (!parts.every(isInt)) return null
  const n = parts.map(Number)
  if (n[0] !== PROVINCE_CODE) return null
  if (n.length === 6 && n[2] === 0 && n[3] === 0) return { mun: n[1], pol: n[4], par: n[5] }
  if (n.length === 4) return { mun: n[1], pol: n[2], par: n[3] }
  return null
}

/** Reads a URL fragment ("#f=…" or "f=…"). Null when it holds no place to go to. */
export function parseShare(hash: string): Shared | null {
  const q = new URLSearchParams(hash.replace(/^#/, ''))
  const f = q.get('f')
  if (f) {
    const ref = parseRef(f)
    if (!ref) return null
    const view: SharedView = {}
    const r = q.get('r')?.toUpperCase()
    if (r && ROTATIONS.includes(r as RotationKey)) view.rotation = r as RotationKey
    const p = q.get('p')?.toLowerCase()
    if (p && p in PROFILES) view.profile = PROFILES[p]
    const y = q.get('y')
    if (y && isInt(y) && +y >= FIRST_YEAR && +y <= LAST_YEAR) view.year = +y
    const v = q.get('v')?.toLowerCase()
    if (v && MODES.includes(v as Mode)) view.mode = v as Mode
    const x = Number(q.get('x'))
    if (RELIEF.includes(x)) view.exaggeration = x
    return { kind: 'farm', ...ref, view }
  }
  const m = q.get('m')
  if (m && isInt(m)) return { kind: 'municipality', mun: +m }
  return null
}

/** Mun code inside the province (29032 → 32). */
export const munCode = (mun: number) => mun % 1000

/** The fragment for the view on screen ("" for the province and region maps). */
export function farmHash(pid: string, view: ViewState) {
  const x = RELIEF.find((e) => Math.abs(e - view.exaggeration) < 0.01) ?? 2
  return `#f=${pid}&r=${view.rotation}&p=${PROFILE_WORD[view.profile]}&y=${view.year}&v=${view.mode}&x=${x}`
}
export const municipalityHash = (mun: number) => `#m=${munCode(mun)}`
