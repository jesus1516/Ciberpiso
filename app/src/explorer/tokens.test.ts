import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { deltaE, minDistance, simulate } from './colorMath'
import { ALL_PAIRS, ratio } from './contrastPairs'
import { ACCENT, COVER_TOKENS, CROP_COLORS, MAP, mix, NEUTRAL, RAMP, STATUS } from './tokens'
import { CROPS } from './scene'

const dir = __dirname
const css = readFileSync(join(dir, 'explorer.css'), 'utf8')
/** The token block: the first `.xp { … }` rule, up to its closing brace. */
const tokenBlock = css.slice(css.indexOf('.xp {'), css.indexOf('}', css.indexOf('.xp {')) + 1)
const cssToken = (name: string) => tokenBlock.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1]?.toUpperCase()

describe('tokens: CSS and TypeScript say the same', () => {
  it('neutral scale, accent, status and crop colours match explorer.css', () => {
    for (const [k, v] of Object.entries(NEUTRAL)) expect(cssToken(k), k).toBe(v.toUpperCase())
    expect(cssToken('accent')).toBe(ACCENT.toUpperCase())
    for (const [k, v] of Object.entries(STATUS)) expect(cssToken(k), k).toBe(v.toUpperCase())
    for (const [k, v] of Object.entries(CROP_COLORS)) expect(cssToken(`crop-${k}`), k).toBe(v.toUpperCase())
  })
  it('the CSS ramp of the municipality legend is the same one the map paints', () => {
    // CSS: color-mix(in srgb, n-700 67%, accent) = mix(n-700, accent, 0.33)
    expect(RAMP[1]).toBe(mix(NEUTRAL['n-700'], ACCENT, 0.33))
    expect(css).toContain('color-mix(in srgb, var(--n-700) 67%, var(--accent))')
    expect(css).toContain('color-mix(in srgb, var(--n-700) 34%, var(--accent))')
  })
})

describe('no stray colours in app/src/explorer', () => {
  const files = readdirSync(dir).filter((f) => /\.(ts|tsx|css)$/.test(f) && !/\.test\.ts$/.test(f) && f !== 'tokens.ts')
  const colour = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/
  it.each(files)('%s uses tokens, not literals', (f) => {
    let src = readFileSync(join(dir, f), 'utf8')
    if (f === 'explorer.css') src = src.replace(tokenBlock, '') // the only place hex may be defined
    const stray = src.split('\n').map((l, i) => ({ l, n: i + 1 })).filter(({ l }) => colour.test(l) && !l.includes('colour-ok:'))
    expect(stray.map(({ n, l }) => `${f}:${n}: ${l.trim().slice(0, 90)}`)).toEqual([])
  })
  it('every exception carries its justification', () => {
    for (const f of files) {
      const lines = readFileSync(join(dir, f), 'utf8').split('\n').filter((l) => l.includes('colour-ok:'))
      for (const l of lines) expect(l.split('colour-ok:')[1].trim().length, `${f}: ${l.trim()}`).toBeGreaterThan(8)
    }
  })
  it('the old per-category hues are gone from the stylesheet', () => {
    expect(css).not.toMatch(/--(terracotta|olive|amber|water|risk|cream)\b/)
  })
})

describe('contrast (WCAG 2.x AA)', () => {
  it.each(ALL_PAIRS.map((p) => [p.use, p] as const))('%s', (_, p) => {
    expect(ratio(p), `${p.fg} on ${p.bg}`).toBeGreaterThanOrEqual(p.min)
  })
})

describe('colour-blind safety (Machado 2009 simulation, CIEDE2000)', () => {
  const group = { good: STATUS.good, warn: STATUS.warn, bad: STATUS.bad }
  it('good / warning / critical stay clearly different with protanopia and deuteranopia', () => {
    expect(minDistance(group, 'normal').d).toBeGreaterThan(30)
    expect(minDistance(group, 'protanopia').d).toBeGreaterThanOrEqual(15)
    expect(minDistance(group, 'deuteranopia').d).toBeGreaterThanOrEqual(15)
    expect(minDistance(group, 'tritanopia').d).toBeGreaterThanOrEqual(8) // rare; orange and pink are the closest pair
  })
  it('the accent is not mistaken for a status colour', () => {
    for (const v of ['normal', 'protanopia', 'deuteranopia'] as const)
      for (const k of ['good', 'warn', 'bad'] as const) expect(deltaE(simulate(ACCENT, v), simulate(STATUS[k], v)), `${v} accent/${k}`).toBeGreaterThanOrEqual(9)
  })
  it('the four crop colours stay apart with protanopia and deuteranopia', () => {
    expect(minDistance(CROP_COLORS, 'normal').d).toBeGreaterThanOrEqual(15)
    expect(minDistance(CROP_COLORS, 'protanopia').d).toBeGreaterThanOrEqual(10)
    expect(minDistance(CROP_COLORS, 'deuteranopia').d).toBeGreaterThanOrEqual(10)
  })
})

describe('crops: grouped colours, a letter each', () => {
  it('shows at most four crop colours', () => {
    expect(new Set(Object.values(CROPS).map((c) => c.color)).size).toBe(4)
  })
  it('every crop has a letter, and crops that share a letter share a group (so the legend never contradicts itself)', () => {
    const byLetter = new Map<string, string>()
    for (const [k, c] of Object.entries(CROPS)) {
      expect(c.letter, k).toMatch(/^[A-Z]$/)
      expect(byLetter.get(c.letter) ?? c.group, `${k} letter ${c.letter}`).toBe(c.group)
      byLetter.set(c.letter, c.group)
    }
  })
  it('the rotation crops can be told apart by letter within a group', () => {
    const rot = ['trigo', 'girasol', 'garbanzo', 'veza', 'barbecho'].map((k) => CROPS[k].letter)
    expect(new Set(rot).size).toBe(rot.length)
  })
  it('land cover reuses the same few colours', () => {
    expect(Object.keys(COVER_TOKENS)).toHaveLength(4)
    expect(MAP.bg).toBe(NEUTRAL['n-800'])
  })
})
