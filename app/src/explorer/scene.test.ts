import { describe, expect, it } from 'vitest'
import { CLASS_LETTER, CROPS, FIRST_SCENARIO_YEAR, LAST_YEAR, cropForYear, rings, tileFor, yearLetter, type BBox, type FarmScene } from './scene'

const farm = (over: Partial<FarmScene> = {}): FarmScene => ({
  key: 'x',
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
  tile: [0, 0, 1, 1],
  rot: 'I-B-I-B-I-B',
  campaigns: [],
  trees: 0,
  clay: null,
  neighbors: [],
  crops: { R0: ['trigo', 'girasol'], R1: ['trigo', 'girasol', 'garbanzo'], R2: ['trigo', 'girasol', 'veza'], R3: ['trigo', 'girasol', 'barbecho'] },
  ...over,
})

describe('tileFor', () => {
  // About 500 m x 500 m farm near Antequera
  const small: BBox = [-4.56, 37.02, -4.555, 37.0245]
  const metres = ([w, s, e, n]: BBox) => ({
    w: (e - w) * 111320 * Math.cos((((s + n) / 2) * Math.PI) / 180),
    h: (n - s) * 110574,
  })

  it('is centred on the farm', () => {
    const [w, s, e, n] = tileFor(small)
    expect((w + e) / 2).toBeCloseTo(-4.5575, 9)
    expect((s + n) / 2).toBeCloseTo(37.02225, 9)
  })

  it('is square in metres', () => {
    const { w, h } = metres(tileFor(small))
    expect(w).toBeCloseTo(h, 3)
  })

  it('never goes below the minimum tile size, however small the farm', () => {
    const tiny: BBox = [-4.5, 37, -4.4999, 37.0001]
    const { w } = metres(tileFor(tiny))
    expect(w).toBeCloseTo(950, 3)
  })

  it('grows with the farm: the side is 1.55 times the longest side', () => {
    const big: BBox = [-4.6, 37.0, -4.5, 37.1]
    const { h } = metres(tileFor(big))
    expect(h).toBeCloseTo(0.1 * 110574 * 1.55, 1)
  })

  it('honours custom factor and minimum', () => {
    const { w } = metres(tileFor([-4.5, 37, -4.4999, 37.0001], 2, 1000))
    expect(w).toBeCloseTo(1000, 3)
  })

  it('west is less than east and south is less than north', () => {
    const [w, s, e, n] = tileFor(small)
    expect(w).toBeLessThan(e)
    expect(s).toBeLessThan(n)
  })
})

describe('yearLetter', () => {
  it('picks the letter of the year index', () => {
    expect(yearLetter('I-B-V-M-P-I', 0)).toBe('I')
    expect(yearLetter('I-B-V-M-P-I', 2)).toBe('V')
    expect(yearLetter('I-B-V-M-P-I', 5)).toBe('I')
  })

  it('falls back to the last letter when the index is past the end', () => {
    expect(yearLetter('I-B', 5)).toBe('B')
  })

  it('returns an empty string without a rotation', () => {
    expect(yearLetter(null, 0)).toBe('')
    expect(yearLetter('', 3)).toBe('')
  })

  it('ignores empty segments', () => {
    expect(yearLetter('I--B', 1)).toBe('B')
  })
})

describe('cropForYear', () => {
  it('uses the MODIS class of the campaign when there is one', () => {
    const e = farm({ campaigns: [{ y: 2022, cls: 'herbaceo_verano' }] })
    expect(cropForYear(e, 2022, 'R0')).toEqual({ key: 'V', observed: true })
  })

  it('falls back to the observed rotation letter when the class is missing or unknown', () => {
    const e = farm({ campaigns: [{ y: 2021, cls: null }, { y: 2022, cls: 'unknown' }] })
    expect(cropForYear(e, 2021, 'R0')).toEqual({ key: 'B', observed: true }) // index 1 of I-B-I-B-I-B
    expect(cropForYear(e, 2022, 'R0')).toEqual({ key: 'I', observed: true }) // index 2
    expect(cropForYear(e, 2020, 'R0')).toEqual({ key: 'I', observed: true }) // no campaign at all
  })

  it('defaults to fallow when there is nothing to go on', () => {
    expect(cropForYear(farm({ rot: null }), 2023, 'R0')).toEqual({ key: 'B', observed: true })
  })

  it('every MODIS class maps to a letter with a palette entry', () => {
    for (const letter of Object.values(CLASS_LETTER)) expect(CROPS[letter]).toBeDefined()
  })

  it('projects the chosen rotation from 2026 on, cycling through its crops', () => {
    const e = farm()
    expect(FIRST_SCENARIO_YEAR).toBe(2026)
    const seq = (r: 'R0' | 'R1' | 'R2' | 'R3') => Array.from({ length: LAST_YEAR - FIRST_SCENARIO_YEAR + 1 }, (_, i) => cropForYear(e, 2026 + i, r).key)
    expect(seq('R0')).toEqual(['trigo', 'girasol', 'trigo', 'girasol', 'trigo', 'girasol'])
    expect(seq('R1')).toEqual(['trigo', 'girasol', 'garbanzo', 'trigo', 'girasol', 'garbanzo'])
    expect(seq('R2')[2]).toBe('veza')
    expect(seq('R3')[5]).toBe('barbecho')
    expect(cropForYear(e, 2026, 'R1').observed).toBe(false)
  })

  it('2025 is still observed and 2026 is the first projection', () => {
    const e = farm()
    expect(cropForYear(e, 2025, 'R1').observed).toBe(true)
    expect(cropForYear(e, 2026, 'R1').observed).toBe(false)
  })

  it('every rotation crop has a label and colour', () => {
    for (const c of ['trigo', 'girasol', 'garbanzo', 'veza', 'barbecho']) {
      expect(CROPS[c].label).toBeTruthy()
      expect(CROPS[c].color).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })
})

describe('rings', () => {
  it('wraps a Polygon so both geometry types look the same', () => {
    const poly = farm().geometry
    expect(rings(poly)).toHaveLength(1)
    expect(rings({ type: 'MultiPolygon', coordinates: [poly.type === 'Polygon' ? poly.coordinates : [], poly.type === 'Polygon' ? poly.coordinates : []] })).toHaveLength(2)
  })
})
