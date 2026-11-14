// Estado del explorador que lee la interfaz React. El mapa, las nubes y el 3D son
// imperativos (controller.ts) y solo escriben aquí lo que hay que pintar.
import { create } from 'zustand'
import type { RotationScore } from '../lib/calculator'
import type { FincaDetalle } from '../lib/detalle'
import type { Finca } from '../lib/geo'
import type { RotationKey } from '../lib/indicators'
import type { Escena, ViewState } from './escena'

export type Level = 0 | 1 | 2 | 3
export type Phase = 'loading' | 'idle' | 'transitioning'

export type ProvinciaProps = { id: string; nombre: string; and: number; fincas?: number; ha?: number; pct_cultivo?: number; candidatas?: number }
export type MunicipioInfo = { mun: number; nombre: string; fincas: number; ha: number; candidatas: number; pct_cultivo?: number; lluvia_mm?: number | null; deficit_mm?: number | null }

export type Hover =
  | { kind: 'provincia'; x: number; y: number; p: ProvinciaProps }
  | { kind: 'municipio'; x: number; y: number; p: MunicipioInfo }
  | { kind: 'finca'; x: number; y: number; p: Finca['properties'] }

export type Seleccion = {
  finca: Finca
  municipio: string
  detalle: FincaDetalle | null
  scores: Record<RotationKey, RotationScore> | null
  escena: Escena
  climate: { lluvia: number; deficit: number; calor: number; heladas: number } | null
  prices: Record<string, { eurT: number; year: number } | null>
}

type ExplorerState = {
  level: Level
  phase: Phase
  error: string | null
  municipio: MunicipioInfo | null
  fincasCount: number | null
  sel: Seleccion | null
  hover: Hover | null
  toast: { title: string; body: string; kind?: 'warning' | 'blocked' } | null
  preparing: boolean
  synthetic: boolean
  view: ViewState
  speed: number
  totals: { andalucia: number; malaga: number; municipios: number; maxCultivo: number }
}

export const useExplorer = create<ExplorerState>(() => ({
  level: 0,
  phase: 'loading',
  error: null,
  municipio: null,
  fincasCount: null,
  sel: null,
  hover: null,
  toast: null,
  preparing: false,
  synthetic: false,
  view: { year: 2025, rotation: 'R1', profile: 'water_first', mode: 'satelite', exaggeration: 2 },
  speed: 1,
  totals: { andalucia: 0, malaga: 0, municipios: 0, maxCultivo: 0 },
}))

let toastTimer = 0
export function showToast(title: string, body: string, kind?: 'warning' | 'blocked') {
  clearTimeout(toastTimer)
  useExplorer.setState({ toast: { title, body, kind } })
  toastTimer = window.setTimeout(() => useExplorer.setState({ toast: null }), 4800)
}
