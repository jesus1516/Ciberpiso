import type { Map } from 'maplibre-gl'
import { create } from 'zustand'
import { computeClimate, type Climate } from './lib/climate'
import { loadCommon, loadDetails, observedCrop, soilTexture, type Common, type FarmDetail } from './lib/detail'
import { fieldCentroid, toField, weightedSlope, type BBox, type Field, type Farm } from './lib/geo'
import { daysAgo, type GibsId } from './lib/gibs'
import { loadIndicators as fetchIndicators, type Indicators } from './lib/indicators'
import { fetchPower, type PowerSource } from './lib/power'
import type { SoilType } from './lib/soil'
import { slopeClass } from './lib/terrain'

export type Step = 'map' | 'dashboard'
export type Terrain = 'off' | 'on' | 'flat'
export type Tab = 'conditions' | 'layers' | 'priorities' | 'rotations'
export type LoadStatus = 'loading' | 'ready' | 'error'
export type MunicipalityFocus = { key: number; name: string; bounds?: BBox }
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
  priorities: Priorities
  constraints: Constraints
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
  setPriority: (key: PriorityKey, value: number) => void
  setConstraints: (patch: Partial<Constraints>) => void
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
  priorities: { water: 3, income: 3, erosion: 3, organic: 3, cost: 3 },
  constraints: { irrigation: 'no', currentCrop: 'wheat', soil: 'loam', slope: 'gentle', slopePct: null },
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
    const slopePct = weightedSlope(field)
    set((s) => ({
      selection: [farm],
      field,
      step: 'dashboard',
      panelOpen: true,
      panelSeen: false,
      tab: 'rotations',
      constraints: slopePct === null ? s.constraints : { ...s.constraints, slopePct, slope: slopeClass(slopePct) },
    }))
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
    const slopePct = weightedSlope(field)
    set((s) => ({
      step: 'dashboard',
      panelOpen: false,
      panelSeen: false,
      constraints: slopePct === null ? s.constraints : { ...s.constraints, slopePct, slope: slopeClass(slopePct) },
    }))
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
      const largest = [...selection].sort((a, b) => b.properties.ha - a.properties.ha)[0]
      const texture = soilTexture(byId[largest?.properties.id]?.suelo ?? null)
      const observed = observedCrop(byId[largest?.properties.id])
      set((s) => ({
        farmData: { status: 'ready', byId, common },
        constraints: { ...s.constraints, ...(texture && { soil: texture }), ...(observed && { currentCrop: observed.crop }) },
      }))
    } catch {
      if (id === farmRequest) set({ farmData: { status: 'error', byId: {}, common: null } })
    }
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
