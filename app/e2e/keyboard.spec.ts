import { expect, test, type Page } from '@playwright/test'
import { FARMS, MUNICIPALITIES, focused, openApp, reachLevel, tabTo, toFarm, toMunicipality, toProvince, waitLevel } from './helpers'

// T-09: the whole journey with the keyboard only, focus management, announcements, landmarks and headings.

const announcer = (page: Page) => page.getByTestId('announcer')
const combo = (name: RegExp) => (f: Awaited<ReturnType<typeof focused>>) => f.role === 'combobox' && name.test(f.name)

test('keyboard only: Andalucía → Málaga → Antequera → farm 62-14 and back with Esc', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = await openApp(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Where is your farm?' })).toBeVisible()

  // Level 0: Tab to the province list, type, Enter.
  const stops0 = await tabTo(page, combo(/^Choose a province/)) // the SIGPAC search, before it, is a combobox too
  console.log('level 0 Tab stops:', stops0.map((f) => `${f.tag} "${f.name}"`).join(' → '))
  await expect(page.getByRole('combobox', { name: 'Choose a province from the list' })).toBeFocused()
  await page.keyboard.type('mal')
  await expect(page.getByRole('option')).toHaveText([/Málaga/])
  await page.keyboard.press('Enter')
  await waitLevel(page, 1)
  // Focus moved to the heading of the new level; the live region said where we are.
  await expect(page.getByRole('heading', { level: 1, name: 'Choose the municipality' })).toBeFocused()
  await expect(announcer(page)).toContainText('Step 2 of 4: Málaga')

  // Level 1: municipality list (accent-insensitive search, Down/Up change the highlighted option).
  await tabTo(page, combo(/^Choose a municipality/))
  await page.keyboard.type('anteq')
  await expect(page.getByRole('option')).toHaveCount(1)
  await page.keyboard.press('Enter')
  await waitLevel(page, 2)
  await page.waitForFunction(() => (window as any).__xp.state.getState().farmsCount !== null, null, { timeout: 60_000 })
  await expect(page.getByRole('heading', { level: 1, name: 'Antequera' })).toBeFocused()
  await expect(announcer(page)).toContainText('Step 3 of 4: Antequera')

  // Level 2: farm list. Candidates first, then by area; urban / water / public farms are not listed.
  await tabTo(page, combo(/farm from the list/))
  await page.keyboard.press('ArrowDown') // opens (the list is open on focus; this keeps it open and moves)
  const listed = await page.getByRole('option').evaluateAll((els) => els.map((e) => ({ text: e.querySelector('.d')?.textContent ?? '', cand: (e.querySelector('.n')?.textContent ?? '').includes('★') })))
  expect(listed.length).toBeGreaterThan(10)
  const firstNonCandidate = listed.findIndex((o) => !o.cand)
  expect(firstNonCandidate, 'candidates come first').toBeGreaterThan(0)
  expect(listed.slice(firstNonCandidate).every((o) => !o.cand), 'no candidate after a non-candidate').toBe(true)
  const areas = (xs: typeof listed) => xs.map((o) => Number(/([\d,.]+) ha/.exec(o.text)![1].replace(/,/g, '')))
  const cands = areas(listed.slice(0, firstNonCandidate))
  expect(cands, 'candidates sorted by area, largest first').toEqual([...cands].sort((a, b) => b - a))
  const others = areas(listed.slice(firstNonCandidate))
  expect(others, 'the rest sorted by area, largest first').toEqual([...others].sort((a, b) => b - a))
  const notListed = await page.evaluate(() => (window as any).__xp.state.getState().farmList.filter((f: any) => ['urbano', 'agua', 'publico'].includes(f.apt)).length)
  expect(notListed, 'non-farmland farms are not in the list').toBe(0)
  await page.keyboard.type('62-14')
  await expect(page.getByRole('option')).toHaveCount(1)
  await page.keyboard.press('Enter')
  await waitLevel(page, 3)
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Farm 62-14')
  await expect(announcer(page)).toContainText('Step 4 of 4: Farm 62-14')

  // Level 3: every control is reachable with Tab, each with a name.
  const stops3 = await tabTo(page, (f) => f.name === 'Settings' && f.tag === 'button', 60)
  console.log('level 3 Tab stops up to Settings:', stops3.map((f) => `${f.tag} "${f.name}"`).join(' → '))
  expect(stops3.every((f) => f.name.length > 0), 'every Tab stop has a name').toBe(true)

  // Esc goes up one level at a time and moves focus to the heading each time.
  await page.getByRole('heading', { level: 1 }).focus()
  for (const [level, heading] of [[2, 'Antequera'], [1, 'Choose the municipality'], [0, 'Where is your farm?']] as const) {
    await page.keyboard.press('Escape')
    await waitLevel(page, level)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeFocused()
  }
  expect(errors, 'console errors').toEqual([])
})

