/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import type { Common, FarmDetail } from './detail'
import type { RotationKey } from './indicators'
import { calculateScores, PROFILES, ROTATIONS, scenarioFor, type Scenario } from './calculator'

const data = (p: string) => new URL(`../../public/data/${p}`, import.meta.url)
const common: Common = JSON.parse(readFileSync(data('comun_29.json'), 'utf8'))
const detail: Record<string, FarmDetail> = JSON.parse(gunzipSync(readFileSync(data('detalle/29015.json.gz'))).toString())
const indicators = JSON.parse(readFileSync(data('indicators_antequera.json'), 'utf8'))

const ROTATION_KEYS = Object.keys(ROTATIONS) as RotationKey[]
const TOLERANCE = 0.05

/** A plain mid-range scenario, used as a base for the edge cases. */
const base: Scenario = {
  precipMm: 450,
  p20PrecipMm: 340,
  deficitMm: 800,
  deficitP20Mm: 910,
  heatDays: 10,
  frostDays: 2,
  soil: { arcilla_pct: 30, ph_h2o: 7, cad_0_100_mm: 150 },
  prices: { trigo: 250, girasol: 450, garbanzo: 700, veza: 300, barbecho: 0 },
  priceYear: 2025,
}

describe('calculator vs the pipeline output (26 Antequera candidates)', () => {
  it('has the 26 candidates', () => {
    expect(indicators.candidates).toHaveLength(26)
  })

  it('reproduces every score, final score and rank with 0 differences', () => {
    const diffs: string[] = []
    let checked = 0
    for (const c of indicators.candidates) {
      const scenario = scenarioFor(detail[c.finca_key], common)
      if (!scenario) { diffs.push(`${c.finca_key}: no scenario`); continue }
      const ours = calculateScores(scenario)
      for (const [rid, r] of Object.entries<any>(c.rotations)) {
        const o = ours[rid as RotationKey]
        for (const k of ['water', 'water_p20', 'soil', 'profit', 'risk'] as const) {
          const mine = k === 'water_p20' ? o.waterP20 : o[k]
          checked++
          if (Math.abs((mine ?? NaN) - r[k]) > TOLERANCE) diffs.push(`${c.finca_key} ${rid} ${k}: pipeline ${r[k]} app ${mine}`)
        }
        for (const p of ['water_first', 'soil_first', 'profit_first'] as const) {
          checked += 2
          if (Math.abs((o.score[p] ?? NaN) - r.rankings[p].final_score) > TOLERANCE) diffs.push(`${c.finca_key} ${rid} ${p} score: pipeline ${r.rankings[p].final_score} app ${o.score[p]}`)
          if (o.rank[p] !== r.rankings[p].rank) diffs.push(`${c.finca_key} ${rid} ${p} rank: pipeline ${r.rankings[p].rank} app ${o.rank[p]}`)
        }
      }
    }
    expect(checked).toBeGreaterThan(1000)
    expect(diffs).toEqual([])
  })
})

describe('scenarioFor', () => {
  const key = Object.keys(detail)[0]

  it('returns null when the climate cell is not in the common file', () => {
    expect(scenarioFor({ ...detail[key], celda: -1 }, common)).toBeNull()
  })

  it('builds prices for every crop and a zero price for fallow', () => {
    const s = scenarioFor(detail[key], common)!
    expect(s.prices.barbecho).toBe(0)
    for (const crop of ['trigo', 'girasol', 'garbanzo', 'veza']) expect(s.prices[crop]).toBeGreaterThan(0)
    expect(s.priceYear).toBeLessThanOrEqual(2025)
  })

  it('keeps the farm soil, including a missing soil', () => {
    expect(scenarioFor({ ...detail[key], suelo: null }, common)!.soil).toBeNull()
  })

  it('computes the dry-year deficit from the mean one', () => {
    const s = scenarioFor(detail[key], common)!
    if (s.deficitMm !== null) expect(s.deficitP20Mm).toBeCloseTo(s.deficitMm + (s.precipMm - s.p20PrecipMm), 9)
    else expect(s.deficitP20Mm).toBeNull()
  })
})

