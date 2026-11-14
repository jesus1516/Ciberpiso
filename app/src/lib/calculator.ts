// Port de calculate_scores (pipeline/calculator.py) para puntuar R0–R3 en cualquier finca
// de Málaga con sus datos reales (detalle + comun). Las 26 candidatas de Antequera traen
// la salida del pipeline; check-calculator compara ambas.
import type { Comun, FincaDetalle } from './detalle'
import type { ProfileKey, RotationKey } from './indicators'

type Crop = { water: number; cover: number; legume: boolean; years: number; market: number; erosion: number; organic: number }

// data/crops.csv
export const CROPS: Record<string, Crop> = {
  trigo: { water: 3, cover: 8, legume: false, years: 1, market: 5, erosion: 3, organic: 3 },
  girasol: { water: 2, cover: 6, legume: false, years: 1, market: 4, erosion: 2, organic: 2 },
  garbanzo: { water: 2, cover: 6, legume: true, years: 1, market: 2, erosion: 2, organic: 2 },
  veza: { water: 2, cover: 6, legume: true, years: 1, market: 1, erosion: 4, organic: 4 },
  barbecho: { water: 0, cover: 0, legume: false, years: 1, market: 0, erosion: 0, organic: 0 },
}

export const ROTATIONS: Record<RotationKey, { name: string; crops: string[] }> = {
  R0: { name: 'Trigo–Girasol (actual)', crops: ['trigo', 'girasol'] },
  R1: { name: 'Trigo–Girasol–Garbanzo', crops: ['trigo', 'girasol', 'garbanzo'] },
  R2: { name: 'Trigo–Girasol–Veza', crops: ['trigo', 'girasol', 'veza'] },
  R3: { name: 'Trigo–Girasol–Barbecho', crops: ['trigo', 'girasol', 'barbecho'] },
}

export const PROFILES: Record<ProfileKey, Record<Score, number>> = {
  water_first: { water: 0.5, soil: 0.25, profit: 0.15, risk: 0.1 },
  soil_first: { water: 0.25, soil: 0.5, profit: 0.1, risk: 0.15 },
  profit_first: { water: 0.15, soil: 0.1, profit: 0.6, risk: 0.15 },
}

// data/calibration.json: déficit hídrico de referencia validado en docs/validacion.md
const REFERENCE_DEFICIT_MM = 900
// Cultivo de la rotación -> clave de precio en comun_29.json
const PRICE_KEYS: Record<string, string> = { trigo: 'wheat', girasol: 'sunflower', garbanzo: 'chickpea', veza: 'vetch' }
const CAMPAIGNS = [2020, 2021, 2022, 2023, 2024, 2025]

type Score = 'water' | 'soil' | 'profit' | 'risk'

export type Scenario = {
  precipMm: number
  p20PrecipMm: number
  deficitMm: number | null
  deficitP20Mm: number | null
  heatDays: number
  frostDays: number
  soil: { arcilla_pct: number | null; ph_h2o: number | null; cad_0_100_mm: number | null } | null
  prices: Record<string, number | null>
  priceYear: number | null
}

export type RotationScore = {
  name: string
  crops: string[]
  water: number
  waterP20: number
  soil: number
  profit: number | null
  risk: number
  priceEurT: number | null
  status: 'viable' | 'viable_with_caveats' | 'not_viable'
  blockers: string[]
  warnings: string[]
  score: Record<ProfileKey, number | null>
  rank: Record<ProfileKey, number | null>
}

/**
 * round() de Python: redondea el valor binario exacto (65.35 es 65.3499…) y las mitades
 * exactas al par, para que las notas coincidan con el pipeline al decimal.
 */
