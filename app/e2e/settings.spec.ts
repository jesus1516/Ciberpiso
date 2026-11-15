import { expect, test, type Page } from '@playwright/test'
import { unfold, FARMS, MUNICIPALITIES, SETTINGS_KEY, VIEWPORTS, clearTransient, openApp, openAppWith, reachLevel, toFarm, waitLevel } from './helpers'
import { measureLayout } from './layout'
import { textContrast } from './contrast'

// T-09: settings menu (text size, high contrast, reduced motion, 3D off), persistence, the data table.

const html = (page: Page) => page.evaluate(() => ({ size: document.documentElement.style.fontSize, ts: getComputedStyle(document.documentElement).getPropertyValue('--ts').trim(), contrast: document.documentElement.dataset.contrast, motion: document.documentElement.dataset.motion }))
const stored = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), SETTINGS_KEY)

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Settings' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
}

test('text size, high contrast and reduced motion apply at once and are saved', async ({ page }) => {
  await openApp(page)
  expect(await html(page)).toMatchObject({ size: '100%', contrast: 'normal' })
  await openSettings(page)
  await page.getByRole('radio', { name: '150 %' }).check({ force: true })
  await page.getByRole('checkbox', { name: /High contrast/ }).check()
  await page.getByRole('checkbox', { name: /Reduce motion/ }).check()
  expect(await html(page)).toEqual({ size: '150%', ts: '1.5', contrast: 'high', motion: 'reduced' })
  expect(await stored(page)).toEqual({ textSize: 150, highContrast: true, reduceMotion: true, use3d: true })
  // The heading really got bigger (44 px × 1.5).
  const h1 = await page.getByRole('heading', { level: 1 }).evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(h1).toBeGreaterThan(60)
  // Reload: the saved settings come back before the first paint.
  await page.reload()
  await page.waitForFunction(() => (window as any).__xp?.state.getState().phase === 'idle', null, { timeout: 60_000 })
  expect(await html(page)).toEqual({ size: '150%', ts: '1.5', contrast: 'high', motion: 'reduced' })
  // Reset.
  await openSettings(page)
  await page.getByRole('button', { name: 'Reset to defaults' }).click()
  expect(await html(page)).toMatchObject({ size: '100%', contrast: 'normal' })
  expect(await stored(page)).toEqual({ textSize: 100, highContrast: false, reduceMotion: false, use3d: true })
})

test('the OS preference prefers-reduced-motion switches the motion off too', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openApp(page)
  expect((await html(page)).motion).toBe('reduced')
  const anim = await page.locator('.xp .scene').first().evaluate((el) => getComputedStyle(el).animationName)
  expect(anim).toBe('none')
})

test('reduced motion makes a transition instant even at normal speed', async ({ page }) => {
  await openAppWith(page, { reduceMotion: true })
  await page.evaluate(() => (window as any).__xp.ctrl.setSpeed(1))
  const t0 = Date.now()
  await page.evaluate(() => (window as any).__xp.ctrl.go(1))
  await waitLevel(page, 1)
  expect(Date.now() - t0, 'Andalucía → Málaga with the clouds takes ~3 s normally').toBeLessThan(1500)
})

test('broken or blocked localStorage never breaks the app', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError') } })
  })
  const errors = await openApp(page)
  await openSettings(page)
  await page.getByRole('radio', { name: '125 %' }).check({ force: true })
  expect((await html(page)).size).toBe('125%') // applies for this visit
  expect(errors, 'console errors').toEqual([])
})

test('corrupt saved settings fall back to the defaults', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, '{"textSize": 999, "highContrast": "yes", nonsense'), SETTINGS_KEY)
  const errors = await openApp(page)
  expect(await html(page)).toMatchObject({ size: '100%', contrast: 'normal' })
  expect(errors).toEqual([])
})

// --------------------------------------------------------------------------- the data table

