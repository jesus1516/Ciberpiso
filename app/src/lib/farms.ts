import bbox from '@turf/bbox'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type { BBox, Farm, FarmProps } from './geo'

export type MunicipalityProps = { mun: number; nombre: string; fincas: number; ha: number; candidatas: number }
export type Municipality = Feature<Polygon | MultiPolygon, MunicipalityProps>
type Farms = FeatureCollection<Polygon | MultiPolygon, FarmProps>

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

async function readGeojson(res: Response) {
  const bytes = new Uint8Array(await res.arrayBuffer())
  const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b
  const body = gzipped ? new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')) : new Blob([bytes]).stream()
  return JSON.parse(await new Response(body).text())
}

export function loadMunicipality(key: number): Promise<Farms> {
  if (!loaded.has(key)) {
    const request = fetch(`${DATA}/fincas/${key}.geojson.gz`)
      .then((res) => {
        if (!res.ok) throw new Error(`farms ${key} ${res.status}`)
        return readGeojson(res)
      })
      .then((data: Farms) => {
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
