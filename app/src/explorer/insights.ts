// What really matters for one farm: 1–3 ranked insights built from the data the farm view
// already has (R0–R3 scores from lib/calculator.ts, POWER climate, SoilGrids soil, slope, `apt`
// and the seasons seen by satellite), plus the one-sentence rotation recommendation.
// Pure functions: no React, no three.js, no fetch (unit tests in insights.test.ts).
//
// Rules. "R0" is the current rotation (Wheat–Sunflower). Thresholds come from the calculator or
// the pipeline, as noted in the last column.
//
// | id          | severity | fires when                                       | card      | source of the threshold                                    |
// |-------------|----------|--------------------------------------------------|-----------|------------------------------------------------------------|
// | no-data     | warning  | the farm has no scores (no climate/soil data)    | —         | calculator needs a climate cell                            |
// | land-use    | warning  | `apt` is set and is not "pendiente"              | rotations | pipeline/export_app_fincas.py aptitud()                    |
// | permanent   | warning  | no land-use insight, and land cover is "arbolado"| rotations | FarmView rule "looks like a permanent crop"                |
// |             |          | or ≥ 4 of the seen seasons are P (permanent)     |           |                                                            |
// | slope       | critical | slope ≥ 30 % or `apt` = "pendiente"              | soil      | PENDIENTE_FUERTE = 30 (export_app_fincas.py)               |
// | slope       | warning  | 12 % ≤ slope < 30 %                              | soil      | candidate rule pendiente_max = 12 (pipeline/build.py)      |
// | water       | critical | R0 not viable (P20 water < 20) or deficit ≥ 900  | water     | calculator blocker; REFERENCE_DEFICIT_MM = 900             |
// | water       | warning  | R0 P20 water < 40 or deficit ≥ 720 mm/yr         | water     | calculator warning; 80 % of the 900 mm reference           |
// | heat        | critical | > 25 hot days (≥ 32 °C) in May–June              | risk      | calculator warning "High heat during the season"           |
// | heat        | warning  | ≥ 10 hot days in May–June                        | risk      | risk × (1 − days/40): heat alone removes ≥ 25 % of it      |
// | frost       | warning  | > 5 frost days a year                            | risk      | calculator warning "Frost risk above the threshold"        |
// | soil-water  | warning  | available water (0–100 cm) ≤ 100 mm              | soil      | calculator: the soil gets 0 points for storage at ≤ 100 mm |
// | best        | good     | the best rotation for the priority is not R0     | rotations | rank 1 for the chosen profile                              |
// | best        | good     | R0 itself ranks first for the priority           | rotations | rank 1 for the chosen profile                              |
//
// Ranking: critical, then warning, then good. Within a severity, land-use / permanent / no-data
// come first (they change how every other number must be read); then the insight furthest past
// its threshold (value ÷ threshold, or threshold ÷ value when lower is worse). Ties keep the
// order of the table. At most 3 are returned; the "best" insight is always a candidate, so a
// farm with scores always gets at least one.
import { PROFILES as WEIGHTS, ROTATIONS, type RotationScore } from '../lib/calculator'
import type { ProfileKey, RotationKey } from '../lib/indicators'
import { APT, PROFILES, fmt } from './texts'

export type Severity = 'critical' | 'warning' | 'good'
/** Element of the farm column the insight is about: one of the four cards or the rotation dock. */
export type InsightTarget = 'water' | 'soil' | 'market' | 'risk' | 'rotations'

export type Insight = {
  id: 'no-data' | 'land-use' | 'permanent' | 'slope' | 'water' | 'heat' | 'frost' | 'soil-water' | 'best'
  severity: Severity
  /** Short, at most 60 characters. */
  headline: string
  /** One sentence with the number behind the headline. */
  detail: string
  target: InsightTarget | null
}

export type FarmFacts = {
  scores: Record<RotationKey, RotationScore> | null
  climate: { rain: number; deficit: number | null; hotDays: number; frostDays: number } | null
  soil: { cad_0_100_mm: number | null } | null
  /** Mean slope of the farm, % */
  slope: number | null
  /** Why the farm does not look like cropland (null = it does) */
  apt: string | null
  /** Dominant land cover (WorldCover class code) */
  cover: string | null
  /** WorldCover share of the farm per class, % (FarmDetail.cobertura) */
  landCover: Record<string, number | null> | null
  /** Seasons seen by satellite, one letter each, e.g. "I-B-I-B-P-P" */
  seasons: string | null
  profile: ProfileKey
}

