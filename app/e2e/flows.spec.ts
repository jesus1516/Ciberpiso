import { expect, test, type Page } from '@playwright/test'
import { FARMS, MUNICIPALITIES, levelOf, openApp, reachLevel, toFarm, toMunicipality, toProvince, type ErrorLog } from './helpers'

// User journeys through the four levels. Navigation goes through the director hooks
// (`window.__xp.ctrl.go`, speed x50); going back and the farm click use the real interface.

const crumbs = (page: Page) => page.getByRole('navigation', { name: 'Breadcrumb' })
const backButton = (page: Page) => page.getByRole('button', { name: /^Back/ })
const state = <T>(page: Page, pick: (s: any) => T) => page.evaluate(`(${pick.toString()})(window.__xp.state.getState())`) as Promise<T>

let errors: ErrorLog
test.beforeEach(async ({ page }) => {
  errors = await openApp(page)
})
test.afterEach(() => {
  expect(errors, 'the page must not log errors').toEqual([])
})

test('Andalucía → Málaga → Antequera → farm 2900059683 → back to Andalucía', async ({ page }) => {
  test.setTimeout(150_000)

  // Level 0
  await expect(page.getByRole('heading', { name: 'Where is your farm?' })).toBeVisible()
  await expect(page.getByText('Step 1 of 4 · Andalucía')).toBeVisible()
  await expect(backButton(page)).toBeDisabled()

  // Level 1
  await toProvince(page)
  await expect(page.getByRole('heading', { name: 'Choose the municipality' })).toBeVisible()
  await expect(crumbs(page).getByRole('button')).toHaveText(['Andalucía', 'Málaga'])

  // Level 2
  await toMunicipality(page, MUNICIPALITIES.antequera)
  await expect(page.getByRole('heading', { name: 'Antequera' })).toBeVisible()
  await expect(page.getByText(/SIGPAC farms\. Zoom in and pick one/)).toBeVisible()
  await expect(page.getByText('Not farmland', { exact: true })).toBeVisible() // legend chip
  expect(await state(page, (s) => s.municipality.mun)).toBe(MUNICIPALITIES.antequera)

  // Level 3
  await toFarm(page, MUNICIPALITIES.antequera, FARMS.antequera)
  await expect(crumbs(page).getByRole('button')).toHaveText(['Andalucía', 'Málaga', 'Antequera', 'Farm 62-14'])
  await expect(page.getByText('Project candidate · Antequera')).toBeVisible()
  await expect(page.getByText('95.8', { exact: false }).first()).toBeVisible()
  for (const rot of ['Current', '+ Chickpea', '+ Vetch', '+ Fallow']) await expect(page.getByText(rot, { exact: true })).toBeVisible()
  expect(await state(page, (s) => s.sel.farm.properties.id)).toBe(FARMS.antequera)
  await expect(page.locator('.fx-card')).toHaveCount(4)

  // Back to Andalucía with the breadcrumb (three levels at once)
  await crumbs(page).getByRole('button', { name: 'Andalucía' }).click()
  await expect.poll(() => state(page, (s) => `${s.level}/${s.phase}`), { timeout: 60_000 }).toBe('0/idle')
  await expect(page.getByRole('heading', { name: 'Where is your farm?' })).toBeVisible()
  expect(await state(page, (s) => s.sel)).toBeNull()
  expect(await state(page, (s) => s.municipality)).toBeNull()
})

test('the Back button and Esc go up one level at a time', async ({ page }) => {
  test.setTimeout(150_000)
  await toFarm(page, MUNICIPALITIES.antequera, FARMS.antequera)

  await backButton(page).click()
  await expect.poll(() => state(page, (s) => `${s.level}/${s.phase}`), { timeout: 60_000 }).toBe('2/idle')
  await expect(page.getByRole('heading', { name: 'Antequera' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect.poll(() => state(page, (s) => `${s.level}/${s.phase}`), { timeout: 60_000 }).toBe('1/idle')
  await expect(page.getByRole('heading', { name: 'Choose the municipality' })).toBeVisible()

  await backButton(page).click()
  await expect.poll(() => state(page, (s) => `${s.level}/${s.phase}`), { timeout: 60_000 }).toBe('0/idle')
  await expect(backButton(page)).toBeDisabled()
})

test('a municipality outside Antequera (Ronda 29084) and a farm there (2900263939)', async ({ page }) => {
  test.setTimeout(150_000)
  await toMunicipality(page, MUNICIPALITIES.ronda)
  await expect(page.getByRole('heading', { name: 'Ronda' })).toBeVisible()
  // The "Candidate" legend chip is only shown when the municipality has project candidates
  const candidates = await state(page, (s) => s.municipality.candidatas as number)
  await expect(page.locator('.chips').getByText('Candidate', { exact: true })).toHaveCount(candidates > 0 ? 1 : 0)

  expect(await page.evaluate((id) => !!(window as any).__xp.getFarm(id), FARMS.ronda)).toBe(true)
  await toFarm(page, MUNICIPALITIES.ronda, FARMS.ronda)
  await expect(crumbs(page).getByRole('button')).toHaveText(['Andalucía', 'Málaga', 'Ronda', 'Farm 10-119'])
  await expect(page.getByText('36.1', { exact: false }).first()).toBeVisible()
  await expect(page.locator('.fx-card').first()).toBeVisible()
  expect(await state(page, (s) => s.sel.farm.properties.mun)).toBe(MUNICIPALITIES.ronda)
})

test('clicking an urban farm (2900264015) shows a warning and does not open it', async ({ page }) => {
  test.setTimeout(150_000)
  await toMunicipality(page, MUNICIPALITIES.ronda)

  const farm = await page.evaluate((id) => (window as any).__xp.getFarm(id).properties, FARMS.urban)
  expect(farm).toMatchObject({ apt: 'urbano', cover: 'urbano' })

  // Zoom on the farm and click on its centre with the real mouse (the click handler of the map).
  const point = await page.evaluate(async (id) => {
    const { ctrl, getFarm } = (window as any).__xp
    const map = ctrl.map
    const geom = getFarm(id).geometry
    const ring = (geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0]) as [number, number][]
    const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length
    const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length
    map.jumpTo({ center: [lng, lat], zoom: 18 })
    const hit = () => map.queryRenderedFeatures(map.project([lng, lat]), { layers: ['farms-fill'] }).some((f: any) => Number(f.id) === id)
    for (let i = 0; i < 100 && !hit(); i++) await new Promise((r) => setTimeout(r, 100))
    const p = map.project([lng, lat])
    const box = map.getCanvas().getBoundingClientRect()
    return { x: box.left + p.x, y: box.top + p.y, hit: hit() }
  }, FARMS.urban)
  expect(point.hit, 'the urban farm must be rendered under the cursor').toBe(true)

  await page.mouse.click(point.x, point.y)

  const toast = page.getByRole('status').filter({ hasText: 'Not farmland' })
  await expect(toast).toBeVisible()
  await expect(toast).toContainText('Urban or built-up area: this farm cannot be analysed')
  // It stays on level 2 and no farm is selected
  await page.waitForTimeout(1000)
  expect(await levelOf(page)).toBe(2)
  expect(await state(page, (s) => `${s.phase}/${s.sel}`)).toBe('idle/null')
  await expect(page.getByRole('heading', { name: 'Ronda' })).toBeVisible()
})

test('the Sources button opens the about dialog', async ({ page }) => {
  await reachLevel(page, 1)
  await page.getByRole('button', { name: 'Sources' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})
