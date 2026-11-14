import type { Map } from 'maplibre-gl'
import { create } from 'zustand'
import type { SoilType } from './data/mock/soil'
import { computeClimate, type Climate } from './lib/climate'
import { fieldCentroid, type Field } from './lib/geo'
import { fetchPower, type PowerSource } from './lib/power'

export type Step = 'map' | 'dashboard'
export type DrawMode = 'idle' | 'polygon' | 'point'
export type Terrain = 'off' | 'on' | 'flat'
export type Tab = 'conditions' | 'layers' | 'priorities' | 'rotations'
export type ClimateState = {
  status: 'idle' | 'loading' | 'ready'
  data: Climate | null
  source: PowerSource | null
  place?: string
}

export type PriorityKey = 'water' | 'income' | 'erosion' | 'organic' | 'cost'
export type Priorities = Record<PriorityKey, number>
export type Irrigation = 'yes' | 'no' | 'limited'
export type SlopeClass = 'flat' | 'gentle' | 'moderate' | 'steep'
export type Constraints = {
  irrigation: Irrigation
  currentCrop: string
  soil: SoilType
  slope: SlopeClass
  slopePct: number | null
}

let climateRequest = 0

type State = {
  map: Map | null
  step: Step
  drawMode: DrawMode
  field: Field | null
  terrain: Terrain
  panelOpen: boolean
  tab: Tab
  aboutOpen: boolean
  climate: ClimateState
  priorities: Priorities
  constraints: Constraints
  setMap: (map: Map | null) => void
  setDrawMode: (mode: DrawMode) => void
  setField: (field: Field | null) => void
  confirmField: () => void
  resetField: () => void
  setTerrain: (terrain: Terrain) => void
  setPanelOpen: (open: boolean) => void
  setTab: (tab: Tab) => void
  setAboutOpen: (open: boolean) => void
  loadClimate: (lat: number, lon: number) => Promise<void>
  setPriority: (key: PriorityKey, value: number) => void
  setConstraints: (patch: Partial<Constraints>) => void
}

export const useStore = create<State>((set, get) => ({
  map: null,
  step: 'map',
  drawMode: 'idle',
  field: null,
  terrain: 'off',
  panelOpen: false,
  tab: 'conditions',
  aboutOpen: false,
  climate: { status: 'idle', data: null, source: null },
  priorities: { water: 3, income: 3, erosion: 3, organic: 3, cost: 3 },
  constraints: { irrigation: 'no', currentCrop: 'wheat', soil: 'loam', slope: 'gentle', slopePct: null },
  setMap: (map) => set({ map }),
  setDrawMode: (drawMode) => set({ drawMode }),
  setField: (field) => set({ field, drawMode: 'idle' }),
  confirmField: () => {
    const field = get().field
    if (!field) return
    const [lon, lat] = fieldCentroid(field)
    set({ step: 'dashboard', panelOpen: false })
    get().loadClimate(lat, lon)
  },
  resetField: () => set({ step: 'map', field: null, panelOpen: false, terrain: 'off', drawMode: 'idle' }),
  setTerrain: (terrain) => set({ terrain }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setTab: (tab) => set({ tab }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  loadClimate: async (lat, lon) => {
    const id = ++climateRequest
    set({ climate: { status: 'loading', data: null, source: null } })
    const result = await fetchPower(lat, lon)
    if (id !== climateRequest) return
    set({ climate: { status: 'ready', data: computeClimate(result.daily), source: result.source, place: result.place } })
  },
  setPriority: (key, value) => set((s) => ({ priorities: { ...s.priorities, [key]: value } })),
  setConstraints: (patch) => set((s) => ({ constraints: { ...s.constraints, ...patch } })),
}))
