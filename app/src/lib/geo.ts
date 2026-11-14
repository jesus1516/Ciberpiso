import bbox from '@turf/bbox'
import centroid from '@turf/centroid'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'

export type FincaProps = {
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
export type Finca = Feature<Polygon | MultiPolygon, FincaProps>
export type Field = FeatureCollection<Polygon | MultiPolygon, FincaProps>
export type BBox = [number, number, number, number]

export const toField = (fincas: Finca[]): Field => ({ type: 'FeatureCollection', features: fincas })

export const areaHa = (field: Field) => field.features.reduce((s, f) => s + f.properties.ha, 0)

export const fieldCentroid = (field: Field) => centroid(field).geometry.coordinates as [number, number]

export const fieldBbox = (field: Field) => bbox(field) as BBox

export function weightedSlope(field: Field): number | null {
  const withSlope = field.features.filter((f) => f.properties.slope !== null)
  const ha = withSlope.reduce((s, f) => s + f.properties.ha, 0)
  return ha ? withSlope.reduce((s, f) => s + f.properties.slope! * f.properties.ha, 0) / ha : null
}
