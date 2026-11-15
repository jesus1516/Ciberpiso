import { describe, expect, it } from 'vitest'
import { LIMITED, NOT_FARMLAND } from '../lib/mapStyle'
import { APT, COVER_NAME } from './texts'

// `apt` says why a farm does not look like cropland (pipeline/export_app_fincas.py, aptitud()).
// NOT_FARMLAND farms cannot be opened (controller.ts shows a "Not farmland" toast),
// LIMITED farms open with an "Indicative analysis" warning, null is plain farmland.
// This mirrors the click rule of the controller.
const canOpen = (apt: string | null) => !(apt && NOT_FARMLAND.includes(apt))
const warnsOnOpen = (apt: string | null) => !!(apt && LIMITED.includes(apt))

describe('apt rules', () => {
  it('cannot open urban, water or public-domain farms', () => {
    expect(NOT_FARMLAND).toEqual(['urbano', 'agua', 'publico'])
    for (const apt of NOT_FARMLAND) expect(canOpen(apt)).toBe(false)
  })

  it('opens forest, steep and rock farms, with a warning', () => {
    expect(LIMITED).toEqual(['monte', 'pendiente', 'roca'])
    for (const apt of LIMITED) {
      expect(canOpen(apt)).toBe(true)
      expect(warnsOnOpen(apt)).toBe(true)
    }
  })

  it('opens plain farmland (apt = null) without a warning', () => {
    expect(canOpen(null)).toBe(true)
    expect(warnsOnOpen(null)).toBe(false)
  })

  it('the two groups do not overlap', () => {
    expect(NOT_FARMLAND.filter((a) => LIMITED.includes(a))).toEqual([])
  })

  it('every aptitude code has an English explanation, and nothing else does', () => {
    expect(Object.keys(APT).sort()).toEqual([...NOT_FARMLAND, ...LIMITED].sort())
    for (const text of Object.values(APT)) expect(text).toMatch(/^[A-Z]/)
  })

  it('every non-farmland farm is described by a land cover or a plain apt label', () => {
    expect(COVER_NAME.cultivo).toBe('cropland')
    expect(COVER_NAME.urbano).toBeDefined()
    expect(COVER_NAME.agua).toBeDefined()
  })
})
