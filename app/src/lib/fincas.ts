import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type { Finca, FincaProps } from './geo'

export const FINCAS_URL = `${import.meta.env.BASE_URL}data/fincas_antequera.geojson`

const byId = new Map<number, Finca>()
let candidates: Finca[] = []

export async function loadFincas(): Promise<FeatureCollection<Polygon | MultiPolygon, FincaProps>> {
  const res = await fetch(FINCAS_URL)
  if (!res.ok) throw new Error(`fincas ${res.status}`)
  const data: FeatureCollection<Polygon | MultiPolygon, FincaProps> = await res.json()
  candidates = []
  data.features.forEach((f) => {
    byId.set(f.properties.id, f)
    if (f.properties.cand === 1) candidates.push(f)
  })
  return data
}

export const getFinca = (id: number) => byId.get(id)
export const firstCandidate = () => candidates[0]
