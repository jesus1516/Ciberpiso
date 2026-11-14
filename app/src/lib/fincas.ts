import bbox from '@turf/bbox'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type { BBox, Finca, FincaProps } from './geo'

export type MunicipioProps = { mun: number; nombre: string; fincas: number; ha: number; candidatas: number }
export type Municipio = Feature<Polygon | MultiPolygon, MunicipioProps>
type Fincas = FeatureCollection<Polygon | MultiPolygon, FincaProps>

const DATA = `${import.meta.env.BASE_URL}data`
export const PROVINCIA = 29
export const DEMO_MUNICIPIO = 29015

let municipios: Municipio[] = []
const loaded = new Map<number, Promise<Fincas>>()
const byId = new Map<number, Finca>()
const byPid = new Map<string, Finca>()

export async function loadMunicipios(): Promise<FeatureCollection<Polygon | MultiPolygon, MunicipioProps>> {
  const res = await fetch(`${DATA}/municipios_${PROVINCIA}.geojson`)
  if (!res.ok) throw new Error(`municipios ${res.status}`)
  const data = await res.json()
  municipios = data.features
  return data
}

async function readGeojson(res: Response) {
  const bytes = new Uint8Array(await res.arrayBuffer())
  const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b
  const body = gzipped ? new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')) : new Blob([bytes]).stream()
  return JSON.parse(await new Response(body).text())
}

export function loadMunicipio(key: number): Promise<Fincas> {
  if (!loaded.has(key)) {
    const request = fetch(`${DATA}/fincas/${key}.geojson.gz`)
      .then((res) => {
        if (!res.ok) throw new Error(`fincas ${key} ${res.status}`)
        return readGeojson(res)
      })
      .then((data: Fincas) => {
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

export const getFinca = (id: number) => byId.get(id)

export const getMunicipio = (key: number) => municipios.find((m) => m.properties.mun === key)

export const municipioBbox = (m: Municipio) => bbox(m) as BBox

export const provinciaBbox = () => bbox({ type: 'FeatureCollection', features: municipios }) as BBox

export const municipioAt = (lng: number, lat: number) => municipios.find((m) => booleanPointInPolygon([lng, lat], m))

export async function fincaByPid(pid: string) {
  const [prov, mun] = pid.split(':').map(Number)
  await loadMunicipio(prov * 1000 + mun)
  return byPid.get(pid)
}
