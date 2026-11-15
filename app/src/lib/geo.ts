import bbox from '@turf/bbox'
import centroid from '@turf/centroid'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'

export type FarmProps = {
  id: number
  pid: string
  mun: number
  pol: number
  par: number
  ha: number
  slope: number | null
  alt: number | null
  cover: string | null
  rot: string | null
  cand: number
  apt: string | null
}
export type Farm = Feature<Polygon | MultiPolygon, FarmProps>
export type Field = FeatureCollection<Polygon | MultiPolygon, FarmProps>
export type BBox = [number, number, number, number]

export const toField = (farms: Farm[]): Field => ({ type: 'FeatureCollection', features: farms })

export const areaHa = (field: Field) => field.features.reduce((s, f) => s + f.properties.ha, 0)

export const fieldCentroid = (field: Field) => centroid(field).geometry.coordinates as [number, number]

export const fieldBbox = (field: Field) => bbox(field) as BBox
