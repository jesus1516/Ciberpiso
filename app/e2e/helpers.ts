import { expect, type Page } from '@playwright/test'

/** One-pixel transparent PNG: stands in for every map tile so tests never depend on the network. */
const BLANK_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

export const FARMS = {
  /** Antequera, project candidate, plain farmland. */
  antequera: 2900059683,
  /** Ronda, plain farmland. */
  ronda: 2900263939,
  /** Ronda, urban: cannot be opened. */
  urban: 2900264015,
  /** Antequera, apt = "pendiente" (53.7 % slope, mostly permanent crop): opens with a critical insight. */
  steep: 2900063712,
  /** Ronda, plain farmland with nothing to warn about: the only insight is the best rotation. */
  calm: 2900261494,
} as const
export const MUNICIPALITIES = { antequera: 29015, ronda: 29084 } as const

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const

/** Errors the page logged (console errors, uncaught exceptions). Collected by `openApp`. */
export type ErrorLog = string[]

/**
 * Opens the app in director mode with every external request (map imagery, elevation tiles)
 * answered locally, and waits until the first level is interactive.
 */
export async function openApp(page: Page, viewport: { width: number; height: number } = VIEWPORTS.desktop): Promise<ErrorLog> {
  const errors: ErrorLog = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  await page.setViewportSize(viewport)
  await page.route((url) => !['127.0.0.1', 'localhost'].includes(url.hostname), (route) => route.fulfill({ status: 200, contentType: 'image/png', body: BLANK_PNG }))
  await page.goto('/?director')
  await page.waitForFunction(() => (window as any).__xp?.state.getState().phase === 'idle', null, { timeout: 60_000 })
  await page.evaluate(() => (window as any).__xp.ctrl.setSpeed(50))
  return errors
}

export const levelOf = (page: Page) => page.evaluate(() => (window as any).__xp.state.getState().level as number)

async function settle(page: Page, level: number) {
  await page.waitForFunction(
    (l) => { const s = (window as any).__xp.state.getState(); return s.phase === 'idle' && s.level === l },
    level,
    { timeout: 60_000 },
  )
}

/** Andalucía (0) → Málaga (1): the same transition as clicking the province. */
export async function toProvince(page: Page) {
  await page.evaluate(() => (window as any).__xp.ctrl.go(1))
  await settle(page, 1)
}

/** Málaga → a municipality (level 2). */
export async function toMunicipality(page: Page, mun: number) {
  if ((await levelOf(page)) === 0) await toProvince(page)
  await page.evaluate((m) => {
    const xp = (window as any).__xp
    const info = xp.ctrl.municipalities.features.find((f: any) => f.properties.mun === m).properties
    xp.ctrl.go(2, { municipality: info })
  }, mun)
  await settle(page, 2)
  // The farms are loaded in the background: wait until they are on the map.
  await page.waitForFunction(() => (window as any).__xp.state.getState().farmsCount !== null, null, { timeout: 60_000 })
}

/** A municipality → one of its farms (level 3). */
export async function toFarm(page: Page, mun: number, farmId: number) {
  await toMunicipality(page, mun)
  await page.evaluate((id) => {
    const xp = (window as any).__xp
    xp.ctrl.go(3, { farm: xp.getFarm(id) })
  }, farmId)
  await settle(page, 3)
}

/** Reaches a level quickly by the shortest route (Antequera / farm 2900059683 for levels 2 and 3). */
export async function reachLevel(page: Page, level: 0 | 1 | 2 | 3) {
  if (level === 1) await toProvince(page)
  if (level === 2) await toMunicipality(page, MUNICIPALITIES.antequera)
  if (level === 3) await toFarm(page, MUNICIPALITIES.antequera, FARMS.antequera)
  expect(await levelOf(page)).toBe(level)
}

/** Hides transient UI (toast, tooltip) so layout checks measure the resting state. */
export async function clearTransient(page: Page) {
  await page.evaluate(() => (window as any).__xp.state.setState({ toast: null, hover: null }))
  await page.waitForTimeout(400)
}

// ---------------------------------------------------------------- accessibility helpers (T-09)

export const SETTINGS_KEY = 'agrospace.settings.v1'

/** Opens the app with saved settings (text size, contrast, motion, 3D) already in localStorage. */
export async function openAppWith(page: Page, settings: Record<string, unknown>, viewport: { width: number; height: number } = VIEWPORTS.desktop): Promise<ErrorLog> {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [SETTINGS_KEY, JSON.stringify(settings)])
  return openApp(page, viewport)
}

/** What has keyboard focus: tag, role, accessible-ish name and id. */
export const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return { tag: 'body', role: '', name: '', id: '', inside: '' }
    const label = (el as HTMLInputElement).labels?.[0]?.textContent
    const name = (el.getAttribute('aria-label') ?? label ?? (el.textContent ?? '')).replace(/\s+/g, ' ').trim().slice(0, 60)
    return { tag: el.tagName.toLowerCase(), role: el.getAttribute('role') ?? '', name, id: el.id, inside: el.closest('[role="dialog"]')?.getAttribute('aria-labelledby') ?? '' }
  })

/** Presses Tab until the focused element matches (or fails after `max` presses). Returns every stop on the way. */
export async function tabTo(page: Page, match: (f: Awaited<ReturnType<typeof focused>>) => boolean, max = 40) {
  const stops: Awaited<ReturnType<typeof focused>>[] = []
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab')
    const f = await focused(page)
    stops.push(f)
    if (match(f)) return stops
  }
  throw new Error(`Tab did not reach the target in ${max} presses. Stops: ${stops.map((f) => `${f.tag}[${f.role}] "${f.name}"`).join(' → ')}`)
}

/** Waits until the explorer is idle on a level (after a keyboard-driven transition). */
export async function waitLevel(page: Page, level: number) {
  await page.waitForFunction((l) => { const s = (window as any).__xp.state.getState(); return s.phase === 'idle' && s.level === l }, level, { timeout: 60_000 })
}

/** Phones open with the narrative folded (map first): press "Details" if it is folded. */
export async function unfold(page: Page) {
  const fold = page.locator('.fold[aria-expanded="false"]')
  if (await fold.isVisible()) await fold.click()
}
