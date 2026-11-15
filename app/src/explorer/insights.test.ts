/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { calculateScores, scenarioFor, type Scenario } from '../lib/calculator'
import type { Common, FarmDetail } from '../lib/detail'
import type { FarmProps } from '../lib/geo'
import type { ProfileKey } from '../lib/indicators'
import { bestRotation, farmInsights, HEADLINE_MAX, recommendation, T, type FarmFacts, type Insight } from './insights'

const data = (p: string) => new URL(`../../public/data/${p}`, import.meta.url)
const gz = (p: string) => JSON.parse(gunzipSync(readFileSync(data(p))).toString())
const common: Common = JSON.parse(readFileSync(data('comun_29.json'), 'utf8'))

/** The same facts the farm view builds for a real farm (controller.ts farmScene + FarmView). */
function realFarm(mun: number, id: number, profile: ProfileKey = 'water_first'): FarmFacts {
  const detail: FarmDetail = gz(`detalle/${mun}.json.gz`)[id]
  const props: FarmProps = gz(`fincas/${mun}.geojson.gz`).features.find((f: { properties: FarmProps }) => f.properties.id === id).properties
  const scenario = scenarioFor(detail, common)!
  const cell = common.celdas[String(detail.celda)].resumen
  return {
    scores: calculateScores(scenario),
    climate: { rain: cell.lluvia_media_mm, deficit: cell.deficit_medio_mm, hotDays: scenario.heatDays, frostDays: scenario.frostDays },
    soil: detail.suelo,
    slope: props.slope,
    apt: props.apt,
    cover: props.cover,
    landCover: detail.cobertura,
    seasons: detail.rotacion_estimada ?? props.rot,
    profile,
  }
}

/** A farm with nothing to warn about (low deficit, cool, gentle, deep soil), built on the real calculator. */
const calm: Scenario = {
  precipMm: 600, p20PrecipMm: 480, deficitMm: 400, deficitP20Mm: 520, heatDays: 2, frostDays: 0,
  soil: { arcilla_pct: 30, ph_h2o: 7, cad_0_100_mm: 150 },
  prices: { trigo: 250, girasol: 450, garbanzo: 700, veza: 300, barbecho: 0 }, priceYear: 2025,
}
function synthetic(over: Partial<Scenario> = {}, facts: Partial<FarmFacts> = {}): FarmFacts {
  const s = { ...calm, ...over }
  return {
    scores: calculateScores(s),
    climate: { rain: s.precipMm, deficit: s.deficitMm, hotDays: s.heatDays, frostDays: s.frostDays },
    soil: s.soil,
    slope: 3,
    apt: null,
    cover: 'cultivo',
    landCover: { arbolado: 4, matorral: 2, pasto: 3, cultivo: 90, urbano: 0, suelo_desnudo: 1, agua: 0 },
    seasons: 'I-B-I-B-I-B',
    profile: 'water_first',
    ...facts,
  }
}
const ids = (xs: Insight[]) => xs.map((i) => `${i.severity}:${i.id}`)

describe('real farms', () => {
  it('Antequera 2900059683: heat and water deficit, then R1 as the best option', () => {
    const ins = farmInsights(realFarm(29015, 2900059683))
    expect(ids(ins)).toEqual(['warning:heat', 'warning:water', 'good:best'])
    expect(ins[0].headline).toBe('High heat risk in May–June (14 days)')
    expect(ins[0].detail).toContain('35 %') // 14 / 40 of the climate-risk score
    expect(ins[1].headline).toBe('Severe water deficit (823 mm/yr)')
    expect(ins[2].headline).toBe('Best option: R1 (+2.8 points over current)') // 67.0 vs 64.2
    expect(ins[0].target).toBe('risk')
  })

  it('Antequera with the Market priority: the current rotation is already the best', () => {
    const ins = farmInsights(realFarm(29015, 2900059683, 'profit_first'))
    expect(ins.at(-1)!.headline).toBe('Current rotation is already the best option')
  })

  it('Ronda 2900263939: steep slope (14.8 %), no water or heat warning', () => {
    const ins = farmInsights(realFarm(29084, 2900263939))
    expect(ids(ins)).toEqual(['warning:slope', 'good:best'])
    expect(ins[0].headline).toBe('Steep slope (14.8 %): erosion risk')
    expect(ins[0].target).toBe('soil')
    expect(ins[1].headline).toBe('Best option: R1 (+2.4 points over current)')
  })

  it('a farm with apt = "pendiente" (2900063712): very steep slope first, then permanent crop', () => {
    const facts = realFarm(29015, 2900063712)
    expect(facts.apt).toBe('pendiente')
    const ins = farmInsights(facts)
    expect(ids(ins)).toEqual(['critical:slope', 'warning:permanent', 'warning:water'])
    expect(ins[0].headline).toBe('Very steep slope (53.7 %): hard to farm')
  })

  it('a farm with apt = "monte" (2900063216): the land-use caveat leads the warnings', () => {
    const ins = farmInsights(realFarm(29015, 2900063216))
    expect(ins[0].id).toBe('land-use')
    expect(ins[0].headline).toBe('Forest or scrub: rotations are indicative')
    expect(ins[0].detail).toMatch(/^\d+ % of the farm is scrub or trees by satellite land cover/)
    expect(ins.find((i) => i.id === 'permanent')).toBeUndefined()
  })
})