test('the farm list opens a limited farm with a warning, and Esc closes the list before going back', async ({ page }) => {
  test.setTimeout(150_000)
  await openApp(page)
  await toMunicipality(page, MUNICIPALITIES.antequera)
  const input = page.getByRole('combobox', { name: 'Choose a farm from the list' })
  await input.focus()
  await expect(input).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape') // closes the list, the level stays
  await expect(input).toHaveAttribute('aria-expanded', 'false')
  expect(await page.evaluate(() => (window as any).__xp.state.getState().level)).toBe(2)
  await page.keyboard.type('zzzz')
  await expect(page.getByRole('status').filter({ hasText: 'No farms match' })).toBeVisible()
  await page.keyboard.press('Escape') // the first Esc closes the list…
  await expect(input).toHaveAttribute('aria-expanded', 'false')
  await expect(input).toHaveValue('zzzz')
  await page.keyboard.press('Escape') // …the second clears the text
  await expect(input).toHaveValue('')
  await page.keyboard.press('Escape') // nothing left to close → back to Málaga
  await waitLevel(page, 1)
})

test('ArrowDown / ArrowUp / Home / End move the highlighted option (aria-activedescendant)', async ({ page }) => {
  await openApp(page)
  const input = page.getByRole('combobox', { name: 'Choose a province from the list' })
  await input.focus()
  const active = () => page.evaluate(() => document.getElementById(document.activeElement!.getAttribute('aria-activedescendant') ?? '')?.textContent ?? '')
  expect(await active()).toContain('Almería') // 8 provinces, in the order of the data
  await page.keyboard.press('ArrowDown')
  const second = await active()
  expect(second).not.toContain('Almería')
  await page.keyboard.press('End')
  const last = await active()
  await page.keyboard.press('Home')
  expect(await active()).toContain('Almería')
  expect(last).not.toBe(second)
  await page.keyboard.press('ArrowUp')
  expect(await active()).toContain('Almería') // does not wrap
  // A province without a tour explains itself instead of failing.
  await page.keyboard.type('sevilla')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'only available for Málaga' })).toBeVisible()
  expect(await page.evaluate(() => (window as any).__xp.state.getState().level)).toBe(0)
})

test('"Full data" drawer traps focus, Esc closes it and gives focus back to its button', async ({ page }) => {
  test.setTimeout(150_000)
  await openApp(page)
  await toFarm(page, MUNICIPALITIES.antequera, FARMS.antequera)
  const button = page.getByRole('button', { name: 'Full data', exact: true })
  await button.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Full data' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  await expect(page.getByRole('button', { name: 'Close full data' })).toBeFocused()
  // Tab and Shift+Tab never leave the drawer.
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('.xp-sheet')), `Tab ${i + 1} stays inside`).toBe(true)
  }
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Shift+Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('.xp-sheet')), `Shift+Tab ${i + 1} stays inside`).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(button).toBeFocused()
  expect(await page.evaluate(() => (window as any).__xp.state.getState().level), 'Esc closed the drawer only').toBe(3)
})

test('the close button of the drawer also returns focus', async ({ page }) => {
  test.setTimeout(150_000)
  await openApp(page)
  await toFarm(page, MUNICIPALITIES.antequera, FARMS.antequera)
  await page.getByRole('button', { name: 'Full data', exact: true }).click()
  await page.getByRole('button', { name: 'Close full data' }).click()
  await expect(page.getByRole('button', { name: 'Full data', exact: true })).toBeFocused()
})

test('the Settings panel is a dialog: focus goes in, Esc closes it and focus returns to the button (the level stays)', async ({ page }) => {
  await openApp(page)
  const button = page.getByRole('button', { name: 'Settings' })
  await button.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('radio', { name: '100 %' })).toBeFocused()
  await page.keyboard.press('ArrowRight') // radio group: arrows change the value
  await expect(page.getByRole('radio', { name: '125 %' })).toBeChecked()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(button).toBeFocused()
  expect(await page.evaluate(() => (window as any).__xp.state.getState().level)).toBe(0)
})

