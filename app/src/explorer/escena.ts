// Lo que el terreno 3D y su interfaz necesitan de una finca, sin depender de three.js
// (así la interfaz no arrastra el 3D al paquete principal).
import type { MultiPolygon, Polygon, Position } from 'geojson'
import type { ProfileKey, RotationKey } from '../lib/indicators'

export type BBox = [number, number, number, number]
export type Geometry = Polygon | MultiPolygon

/** Todo lo que el 3D necesita de una finca. */
export type Escena = {
  key: string
  geometry: Geometry
  tile: BBox
  /** Rotación observada 2020–2025 (fincas.csv), p. ej. "I-I-B-B-I-I" */
  rot: string | null
  /** Clase MODIS por campaña cuando la finca tiene fenología */
  campaigns: { y: number; cls: string | null }[]
  /** % de arbolado WorldCover */
  arbolado: number
  clay: number | null
  neighbors: { geometry: Geometry; cover: string | null; rot: string | null }[]
  crops: Record<RotationKey, string[]>
}

export type Anchor = { x: number; y: number; behind?: boolean }
export type Anchors = Record<'water' | 'risk' | 'market' | 'center' | 'soil', Anchor>
export type Mode = 'satelite' | 'maqueta'
export type ViewState = { year: number; rotation: RotationKey; profile: ProfileKey; mode: Mode; exaggeration: number }
// ------------------------------------------------------------ paleta
export const CROPS: Record<string, { label: string; color: string }> = {
  trigo: { label: 'Trigo', color: '#D9B45B' },
  girasol: { label: 'Girasol', color: '#EBC93C' },
  garbanzo: { label: 'Garbanzo', color: '#9FB86A' },
  veza: { label: 'Veza', color: '#82A27E' },
  barbecho: { label: 'Barbecho', color: '#9C7A57' },
  I: { label: 'Cereal de invierno', color: '#D4B160' },
  V: { label: 'Cultivo de verano', color: '#E3C24A' },
  B: { label: 'Barbecho o pastizal', color: '#A3835F' },
  M: { label: 'Mixto', color: '#B8A76C' },
  P: { label: 'Permanente', color: '#667E48' },
}
export const COVER_COLORS: Record<string, string> = {
  pasto: '#A9AA74', arbolado: '#5E7646', matorral: '#7D8558', urbano: '#BEB5A7', suelo_desnudo: '#B39A7A', agua: '#6BA8A3',
}
export const CLASS_LETTER: Record<string, string> = { herbaceo_invierno: 'I', herbaceo_verano: 'V', barbecho_o_pastizal: 'B', mixto: 'M', permanente: 'P' }
export const FIRST_SCENARIO_YEAR = 2026
export const LAST_YEAR = 2031

export const rings = (g: Geometry): Position[][][] => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)

/** Cuadrado en metros centrado en la finca: la pieza de terreno que se recorta. */
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

/** Qué hay en la finca un año: campaña observada (≤2025) o escenario de rotación. */
export function cropForYear(e: Escena, year: number, rotation: RotationKey) {
  if (year < FIRST_SCENARIO_YEAR) {
    const c = e.campaigns.find((x) => x.y === year)
    const letter = (c?.cls && CLASS_LETTER[c.cls]) || yearLetter(e.rot, year - 2020)
    return { key: letter || 'B', observed: true }
  }
  const crops = e.crops[rotation]
  return { key: crops[(year - FIRST_SCENARIO_YEAR) % crops.length], observed: false }
}