describe('calculateScores: structure', () => {
  const out = calculateScores(base)

  it('scores the four rotations, every score between 0 and 100', () => {
    expect(Object.keys(out)).toEqual(ROTATION_KEYS)
    for (const r of Object.values(out)) {
      for (const v of [r.water, r.waterP20, r.soil, r.profit!, r.risk]) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
  })

  it('profile weights add up to 1', () => {
    for (const w of Object.values(PROFILES)) expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9)
  })

  it('rounds scores to one decimal', () => {
    for (const r of Object.values(out)) for (const v of [r.water, r.soil, r.profit!, r.risk]) expect(Math.round(v * 10) / 10).toBe(v)
  })

  it('a rotation with fallow carries a bare-soil penalty on risk', () => {
    expect(out.R3.risk).toBeLessThan(out.R2.risk)
  })

  it('legume rotations beat the current one on soil', () => {
    expect(out.R1.soil).toBeGreaterThan(out.R0.soil)
    expect(out.R2.soil).toBeGreaterThan(out.R0.soil)
  })
})

describe('calculateScores: missing soil', () => {
  it('still scores soil, from the crops alone', () => {
    const out = calculateScores({ ...base, soil: null })
    for (const r of Object.values(out)) {
      expect(Number.isFinite(r.soil)).toBe(true)
      expect(r.soil).toBeLessThanOrEqual(100)
    }
    // Fallback formula: average cover * 100 / 6 (+15 with a legume), capped at 100
    expect(out.R0.soil).toBe(100)
    expect(out.R3.soil).toBe(Math.round(((8 + 6 + 0) / 3) * (100 / 6) * 10) / 10)
    expect(out.R3.soil).toBeLessThan(out.R0.soil)
  })

  it('treats null soil fields as typical values (clay 30, pH 7, CAD 120)', () => {
    const nulls = calculateScores({ ...base, soil: { arcilla_pct: null, ph_h2o: null, cad_0_100_mm: null } })
    const typical = calculateScores({ ...base, soil: { arcilla_pct: 30, ph_h2o: 7, cad_0_100_mm: 120 } })
    for (const k of ROTATION_KEYS) expect(nulls[k].soil).toBe(typical[k].soil)
  })

  it('a worse soil gives a lower score', () => {
    const good = calculateScores(base)
    const bad = calculateScores({ ...base, soil: { arcilla_pct: 70, ph_h2o: 9, cad_0_100_mm: 60 } })
    for (const k of ROTATION_KEYS) expect(bad[k].soil).toBeLessThan(good[k].soil)
  })
})

describe('calculateScores: missing prices', () => {
  it('a rotation without all its prices has no profit, no final score and no rank', () => {
    const out = calculateScores({ ...base, prices: { ...base.prices, garbanzo: null } })
    expect(out.R1.profit).toBeNull()
    expect(out.R1.priceEurT).toBeNull()
    expect(out.R1.warnings).toContain('No price for all the crops in the rotation')
    for (const p of Object.keys(PROFILES) as (keyof typeof PROFILES)[]) {
      expect(out.R1.score[p]).toBeNull()
      expect(out.R1.rank[p]).toBeNull()
    }
  })

  it('the other rotations are still ranked and ranks stay consecutive from 1', () => {
    const out = calculateScores({ ...base, prices: { ...base.prices, garbanzo: null } })
    expect(out.R1.status).toBe('viable_with_caveats')
    const ranks = [out.R0, out.R2, out.R3].map((r) => r.rank.water_first).sort()
    expect(ranks).toEqual([1, 2, 3])
  })

  it('with no price at all, nothing is ranked', () => {
    const out = calculateScores({ ...base, prices: { trigo: null, girasol: null, garbanzo: null, veza: null, barbecho: 0 } })
    for (const r of Object.values(out)) {
      expect(r.profit).toBeNull()
      expect(r.rank.profit_first).toBeNull()
    }
  })

  it('an undefined price counts as missing', () => {
    const { veza: _veza, ...rest } = base.prices
    expect(calculateScores({ ...base, prices: rest }).R2.profit).toBeNull()
  })
})

