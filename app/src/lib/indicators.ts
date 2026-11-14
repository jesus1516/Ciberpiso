export type RotationKey = 'R0' | 'R1' | 'R2' | 'R3'
export type ProfileKey = 'water_first' | 'soil_first' | 'profit_first'
export type Confidence = 'low' | 'medium' | 'high'

export type Evidence = {
  source: string
  url?: string
  date?: string
  value?: string
  note?: string
}

export type IndicatorMeta = {
  value: number | null
  unit: string
  source: string
  date: string
  confidence: Confidence
  gap: string
  p20?: number
  price_eur_t?: number | null
  market_ease_1_5?: number
}

export type Ranking = {
  rank: number | null
  final_score: number | null
  partial: boolean
  partial_score: number | null
  missing: string[]
  contributions: Record<string, number>
  tied_with: string[]
}

export type Rotation = {
  name: string
  crops: string[]
  water: number
  water_p20: number
  soil: number
  profit: number | null
  profit_label: string
  risk: number
  comparable: boolean
  market: {
    score: number | null
    price_eur_t: number | null
    market_ease_1_5: number
    component_market_ease: number | null
    component_price: number | null
    is_profit: boolean
    price_source: string
    price_year: number | null
    gap: string
  }
  viability: { status: string; blockers: string[]; warnings: string[] }
  eligible: boolean
  rankings: Record<ProfileKey, Ranking>
  confidence: Confidence
  confidence_score: number
  why: string
  benefits: string[]
  data_gaps: string[]
  review_risks: string[]
  evidence: Evidence[]
  indicators: Record<'water' | 'soil' | 'profit' | 'risk', IndicatorMeta>
  disclaimer: string
}

export type Candidate = {
  finca_key: string
  parcela_id: string
  municipio: string
  superficie_ha: number
  lat: number
  lon: number
  rotacion_estimada: string
  climate_used: {
    lluvia_media_mm: number
    lluvia_p20_mm: number
    deficit_medio_mm: number
    deficit_p20_mm: number
    dias_calor_may_jun: number
    dias_helada: number
  }
  price_reference: Record<
    string,
    { eur_t: number | null; anio: number | null; mismo_anio_que_campana: boolean | null; fuente: string }
  >
  campaigns: { campana: number; lluvia_mm: number; ndvi_jun_ago: number; clase_estimada: string }[]
  rotations: Record<RotationKey, Rotation>
}

export type Indicators = {
  schema_version: number
  aoi: string
  generated_at: string
  status: string
  disclaimer: string
  glossary: Record<string, string>
  sources: { name: string; url: string; use: string }[]
  profiles: Record<ProfileKey, Record<string, number>>
  summary: {
    fincas: number
    campanas: number[]
    top_por_perfil: Record<ProfileKey, Record<string, number>>
  }
  candidates: Candidate[]
  byPid: Record<string, Candidate>
  app_export?: { municipio: string; parcela_ids: number; geojson: string; source: string }
}

export const INDICATORS_URL = `${import.meta.env.BASE_URL}data/indicators_antequera.json`

export async function loadIndicators(): Promise<Indicators> {
  const res = await fetch(INDICATORS_URL)
  if (!res.ok) throw new Error(`indicators ${res.status}`)
  const data = (await res.json()) as Indicators
  if (data.schema_version !== 1) {
    throw new Error(`indicators schema ${data.schema_version}`)
  }
  data.byPid = Object.fromEntries(data.candidates.map((c) => [c.parcela_id, c]))
  return data
}
