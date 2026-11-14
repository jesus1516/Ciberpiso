import type { Map } from 'maplibre-gl'
import { create } from 'zustand'
import type { Field } from './lib/geo'

export type Step = 'map' | 'dashboard'
export type DrawMode = 'idle' | 'polygon' | 'point'
export type Terrain = 'off' | 'on' | 'flat'
export type Tab = 'conditions' | 'layers' | 'priorities' | 'rotations'

type State = {
  map: Map | null
  step: Step
  drawMode: DrawMode
  field: Field | null
  terrain: Terrain
  panelOpen: boolean
  tab: Tab
  aboutOpen: boolean
  setMap: (map: Map | null) => void
  setDrawMode: (mode: DrawMode) => void
  setField: (field: Field | null) => void
  confirmField: () => void
  resetField: () => void
  setTerrain: (terrain: Terrain) => void
  setPanelOpen: (open: boolean) => void
  setTab: (tab: Tab) => void
  setAboutOpen: (open: boolean) => void
}

export const useStore = create<State>((set) => ({
  map: null,
  step: 'map',
  drawMode: 'idle',
  field: null,
  terrain: 'off',
  panelOpen: false,
  tab: 'conditions',
  aboutOpen: false,
  setMap: (map) => set({ map }),
  setDrawMode: (drawMode) => set({ drawMode }),
  setField: (field) => set({ field, drawMode: 'idle' }),
  confirmField: () => set({ step: 'dashboard', panelOpen: false }),
  resetField: () => set({ step: 'map', field: null, panelOpen: false, terrain: 'off', drawMode: 'idle' }),
  setTerrain: (terrain) => set({ terrain }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setTab: (tab) => set({ tab }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
}))