describe('calculateScores: ranking', () => {
  it('rank 1 is the best score and ranks follow the score order', () => {
    const out = calculateScores(base)
    for (const p of Object.keys(PROFILES) as (keyof typeof PROFILES)[]) {
      const ranked = ROTATION_KEYS.filter((k) => out[k].rank[p] !== null).sort((a, b) => out[a].rank[p]! - out[b].rank[p]!)
      for (let i = 1; i < ranked.length; i++) expect(out[ranked[i - 1]].score[p]!).toBeGreaterThanOrEqual(out[ranked[i]].score[p]!)
      expect(out[ranked[0]].rank[p]).toBe(1)
    }
  })

  it('ties share a rank and the next rank is skipped (competition ranking)', () => {
    // R1 and R2 differ only by chickpea vs vetch (market and price); search for a vetch price
    // that makes their rounded final score identical.
    let tied: ReturnType<typeof calculateScores> | null = null
    for (let veza = 0; veza <= 800 && !tied; veza += 0.5) {
      const out = calculateScores({ ...base, soil: null, prices: { ...base.prices, garbanzo: 100, veza } })
      if (out.R1.score.profit_first === out.R2.score.profit_first) tied = out
    }
    expect(tied).not.toBeNull()
    const out = tied!
    expect(out.R1.rank.profit_first).toBe(out.R2.rank.profit_first)
    for (const k of ROTATION_KEYS) {
      const better = ROTATION_KEYS.filter((o) => out[o].score.profit_first! > out[k].score.profit_first!).length
      expect(out[k].rank.profit_first).toBe(better + 1)
    }
  })

  it('equal scores get equal ranks', () => {
    const out = calculateScores(base)
    for (const p of Object.keys(PROFILES) as (keyof typeof PROFILES)[]) {
      for (const a of ROTATION_KEYS) for (const b of ROTATION_KEYS) {
        if (out[a].score[p] !== null && out[a].score[p] === out[b].score[p]) expect(out[a].rank[p]).toBe(out[b].rank[p])
      }
    }
  })

  it('a not viable rotation (blocker) is never ranked', () => {
    const out = calculateScores({ ...base, deficitMm: 4000, deficitP20Mm: 4000, precipMm: 100, p20PrecipMm: 60 })
    const blocked = ROTATION_KEYS.filter((k) => out[k].blockers.length)
    expect(blocked.length).toBeGreaterThan(0)
    for (const k of blocked) {
      expect(out[k].status).toBe('not_viable')
      expect(out[k].rank.water_first).toBeNull()
      expect(out[k].score.water_first).not.toBeNull()
    }
  })
})

describe('calculateScores: warnings and status', () => {
  it('a mild scenario is viable without warnings', () => {
    const out = calculateScores({ ...base, deficitMm: 300, deficitP20Mm: 350 })
    expect(out.R0.status).toBe('viable')
    expect(out.R0.warnings).toEqual([])
  })

  it('warns about heat above 25 days and frost above 5 days', () => {
    const out = calculateScores({ ...base, heatDays: 26, frostDays: 6, deficitMm: 300, deficitP20Mm: 350 })
    expect(out.R0.warnings).toEqual(['High heat during the season', 'Frost risk above the threshold'])
    expect(out.R0.status).toBe('viable_with_caveats')
  })

  it('no deficit falls back to the rainfall to judge drought', () => {
    const out = calculateScores({ ...base, deficitMm: null, deficitP20Mm: null })
    for (const r of Object.values(out)) expect(Number.isFinite(r.water)).toBe(true)
  })

  it('more heat and frost lower the risk score', () => {
    const calm = calculateScores({ ...base, heatDays: 0, frostDays: 0 })
    const harsh = calculateScores({ ...base, heatDays: 30, frostDays: 10 })
    for (const k of ROTATION_KEYS) expect(harsh[k].risk).toBeLessThan(calm[k].risk)
  })
})
