import type { SoilType } from './soil'

export type SoilData = {
  arcilla_pct: number | null
  arena_pct: number | null
  limo_pct: number | null
  cos_gkg: number | null
  ph_h2o: number | null
  densidad_gcm3: number | null
  nitrogeno_gkg: number | null
  cic_cmolkg: number | null
  cad_0_100_mm: number | null
  gruesos_pct: number | null
  pct_superficie_con_dato: number | null
}

export type Phenology = {
  campana: number
  ndvi_media: number | null
  ndvi_max: number | null
  mes_ndvi_max: number | null
  ndvi_amplitud: number | null
  ndvi_ene_abr: number | null
  ndvi_jun_ago: number | null
  ndvi_oct_dic: number | null
  clase_estimada: string | null
}

export type FarmDetail = {
  recintos: number
  celda: number
  altitud_m: number | null
  pendiente_pct: number | null
  cobertura: Record<string, number | null>
  cobertura_dominante: string | null
  rotacion_estimada: string | null
  campanas: Record<'invierno' | 'verano' | 'barbecho' | 'arables', number | null>
  ndvi_jun_ago_max: number | null
  candidata: number
  suelo: SoilData | null
  fenologia: Phenology[]
  ndvi: [string, number | null][]
}

export type CampaignClimate = {
  campana: number
  lluvia_mm: number
  lluvia_oct_may_mm: number
  et0_mm: number
  tmedia_c: number
  tmax_abs_c: number
  tmin_abs_c: number
  dias_calor_may_jun: number
  dias_calor_jul_ago: number
  dias_helada: number
  dias_helada_mar_abr: number
  deficit_mm: number
  gwetroot_mar_may: number | null
  gwetroot_mar_may_anomalia: number | null
}

export type ClimateCell = {
  resumen: {
    lat: number
    lon: number
    campanas: number
    lluvia_media_mm: number
    lluvia_p20_mm: number
    lluvia_cv: number
    campana_mas_seca: number
    deficit_medio_mm: number
    dias_calor_may_jun_media: number
    dias_calor_jul_ago_media: number
    dias_helada_media: number
  }
  campanas: CampaignClimate[]
}

export type Price = { producto: string; fuente: string; serie: [number, number][] }
export type Common = { celdas: Record<string, ClimateCell>; precios: Record<string, Price> }

const DATA = `${import.meta.env.BASE_URL}data`
const municipalities = new Map<number, Promise<Record<string, FarmDetail>>>()
let common: Promise<Common> | null = null

async function gunzipJson(res: Response) {
  const bytes = new Uint8Array(await res.arrayBuffer())
  const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b
  const stream = new Blob([bytes]).stream()
  return JSON.parse(await new Response(gzipped ? stream.pipeThrough(new DecompressionStream('gzip')) : stream).text())
}

function loadDetailMunicipality(mun: number) {
  if (!municipalities.has(mun)) {
    const request = fetch(`${DATA}/detalle/${mun}.json.gz`).then((res) => {
      if (!res.ok) throw new Error(`detail ${mun} ${res.status}`)
      return gunzipJson(res)
    })
    request.catch(() => municipalities.delete(mun))
    municipalities.set(mun, request)
  }
  return municipalities.get(mun)!
}

export function loadCommon(prov = 29) {
  if (!common) {
    common = fetch(`${DATA}/comun_${prov}.json`).then((res) => {
      if (!res.ok) throw new Error(`common ${res.status}`)
      return res.json()
    })
    common.catch(() => (common = null))
  }
  return common
}

export async function loadDetails(farms: { id: number; mun: number }[]) {
  const out: Record<number, FarmDetail> = {}
  await Promise.all(
    farms.map(async ({ id, mun }) => {
      const data = await loadDetailMunicipality(mun)
      if (data[id]) out[id] = data[id]
    }),
  )
  return out
}

export function latestPrice(p: Price | undefined) {
  const last = p?.serie[p.serie.length - 1]
  return last ? { year: last[0], eurT: last[1] } : null
}

export function soilTexture(s: SoilData | null): SoilType | null {
  if (!s || s.arena_pct === null || s.arcilla_pct === null) return null
  if (s.arcilla_pct >= 35) return 'clay'
  if (s.arena_pct >= 52 && s.arcilla_pct < 20) return 'sandy'
  return 'loam'
}

const CLASS_TO_CROP: Record<string, string> = { herbaceo_invierno: 'wheat', herbaceo_verano: 'sunflower', permanente: 'olive' }

export function observedCrop(d: FarmDetail | undefined) {
  const last = d?.fenologia.filter((f) => f.clase_estimada && f.clase_estimada !== 'sin_datos').at(-1)
  if (!last?.clase_estimada) return null
  const crop = CLASS_TO_CROP[last.clase_estimada]
  return crop ? { crop, campana: last.campana, clase: last.clase_estimada } : null
}
