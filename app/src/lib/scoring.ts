import { t } from '../i18n'
import type { Constraints, Priorities, PriorityKey } from '../store'
import type { Climate, HeatPoint } from './climate'
import { crop, cropMonths, type Crop } from './crops'
import type { SoilProperties } from './soil'

export type Level = 'low' | 'medium' | 'high'
export type Context = {
  climate: Climate
  climateReal: boolean
  constraints: Constraints
  soil: SoilProperties
  heat: HeatPoint[]
  prices: Record<string, number | null>
  southern: boolean
}
export type CriterionScore = { score: number; reason: string; demoInputs: string[]; uncertainty: Level }
export type CropRisk = { crop: Crop; frost: number; drought: number; heat: number; frostDays: number }
export type SeasonRisk = { months: number[]; level: Level; reasons: string[] }
export type Analysis = {
  scores: Record<PriorityKey, CriterionScore>
  total: number
  uncertainty: Level
  coverage: number[]
  bareMonths: number
  rainOnBare: number
  risks: CropRisk[]
  seasons: SeasonRisk[]
}

export const PRIORITY_KEYS: PriorityKey[] = ['water', 'income', 'erosion', 'organic', 'cost']
const SEASONS = [[11, 0, 1], [2, 3, 4], [5, 6, 7], [8, 9, 10]]
const SLOPE_FACTOR = { flat: 0.5, gentle: 1, moderate: 1.5, steep: 2 }
const IRRIGATION_FACTOR = { yes: 0.2, limited: 0.6, no: 1 }

const clamp = (v: number) => Math.round(Math.max(0, Math.min(100, v)))
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
const LEVELS: Level[] = ['low', 'medium', 'high']
const levelFor = (demoCount: number) => LEVELS[Math.min(demoCount, 2)]

const groundCover = (c: Crop) => (c.perennial ? 0.4 : 1)

// Same price/market proxy as pipeline/calculator.py: 70 % market ease (1-5) + 30 % price capped at 800 €/t.
export function marketValue(c: Crop, price: number | null | undefined) {
  const market = (c.marketEase / 5) * 100
  return price == null ? market : 0.7 * market + 0.3 * (Math.min(price, 800) / 800) * 100
}

export function coverage(years: string[][], southern: boolean) {
  return Array.from({ length: 12 }, (_, m) =>
    mean(years.map((ids) => Math.max(0, ...ids.map(crop).filter((c) => cropMonths(c, southern).includes(m)).map(groundCover)))),
  )
}

export function cropRisk(c: Crop, ctx: Context): CropRisk {
  const months = cropMonths(c, ctx.southern)
  const monthly = months.map((m) => ctx.climate.monthly[m])
  const frostDays = monthly.reduce((s, m) => s + m.frostDays, 0)
  const frost = c.frostTolerance >= 4 ? 0 : clamp01((frostDays * (4 - c.frostTolerance)) / 20)
  const deficit = mean(monthly.map((m) => Math.max(0, -m.balance)))
  const sensitivity = ((6 - c.droughtTolerance) / 5) * (c.waterUse / 3)
  const drought = clamp01((deficit / 120) * sensitivity * IRRIGATION_FACTOR[ctx.constraints.irrigation])
  const heat = clamp01(mean(months.map((m) => ctx.heat[m]?.stress ?? 0)) * ((6 - c.droughtTolerance) / 5))
  return { crop: c, frost, drought, heat, frostDays }
}

