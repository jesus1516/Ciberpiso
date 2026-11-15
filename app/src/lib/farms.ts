import bbox from '@turf/bbox'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type { FarmsRequest, FarmsResponse } from './farms.worker'
import type { BBox, Farm, FarmProps } from './geo'

export type MunicipalityProps = { mun: number; nombre: string; fincas: number; ha: number; candidatas: number }
export type Municipality = Feature<Polygon | MultiPolygon, MunicipalityProps>
/** `url`: a blob: URL of the same GeoJSON, for MapLibre's setData (parsed in its worker). */
export type Farms = FeatureCollection<Polygon | MultiPolygon, FarmProps> & { url?: string }

const DATA = `${import.meta.env.BASE_URL}data`
export const PROVINCE = 29
export const DEMO_MUNICIPALITY = 29015

let municipalities: Municipality[] = []
const loaded = new Map<number, Promise<Farms>>()
const byId = new Map<number, Farm>()
const byPid = new Map<string, Farm>()

export async function loadMunicipalities(): Promise<FeatureCollection<Polygon | MultiPolygon, MunicipalityProps>> {
  const res = await fetch(`${DATA}/municipios_${PROVINCE}.geojson`)
  if (!res.ok) throw new Error(`municipalities ${res.status}`)
  const data = await res.json()
  municipalities = data.features
  return data
}

// The farms of a municipality (Antequera: 14,529 farms, 9.8 MB of GeoJSON) are decompressed and
// parsed in a Web Worker (T-05). The main thread receives the properties, a bounding box per farm and
// each geometry as a JSON string that is parsed only when that farm is used; MapLibre loads the
// GeoJSON itself, in its own worker, from a blob: URL (`Farms.url`).
type Parsed = Extract<FarmsResponse, { ok: true }>
let farmsWorker: Worker | null = null
let nextReq = 0
const waiting = new Map<number, { resolve: (r: Parsed) => void; reject: (e: Error) => void }>()

function parseInWorker(url: string) {
  if (!farmsWorker) {
    farmsWorker = new Worker(new URL('./farms.worker.ts', import.meta.url), { type: 'module' })
    farmsWorker.onmessage = (e: MessageEvent<FarmsResponse>) => {
      const w = waiting.get(e.data.req)
      if (!w) return
      waiting.delete(e.data.req)
      if (e.data.ok) w.resolve(e.data)
      else w.reject(new Error(e.data.error))
    }
    farmsWorker.onerror = () => {
      for (const w of waiting.values()) w.reject(new Error('farms worker failed'))
      waiting.clear()
      farmsWorker?.terminate()
      farmsWorker = null
    }
  }
  return new Promise<Parsed>((resolve, reject) => {
    const req = ++nextReq
    waiting.set(req, { resolve, reject })
    farmsWorker!.postMessage({ req, url } satisfies FarmsRequest)
  })
}

/** Features whose geometry is parsed on first use; `bbox` is set, so turf's bbox() never reads it. */
function toFarms(r: Parsed): Farms {
  const features = r.props.map((properties, i): Farm => {
    const json = r.geoms[i]
    let geometry: Polygon | MultiPolygon | undefined
    return {
      type: 'Feature',
      properties,
      bbox: [r.boxes[i * 4], r.boxes[i * 4 + 1], r.boxes[i * 4 + 2], r.boxes[i * 4 + 3]],
      get geometry() {
        return (geometry ??= JSON.parse(json) as Polygon | MultiPolygon)
      },
    }
  })
  return { type: 'FeatureCollection', features, url: URL.createObjectURL(r.blob) }
}

export function loadMunicipality(key: number): Promise<Farms> {
  if (!loaded.has(key)) {
    const request = parseInWorker(new URL(`${DATA}/fincas/${key}.geojson.gz`, location.href).href).then((r) => {
      const data = toFarms(r)
      data.features.forEach((f) => {
        byId.set(f.properties.id, f)
        byPid.set(f.properties.pid, f)
      })
      return data
    })
    request.catch(() => loaded.delete(key))
    loaded.set(key, request)
  }
  return loaded.get(key)!
}

export const getFarm = (id: number) => byId.get(id)

export const getMunicipality = (key: number) => municipalities.find((m) => m.properties.mun === key)

export const municipalityBbox = (m: Municipality) => bbox(m) as BBox

export const provinceBbox = () => bbox({ type: 'FeatureCollection', features: municipalities }) as BBox

export const municipalityAt = (lng: number, lat: number) => municipalities.find((m) => booleanPointInPolygon([lng, lat], m))

export async function farmByPid(pid: string) {
  const [prov, mun] = pid.split(':').map(Number)
  await loadMunicipality(prov * 1000 + mun)
  return byPid.get(pid)
}
