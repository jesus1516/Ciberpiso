import { expect, test, type Page } from '@playwright/test'
import { clearTransient, FARMS, MUNICIPALITIES, openApp, reachLevel, toFarm, VIEWPORTS } from './helpers'
import { measureLayout } from './layout'

// Every level (and a few extra states) at 1440×900, 1280×720, 1024×768 and 390×844: panels must not overlap, must
// stay inside the viewport and text must not be cut off. A problem is a failing test with the
// offending elements in the message. Known problems are listed in KNOWN and marked `test.fail`
// (see docs/testing.md); once one is fixed its test "unexpectedly passes" and the entry must go.

type Scenario = {
  id: string
  title: string
  setup: (page: Page) => Promise<void>
  /** The sheet is a drawer that covers the farm view on purpose, so only its own box is checked. */
  coversOthers?: boolean
}

const scenarios: Scenario[] = [
  { id: 'level0', title: 'level 0 · Andalucía', setup: (p) => reachLevel(p, 0) },
  { id: 'level1', title: 'level 1 · Málaga', setup: (p) => reachLevel(p, 1) },
  { id: 'level2', title: 'level 2 · municipality (Antequera)', setup: (p) => reachLevel(p, 2) },
  { id: 'level3', title: 'level 3 · farm (Antequera 2900059683)', setup: (p) => reachLevel(p, 3) },
  { id: 'level3-ronda', title: 'level 3 · farm (Ronda 2900263939)', setup: (p) => toFarm(p, MUNICIPALITIES.ronda, FARMS.ronda) },
  {
    id: 'level2-toast',
    title: 'level 2 · with the "not farmland" toast',
    setup: async (p) => {
      await reachLevel(p, 2)
      await p.evaluate(() => (window as any).__xp.state.setState({
        toast: { title: 'Not farmland', body: 'Urban or built-up area: this farm cannot be analysed (SIGPAC and ESA WorldCover).', kind: 'blocked' },
      }))
    },
  },
  {
    id: 'level3-full-data',
    title: 'level 3 · "Full data" sheet open',
    coversOthers: true,
    setup: async (p) => {
      await reachLevel(p, 3)
      await p.getByRole('button', { name: 'Full data', exact: true }).click()
      await expect(p.locator('.xp-sheet')).toBeVisible()
    },
  },
]

/** `<viewport>/<scenario id>` → what is known to be wrong. Empty: add an entry only for a real, tracked bug. */
const KNOWN: Record<string, string> = {}

/**
 * The layout suite checks two more sizes than the shared desktop/phone pair: a small laptop
 * (1280×720) and a tablet in landscape (1024×768), where the farm view uses its narrower column.
 */
const LAYOUT_VIEWPORTS = {
  ...VIEWPORTS,
  laptop: { width: 1280, height: 720 },
  tablet: { width: 1024, height: 768 },
} as const

for (const [vpName, viewport] of Object.entries(LAYOUT_VIEWPORTS)) {
  for (const sc of scenarios) {
    test(`layout ${vpName} ${viewport.width}x${viewport.height} · ${sc.title}`, async ({ page }) => {
      test.setTimeout(150_000)
      const known = KNOWN[`${vpName}/${sc.id}`]
      if (known) test.fail(true, known)
      await openApp(page, viewport)
      await sc.setup(page)
      if (sc.id !== 'level2-toast') await clearTransient(page)
      await page.waitForTimeout(800)
      const r = await measureLayout(page)
      expect(r.panels, 'some panels must be visible').toBeGreaterThan(2)
      const where = `${viewport.width}x${viewport.height}, ${sc.title}`
      const overlaps = sc.coversOthers ? r.overlaps.filter((o) => !o.includes('xp-sheet')) : r.overlaps
      expect.soft(overlaps, `Overlapping panels at ${where}`).toEqual([])
      expect.soft(r.outside, `Panels outside the viewport at ${where}`).toEqual([])
      expect.soft(r.clipped, `Clipped text at ${where}`).toEqual([])
    })
  }
}