export function analyse(years: string[][], ctx: Context, priorities: Priorities): Analysis {
  const { climate, constraints, soil } = ctx
  const crops = years.flat().map(crop)
  const unique = [...new Map(crops.map((c) => [c.id, c])).values()]
  const risks = unique.map((c) => cropRisk(c, ctx))
  const riskOf = (c: Crop) => risks.find((r) => r.crop.id === c.id)!
  const avg = (key: 'waterUse' | 'erosionProtection' | 'organicMatter' | 'inputCost') => mean(crops.map((c) => c[key]))
  const share = (test: (ids: string[]) => boolean) => years.filter(test).length / years.length
  const legumeShare = share((ids) => ids.some((id) => crop(id).nitrogenFixing))
  const coverShare = share((ids) => ids.some((id) => crop(id).group === 'cover'))
  const fallowShare = share((ids) => ids.length === 0)
  const cov = coverage(years, ctx.southern)
  const bareMonths = cov.reduce((s, v) => s + (1 - v), 0)
  const rainOnBare = cov.reduce((s, v, m) => s + (1 - v) * climate.monthly[m].rain, 0)
  const balance = climate.annualRain - climate.annualEt0
  const thirsty = unique.filter((c) => c.waterUse >= 4)
  const slopeF = SLOPE_FACTOR[constraints.slope]
  const climateDemo = ctx.climateReal ? [] : [t.scoring.inputs.climateSample]
  const names = (cs: Crop[]) => cs.map((c) => c.name).join(', ')

  const waterPenalty = constraints.irrigation !== 'yes' && balance < -300 ? thirsty.length * 12 : 0
  const sandyPenalty = soil.waterHoldingMm < 100 ? thirsty.length * 5 : 0
  const water = clamp(100 - (avg('waterUse') - 1) * 20 - waterPenalty - sandyPenalty + fallowShare * 10)

  const value = (c: Crop) => marketValue(c, ctx.prices[c.id]) * (1 - 0.5 * Math.max(riskOf(c).drought, riskOf(c).frost))
  const marketValues = years.map((ids) => Math.max(0, ...ids.map((id) => value(crop(id)))))
  const income = clamp(mean(marketValues))
  const riskyCrops = risks.filter((r) => Math.max(r.drought, r.frost) > 0.4).map((r) => r.crop)
  const noPrice = unique.filter((c) => ctx.prices[c.id] == null)
  const soilDemo = soil.fromData ? [] : [t.scoring.inputs.soil]

  const rainShareBare = climate.annualRain ? rainOnBare / climate.annualRain : 0
  const erosion = clamp(100 - bareMonths * 5 * slopeF - rainShareBare * 40 * slopeF + (avg('erosionProtection') - 3) * 6)

  const organic = clamp(30 + (avg('organicMatter') - 1) * 12 + legumeShare * 15 + coverShare * 15 - fallowShare * 20 + (bareMonths < 3 ? 5 : 0))

  const irrigatedThirsty = constraints.irrigation === 'yes' && thirsty.length > 0
  const cost = clamp(100 - (avg('inputCost') - 1) * 18 + legumeShare * 12 + fallowShare * 10 - (irrigatedThirsty ? 10 : 0))

  const make = (score: number, reason: string, demoInputs: string[]): CriterionScore => ({ score, reason, demoInputs, uncertainty: levelFor(demoInputs.length) })
  const scores: Record<PriorityKey, CriterionScore> = {
    water: make(water, t.scoring.water(avg('waterUse'), balance, names(thirsty), constraints.irrigation), [...soilDemo, ...climateDemo]),
    income: make(income, t.scoring.income(mean(crops.map((c) => marketValue(c, ctx.prices[c.id]))), names(riskyCrops), fallowShare, names(noPrice)), climateDemo),
    erosion: make(erosion, t.scoring.erosion(bareMonths, rainOnBare, t.priorities.slopes[constraints.slope]), [...(constraints.slopePct === null ? [t.scoring.inputs.slope] : []), ...climateDemo]),
    organic: make(organic, t.scoring.organic(avg('organicMatter'), legumeShare, coverShare, fallowShare, soil.organicMatterPct, soil.fromData), soilDemo),
    cost: make(cost, t.scoring.cost(avg('inputCost'), legumeShare, irrigatedThirsty), []),
  }

  const weights = PRIORITY_KEYS.map((k) => priorities[k])
  const wSum = weights.reduce((a, b) => a + b, 0)
  const w = wSum ? weights.map((x) => x / wSum) : weights.map(() => 1 / weights.length)
  const total = Math.round(PRIORITY_KEYS.reduce((s, k, i) => s + scores[k].score * w[i], 0))
  const levelIndex = PRIORITY_KEYS.reduce((s, k, i) => s + LEVELS.indexOf(scores[k].uncertainty) * w[i], 0)

  return {
    scores,
    total,
    uncertainty: LEVELS[Math.round(levelIndex)],
    coverage: cov,
    bareMonths,
    rainOnBare,
    risks,
    seasons: SEASONS.map((months) => seasonRisk(months, years, cov, ctx)),
  }
}

function seasonRisk(months: number[], years: string[][], cov: number[], ctx: Context): SeasonRisk {
  const { climate, constraints } = ctx
  const reasons: string[] = []
  let points = 0
  const rain = months.reduce((s, m) => s + climate.monthly[m].rain, 0)
  const bare = mean(months.map((m) => 1 - cov[m]))
  const erosion = bare * (rain / 120) * SLOPE_FACTOR[constraints.slope]
  if (erosion > 0.35) {
    points += erosion > 0.8 ? 2 : 1
    reasons.push(t.scoring.season.erosion(Math.round(rain)))
  }
  const inField = [...new Set(years.flat())].map(crop).filter((c) => months.some((m) => cropMonths(c, ctx.southern).includes(m)))
  const frost = months.reduce((s, m) => s + climate.monthly[m].frostDays, 0)
  const frostCrops = inField.filter((c) => c.frostTolerance <= 2)
  if (frost >= 1 && frostCrops.length) {
    points += frost >= 5 ? 2 : 1
    reasons.push(t.scoring.season.frost(frostCrops.map((c) => c.name).join(', '), frost))
  }
  const balance = months.reduce((s, m) => s + climate.monthly[m].balance, 0)
  const dryCrops = inField.filter((c) => c.droughtTolerance <= 3)
  if (balance < -150 && dryCrops.length && constraints.irrigation !== 'yes') {
    points += balance < -350 ? 2 : 1
    reasons.push(t.scoring.season.drought(dryCrops.map((c) => c.name).join(', '), Math.round(balance)))
  }
  const heat = mean(months.map((m) => ctx.heat[m]?.stress ?? 0))
  if (heat > 0.6 && inField.length) {
    points += 1
    reasons.push(t.scoring.season.heat)
  }
  return { months, level: points >= 3 ? 'high' : points >= 1 ? 'medium' : 'low', reasons }
}
