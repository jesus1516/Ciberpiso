// What the 3D terrain and its interface need from a farm, without depending on three.js
// (so the interface does not drag the 3D into the main bundle).
import type { MultiPolygon, Polygon, Position } from 'geojson'
import type { ProfileKey, RotationKey } from '../lib/indicators'

export type BBox = [number, number, number, number]
export type Geometry = Polygon | MultiPolygon

/** Everything the 3D needs from a farm. */
export type FarmScene = {
  key: string
  geometry: Geometry
  tile: BBox
  /** Observed rotation 2020–2025 (fincas.csv), e.g. "I-I-B-B-I-I" */
  rot: string | null
  /** MODIS class per campaign when the farm has phenology data */
  campaigns: { y: number; cls: string | null }[]
  /** WorldCover tree cover % */
  trees: number
  clay: number | null
  neighbors: { geometry: Geometry; cover: string | null; rot: string | null }[]
  crops: Record<RotationKey, string[]>
}

export type Anchor = { x: number; y: number; behind?: boolean }
export type Anchors = Record<'water' | 'risk' | 'market' | 'center' | 'soil', Anchor>
export type Mode = 'satellite' | 'model'
export type ViewState = { year: number; rotation: RotationKey; profile: ProfileKey; mode: Mode; exaggeration: number }
// ------------------------------------------------------------ palette
export const CROPS: Record<string, { label: string; color: string }> = {
  trigo: { label: 'Wheat', color: '#D9B45B' },
  girasol: { label: 'Sunflower', color: '#EBC93C' },
  garbanzo: { label: 'Chickpea', color: '#9FB86A' },
  veza: { label: 'Vetch', color: '#82A27E' },
  barbecho: { label: 'Fallow', color: '#9C7A57' },
  I: { label: 'Winter cereal', color: '#D4B160' },
  V: { label: 'Summer crop', color: '#E3C24A' },
  B: { label: 'Fallow or pasture', color: '#A3835F' },
  M: { label: 'Mixed', color: '#B8A76C' },
  P: { label: 'Permanent crop', color: '#667E48' },
}
export const COVER_COLORS: Record<string, string> = {
  pasto: '#A9AA74', arbolado: '#5E7646', matorral: '#7D8558', urbano: '#BEB5A7', suelo_desnudo: '#B39A7A', agua: '#6BA8A3',
}
export const CLASS_LETTER: Record<string, string> = { herbaceo_invierno: 'I', herbaceo_verano: 'V', barbecho_o_pastizal: 'B', mixto: 'M', permanente: 'P' }
export const FIRST_SCENARIO_YEAR = 2026
export const LAST_YEAR = 2031

export const rings = (g: Geometry): Position[][][] => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)

/** Square in metres centred on the farm: the piece of terrain that is cut out. */
export function tileFor([w, s, e, n]: BBox, factor = 1.55, minM = 950): BBox {
  const cx = (w + e) / 2, cy = (s + n) / 2
  const mx = 111320 * Math.cos((cy * Math.PI) / 180)
  const side = Math.max((e - w) * mx, (n - s) * 110574, minM / factor) * factor
  return [cx - side / 2 / mx, cy - side / 2 / 110574, cx + side / 2 / mx, cy + side / 2 / 110574]
}

export function yearLetter(rot: string | null, idx: number) {
  const parts = (rot ?? '').split('-').filter(Boolean)
  return parts[idx] ?? parts.at(-1) ?? ''
}

/** What is on the farm in a given year: observed campaign (≤2025) or rotation scenario. */
export function cropForYear(e: FarmScene, year: number, rotation: RotationKey) {
  if (year < FIRST_SCENARIO_YEAR) {
    const c = e.campaigns.find((x) => x.y === year)
    const letter = (c?.cls && CLASS_LETTER[c.cls]) || yearLetter(e.rot, year - 2020)
    return { key: letter || 'B', observed: true }
  }
  const crops = e.crops[rotation]
  return { key: crops[(year - FIRST_SCENARIO_YEAR) % crops.length], observed: false }
}