describe('rules and thresholds', () => {
  it('a calm farm only gets the opportunity', () => {
    expect(ids(farmInsights(synthetic()))).toEqual(['good:best'])
  })

  it('water: warning from 720 mm/yr, critical from the 900 mm reference', () => {
    expect(farmInsights(synthetic({ deficitMm: T.deficitHigh - 1 })).find((i) => i.id === 'water')).toBeUndefined()
    expect(farmInsights(synthetic({ deficitMm: T.deficitHigh })).find((i) => i.id === 'water')?.severity).toBe('warning')
    const crit = farmInsights(synthetic({ deficitMm: 955, deficitP20Mm: 1070 }))[0]
    expect(crit).toMatchObject({ id: 'water', severity: 'critical', headline: 'Extreme water deficit (955 mm/yr)', target: 'water' })
  })

  it('water: a P20 blocker of the calculator is critical even with a moderate mean deficit', () => {
    const f = synthetic({ deficitMm: 700, deficitP20Mm: 3000, precipMm: 600, p20PrecipMm: 100 })
    expect(f.scores!.R0.waterP20).toBeLessThan(T.waterP20Blocker)
    const water = farmInsights(f).find((i) => i.id === 'water')!
    expect(water.severity).toBe('critical')
    expect(water.detail).toContain('P20')
  })

  it('heat: warning from 10 days, critical above the calculator limit of 25', () => {
    expect(farmInsights(synthetic({ heatDays: 9 })).find((i) => i.id === 'heat')).toBeUndefined()
    expect(farmInsights(synthetic({ heatDays: 10 })).find((i) => i.id === 'heat')?.severity).toBe('warning')
    expect(farmInsights(synthetic({ heatDays: 25 })).find((i) => i.id === 'heat')?.severity).toBe('warning')
    expect(farmInsights(synthetic({ heatDays: 26 })).find((i) => i.id === 'heat')?.severity).toBe('critical')
  })

  it('frost: warning above 5 days', () => {
    expect(farmInsights(synthetic({ frostDays: 5 })).find((i) => i.id === 'frost')).toBeUndefined()
    expect(farmInsights(synthetic({ frostDays: 6 })).find((i) => i.id === 'frost')).toMatchObject({ severity: 'warning', target: 'risk' })
  })

  it('slope: warning from 12 %, critical from 30 % or with apt "pendiente"', () => {
    const slope = (f: FarmFacts) => farmInsights(f).find((i) => i.id === 'slope')
    expect(slope(synthetic({}, { slope: 11.9 }))).toBeUndefined()
    expect(slope(synthetic({}, { slope: 12 }))?.severity).toBe('warning')
    expect(slope(synthetic({}, { slope: 30 }))?.severity).toBe('critical')
    expect(slope(synthetic({}, { slope: null, apt: 'pendiente' }))).toMatchObject({ severity: 'critical', headline: 'Very steep slope: hard to farm' })
  })

  it('soil water: warning at 100 mm or less', () => {
    const soil = (cad: number) => farmInsights(synthetic({ soil: { arcilla_pct: 30, ph_h2o: 7, cad_0_100_mm: cad } })).find((i) => i.id === 'soil-water')
    expect(soil(101)).toBeUndefined()
    expect(soil(91)).toMatchObject({ severity: 'warning', headline: 'Soil with little available water (91 mm)', target: 'soil' })
  })

  it('permanent crop: tree cover, or 4 seasons out of 6 seen as permanent', () => {
    const perm = (f: Partial<FarmFacts>) => farmInsights(synthetic({}, f)).find((i) => i.id === 'permanent')
    expect(perm({ cover: 'arbolado' })?.headline).toBe('Looks like a permanent crop: rotations are indicative')
    expect(perm({ cover: 'arbolado', landCover: { arbolado: 71.5 } })?.detail).toContain('72 % trees')
    expect(perm({ seasons: 'P-P-P-B-B-B' })).toBeUndefined()
    expect(perm({ seasons: 'P-P-P-P-B-B' })?.detail).toContain('4 of the 6 seasons')
  })

  it('no scores: a single "no data" insight', () => {
    expect(farmInsights({ ...synthetic(), scores: null, climate: null, soil: null })).toEqual([
      expect.objectContaining({ id: 'no-data', severity: 'warning', target: null }),
    ])
  })
})