test('data table: indicators per rotation as a real table, available next to the 3D', async ({ page }) => {
  test.setTimeout(150_000)
  await openApp(page)
  await toFarm(page, MUNICIPALITIES.antequera, FARMS.antequera)
  await page.getByRole('button', { name: 'Data table' }).click()
  const table = page.getByRole('table')
  await expect(table).toBeVisible()
  await expect(table.getByRole('columnheader')).toHaveText(['Rotation', 'Crops', 'Water', 'Soil', 'Market', 'Climate risk', 'Final score', 'Rank'])
  await expect(table.getByRole('row')).toHaveCount(5)
  await expect(table.getByRole('rowheader')).toHaveText([/R0 Current/, /R1 \+ Chickpea/, /R2 \+ Vetch/, /R3 \+ Fallow/])
  // The values are the ones on the cards (R1 shown: water 66, soil 72, market 70, risk 55).
  const r1 = table.getByRole('row').filter({ hasText: 'R1' })
  await expect(r1).toContainText('1 ★ best')
  expect(await r1.getByRole('cell').allTextContents()).toEqual(expect.arrayContaining([expect.stringMatching(/^6[56]\.\d$/), '72.0', '55.0', '67.0']))
  await expect(table.locator('caption')).toContainText('priority “Water”')
  // Changing the priority re-ranks the table.
  await page.getByRole('button', { name: 'Market', exact: true }).click()
  await expect(table.locator('caption')).toContainText('priority “Market”')
  await page.getByRole('button', { name: 'Data table' }).click()
  await expect(table).toBeHidden()
})

// --------------------------------------------------------------------------- 3D off

