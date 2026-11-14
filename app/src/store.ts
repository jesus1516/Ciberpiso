import type { Map } from 'maplibre-gl'
import { create } from 'zustand'
import type { SoilType } from './data/mock/soil'
import { computeClimate, type Climate } from './lib/climate'
import { fieldCentroid, toField, weightedSlope, type Field, type Finca } from './lib/geo'
import { daysAgo, type GibsId } from './lib/gibs'
import { fetchPower, type PowerSource } from './lib/power'
import { slopeClass } from './lib/terrain'

export type Step = 'map' | 'dashboard'
export type Terrain = 'off' | 'on' | 'flat'
export type Tab = 'conditions' | 'layers' | 'priorities' | 'rotations'
export type LoadStatus = 'loading' | 'ready' | 'error'
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

export type LayerState = { visible: boolean; opacity: number; error: boolean }

let climateRequest = 0

type State = {
  map: Map | null
  step: Step
  fincasStatus: LoadStatus
  selection: Finca[]
  field: Field | null
  terrain: Terrain
  panelOpen: boolean
  panelSeen: boolean
  tab: Tab
  aboutOpen: boolean
  climate: ClimateState
  priorities: Priorities
  constraints: Constraints
  layers: Record<GibsId, LayerState>
  gibsDate: string
  setMap: (map: Map | null) => void
  setFincasStatus: (status: LoadStatus) => void
  toggleFinca: (finca: Finca) => void
  clearSelection: () => void
  confirmField: () => void
  resetField: () => void
  setTerrain: (terrain: Terrain) => void
  setPanelOpen: (open: boolean) => void
  setTab: (tab: Tab) => void
  setAboutOpen: (open: boolean) => void
  loadClimate: (lat: number, lon: number) => Promise<void>
  setPriority: (key: PriorityKey, value: number) => void
  setConstraints: (patch: Partial<Constraints>) => void
  setLayer: (id: GibsId, patch: Partial<LayerState>) => void
  setGibsDate: (date: string) => void
}

export const useStore = create<State>((set, get) => ({
  map: null,
  step: 'map',
  fincasStatus: 'loading',
  selection: [],
  field: null,
  terrain: 'off',
  panelOpen: false,
  panelSeen: false,
  tab: 'conditions',
  aboutOpen: false,
  climate: { status: 'idle', data: null, source: null },
  priorities: { water: 3, income: 3, erosion: 3, organic: 3, cost: 3 },
  constraints: { irrigation: 'no', currentCrop: 'wheat', soil: 'loam', slope: 'gentle', slopePct: null },
  layers: {
    ndvi: { visible: false, opacity: 0.7, error: false },
    imerg: { visible: false, opacity: 0.7, error: false },
    smap: { visible: false, opacity: 0.7, error: false },
  },
  gibsDate: daysAgo(7),
  setMap: (map) => set({ map }),
  setFincasStatus: (fincasStatus) => set({ fincasStatus }),
  toggleFinca: (finca) =>
    set((s) => {
      const exists = s.selection.some((f) => f.properties.id === finca.properties.id)
      const selection = exists ? s.selection.filter((f) => f.properties.id !== finca.properties.id) : [...s.selection, finca]
      return { selection, field: selection.length ? toField(selection) : null }
    }),
  clearSelection: () => set({ selection: [], field: null }),
  confirmField: () => {
    const field = get().field
    if (!field) return
    const [lon, lat] = fieldCentroid(field)
    const slopePct = weightedSlope(field)
    set((s) => ({
      step: 'dashboard',
      panelOpen: false,
      panelSeen: false,
      constraints: slopePct === null ? s.constraints : { ...s.constraints, slopePct, slope: slopeClass(slopePct) },
    }))
    get().loadClimate(lat, lon)
  },
  resetField: () =>
    set((s) => ({ step: 'map', panelOpen: false, terrain: 'off', constraints: { ...s.constraints, slopePct: null } })),
  setTerrain: (terrain) => set({ terrain }),
  setPanelOpen: (panelOpen) => set((s) => ({ panelOpen, panelSeen: s.panelSeen || panelOpen })),
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
  setLayer: (id, patch) => set((s) => ({ layers: { ...s.layers, [id]: { ...s.layers[id], ...patch } } })),
  setGibsDate: (gibsDate) =>
    set((s) => ({
      gibsDate,
      layers: Object.fromEntries(Object.entries(s.layers).map(([k, v]) => [k, { ...v, error: false }])) as Record<GibsId, LayerState>,
    })),
}))
