import type { Page } from '@playwright/test'

// Measures the contrast of the text that is really on screen, against the pixels it really sits on:
// the text is made transparent, the page is screenshotted, and each text box is compared with the
// backdrop pixels behind it (worst case after dropping 2 % outliers such as anti-aliasing).
// This covers text over gradients, translucent panels and the WebGL canvases, which a table of
// token pairs cannot. WCAG 2.x AA: 4.5:1, or 3:1 for large text (≥ 24 px, or ≥ 18.66 px bold).

export type TextFailure = { text: string; ratio: number; need: number; fg: string; size: number; where: string }
export type ContrastReport = { checked: number; failures: TextFailure[]; lowest: { text: string; ratio: number }[] }

export async function textContrast(page: Page, roots: string[]): Promise<ContrastReport> {
  // 1. The text boxes to check (including ::before / ::after content).
  const items = await page.evaluate((selectors) => {
    const out: { text: string; x: number; y: number; w: number; h: number; color: string; size: number; bold: boolean; where: string }[] = []
    const seen = new Set<Element>()
    const visible = (el: Element) => (el as HTMLElement).checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })
    for (const sel of selectors) {
      for (const root of document.querySelectorAll(sel)) {
        for (const el of [root, ...root.querySelectorAll('*')]) {
          if (seen.has(el) || el.closest('.vh, svg, canvas, script, style') || !visible(el)) continue
          seen.add(el)
          const cs = getComputedStyle(el)
          const direct = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent!.trim())
          const boxes: { text: string; r: DOMRect; cs: CSSStyleDeclaration }[] = []
          if (direct.length) {
            const range = document.createRange()
            for (const n of direct) { range.selectNodeContents(n); for (const r of range.getClientRects()) boxes.push({ text: n.textContent!.trim().slice(0, 40), r, cs }) }
          }
          for (const pseudo of ['::before', '::after']) {
            const ps = getComputedStyle(el, pseudo)
            if (ps.content && ps.content !== 'none' && ps.content !== 'normal' && ps.content !== '""') {
              // Absolutely positioned pseudo-elements have resolved offsets and size: measure their own box.
              // Otherwise fall back to the host box (it also contains other things, so it can only over-report).
              const host = el.getBoundingClientRect()
              const own = ps.position === 'absolute' && [ps.left, ps.top, ps.width, ps.height].every((v) => /px$/.test(v))
              const r = own ? new DOMRect(host.x + parseFloat(ps.left), host.y + parseFloat(ps.top), parseFloat(ps.width), parseFloat(ps.height)) : host
              boxes.push({ text: `${pseudo} ${ps.content.slice(0, 30)}`, r, cs: ps })
            }
          }
          for (const { text, r, cs: c } of boxes) {
            if (r.width < 2 || r.height < 2) continue
            // Text scrolled out of a scrolling box is not on screen (the other scroll position covers it).
            let clipped = false
            for (let p = el.parentElement; p && !clipped; p = p.parentElement) {
              const ps = getComputedStyle(p)
              if (ps.overflowY === 'visible' && ps.overflowX === 'visible') continue
              const b = p.getBoundingClientRect()
              clipped = r.bottom > b.bottom + 1 || r.top < b.top - 1 || r.right > b.right + 1 || r.left < b.left - 1
            }
            if (clipped) continue
            out.push({ text, x: r.x, y: r.y, w: r.width, h: r.height, color: c.color, size: parseFloat(c.fontSize), bold: parseInt(c.fontWeight) >= 700, where: `${el.tagName.toLowerCase()}.${(el as HTMLElement).className?.toString().split(' ')[0] ?? ''}` })
          }
        }
      }
    }
    return out
  }, roots)

  // 2. The page without any text.
  const hide = await page.addStyleTag({ content: '*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; } svg { visibility: hidden !important; }' })
  await page.waitForTimeout(250)
  const shot = (await page.screenshot()).toString('base64')
  await hide.evaluate((el) => (el as unknown as HTMLElement).remove())

  // 3. Compare in the page (canvas gives pixels and parses any CSS colour, including color-mix results).
  return page.evaluate(async ({ items, shot }) => {
    const img = new Image()
    img.src = `data:image/png;base64,${shot}`
    await img.decode()
    const scale = img.width / window.innerWidth
    const cv = document.createElement('canvas')
    cv.width = img.width; cv.height = img.height
    const ctx = cv.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0)
    const px = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
    const parse = (css: string): [number, number, number, number] => { px.clearRect(0, 0, 1, 1); px.fillStyle = css; px.fillRect(0, 0, 1, 1); const d = px.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255] }
    const lin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
    const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    const failures: TextFailure[] = []
    const all: { text: string; ratio: number }[] = []
    for (const it of items) {
      const x0 = Math.max(0, Math.floor(it.x * scale)), y0 = Math.max(0, Math.floor(it.y * scale))
      const x1 = Math.min(cv.width, Math.ceil((it.x + it.w) * scale)), y1 = Math.min(cv.height, Math.ceil((it.y + it.h) * scale))
      if (x1 - x0 < 1 || y1 - y0 < 1) continue // not on screen (scrolled away)
      const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
      const [fr, fg, fb, fa] = parse(it.color)
      const ratios: number[] = []
      for (let i = 0; i < d.length; i += 4) {
        const r = fr * fa + d[i] * (1 - fa), g = fg * fa + d[i + 1] * (1 - fa), b = fb * fa + d[i + 2] * (1 - fa)
        const [l1, l2] = [lum(r, g, b), lum(d[i], d[i + 1], d[i + 2])].sort((p, q) => q - p)
        ratios.push((l1 + 0.05) / (l2 + 0.05))
      }
      ratios.sort((a, b) => a - b)
      const ratio = ratios[Math.floor(ratios.length * 0.02)]
      const large = it.size >= 24 || (it.size >= 18.66 && it.bold)
      const need = large ? 3 : 4.5
      all.push({ text: it.text, ratio })
      if (ratio < need) failures.push({ text: it.text, ratio: Math.round(ratio * 100) / 100, need, fg: it.color, size: it.size, where: it.where })
    }
    all.sort((a, b) => a.ratio - b.ratio)
    return { checked: all.length, failures, lowest: all.slice(0, 5).map((a) => ({ text: a.text, ratio: Math.round(a.ratio * 100) / 100 })) }
  }, { items, shot })
}
