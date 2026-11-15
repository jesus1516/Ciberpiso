import { expect, test } from '@playwright/test'
import { openApp } from './helpers'
import { measureLayout } from './layout'

// Self-test of the layout checker: it must report problems that are planted on purpose,
// otherwise a green layout suite would mean nothing.
test('the layout checker detects overlaps, clipped text and panels outside the viewport (scrolling columns included)', async ({ page }) => {
  await openApp(page)
  const clean = await measureLayout(page)
  expect(clean).toMatchObject({ overlaps: [], outside: [], clipped: [] })

  await page.evaluate(() => {
    const xp = document.querySelector('.xp')!
    const crumbs = document.querySelector('.crumbs')!.getBoundingClientRect()
    const add = (html: string) => xp.insertAdjacentHTML('beforeend', html)
    // 1. a panel on top of the breadcrumb
    add(`<div class="glass planted-overlap" style="position:absolute;z-index:70;left:${crumbs.left}px;top:${crumbs.top}px;width:120px;height:30px">overlap</div>`)
    // 2. a label that does not fit its box
    add('<div class="glass planted-clip" style="position:absolute;z-index:70;left:600px;top:300px;width:60px;overflow:hidden;white-space:nowrap">A label that is much too long</div>')
    // 3. a panel half outside of the viewport
    add('<div class="glass planted-outside" style="position:absolute;z-index:70;right:-80px;top:300px;width:200px;height:40px">outside</div>')
  })
  const r = await measureLayout(page)
  expect(r.overlaps.join('\n')).toContain('planted-overlap')
  expect(r.clipped.join('\n')).toContain('planted-clip')
  expect(r.outside.join('\n')).toContain('planted-outside')

  // Scrolling columns: a panel below the fold of a scrollable box that is inside the viewport is
  // reachable (not "outside"), but a scrollable box that itself sticks out is still reported.
  await page.evaluate(() => {
    const xp = document.querySelector('.xp')!
    const vh = document.documentElement.clientHeight
    const add = (html: string) => xp.insertAdjacentHTML('beforeend', html)
    add(`<div style="position:absolute;z-index:70;left:900px;top:${vh - 300}px;width:150px;height:200px;overflow-y:auto"><div class="glass planted-scrolled" style="height:${vh}px">tall</div></div>`)
    add(`<div style="position:absolute;z-index:70;left:1100px;top:${vh - 100}px;width:150px;height:200px;overflow-y:auto"><div class="glass planted-scroll-out" style="height:${vh}px">tall</div></div>`)
  })
  const s = await measureLayout(page)
  expect(s.outside.join('\n')).not.toContain('planted-scrolled')
  expect(s.outside.join('\n')).toContain('planted-scroll-out')

  // Overlaps of a few pixels are tolerated
  const tolerated = await measureLayout(page, 10_000)
  expect(tolerated.overlaps).toEqual([])
})
