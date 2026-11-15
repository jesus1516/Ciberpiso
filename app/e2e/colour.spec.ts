import { expect, test } from '@playwright/test'
import { textContrast } from './contrast'
import { FARMS, MUNICIPALITIES, VIEWPORTS, clearTransient, openApp, reachLevel, toFarm } from './helpers'

// T-08, accessible colour system: text contrast against the real backdrop, and colour is never the
// only signal. (The token pairs, colour-blind distances and "no stray hex" rules are unit tests:
// src/explorer/tokens.test.ts.)

const FARM_ROOTS = ['.fx-col', '.fx-tools', '.fx-legend', '.crumbs', '.back', '.xp .toast.visible', '.xp .tooltip.visible']
const MAP_ROOTS = ['.masthead', '.narrative', '.crumbs', '.back', '.disclaimer', '.director']

for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  test(`text contrast ≥ 4.5:1 (3:1 large) against its real background · farm view · ${vpName}`, async ({ page }) => {
    test.setTimeout(150_000)
    const errors = await openApp(page, viewport)
    await toFarm(page, MUNICIPALITIES.antequera, FARMS.antequera)
    await clearTransient(page)
    await page.waitForTimeout(800) // the cards fade in
    const top = await textContrast(page, FARM_ROOTS)
    expect(top.checked, 'text boxes measured').toBeGreaterThan(20)
    expect.soft(top.failures, `top of the column (lowest: ${JSON.stringify(top.lowest)})`).toEqual([])
    // The column scrolls on small screens: measure what is below the fold too.
    await page.locator('.fx-col').evaluate((el) => { el.scrollTop = el.scrollHeight })
    await page.waitForTimeout(300)
    const bottom = await textContrast(page, FARM_ROOTS)
    expect.soft(bottom.failures, `bottom of the column (lowest: ${JSON.stringify(bottom.lowest)})`).toEqual([])
    expect(errors, 'console errors').toEqual([])
  })
}

test('text contrast against its real background · farm with a critical insight (magenta-red)', async ({ page }) => {
  test.setTimeout(150_000)
  await openApp(page)
  await toFarm(page, MUNICIPALITIES.antequera, FARMS.steep)
  await clearTransient(page)
  await page.waitForTimeout(800)
  await expect(page.locator('.ins.top')).toHaveClass(/critical/)
  const r = await textContrast(page, FARM_ROOTS)
  expect(r.failures, `lowest: ${JSON.stringify(r.lowest)}`).toEqual([])
})

for (const level of [0, 1, 2] as const) {
  test(`text contrast against its real background · map level ${level}`, async ({ page }) => {
    test.setTimeout(150_000)
    await openApp(page)
    await reachLevel(page, level)
    await clearTransient(page)
    await page.waitForTimeout(800)
    const r = await textContrast(page, [...MAP_ROOTS, '.chips', '.legend-scale'])
    expect(r.checked).toBeGreaterThan(3)
    expect(r.failures, `lowest: ${JSON.stringify(r.lowest)}`).toEqual([])
  })
}

test('colour is never the only signal in the farm view', async ({ page }) => {
  test.setTimeout(150_000)
  await openApp(page)
  await toFarm(page, MUNICIPALITIES.antequera, FARMS.antequera)
  await clearTransient(page)

  // Severity: a word and an icon next to the colour, on the top insight and on the others
  await expect(page.locator('.ins.top .sev')).toHaveText(/^(Critical|Warning|Opportunity)$/)
  await expect(page.locator('.ins.top .sev svg')).toHaveCount(1)
  for (const summary of await page.locator('.ins-more summary').all()) {
    await expect(summary.locator('svg')).toHaveCount(1)
    await expect(summary.locator('.vh')).toHaveText(/^(Critical|Warning|Opportunity): $/)
  }

  // Scores: the number is always there, and every score carries a word (high / medium / low) and a shape
  const words = await page.locator('.fx-card .word').allTextContents()
  expect(words).toHaveLength(4)
  for (const w of words) expect(w.trim()).toMatch(/^[▲■▼]?\s*(high|medium|low)( risk)?$/)
  // Changes against the current rotation carry an arrow and a sign
  await page.getByRole('button', { name: /^R1/ }).click()
  await expect.poll(() => page.locator('.fx-card .delta.up, .fx-card .delta.down').count()).toBeGreaterThan(0)
  for (const d of await page.locator('.fx-card .delta.up').allTextContents()) expect(d).toMatch(/^▲ \+/)
  for (const d of await page.locator('.fx-card .delta.down').allTextContents()) expect(d).toMatch(/^▼ [-−]/)

  // Crops: few colours, and a letter on every swatch of the timeline, the header and the legend
  const swatches = await page.locator('.year i, .fx-head .now i, .fx-legend .sw i').evaluateAll((els) =>
    els.map((el) => ({ letter: el.textContent?.trim() ?? '', bg: getComputedStyle(el).backgroundColor, label: el.closest('.year')?.getAttribute('title') ?? el.parentElement?.textContent ?? '' })))
  expect(swatches.length).toBeGreaterThan(12)
  for (const s of swatches) expect(s.letter, `swatch ${JSON.stringify(s)}`).toMatch(/^[A-Z]$/)
  expect(new Set(swatches.map((s) => s.bg)).size, 'distinct crop colours on screen').toBeLessThanOrEqual(4)
  await expect(page.locator('.year')).toHaveCount(12)
  for (const t of await page.locator('.year').evaluateAll((els) => els.map((e) => e.getAttribute('title')))) expect(t).toMatch(/^20\d\d · .+ \((observed|scenario)\)$/)
  // The legend names every crop it shows
  for (const t of await page.locator('.fx-legend .sw span').allTextContents()) expect(t.trim().length).toBeGreaterThan(1)
  // The current year is marked by more than colour (ring + bold + underline are CSS; the state is aria-current)
  await expect(page.locator('.year[aria-current="true"]')).toHaveCount(1)
})

test('colour is never the only signal in the municipality legend', async ({ page }) => {
  test.setTimeout(150_000)
  await openApp(page)
  await reachLevel(page, 2)
  const chips = await page.locator('.chips li').evaluateAll((els) => els.map((li) => ({ text: li.textContent?.trim(), pattern: getComputedStyle(li.querySelector('i')!).backgroundImage })))
  expect(chips.map((c) => c.text)).toEqual(expect.arrayContaining([expect.stringMatching(/Farmland/), expect.stringMatching(/Limited/), expect.stringMatching(/Not farmland/)]))
  // "Limited" (dots) and "Not farmland" (stripes) have a pattern, "Candidate" a star
  expect(chips.find((c) => /Limited/.test(c.text ?? ''))!.pattern).toContain('gradient')
  expect(chips.find((c) => /Not farmland/.test(c.text ?? ''))!.pattern).toContain('gradient')
  for (const c of chips.filter((c) => /Candidate/.test(c.text ?? ''))) expect(c.text).toMatch(/^★/)
})
