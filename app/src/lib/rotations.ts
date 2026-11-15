import { t } from '../i18n'
import type { Priorities } from '../store'
import { crop, type Crop } from './crops'
import { analyse, cropRisk, PRIORITY_KEYS, type Analysis, type Context } from './scoring'

export type StrategyId = 'A' | 'B' | 'C'
export type Evidence = { source: string; text: string; demo: boolean }
export type Strategy = {
  id: StrategyId
  years: string[][]
  why: string
  evidence: Evidence[]
  benefits: string[]
  risks: string[]
  gaps: string[]
  analysis: Analysis
}

const name = (id: string) => crop(id).name

function leastRisky(ids: string[], ctx: Context) {
  const risk = (id: string) => {
    const r = cropRisk(crop(id), ctx)
    return Math.max(r.drought, r.frost)
  }
  return [...ids].sort((a, b) => risk(a) - risk(b))[0]
}

function plans(ctx: Context) {
  const current = crop(ctx.constraints.currentCrop)
  const summerRain = [5, 6, 7].reduce((s, m) => s + ctx.climate.monthly[ctx.southern ? (m + 6) % 12 : m].rain, 0)

  if (current.perennial) {
    return { current, A: [[current.id]], B: [[current.id, 'vetch']], C: [[current.id, 'barley']], roles: { legume: null, cover: null, deep: null, fallow: false } }
  }

  const legume = ctx.climate.annualRain >= 550 || ctx.constraints.irrigation === 'yes' ? 'faba' : 'chickpea'
  const cover = ctx.climate.frostDaysYear > 40 ? 'rye' : 'vetch'
  const deep = leastRisky(ctx.constraints.irrigation === 'yes' ? ['sunflower', 'sorghum', 'corn'] : ['sunflower', 'sorghum'], ctx)
  const cereal = current.group === 'cereal' && current.months.includes(1) ? current.id : 'wheat'
  const summer = ctx.constraints.irrigation !== 'no' || summerRain > 120 ? 'sorghum' : null

  return {
    current,
    A: current.partner ? [[current.id], [current.partner]] : [[current.id]],
    B: [[legume], [cover, deep], [cereal]],
    C: [['barley'], ['chickpea'], summer ? [summer] : []],
    roles: { legume, cover, deep, fallow: !summer },
  }
}

function evidence(ctx: Context, a: Analysis) {
  const c = ctx.climate
  const e = t.rotations.evidence
  const power = ctx.climateReal ? 'POWER' : `POWER (${t.rotations.sample})`
  const frostMonths = c.monthly.filter((m) => m.frostDays >= 0.5).map((m) => t.months[m.month])
  return {
    balance: { source: power, text: e.balance(c.annualRain, c.annualEt0), demo: !ctx.climateReal },
    variability: { source: power, text: e.variability(c.rainStd, c.rainCv), demo: !ctx.climateReal },
    frost: { source: power, text: e.frost(c.frostDaysYear, frostMonths), demo: !ctx.climateReal },
    bare: { source: power, text: e.bare(a.bareMonths, a.rainOnBare), demo: !ctx.climateReal },
    heat: { source: power, text: e.heat, demo: !ctx.climateReal },
    soil: { source: 'SoilGrids', text: e.soil(ctx.soil.organicMatterPct, ctx.soil.waterHoldingMm), demo: !ctx.soil.fromData },
  }
}

function risks(id: StrategyId, years: string[][], a: Analysis, ctx: Context) {
  const r = t.rotations.risk
  const out: string[] = []
  for (const cr of a.risks) {
    if (cr.frost > 0.35) out.push(r.frost(cr.crop.name, cr.frostDays))
    if (cr.drought > 0.45) out.push(ctx.constraints.irrigation === 'yes' ? r.irrigation(cr.crop.name) : r.drought(cr.crop.name))
  }
  const slope = ctx.constraints.slope
  if ((slope === 'moderate' || slope === 'steep') && a.rainOnBare > 0.25 * ctx.climate.annualRain) out.push(r.erosion(t.priorities.slopes[slope]))
  if (id === 'A' && !crop(ctx.constraints.currentCrop).perennial) out.push(r.short)
  if (id === 'B') out.push(r.coverWater, r.newCrops)
  if (id === 'C') {
    if (years.some((y) => y.length === 0)) out.push(r.fallow)
    out.push(r.lowYield)
  }
  return out
}

function gaps(id: StrategyId, years: string[][], ctx: Context) {
  const g = t.rotations.gap
  const out = [ctx.climateReal ? g.grid : g.sample, ctx.soil.fromData ? g.soil : g.noSoil, g.market]
  if (ctx.constraints.slopePct === null) out.push(g.slope)
  if (id === 'A') out.push(g.yields)
  if (id === 'B') out.push(g.cover)
  if (id === 'C' && years.some((y) => y.length === 0)) out.push(g.fallow)
  return out
}

function benefits(id: StrategyId, a: Analysis) {
  const strong = PRIORITY_KEYS.filter((k) => a.scores[k].score >= 55).sort((x, y) => a.scores[y].score - a.scores[x].score)
  const out = strong.slice(0, 3).map((k) => t.rotations.benefit[k](a.scores[k].score))
  if (id === 'A') out.push(t.rotations.benefit.familiar)
  return out.length ? out : [t.rotations.benefit.none]
}

export function buildStrategies(ctx: Context, priorities: Priorities): Strategy[] {
  const p = plans(ctx)
  const w = t.rotations.why
  const make = (id: StrategyId, years: string[][], why: string, ev: (e: ReturnType<typeof evidence>) => Evidence[]): Strategy => {
    const analysis = analyse(years, ctx, priorities)
    return {
      id,
      years,
      why,
      evidence: ev(evidence(ctx, analysis)),
      benefits: benefits(id, analysis),
      risks: risks(id, years, analysis, ctx),
      gaps: gaps(id, years, ctx),
      analysis,
    }
  }
  const current: Crop = p.current
  const balance = ctx.climate.annualRain - ctx.climate.annualEt0
  const { legume, cover, deep, fallow } = p.roles

  return [
    make('A', p.A, w.A(current.name, current.partner && !current.perennial ? name(current.partner) : null), (e) => [e.balance, e.bare, e.variability]),
    make('B', p.B, current.perennial ? w.Bperennial(current.name, name('vetch')) : w.B(name(legume!), name(cover!), name(deep!)), (e) => [e.bare, e.frost, e.soil]),
    make('C', p.C, current.perennial ? w.Cperennial(current.name) : w.C(p.C.flat().map(name), !!fallow, balance), (e) => [e.balance, e.variability, e.heat]),
  ]
}
