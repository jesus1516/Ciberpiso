import type { Page } from '@playwright/test'

/** Visible panels of the interface that must not collide with each other. */
export const PANEL_SELECTORS = [
  '.masthead',
  '.narrative',
  '.crumbs',
  '.back',
  '.disclaimer',
  '.glass:not(.director)', // cards, dock, tooltip, toast, "preparing" pill
  '.fx-head',
  '.fx-tools',
  '.fx-legend',
  '.xp-sheet',
]

/** Overlaps smaller than this many pixels (in both directions) are tolerated. */
export const OVERLAP_TOLERANCE_PX = 4

export type LayoutReport = { overlaps: string[]; outside: string[]; clipped: string[]; panels: number }

/** Measures the page in the browser and returns human-readable problems (empty arrays = all good). */
export function measureLayout(page: Page, tolerance = OVERLAP_TOLERANCE_PX): Promise<LayoutReport> {
  return page.evaluate(
    ({ selectors, tol }) => {
      const vw = document.documentElement.clientWidth
      const vh = document.documentElement.clientHeight
      const describe = (el: Element) => {
        const cls = typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className.trim().split(/\s+/).join('.') : ''
        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 28)
        return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${text ? ` "${text}"` : ''}`
      }
      const visible = (el: Element) => {
        const cs = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        // Elements and every ancestor must be rendered and not faded out.
        for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
          const s = getComputedStyle(e)
          if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.1) return false
        }
        return cs.display !== 'contents' && r.width > 0 && r.height > 0
      }

      const panels = [...new Set(selectors.flatMap((s) => [...document.querySelectorAll(`.xp ${s}`)]))].filter(visible)
      // A panel that contains another one is a wrapper, not something that can collide with its content.
      const leaves = panels.filter((p) => !panels.some((q) => q !== p && p.contains(q)))

      const overlaps: string[] = []
      const outside: string[] = []
      for (let i = 0; i < leaves.length; i++) {
        const a = leaves[i].getBoundingClientRect()
        if (a.left < -1 || a.top < -1 || a.right > vw + 1 || a.bottom > vh + 1) {
          outside.push(`${describe(leaves[i])} sticks out of the ${vw}x${vh} viewport (left ${Math.round(a.left)}, top ${Math.round(a.top)}, right ${Math.round(a.right)}, bottom ${Math.round(a.bottom)})`)
        }
        for (let j = i + 1; j < leaves.length; j++) {
          if (leaves[i].contains(leaves[j]) || leaves[j].contains(leaves[i])) continue
          const b = leaves[j].getBoundingClientRect()
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          if (w > tol && h > tol) overlaps.push(`${describe(leaves[i])} overlaps ${describe(leaves[j])} by ${Math.round(w)}x${Math.round(h)} px`)
        }
      }

      // Text cut off by its own box (overflow hidden / ellipsis / fixed-size boxes).
      const clipped: string[] = []
      const skip = '.xp-map, .maplibregl-map, canvas, .director, svg'
      for (const el of document.querySelectorAll('.xp *')) {
        if (el.closest(skip) || !visible(el)) continue
        const hasText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())
        if (!hasText) continue
        const h = el as HTMLElement
        const cs = getComputedStyle(h)
        if (cs.display === 'inline' || h.clientWidth === 0) continue
        const clipsX = cs.overflowX !== 'visible'
        const clipsY = cs.overflowY !== 'visible' && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll'
        if (h.scrollWidth > h.clientWidth + 1 && (clipsX || cs.textOverflow === 'ellipsis')) {
          clipped.push(`${describe(el)} is cut off horizontally (scrollWidth ${h.scrollWidth} > clientWidth ${h.clientWidth})`)
        } else if (clipsY && h.scrollHeight > h.clientHeight + 1) {
          clipped.push(`${describe(el)} is cut off vertically (scrollHeight ${h.scrollHeight} > clientHeight ${h.clientHeight})`)
        }
      }
      return { overlaps, outside, clipped, panels: leaves.length }
    },
    { selectors: PANEL_SELECTORS, tol: tolerance },
  )
}