describe('ranking', () => {
  it('returns at most 3, critical before warning before good', () => {
    const ins = farmInsights(synthetic({ deficitMm: 950, heatDays: 30, frostDays: 8, soil: { arcilla_pct: 30, ph_h2o: 7, cad_0_100_mm: 80 } }, { slope: 20 }))
    expect(ins).toHaveLength(3)
    expect(ins.map((i) => i.severity)).toEqual(['critical', 'critical', 'warning'])
  })

  it('within a severity, the insight furthest past its threshold first', () => {
    // heat 14/10 = 1.4 beats deficit 750/720 ≈ 1.04
    expect(ids(farmInsights(synthetic({ heatDays: 14, deficitMm: 750 })))).toEqual(['warning:heat', 'warning:water', 'good:best'])
    // heat 11/10 = 1.1 loses to deficit 850/720 ≈ 1.18
    expect(ids(farmInsights(synthetic({ heatDays: 11, deficitMm: 850 })))).toEqual(['warning:water', 'warning:heat', 'good:best'])
  })

  it('land-use and permanent warnings come before the other warnings', () => {
    const ins = farmInsights(synthetic({ heatDays: 20, deficitMm: 850 }, { cover: 'arbolado' }))
    expect(ids(ins)).toEqual(['warning:permanent', 'warning:heat', 'warning:water'])
  })

  it('every farm with scores gets 1–3 insights with short headlines and a numbered detail', () => {
    const cases = [synthetic(), synthetic({ deficitMm: 950, heatDays: 40, frostDays: 9 }, { slope: 182.8, apt: 'pendiente', cover: 'arbolado' }),
      synthetic({}, { apt: 'monte' }), synthetic({}, { apt: 'roca' }), synthetic({}, { apt: 'publico' }), realFarm(29015, 2900059683), realFarm(29084, 2900263939)]
    for (const f of cases) {
      for (const profile of ['water_first', 'soil_first', 'profit_first'] as const) {
        const ins = farmInsights({ ...f, profile })
        expect(ins.length).toBeGreaterThanOrEqual(1)
        expect(ins.length).toBeLessThanOrEqual(3)
        for (const i of ins) {
          expect(i.headline.length, i.headline).toBeLessThanOrEqual(HEADLINE_MAX)
          expect(i.detail).toMatch(/\d/)
          expect(i.detail).toMatch(/\.$/)
        }
      }
    }
  })
})

describe('recommendation', () => {
  it('names the best rotation and the score that explains it', () => {
    const f = realFarm(29015, 2900059683)
    expect(bestRotation(f.scores!, 'water_first')).toBe('R1')
    expect(recommendation(f.scores, 'water_first')).toBe(
      'R1 (Wheat–Sunflower–Chickpea) is best for the Water priority: 67.0 vs. 64.2 now, mainly for better soil (+7.5), which outweighs a weaker market (-4.8).',
    )
    expect(bestRotation(f.scores!, 'soil_first')).toBe('R2')
    expect(recommendation(f.scores, 'soil_first')).toMatch(/^R2 \(Wheat–Sunflower–Vetch\) is best for the Soil priority: 68\.4 vs\. 63\.3 now, mainly for better soil/)
  })

  it('says to keep the current rotation when it ranks first', () => {
    const f = realFarm(29015, 2900059683)
    expect(recommendation(f.scores, 'profit_first')).toBe('Keep the current rotation: it scores 68.6 for the Market priority, ahead of R1 (67.4).')
  })

  it('is null without scores', () => {
    expect(recommendation(null, 'water_first')).toBeNull()
  })
})