/** Thresholds of the table above. */
export const T = {
  slopeSteep: 12,
  slopeVerySteep: 30,
  referenceDeficit: 900, // REFERENCE_DEFICIT_MM in lib/calculator.ts (data/calibration.json)
  deficitHigh: 720, // 80 % of the reference
  waterP20Blocker: 20,
  waterP20Warning: 40,
  heatHigh: 10,
  heatVeryHigh: 25,
  heatZero: 40, // the calculator's heat factor reaches 0 at 40 days
  frost: 5,
  soilWater: 100,
  permanentSeasons: 4,
} as const

export const HEADLINE_MAX = 60
const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, good: 2 }
const profileName = (p: ProfileKey) => PROFILES.find(([k]) => k === p)?.[1] ?? p

/** Best rotation for a profile (rank 1; R0 wins a tie, then the R order). */
export function bestRotation(scores: Record<RotationKey, RotationScore>, profile: ProfileKey): RotationKey | null {
  const first = (Object.keys(scores) as RotationKey[]).filter((k) => scores[k].rank[profile] === 1)
  return first.includes('R0') ? 'R0' : first[0] ?? null
}

type Candidate = Insight & { strength: number; order: number }

/** The 1–3 insights of a farm, most important first. */
export function farmInsights(f: FarmFacts): Insight[] {
  const out: Omit<Candidate, 'order'>[] = []
  const add = (i: Insight, strength: number) => out.push({ ...i, strength })
  const pinned = Number.POSITIVE_INFINITY
  const r0 = f.scores?.R0

  if (!f.scores) {
    add({ id: 'no-data', severity: 'warning', target: null, headline: 'No climate or soil data for this farm',
      detail: 'The project files have no climate cell or soil profile for this farm, so its rotations cannot be scored.' }, pinned)
  }

  // Land use: what the farm is, before any score.
  const pct = (...keys: string[]) => {
    const vals = keys.map((k) => f.landCover?.[k]).filter((v): v is number => typeof v === 'number')
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null
  }
  if (f.apt && f.apt !== 'pendiente') {
    const share = LAND_USE_COVER[f.apt] ? pct(...LAND_USE_COVER[f.apt][0]) : null
    const what = share !== null
      ? `${fmt(share)} % of the farm is ${LAND_USE_COVER[f.apt][1]} by satellite land cover`
      : f.apt === 'publico' ? 'SIGPAC marks it as public domain (track, road or watercourse; plot 9000 or above)'
      : `Satellite land cover and SIGPAC point to ${(APT[f.apt] ?? f.apt).toLowerCase()}`
    add({ id: 'land-use', severity: 'warning', target: 'rotations', headline: `${shortApt(f.apt)}: rotations are indicative`,
      detail: `${what}, so the herbaceous rotation scores are only indicative here.` }, pinned)
  } else {
    const letters = (f.seasons ?? '').split('-').filter(Boolean)
    const permanent = letters.filter((l) => l === 'P').length
    const trees = pct('arbolado')
    if (f.cover === 'arbolado' || permanent >= T.permanentSeasons) {
      add({ id: 'permanent', severity: 'warning', target: 'rotations', headline: 'Looks like a permanent crop: rotations are indicative',
        detail: permanent >= T.permanentSeasons
          ? `${permanent} of the ${letters.length} seasons seen by satellite look like a permanent crop (olive, almond…), so a rotation would mean replanting.`
          : `Satellite land cover is ${trees !== null ? `${fmt(trees)} % trees` : 'mostly trees'} (in Málaga usually olive or almond groves), so a rotation would mean replanting.` }, pinned)
    }
  }

  // Slope (erosion and machinery).
  if (f.apt === 'pendiente' || (f.slope !== null && f.slope >= T.slopeVerySteep)) {
    add({ id: 'slope', severity: 'critical', target: 'soil', headline: `Very steep slope${f.slope !== null ? ` (${fmt(f.slope, 1)} %)` : ''}: hard to farm`,
      detail: `${f.slope !== null ? `A mean slope of ${fmt(f.slope, 1)} % is` : 'The slope is'} at or above the ${T.slopeVerySteep} % where tillage and machinery become very difficult and erosion is severe.` },
    (f.slope ?? T.slopeVerySteep) / T.slopeVerySteep)
  } else if (f.slope !== null && f.slope >= T.slopeSteep) {
    add({ id: 'slope', severity: 'warning', target: 'soil', headline: `Steep slope (${fmt(f.slope, 1)} %): erosion risk`,
      detail: `A mean slope of ${fmt(f.slope, 1)} % is above the ${T.slopeSteep} % the project allows for candidate farms, so bare soil between crops can wash away.` },
    f.slope / T.slopeSteep)
  }

  // Water.
  const deficit = f.climate?.deficit ?? null
  const p20 = r0?.waterP20 ?? null
  const deficitTxt = deficit !== null && f.climate
    ? `Crops need ${fmt(deficit)} mm a year more than the ${fmt(f.climate.rain)} mm of rain, ${fmt((deficit / T.referenceDeficit) * 100)} % of the ${T.referenceDeficit} mm reference deficit.`
    : ''
  if ((p20 !== null && p20 < T.waterP20Blocker) || (deficit !== null && deficit >= T.referenceDeficit)) {
    const byP20 = p20 !== null && p20 < T.waterP20Blocker
    add({ id: 'water', severity: 'critical', target: 'water',
      headline: deficit !== null ? `Extreme water deficit (${fmt(deficit)} mm/yr)` : 'Extreme water deficit in dry years',
      detail: byP20 ? `In a dry year (P20) the water score of the current rotation falls to ${fmt(p20, 1)}/100, below the limit of ${T.waterP20Blocker}.` : deficitTxt },
    Math.max(deficit !== null ? deficit / T.referenceDeficit : 0, p20 !== null ? T.waterP20Blocker / Math.max(p20, 1) : 0))
  } else if ((p20 !== null && p20 < T.waterP20Warning) || (deficit !== null && deficit >= T.deficitHigh)) {
    const byDeficit = deficit !== null && deficit >= T.deficitHigh
    add({ id: 'water', severity: 'warning', target: 'water',
      headline: byDeficit ? `Severe water deficit (${fmt(deficit)} mm/yr)` : 'Water stress likely in dry years',
      detail: byDeficit ? deficitTxt : `In a dry year (P20) the water score of the current rotation falls to ${fmt(p20, 1)}/100, below ${T.waterP20Warning}.` },
    Math.max(deficit !== null ? deficit / T.deficitHigh : 0, p20 !== null ? T.waterP20Warning / Math.max(p20, 1) : 0))
  }

  // Heat and frost (climate-risk card).
  if (f.climate) {
    const heat = f.climate.hotDays
    const cut = Math.min(100, (heat / T.heatZero) * 100)
    const heatTxt = `${fmt(heat)} days a year reach 32 °C in May–June, when grain fills; heat alone cuts the climate-risk score by ${fmt(cut)} %.`
    if (heat > T.heatVeryHigh) add({ id: 'heat', severity: 'critical', target: 'risk', headline: `Very high heat risk in May–June (${fmt(heat)} days)`, detail: heatTxt }, heat / T.heatVeryHigh)
    else if (heat >= T.heatHigh) add({ id: 'heat', severity: 'warning', target: 'risk', headline: `High heat risk in May–June (${fmt(heat)} days)`, detail: heatTxt }, heat / T.heatHigh)
    if (f.climate.frostDays > T.frost) {
      add({ id: 'frost', severity: 'warning', target: 'risk', headline: `Frost risk (${fmt(f.climate.frostDays)} days a year)`,
        detail: `A median of ${fmt(f.climate.frostDays)} frost days a year, above the calculator's limit of ${T.frost}.` }, f.climate.frostDays / T.frost)
    }
  }

  // Soil that holds little water.
  const cad = f.soil?.cad_0_100_mm ?? null
  if (cad !== null && cad <= T.soilWater) {
    add({ id: 'soil-water', severity: 'warning', target: 'soil', headline: `Soil with little available water (${fmt(cad)} mm)`,
      detail: `The top metre holds ${fmt(cad)} mm of water plants can use; at ${T.soilWater} mm or less the soil gets no points for storage.` },
    T.soilWater / Math.max(cad, 1))
  }

  // The opportunity: best rotation for the chosen priority.
  if (f.scores && r0) {
    const best = bestRotation(f.scores, f.profile)
    const prio = profileName(f.profile)
    if (best && best !== 'R0') {
      const b = f.scores[best]
      const gain = (b.score[f.profile] ?? 0) - (r0.score[f.profile] ?? 0)
      add({ id: 'best', severity: 'good', target: 'rotations', headline: `Best option: ${best} (+${fmt(gain, 1)} points over current)`,
        detail: `${b.name} scores ${fmt(b.score[f.profile], 1)} for the ${prio} priority, against ${fmt(r0.score[f.profile], 1)} for the current rotation.` }, gain)
    } else if (best === 'R0') {
      add({ id: 'best', severity: 'good', target: 'rotations', headline: 'Current rotation is already the best option',
        detail: `No alternative beats the current rotation (${fmt(r0.score[f.profile], 1)}) for the ${prio} priority.` }, 0)
    }
  }

  return out
    .map((c, order) => ({ ...c, order }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.strength - a.strength || a.order - b.order)
    .slice(0, 3)
    .map(({ strength: _s, order: _o, ...i }) => i)
}

/** WorldCover classes behind each `apt` code, and how to say them. */
const LAND_USE_COVER: Record<string, [string[], string]> = {
  monte: [['matorral', 'arbolado'], 'scrub or trees'],
  roca: [['suelo_desnudo'], 'rock or bare soil'],
  urbano: [['urbano'], 'built-up'],
  agua: [['agua'], 'open water'],
}

/** Short land-use names for headlines (APT has the full ones). */
function shortApt(apt: string) {
  const short: Record<string, string> = { monte: 'Forest or scrub', roca: 'Rock or bare soil', urbano: 'Built-up land', agua: 'Open water', publico: 'Public land' }
  return short[apt] ?? 'Not typical cropland'
}

const GAIN: Record<string, [string, string]> = {
  water: ['more water margin', 'less water margin'],
  soil: ['better soil', 'poorer soil'],
  profit: ['a better market', 'a weaker market'],
  risk: ['lower climate risk', 'higher climate risk'],
}

/**
 * One sentence for under the rotation selector: the best rotation for the priority and why
 * (the score that adds the most to its weighted total, and the one that costs the most).
 */
export function recommendation(scores: Record<RotationKey, RotationScore> | null, profile: ProfileKey): string | null {
  if (!scores) return null
  const best = bestRotation(scores, profile)
  if (!best) return null
  const b = scores[best]
  const r0 = scores.R0
  const prio = profileName(profile)
  if (best === 'R0') {
    const next = (Object.keys(scores) as RotationKey[]).filter((k) => k !== 'R0' && scores[k].score[profile] !== null)
      .sort((x, y) => (scores[y].score[profile] as number) - (scores[x].score[profile] as number))[0]
    return `Keep the current rotation: it scores ${fmt(r0.score[profile], 1)} for the ${prio} priority${next ? `, ahead of ${next} (${fmt(scores[next].score[profile], 1)})` : ''}.`
  }
  const w = WEIGHTS[profile]
  const parts = (Object.keys(w) as (keyof typeof w)[])
    .map((k) => ({ k, d: (b[k] ?? 0) - (r0[k] ?? 0), c: w[k] * ((b[k] ?? 0) - (r0[k] ?? 0)) }))
  const up = parts.filter((p) => p.d > 0.05).sort((x, y) => y.c - x.c)[0]
  const down = parts.filter((p) => p.d < -0.05).sort((x, y) => x.c - y.c)[0]
  const why = up
    ? `, mainly for ${GAIN[up.k][0]} (+${fmt(up.d, 1)})${down ? `, which outweighs ${GAIN[down.k][1]} (${fmt(down.d, 1)})` : ''}`
    : ''
  return `${best} (${ROTATIONS[best].name}) is best for the ${prio} priority: ${fmt(b.score[profile], 1)} vs. ${fmt(r0.score[profile], 1)} now${why}.`
}
