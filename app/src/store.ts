import type { Map } from 'maplibre-gl'
import { create } from 'zustand'
import { computeClimate, type Climate } from './lib/climate'
import { loadCommon, loadDetails, type Common, type FarmDetail } from './lib/detail'
import { fieldCentroid, toField, type BBox, type Field, type Farm } from './lib/geo'
import { daysAgo, type GibsId } from './lib/gibs'
import { loadIndicators as fetchIndicators, type Indicators } from './lib/indicators'
import { fetchPower, type PowerSource } from './lib/power'

export type Step = 'map' | 'dashboard'
export type Terrain = 'off' | 'on' | 'flat'
export type Tab = 'conditions' | 'layers'
export type LoadStatus = 'loading' | 'ready' | 'error'
export type MunicipalityFocus = { key: number; name: string; bounds?: BBox }
export type ClimateState = {
  status: 'idle' | 'loading' | 'ready'
  data: Climate | null
  source: PowerSource | null
  place?: string
}

export type LayerState = { visible: boolean; opacity: number; error: boolean }

export type FarmData = { status: LoadStatus | 'idle'; byId: Record<number, FarmDetail>; common: Common | null }

let climateRequest = 0
let farmRequest = 0

type State = {
  map: Map | null
  step: Step
  farmsStatus: LoadStatus
  municipality: MunicipalityFocus | null
  municipalityStatus: LoadStatus
  indicatorsStatus: LoadStatus
  indicators: Indicators | null
  selection: Farm[]
  field: Field | null
  terrain: Terrain
  panelOpen: boolean
  panelSeen: boolean
  tab: Tab
  aboutOpen: boolean
  climate: ClimateState
  layers: Record<GibsId, LayerState>
  gibsDate: string
  setMap: (map: Map | null) => void
  setFarmsStatus: (status: LoadStatus) => void
  setMunicipality: (municipality: MunicipalityFocus | null) => void
  setMunicipalityStatus: (status: LoadStatus) => void
  loadIndicators: () => Promise<void>
  openProjectFarm: (farm: Farm) => void
  toggleFarm: (farm: Farm) => void
  clearSelection: () => void
  confirmField: () => void
  resetField: () => void
  setTerrain: (terrain: Terrain) => void
  setPanelOpen: (open: boolean) => void
  setTab: (tab: Tab) => void
  setAboutOpen: (open: boolean) => void
  loadClimate: (lat: number, lon: number) => Promise<void>
  farmData: FarmData
  loadFarmData: () => Promise<void>
  setLayer: (id: GibsId, patch: Partial<LayerState>) => void
  setGibsDate: (date: string) => void
}

export const useStore = create<State>((set, get) => ({
  map: null,
  step: 'map',
  farmsStatus: 'loading',
  municipality: null,
  municipalityStatus: 'ready',
  indicatorsStatus: 'loading',
  indicators: null,
  selection: [],
  field: null,
  terrain: 'off',
  panelOpen: false,
  panelSeen: false,
  tab: 'conditions',
  aboutOpen: false,
  climate: { status: 'idle', data: null, source: null },
  layers: {
    ndvi: { visible: false, opacity: 0.7, error: false },
    imerg: { visible: false, opacity: 0.7, error: false },
    smap: { visible: false, opacity: 0.7, error: false },
  },
  gibsDate: daysAgo(7),
  setMap: (map) => set({ map }),
  setFarmsStatus: (farmsStatus) => set({ farmsStatus }),
  setMunicipality: (municipality) => set({ municipality }),
  setMunicipalityStatus: (municipalityStatus) => set({ municipalityStatus }),
  loadIndicators: async () => {
    set({ indicatorsStatus: 'loading' })
    try {
      const indicators = await fetchIndicators()
      set({ indicators, indicatorsStatus: 'ready' })
    } catch {
      set({ indicatorsStatus: 'error' })
    }
  },
  openProjectFarm: (farm) => {
    const field = toField([farm])
    const [lon, lat] = fieldCentroid(field)
    set({ selection: [farm], field, step: 'dashboard', panelOpen: true, panelSeen: false, tab: 'conditions' })
    get().loadClimate(lat, lon)
    get().loadFarmData()
  },
  toggleFarm: (farm) =>
    set((s) => {
      const exists = s.selection.some((f) => f.properties.id === farm.properties.id)
      const selection = exists ? s.selection.filter((f) => f.properties.id !== farm.properties.id) : [...s.selection, farm]
      return { selection, field: selection.length ? toField(selection) : null }
    }),
  clearSelection: () => set({ selection: [], field: null }),
  confirmField: () => {
    const field = get().field
    if (!field) return
    const [lon, lat] = fieldCentroid(field)
    set({ step: 'dashboard', panelOpen: false, panelSeen: false })
    get().loadClimate(lat, lon)
    get().loadFarmData()
  },
  farmData: { status: 'idle', byId: {}, common: null },
  loadFarmData: async () => {
    const selection = get().selection
    const id = ++farmRequest
    set({ farmData: { status: 'loading', byId: {}, common: null } })
    try {
      const [byId, common] = await Promise.all([
        loadDetails(selection.map((f) => ({ id: f.properties.id, mun: f.properties.mun }))),
        loadCommon(),
      ])
      if (id !== farmRequest) return
      set({ farmData: { status: 'ready', byId, common } })
    } catch {
      if (id === farmRequest) set({ farmData: { status: 'error', byId: {}, common: null } })
    }
  },
  resetField: () => set({ step: 'map', panelOpen: false, terrain: 'off' }),
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
  setLayer: (id, patch) => set((s) => ({ layers: { ...s.layers, [id]: { ...s.layers[id], ...patch } } })),
  setGibsDate: (gibsDate) =>
    set((s) => ({
      gibsDate,
      layers: Object.fromEntries(Object.entries(s.layers).map(([k, v]) => [k, { ...v, error: false }])) as Record<GibsId, LayerState>,
    })),
}))