test('screen readers: the live region announces moves and arrivals; the map has a summary', async ({ page }) => {
  test.setTimeout(150_000)
  await openApp(page)
  const map = page.getByRole('region', { name: 'Map of Andalucía and Málaga' })
  await expect(map).toHaveAccessibleDescription(/Map of Andalucía with its 8 provinces/)
  await expect(announcer(page)).toHaveAttribute('aria-live', 'polite')
  // The text of a transition is said while it runs ("Going to Málaga…").
  const heard: string[] = []
  await page.exposeFunction('__heard', (t: string) => heard.push(t))
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="announcer"]')!
    new MutationObserver(() => (window as any).__heard(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true })
  })
  await page.evaluate(() => (window as any).__xp.ctrl.setSpeed(1))
  await page.evaluate(() => (window as any).__xp.ctrl.go(1))
  await waitLevel(page, 1)
  expect(heard.some((t) => /^Going to Málaga/.test(t)), `heard: ${JSON.stringify(heard)}`).toBe(true)
  expect(heard.at(-1)).toMatch(/^Step 2 of 4: Málaga/)
  await expect(map).toHaveAccessibleDescription(/province of Málaga with \d+ municipalities/)
  await page.evaluate(() => (window as any).__xp.ctrl.setSpeed(50))
  await toMunicipality(page, MUNICIPALITIES.antequera)
  await expect(map).toHaveAccessibleDescription(/Map of Antequera with [\d,]+ farms/)
})

for (const level of [0, 1, 2, 3] as const) {
  test(`landmarks and headings · level ${level}`, async ({ page }) => {
    test.setTimeout(150_000)
    await openApp(page)
    await reachLevel(page, level)
    await page.waitForTimeout(600)
    const r = await page.evaluate(() => {
      const shown = (el: Element) => (el as HTMLElement).checkVisibility({ visibilityProperty: true })
      const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(shown).map((h) => ({ level: Number(h.tagName[1]), text: (h.textContent ?? '').trim().slice(0, 40) }))
      const has = (sel: string) => [...document.querySelectorAll(sel)].filter(shown).length
      // <main> is display: contents, so it is counted without the visibility check.
      return {
        headings,
        main: document.querySelectorAll('main').length, banner: has('.xp > header, .xp header.masthead'), nav: has('nav[aria-label]'), region: has('[role="region"][aria-label]'),
        complementary: has('aside:not(.director)'), // the testing-only director panel is an aside
        // Controls that are neither a native control nor have a role.
        clickableDivs: [...document.querySelectorAll('.xp div[onclick], .xp span[onclick]')].length,
      }
    })
    expect(r.main, 'one main landmark').toBe(1)
    expect(r.banner, 'a banner (masthead) on the map levels').toBe(level === 3 ? 0 : 1)
    expect(r.nav, 'the breadcrumb navigation').toBeGreaterThanOrEqual(1)
    expect(r.region, 'the map region').toBeGreaterThanOrEqual(1)
    expect(r.complementary, 'asides sit outside main').toBe(0)
    const levels = r.headings.map((h) => h.level)
    expect(levels.filter((l) => l === 1), `exactly one h1 (${JSON.stringify(r.headings)})`).toHaveLength(1)
    // Heading order: never skip a level going down (h1 → h3 is a skip; h2 → h1 is fine).
    let prev = 0
    for (const h of r.headings) {
      expect(h.level, `heading "${h.text}" must not skip a level (previous h${prev})`).toBeLessThanOrEqual(prev + 1)
      prev = h.level
    }
  })
}

test('the 3D canvas is described as an image and not a Tab stop; cards and years have names', async ({ page }) => {
  test.setTimeout(150_000)
  await openApp(page)
  await toFarm(page, MUNICIPALITIES.antequera, FARMS.antequera)
  const canvas = page.locator('.dio-canvas')
  await expect(canvas).toHaveAttribute('role', 'img')
  await expect(canvas).toHaveAttribute('aria-label', /data table/)
  await expect(page.getByRole('article', { name: /^Water, indicator 1: \d+ out of 100/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^2026: .+\(scenario\)$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^R1, \+ Chickpea: score [\d.]+/ })).toBeVisible()
})

test('visible focus: every Tab stop of the farm view shows an outline or ring', async ({ page }) => {
  test.setTimeout(150_000)
  await openApp(page)
  await toFarm(page, MUNICIPALITIES.antequera, FARMS.antequera)
  await page.getByRole('heading', { level: 1 }).focus()
  const lacking: string[] = []
  for (let i = 0; i < 45; i++) {
    await page.keyboard.press('Tab')
    const r = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return null
      const cs = getComputedStyle(el)
      const target = el.matches('input[type="radio"]') ? (el.nextElementSibling as HTMLElement | null) ?? el : el
      const ts = getComputedStyle(target)
      const outline = parseFloat(ts.outlineWidth) >= 2 && ts.outlineStyle !== 'none'
      const ring = cs.boxShadow !== 'none'
      const sel = `${el.tagName.toLowerCase()}.${el.className.toString().split(' ')[0]} "${(el.textContent ?? '').trim().slice(0, 20)}"`
      return { ok: outline || ring, sel, visible: el.getClientRects().length > 0 }
    })
    if (r && r.visible && !r.ok) lacking.push(r.sel)
  }
  expect(lacking, 'focused elements without a visible indicator').toEqual([])
})
