import area from '@turf/area'
import bbox from '@turf/bbox'
import centroid from '@turf/centroid'
import type { Feature, Polygon } from 'geojson'

export type Field = Feature<Polygon>
export type BBox = [number, number, number, number]

export const areaHa = (field: Field) => area(field) / 10_000

export const fieldCentroid = (field: Field) => centroid(field).geometry.coordinates as [number, number]

export const fieldBbox = (field: Field) => bbox(field) as BBox

export function squareAround(lng: number, lat: number, halfSideM = 250): Field {
  const dLat = halfSideM / 111_320
  const dLng = halfSideM / (111_320 * Math.cos((lat * Math.PI) / 180))
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [lng - dLng, lat - dLat],
        [lng + dLng, lat - dLat],
        [lng + dLng, lat + dLat],
        [lng - dLng, lat + dLat],
        [lng - dLng, lat - dLat],
      ]],
    },
  }
}
