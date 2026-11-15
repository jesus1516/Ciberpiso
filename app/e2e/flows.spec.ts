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
  await expect(page.locator('.chips').getByText(/^★?\s*Candidate$/)).toHaveCount(candidates > 0 ? 1 : 0)

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

// Insights (explorer/insights.ts): 1–3 ranked points at the top of the farm column, the card
// behind the top one emphasised, the others receded, and the key point announced once.
const insights = (page: Page) => page.locator('.fx-insights')
const topInsight = (page: Page) => insights(page).locator('.ins.top')
const moreInsights = (page: Page) => insights(page).locator('.ins-more summary')

test('farm insights: Antequera 2900059683 (heat, water deficit, best rotation)', async ({ page }) => {
  test.setTimeout(150_000)
  await toFarm(page, MUNICIPALITIES.antequera, FARMS.antequera)

  await expect(topInsight(page)).toHaveClass(/warning/)
  await expect(topInsight(page).getByRole('heading')).toHaveText(/^High heat risk in May–June \(14\s+days\)$/)
  await expect(topInsight(page)).toContainText('cuts the climate-risk score by 35')
  await expect(moreInsights(page)).toHaveText([/Severe water deficit \(823\s+mm\/yr\)/, /Best option: R1 \(\+2\.8 points over current\)/])
  // The top insight is the largest text of the column
  const sizes = await page.evaluate(() => {
    const px = (el: Element | null) => (el ? parseFloat(getComputedStyle(el).fontSize) : 0)
    const others = [...document.querySelectorAll('.fx-col *')].filter((el) => !el.closest('.ins.top') && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()))
    return { top: px(document.querySelector('.ins.top h2')), max: Math.max(...others.map(px)) }
  })
  expect(sizes.top).toBeGreaterThan(sizes.max)

  // The card behind the top insight (climate risk) stands out; the others recede
  await expect(page.locator('.fx-card.emph')).toHaveAttribute('data-k', 'risk')
  await expect(page.locator('.fx-card.recede')).toHaveCount(3)
  await expect(page.locator('.fx-card.emph .ev')).toBeVisible()

  // Announced once to screen readers
  const live = page.locator('.fx-col [aria-live="polite"]')
  await expect(live).toHaveText(/^Key point for this farm: High heat risk in May–June \(14\s+days\)\. Also: Severe water deficit/)

  // Recommendation under the rotation selector, for the chosen priority
  await expect(page.locator('.rec')).toContainText('R1 (+ Chickpea) is best for Water: 67.0 vs. 64.2 now, mainly better soil (+7.5)')
  await page.locator('.prio').getByRole('button', { name: 'Market' }).click()
  await expect(page.locator('.rec')).toContainText('Keep the current rotation: it is best for Market (68.6)')
  await expect(moreInsights(page).last()).toHaveText(/Current rotation is already the best option/)
  await expect(live).toHaveText(/^Key point for this farm: High heat risk/) // not re-announced

  // Opening a secondary insight shows its sentence and emphasises its card; clicking a card does too
  await moreInsights(page).first().click()
  await expect(insights(page).locator('.ins-more .why').first()).toContainText('823')
  await expect(page.locator('.fx-card.emph')).toHaveAttribute('data-k', 'water')
  await page.locator('.fx-card[data-k="soil"]').click()
  await expect(page.locator('.fx-card.emph')).toHaveAttribute('data-k', 'soil')
})

test('farm insights: Ronda 2900263939 (steep slope)', async ({ page }) => {
  test.setTimeout(150_000)
  await toFarm(page, MUNICIPALITIES.ronda, FARMS.ronda)
  await expect(topInsight(page).getByRole('heading')).toHaveText(/^Steep slope \(14\.8\s+%\): erosion risk$/)
  await expect(moreInsights(page)).toHaveText([/Best option: R1 \(\+2\.4 points over current\)/])
  await expect(page.locator('.fx-card.emph')).toHaveAttribute('data-k', 'soil')
})

test('farm insights: a farm with apt set (Antequera 2900063712, very steep)', async ({ page }) => {
  test.setTimeout(150_000)
  await toFarm(page, MUNICIPALITIES.antequera, FARMS.steep)
  expect(await state(page, (s) => s.sel.farm.properties.apt)).toBe('pendiente')
  await expect(topInsight(page)).toHaveClass(/critical/)
  await expect(topInsight(page)).toContainText('Critical')
  await expect(topInsight(page).getByRole('heading')).toHaveText(/^Very steep slope \(53\.7\s+%\): hard to farm$/)
  await expect(moreInsights(page)).toHaveText([/Looks like a permanent crop: rotations are indicative/, /Severe water deficit/])
})

test('farm insights: a farm with nothing to warn about (Ronda 2900261494)', async ({ page }) => {
  test.setTimeout(150_000)
  await toFarm(page, MUNICIPALITIES.ronda, FARMS.calm)
  await expect(topInsight(page)).toHaveClass(/good/)
  await expect(topInsight(page).getByRole('heading')).toHaveText(/^Best option: R1 \(\+\d\.\d points over current\)$/)
  await expect(moreInsights(page)).toHaveCount(0)
  // The opportunity is about the rotation selector: it is the emphasised element
  await expect(page.locator('.fx-dock.emph')).toHaveCount(1)
  await expect(page.locator('.fx-card.recede')).toHaveCount(4)
})