test('3D off: no WebGL, flat map, data table, every control still works, Esc goes back', async ({ page }) => {
  test.setTimeout(150_000)
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  const errors = await openAppWith(page, { use3d: false })
  // Clouds are not used (and not downloaded): a transition is a plain map flight.
  await page.evaluate(() => (window as any).__xp.ctrl.go(1))
  await waitLevel(page, 1)
  await toFarm(page, MUNICIPALITIES.antequera, FARMS.antequera)
  const st = await page.evaluate(() => { const s = (window as any).__xp.state.getState(); return { flat: s.flat, dio: (window as any).__xp.ctrl.dio !== null } })
  expect(st).toEqual({ flat: true, dio: false })
  expect(requests.filter((u) => /diorama|clouds/.test(u)), 'no 3D / cloud chunks downloaded').toEqual([])
  await expect(page.locator('.dio-canvas')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  // The table is the terrain's replacement; the 3D-only controls are gone.
  const table = page.getByRole('table')
  await expect(table).toBeVisible()
  await expect(page.getByRole('button', { name: 'Satellite' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Re-centre view' })).toHaveCount(0)
  // Rotation, priority and years work without the diorama.
  await page.getByRole('button', { name: /^R2, / }).click()
  expect(await page.evaluate(() => (window as any).__xp.state.getState().view.rotation)).toBe('R2')
  await expect(page.getByRole('button', { name: /^R2, / })).toHaveAttribute('aria-pressed', 'true')
  await expect(table.getByRole('row').filter({ hasText: 'R2' })).toHaveAttribute('aria-current', 'true')
  await page.getByRole('button', { name: 'Soil', exact: true }).click()
  expect(await page.evaluate(() => (window as any).__xp.state.getState().view.profile)).toBe('soil_first')
  await page.getByRole('button', { name: /^2027: / }).click()
  expect(await page.evaluate(() => (window as any).__xp.state.getState().view.year)).toBe(2027)
  await page.evaluate(() => (window as any).__xp.ctrl.setSpeed(50))
  await page.getByRole('button', { name: 'Play campaigns' }).click()
  await page.waitForFunction(() => (window as any).__xp.state.getState().view.year === 2031, null, { timeout: 30_000 })
  // Full data still works (focus trap included) and Esc goes back to the municipality.
  await page.getByRole('button', { name: 'Full data', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Full data' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('heading', { level: 1 }).focus()
  await page.keyboard.press('Escape')
  await waitLevel(page, 2)
  await expect(page.getByRole('heading', { level: 1, name: 'Antequera' })).toBeFocused()
  expect(await page.evaluate(() => (window as any).__xp.state.getState().flat)).toBe(false)
  expect(errors, 'console errors').toEqual([])
})

// --------------------------------------------------------------------------- no overlaps with big text / high contrast

const LAYOUT_VPS = { ...VIEWPORTS, laptop: { width: 1280, height: 720 }, tablet: { width: 1024, height: 768 } } as const
const configs = [
  { id: 'text150', settings: { textSize: 150 } },
  { id: 'text125+contrast', settings: { textSize: 125, highContrast: true } },
] as const
for (const [vpName, vp] of Object.entries(LAYOUT_VPS)) {
  for (const cfg of configs) {
    for (const level of [0, 1, 2, 3] as const) {
      test(`no overlaps · ${cfg.id} · ${vpName} · level ${level}`, async ({ page }) => {
        test.setTimeout(150_000)
        await openAppWith(page, cfg.settings, vp)
        await reachLevel(page, level)
        await clearTransient(page)
        await page.waitForTimeout(900)
        const check = async (when: string) => {
          const r = await measureLayout(page)
          expect.soft(r.overlaps, `Overlapping panels (${when})`).toEqual([])
          expect.soft(r.outside, `Panels outside the viewport (${when})`).toEqual([])
          expect.soft(r.clipped, `Clipped text (${when})`).toEqual([])
        }
        await check('top')
        for (const sel of ['.fx-col', '.narrative']) {
          const scrolled = await page.evaluate((s) => { const el = document.querySelector(s); if (!el || el.scrollHeight <= el.clientHeight + 1) return false; el.scrollTop = el.scrollHeight; return true }, sel)
          if (scrolled) { await page.waitForTimeout(250); await check(`${sel} scrolled to the end`) }
        }
        // The combobox open (level 0–2): the narrative stays inside the viewport and the highlighted option is visible in it.
        if (level < 3) {
          await unfold(page)
          await page.getByRole('combobox', { name: /from the list$/ }).focus()
          await page.waitForTimeout(300)
          const box = await page.evaluate(() => {
            const n = document.querySelector('.narrative')!.getBoundingClientRect()
            const o = document.querySelector('.al-list:not([hidden]) li.on')?.getBoundingClientRect()
            return o ? { narrativeBottom: n.bottom, vh: innerHeight, optionInside: o.top >= n.top - 1 && o.bottom <= n.bottom + 1 } : null
          })
          expect(box, 'the list is open with a highlighted option').not.toBeNull()
          expect(box!.narrativeBottom, 'narrative inside the viewport').toBeLessThanOrEqual(box!.vh + 1)
          expect(box!.optionInside, 'highlighted option scrolled into view inside the narrative').toBe(true)
        }
      })
    }
  }
}

test('high contrast: text contrast measured on the rendered page (farm view and map)', async ({ page }) => {
  test.setTimeout(150_000)
  await openAppWith(page, { highContrast: true })
  await reachLevel(page, 2)
  await clearTransient(page)
  await page.waitForTimeout(800)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()) // the focus ring is not text
  const map = await textContrast(page, ['.masthead', '.narrative', '.crumbs', '.back', '.disclaimer'])
  expect(map.checked).toBeGreaterThan(5)
  expect(map.failures, `lowest: ${JSON.stringify(map.lowest)}`).toEqual([])
  await reachLevel(page, 3)
  await clearTransient(page)
  await page.waitForTimeout(1000)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()) // the focus ring is not text
  const farm = await textContrast(page, ['.fx-col', '.fx-stage', '.fx-legend', '.crumbs', '.back'])
  expect(farm.checked).toBeGreaterThan(20)
  expect(farm.failures, `lowest: ${JSON.stringify(farm.lowest)}`).toEqual([])
  // Stronger than AA: words are at least 7:1 in this mode. The one-letter crop codes sit on the fixed crop
  // colours (4 groups, same in every mode), which keep their AA contrast (checked above).
  const words = farm.lowest.filter((t) => t.text.length > 1)
  for (const t of words) expect(t.ratio, `text "${t.text}"`).toBeGreaterThanOrEqual(7)
})
