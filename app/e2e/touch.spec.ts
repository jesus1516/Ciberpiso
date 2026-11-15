import { expect, test } from '@playwright/test'
import { FARMS, MUNICIPALITIES, VIEWPORTS, clearTransient, openApp, openAppWith, reachLevel, toFarm } from './helpers'

// T-09: on phones every control is at least 44 × 44 CSS px.

/** Visible interactive elements smaller than 44 × 44 (map canvases and the 3D picture excluded). */
function smallTargets(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const sel = 'button, a[href], input, select, textarea, summary, [role="option"], [role="button"], article[tabindex="0"], .maplibregl-ctrl button'
    const out: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
      if (el.closest('.vh, [inert], .dio-markers, .xp-map canvas')) continue
      // Radio inputs are covered by their label box (the real target).
      const box = (el.matches('input[type="radio"], input[type="checkbox"]') ? el.closest('label') ?? el : el).getBoundingClientRect()
      if (box.width < 43.5 || box.height < 43.5) {
        out.push(`${el.tagName.toLowerCase()}.${(el.className?.toString() ?? '').split(' ')[0]} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}" ${Math.round(box.width)}×${Math.round(box.height)}`)
      }
    }
    return out
  })
}

for (const level of [0, 1, 2, 3] as const) {
  test(`touch targets ≥ 44×44 px on a phone · level ${level}`, async ({ page }) => {
    test.setTimeout(150_000)
    await openApp(page, VIEWPORTS.mobile)
    await reachLevel(page, level)
    await clearTransient(page)
    await page.waitForTimeout(900)
    expect(await smallTargets(page)).toEqual([])
    if (level === 3) {
      await page.locator('.fx-col').evaluate((el) => { el.scrollTop = el.scrollHeight })
      await page.waitForTimeout(300)
      expect(await smallTargets(page), 'column scrolled to the end').toEqual([])
    }
  })
}

test('touch targets on a phone: open list, settings panel and the data table', async ({ page }) => {
  test.setTimeout(150_000)
  await openApp(page, VIEWPORTS.mobile)
  await page.getByRole('combobox', { name: /from the list$/ }).focus()
  expect(await smallTargets(page), 'open province list').toEqual([])
  await page.getByRole('button', { name: 'Settings' }).click()
  expect(await smallTargets(page), 'settings panel').toEqual([])
  await page.keyboard.press('Escape')
  await toFarm(page, MUNICIPALITIES.antequera, FARMS.antequera)
  await page.getByRole('button', { name: 'Data table' }).click()
  await page.waitForTimeout(300)
  expect(await smallTargets(page), 'farm view with the table').toEqual([])
})

test('touch targets also hold with 150 % text on a phone', async ({ page }) => {
  test.setTimeout(150_000)
  await openAppWith(page, { textSize: 150 }, VIEWPORTS.mobile)
  await reachLevel(page, 3)
  await clearTransient(page)
  await page.waitForTimeout(900)
  expect(await smallTargets(page)).toEqual([])
})
