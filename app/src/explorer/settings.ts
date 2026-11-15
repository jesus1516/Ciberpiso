// Accessibility settings: text size, high contrast, reduced motion and the 3D on/off switch.
// They live in one small store, are persisted in localStorage (every access is wrapped in
// try/catch: private mode, blocked storage and corrupt values must never break the app) and are
// applied to <html> as attributes and a CSS variable that explorer.css / access.css read:
//   --ts                    text scale (1, 1.25, 1.5): every font size in the explorer is calc(Npx * var(--ts))
//   html font-size          the same scale for the rem-based parts (Full data drawer, Sources dialog)
//   data-contrast="high"    high-contrast palette
//   data-motion="reduced"   no animations or transitions (also when the OS asks for it)
import { create } from 'zustand'

export const TEXT_SIZES = [100, 125, 150] as const
export type TextSize = (typeof TEXT_SIZES)[number]

export type Settings = {
  textSize: TextSize
  highContrast: boolean
  /** Reduce motion on top of the operating system preference. */
  reduceMotion: boolean
  /** The 3D terrain and the cloud transitions. Off: the data table and the flat map are used. */
  use3d: boolean
}

export const DEFAULT_SETTINGS: Settings = { textSize: 100, highContrast: false, reduceMotion: false, use3d: true }
export const STORAGE_KEY = 'ciberpiso.settings.v1'

/** Reads and validates the stored settings; anything unexpected falls back to the defaults. */
export function parseSettings(raw: string | null): Settings {
  if (!raw) return { ...DEFAULT_SETTINGS }
  try {
    const v = JSON.parse(raw) as Partial<Settings> | null
    if (!v || typeof v !== 'object') return { ...DEFAULT_SETTINGS }
    return {
      textSize: (TEXT_SIZES as readonly number[]).includes(v.textSize as number) ? (v.textSize as TextSize) : DEFAULT_SETTINGS.textSize,
      highContrast: typeof v.highContrast === 'boolean' ? v.highContrast : DEFAULT_SETTINGS.highContrast,
      reduceMotion: typeof v.reduceMotion === 'boolean' ? v.reduceMotion : DEFAULT_SETTINGS.reduceMotion,
      use3d: typeof v.use3d === 'boolean' ? v.use3d : DEFAULT_SETTINGS.use3d,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function load(): Settings {
  try {
    return parseSettings(globalThis.localStorage?.getItem(STORAGE_KEY) ?? null)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function save(s: Settings) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable: the settings last for this visit only */
  }
}

export const useSettings = create<Settings>(() => load())

export function updateSettings(patch: Partial<Settings>) {
  useSettings.setState(patch)
  const { textSize, highContrast, reduceMotion, use3d } = useSettings.getState()
  save({ textSize, highContrast, reduceMotion, use3d })
}

export function resetSettings() {
  updateSettings({ ...DEFAULT_SETTINGS })
}

const osReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** True when animations must be skipped: the operating system asks for it or the setting is on. */
export const reducedMotion = () => osReducedMotion() || useSettings.getState().reduceMotion
/** True when the 3D terrain and the clouds may be used. */
export const use3d = () => useSettings.getState().use3d

/** Writes the settings to <html>. Called once at start and on every change. */
export function applySettings(s: Settings = useSettings.getState(), root: HTMLElement = document.documentElement) {
  root.style.setProperty('--ts', String(s.textSize / 100))
  root.style.fontSize = `${s.textSize}%`
  root.dataset.contrast = s.highContrast ? 'high' : 'normal'
  root.dataset.motion = s.reduceMotion || osReducedMotion() ? 'reduced' : 'normal'
  root.dataset.text = String(s.textSize)
}
