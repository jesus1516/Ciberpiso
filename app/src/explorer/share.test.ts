import { describe, expect, it } from 'vitest'
import type { ViewState } from './scene'
import { farmHash, municipalityHash, parseShare } from './share'

const view: ViewState = { year: 2027, rotation: 'R2', profile: 'soil_first', mode: 'model', exaggeration: 3.5 }

describe('parseShare', () => {
  it('reads a farm with its whole view', () => {
    expect(parseShare('#f=29:32:0:0:38:14&r=R2&p=soil&y=2027&v=model&x=3.5')).toEqual({
      kind: 'farm', mun: 32, pol: 38, par: 14, view: { rotation: 'R2', profile: 'soil_first', year: 2027, mode: 'model', exaggeration: 3.5 },
    })
  })
  it('accepts the short reference and no view', () => {
    expect(parseShare('f=29:32:38:14')).toEqual({ kind: 'farm', mun: 32, pol: 38, par: 14, view: {} })
  })
  it('leaves out each wrong value and keeps the rest', () => {
    expect(parseShare('#f=29:32:0:0:38:14&r=R9&p=money&y=2040&v=xray&x=7')).toEqual({ kind: 'farm', mun: 32, pol: 38, par: 14, view: {} })
    expect(parseShare('#f=29:32:0:0:38:14&r=r1&y=2019')).toEqual({ kind: 'farm', mun: 32, pol: 38, par: 14, view: { rotation: 'R1' } })
  })
  it('reads a municipality', () => {
    expect(parseShare('#m=15')).toEqual({ kind: 'municipality', mun: 15 })
  })
  it('ignores fragments with no usable place', () => {
    for (const h of ['', '#', '#hello', '#f=', '#f=41:32:0:0:38:14', '#f=29:32:1:0:38:14', '#f=29:32:38', '#f=29:a:38:14', '#m=abc', '#r=R1'])
      expect(parseShare(h), h).toBeNull()
  })
})

describe('writing links', () => {
  it('a farm link reads back as the same view', () => {
    const h = farmHash('29:32:0:0:38:14', view)
    expect(h).toBe('#f=29:32:0:0:38:14&r=R2&p=soil&y=2027&v=model&x=3.5')
    expect(parseShare(h)).toEqual({ kind: 'farm', mun: 32, pol: 38, par: 14, view })
  })
  it('snaps a relief caught mid-animation to the nearest… or the default', () => {
    expect(farmHash('29:32:0:0:38:14', { ...view, exaggeration: 2.004 })).toContain('&x=2')
    expect(farmHash('29:32:0:0:38:14', { ...view, exaggeration: 2.7 })).toContain('&x=2')
  })
  it('a municipality link uses its SIGPAC code', () => {
    expect(municipalityHash(29015)).toBe('#m=15')
    expect(parseShare(municipalityHash(29015))).toEqual({ kind: 'municipality', mun: 15 })
  })
})
