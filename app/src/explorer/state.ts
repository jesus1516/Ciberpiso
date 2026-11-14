// Explorer state read by the React interface. The map, the clouds and the 3D are
// imperative (controller.ts) and only write here what has to be rendered.
import { create } from 'zustand'
import type { RotationScore } from '../lib/calculator'
import type { FarmDetail } from '../lib/detail'
import type { Farm } from '../lib/geo'
import type { RotationKey } from '../lib/indicators'
import type { FarmScene, ViewState } from './scene'

export type Level = 0 | 1 | 2 | 3
export type Phase = 'loading' | 'idle' | 'transitioning'

export type ProvinceProps = { id: string; nombre: string; and: number; fincas?: number; ha?: number; pct_cultivo?: number; candidatas?: number }
export type MunicipalityInfo = { mun: number; nombre: string; fincas: number; ha: number; candidatas: number; pct_cultivo?: number; lluvia_mm?: number | null; deficit_mm?: number | null }

export type Hover =
  | { kind: 'province'; x: number; y: number; p: ProvinceProps }
  | { kind: 'municipality'; x: number; y: number; p: MunicipalityInfo }
  | { kind: 'farm'; x: number; y: number; p: Farm['properties'] }

export type Selection = {
  farm: Farm
  municipality: string
  detail: FarmDetail | null
  scores: Record<RotationKey, RotationScore> | null
  farmScene: FarmScene
  climate: { rain: number; deficit: number; hotDays: number; frostDays: number } | null
  prices: Record<string, { eurT: number; year: number } | null>
}

type ExplorerState = {
  level: Level
  phase: Phase
  error: string | null
  municipality: MunicipalityInfo | null
  farmsCount: number | null
  sel: Selection | null
  hover: Hover | null
  toast: { title: string; body: string; kind?: 'warning' | 'blocked' } | null
  preparing: boolean
  synthetic: boolean
  view: ViewState
  speed: number
  totals: { andalucia: number; malaga: number; municipalities: number; maxCropland: number }
}

export const useExplorer = create<ExplorerState>(() => ({
  level: 0,
  phase: 'loading',
  error: null,
  municipality: null,
  farmsCount: null,
  sel: null,
  hover: null,
  toast: null,
  preparing: false,
  synthetic: false,
  view: { year: 2025, rotation: 'R1', profile: 'water_first', mode: 'satellite', exaggeration: 2 },
  speed: 1,
  totals: { andalucia: 0, malaga: 0, municipalities: 0, maxCropland: 0 },
}))

let toastTimer = 0
export function showToast(title: string, body: string, kind?: 'warning' | 'blocked') {
  clearTimeout(toastTimer)
  useExplorer.setState({ toast: { title, body, kind } })
  toastTimer = window.setTimeout(() => useExplorer.setState({ toast: null }), 4800)
}
