import type { DetailRequest, DetailResponse } from './detail.worker'

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
let common: Promise<Common> | null = null

// The municipality detail files (up to 16 MB of JSON) are decompressed and parsed in a Web Worker
// (T-05): parsing them here blocked the main thread for over a second on slow computers. The main
// thread only receives the farms it asks for.
type Pending = { resolve: (d: Record<number, FarmDetail>) => void; reject: (e: Error) => void }
let worker: Worker | null = null
let nextReq = 0
const pending = new Map<number, Pending>()

function detailWorker() {
  if (!worker) {
    worker = new Worker(new URL('./detail.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<DetailResponse>) => {
      const p = pending.get(e.data.req)
      if (!p) return
      pending.delete(e.data.req)
      if (e.data.ok) p.resolve(e.data.details)
      else p.reject(new Error(e.data.error))
    }
    worker.onerror = () => {
      for (const p of pending.values()) p.reject(new Error('detail worker failed'))
      pending.clear()
      worker?.terminate()
      worker = null
    }
  }
  return worker
}

/** Details of some farms of one municipality. An empty list only loads (prefetches) the file. */
function requestDetails(mun: number, farms: number[]) {
  const url = new URL(`${DATA}/detalle/${mun}.json.gz`, location.href).href
  return new Promise<Record<number, FarmDetail>>((resolve, reject) => {
    const req = ++nextReq
    pending.set(req, { resolve, reject })
    detailWorker().postMessage({ req, url, mun, farms } satisfies DetailRequest)
  })
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
  const byMun = new Map<number, number[]>()
  for (const { id, mun } of farms) byMun.set(mun, [...(byMun.get(mun) ?? []), ...(id >= 0 ? [id] : [])])
  const parts = await Promise.all([...byMun].map(([mun, ids]) => requestDetails(mun, ids)))
  return Object.assign({}, ...parts) as Record<number, FarmDetail>
}

export function latestPrice(p: Price | undefined) {
  const last = p?.serie[p.serie.length - 1]
  return last ? { year: last[0], eurT: last[1] } : null
}

export type SoilType = 'sandy' | 'loam' | 'clay'

export function soilTexture(s: SoilData | null): SoilType | null {
  if (!s || s.arena_pct === null || s.arcilla_pct === null) return null
  if (s.arcilla_pct >= 35) return 'clay'
  if (s.arena_pct >= 52 && s.arcilla_pct < 20) return 'sandy'
  return 'loam'
}
