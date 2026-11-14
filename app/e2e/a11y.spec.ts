import { expect, test, type Page } from '@playwright/test'
import { clearTransient, openApp, reachLevel, VIEWPORTS } from './helpers'

// Basic accessibility smoke: every visible button has an accessible name, the page declares its
// language and title, and nothing logs errors while moving through the levels.

/** Buttons that are rendered but have no accessible name (aria-label / labelledby, text, title or img alt). */
function unnamedButtons(page: Page) {
  return page.evaluate(() => {
    const nameOf = (el: Element): string => {
      const label = el.getAttribute('aria-label')?.trim()
      if (label) return label
      const by = el.getAttribute('aria-labelledby')
      if (by) {
        const text = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim()
        if (text) return text
      }
      const own = (el.textContent ?? '').trim()
      if (own) return own
      const img = el.querySelector('img[alt]:not([alt=""])')
      if (img) return img.getAttribute('alt')!
      return el.getAttribute('title')?.trim() ?? ''
    }
    const describe = (el: Element) => `button.${(el as HTMLElement).className.toString().trim().split(/\s+/).join('.')} at ${Math.round(el.getBoundingClientRect().x)},${Math.round(el.getBoundingClientRect().y)}`
    return [...document.querySelectorAll('button, [role="button"]')]
      .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
      .filter((el) => !nameOf(el))
      .map(describe)
  })
}

/** Images and landmarks that need a name. */
function unnamedImages(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('img:not([alt])')].map((el) => `img ${(el as HTMLImageElement).src}`),
  )
}

test('the document has a language and a title', async ({ page }) => {
  await openApp(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page).toHaveTitle(/Ciberpiso/)
})

for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  for (const level of [0, 1, 2, 3] as const) {
    test(`every button has an accessible name · ${vpName} · level ${level}`, async ({ page }) => {
      test.setTimeout(150_000)
      const errors = await openApp(page, viewport)
      await reachLevel(page, level)
      await clearTransient(page)
      expect.soft(await unnamedButtons(page), 'buttons without an accessible name').toEqual([])
      expect.soft(await unnamedImages(page), 'images without alt attribute').toEqual([])
      expect(errors, 'console errors').toEqual([])
    })
  }
}

test('the "Full data" sheet and the "Sources" dialog have named buttons', async ({ page }) => {
  test.setTimeout(150_000)
  const errors = await openApp(page)
  await reachLevel(page, 3)
  await page.getByRole('button', { name: 'Full data', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Full data for the farm' })).toBeVisible()
  expect.soft(await unnamedButtons(page), 'sheet buttons without an accessible name').toEqual([])
  await page.keyboard.press('Escape') // leaves the farm; the page must keep working
  await expect.poll(() => page.evaluate(() => (window as any).__xp.state.getState().level), { timeout: 60_000 }).toBe(2)
  await page.getByRole('button', { name: 'Sources' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect.soft(await unnamedButtons(page), 'dialog buttons without an accessible name').toEqual([])
  expect(errors, 'console errors').toEqual([])
})
