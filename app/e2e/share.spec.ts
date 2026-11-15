// Shareable links (share.ts): the URL fragment follows the view, and opening a link restores it.
import { expect, test, type Page } from '@playwright/test'
import { FARMS, MUNICIPALITIES, VIEWPORTS, levelOf, openApp, toFarm, toProvince } from './helpers'

/** Antequera, polygon 62, parcel 14 (FARMS.antequera). */
const PID = '29:15:0:0:62:14'
const hash = (page: Page) => page.evaluate(() => location.hash)
const state = (page: Page) => page.evaluate(() => {
  const s = (window as any).__xp.state.getState()
  return { level: s.level, phase: s.phase, farm: s.sel?.farm.properties.id, mun: s.municipality?.mun, view: s.view }
})

test('the address follows the view without adding history entries', async ({ page }) => {
  test.setTimeout(150_000)
  await openApp(page)
  expect(await hash(page)).toBe('')
  const entries = await page.evaluate(() => history.length)
  await toFarm(page, MUNICIPALITIES.antequera, FARMS.antequera)
  await expect.poll(() => hash(page)).toBe(`#f=${PID}&r=R1&p=water&y=2025&v=satellite&x=2`)
  await page.getByRole('button', { name: /^R2, / }).click()
  await page.getByRole('button', { name: 'Soil', exact: true }).click()
  await expect.poll(() => hash(page)).toMatch(new RegExp(`^#f=${PID}&r=R2&p=soil&y=20\\d\\d&v=satellite&x=2$`))
  await page.evaluate(() => (window as any).__xp.ctrl.go(2))
  await expect.poll(() => hash(page)).toBe('#m=15')
  await page.evaluate(() => (window as any).__xp.ctrl.go(1))
  await expect.poll(() => hash(page)).toBe('')
  expect(await page.evaluate(() => location.search)).toBe('?director')
  expect(await page.evaluate(() => history.length)).toBe(entries)
})

test('a shared link opens the farm with its rotation, priority, year, mode and relief', async ({ page }) => {
  test.setTimeout(150_000)
  const errors = await openApp(page, VIEWPORTS.desktop, `/?director#f=${PID}&r=R3&p=market&y=2028&v=model&x=3.5`)
  await expect.poll(() => state(page), { timeout: 90_000 }).toMatchObject({
    level: 3, phase: 'idle', farm: FARMS.antequera,
    view: { rotation: 'R3', profile: 'profit_first', year: 2028, mode: 'model', exaggeration: 3.5 },
  })
  await expect(page.getByRole('button', { name: /^R3, / })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Market', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Model', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => hash(page)).toBe(`#f=${PID}&r=R3&p=market&y=2028&v=model&x=3.5`)
  expect(errors).toEqual([])
})

test('a link to a municipality opens its farm map', async ({ page }) => {
  test.setTimeout(120_000)
  await openApp(page, VIEWPORTS.desktop, '/?director#m=84')
  await expect.poll(() => state(page), { timeout: 90_000 }).toMatchObject({ level: 2, phase: 'idle', mun: MUNICIPALITIES.ronda })
})

test('a broken link says so and the explorer starts as usual', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = await openApp(page, VIEWPORTS.desktop, '/?director#f=29:15:0:0:99999:1&r=R2')
  await expect(page.getByText('Link not found')).toBeVisible()
  await expect(page.getByText('Antequera has no SIGPAC parcel 99999/1.')).toBeVisible()
  expect(await levelOf(page)).toBe(0)
  await expect.poll(() => hash(page)).toBe('')
  expect(errors).toEqual([])
})

test('a link pasted into the open tab goes there', async ({ page }) => {
  test.setTimeout(150_000)
  await openApp(page)
  await toProvince(page)
  await page.evaluate((pid) => { location.hash = `#f=${pid}&r=R2` }, PID)
  await expect.poll(() => state(page), { timeout: 90_000 }).toMatchObject({ level: 3, phase: 'idle', farm: FARMS.antequera, view: { rotation: 'R2' } })
})