function pyRound(value: number, digits = 0) {
  const [int, frac] = Math.abs(value).toFixed(digits + 30).split('.')
  const rest = frac.slice(digits)
  let n = BigInt(int + frac.slice(0, digits))
  if (rest[0] > '5' || (rest[0] === '5' && /[1-9]/.test(rest.slice(1)))) n += 1n
  else if (rest[0] === '5' && n % 2n === 1n) n += 1n
  const r = Number(n) / 10 ** digits
  return value < 0 ? -r : r
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Resume el clima de la celda POWER, el suelo y los precios como hace planning_scenario. */
export function scenarioFor(detalle: FincaDetalle, comun: Comun): Scenario | null {
  const celda = comun.celdas[String(detalle.celda)]
  if (!celda) return null
  const r = celda.resumen
  const frost = celda.campanas.filter((c) => CAMPAIGNS.includes(c.campana)).map((c) => c.dias_helada)
  const prices: Record<string, number | null> = { barbecho: 0 }
  let priceYear: number | null = null
  for (const [crop, key] of Object.entries(PRICE_KEYS)) {
    const last = comun.precios[key]?.serie.filter(([year]) => year <= 2025).at(-1)
    prices[crop] = last ? last[1] : null
    if (last) priceYear = Math.max(priceYear ?? 0, last[0])
  }
  const deficit = r.deficit_medio_mm ?? null
  return {
    precipMm: r.lluvia_media_mm,
    p20PrecipMm: r.lluvia_p20_mm,
    deficitMm: deficit,
    deficitP20Mm: deficit === null ? null : deficit + (r.lluvia_media_mm - r.lluvia_p20_mm),
    heatDays: pyRound(r.dias_calor_may_jun_media),
    frostDays: frost.length ? pyRound(median(frost)) : 0,
    soil: detalle.suelo,
    prices,
    priceYear,
  }
}

function waterScore(weightedWater: number, precip: number, deficit: number | null) {
  const drought = deficit !== null
    ? Math.min(3, Math.max(0.25, deficit / REFERENCE_DEFICIT_MM))
    : Math.min(3, Math.max(1, 450 / Math.max(precip, 1)))
  return clamp(100 - (weightedWater / 5) * 80 * drought, 0, 100)
}

function soilScore(crops: string[], soil: Scenario['soil']) {
  const c = crops.map((id) => CROPS[id])
  const avgCover = c.reduce((s, x) => s + x.cover, 0) / c.length
  const legume = c.some((x) => x.legume)
  if (!soil) return Math.min(100, (avgCover * 100) / 6 + (legume ? 15 : 0))
  const cover = Math.min(100, (avgCover / 8) * 100)
  const clay = soil.arcilla_pct ?? 30
  const ph = soil.ph_h2o ?? 7
  const cad = soil.cad_0_100_mm ?? 120
  const texture = clamp(100 - Math.abs(clay - 30) * 4, 0, 100)
  const phScore = clamp(100 - Math.abs(ph - 7) * 25, 0, 100)
  const cadScore = clamp(((cad - 100) / 50) * 100, 0, 100)
  const quality = 0.4 * texture + 0.3 * phScore + 0.3 * cadScore
  const protection = (c.reduce((s, x) => s + x.erosion, 0) / c.length / 5) * 100
  const organic = (c.reduce((s, x) => s + x.organic, 0) / c.length / 5) * 100
  return clamp(0.4 * cover + 0.25 * quality + 0.15 * protection + 0.1 * organic + 0.1 * (legume ? 100 : 0), 0, 100)
}

/** Las cuatro rotaciones con notas 0–100, nota final por perfil y puesto. */
export function calculateScores(s: Scenario): Record<RotationKey, RotationScore> {
  const heatRatio = clamp(1 - s.heatDays / 40, 0, 1)
  const frostRatio = clamp(1 - s.frostDays / 20, 0, 1)
  const out = {} as Record<RotationKey, RotationScore>

  for (const [rid, info] of Object.entries(ROTATIONS) as [RotationKey, (typeof ROTATIONS)[RotationKey]][]) {
    const c = info.crops.map((id) => CROPS[id])
    const totalYears = c.reduce((sum, x) => sum + x.years, 0)
    const weightedWater = c.reduce((sum, x) => sum + x.water * x.years, 0) / totalYears
    const water = waterScore(weightedWater, s.precipMm, s.deficitMm)
    const waterP20 = waterScore(weightedWater, s.p20PrecipMm, s.deficitP20Mm ?? s.deficitMm)
    const soil = soilScore(info.crops, s.soil)

    const marketAvg = c.reduce((sum, x) => sum + x.market, 0) / c.length
    const prices = info.crops.map((id) => s.prices[id])
    const priceAvg = prices.every((p) => p !== null && p !== undefined) ? (prices as number[]).reduce((a, b) => a + b, 0) / prices.length : null
    const profit = priceAvg === null ? null : 0.7 * (marketAvg / 5) * 100 + 0.3 * (Math.min(priceAvg, 800) / 800) * 100

    const bare = info.crops.includes('barbecho') ? 25 : 0
    const diversity = Math.min(100, Math.max(40, 60 + 20 * (info.crops.length - 2)))
    const risk = clamp((100 - bare) * heatRatio * frostRatio * (0.7 + (0.3 * diversity) / 100), 0, 100)

    const blockers: string[] = []
    const warnings: string[] = []
    if (waterP20 < 20) blockers.push('Déficit hídrico extremo incluso en año seco (P20)')
    else if (waterP20 < 40) warnings.push('Estrés hídrico probable en años secos (P20)')
    if (s.heatDays > 25) warnings.push('Calor elevado durante la temporada')
    if (s.frostDays > 5) warnings.push('Riesgo de heladas por encima del umbral')
    if (profit === null) warnings.push('Sin precio para todos los cultivos de la rotación')

    out[rid] = {
      name: info.name,
      crops: info.crops,
      water: pyRound(water, 1),
      waterP20: pyRound(waterP20, 1),
      soil: pyRound(soil, 1),
      profit: profit === null ? null : pyRound(profit, 1),
      risk: pyRound(risk, 1),
      priceEurT: priceAvg === null ? null : pyRound(priceAvg, 1),
      status: blockers.length ? 'not_viable' : warnings.length ? 'viable_with_caveats' : 'viable',
      blockers,
      warnings,
      score: {} as Record<ProfileKey, number | null>,
      rank: {} as Record<ProfileKey, number | null>,
    }
  }

  // Como el pipeline, la nota final se calcula con las notas ya redondeadas.
  for (const [profile, weights] of Object.entries(PROFILES) as [ProfileKey, Record<Score, number>][]) {
    for (const r of Object.values(out)) {
      const complete = (Object.keys(weights) as Score[]).every((k) => r[k] !== null)
      const total = Object.values(weights).reduce((sum, w) => sum + w, 0)
      const sum = (Object.entries(weights) as [Score, number][]).reduce((acc, [k, w]) => acc + (r[k] as number) * w, 0)
      r.score[profile] = complete ? pyRound(sum / total, 1) : null
    }
    const ranked = (Object.keys(out) as RotationKey[])
      .filter((rid) => !out[rid].blockers.length && out[rid].score[profile] !== null)
      .sort((a, b) => (out[b].score[profile] as number) - (out[a].score[profile] as number))
    let lastScore: number | null = null
    let lastRank = 0
    ranked.forEach((rid, i) => {
      const score = out[rid].score[profile]
      if (score !== lastScore) { lastRank = i + 1; lastScore = score }
      out[rid].rank[profile] = lastRank
    })
    for (const rid of Object.keys(out) as RotationKey[]) out[rid].rank[profile] ??= null
  }
  return out
}
