import type { Map } from 'maplibre-gl'
import type { BBox } from './geo'

const PROVINCE_PITCH = 22
const MUNICIPIO_PITCH = 25

const padding = () => (window.innerWidth >= 640 ? { top: 80, bottom: 60, left: 480, right: 60 } : { top: 300, bottom: 40, left: 20, right: 20 })

export function flyToProvincia(map: Map, bounds: BBox, duration = 1600) {
  map.fitBounds(bounds, { padding: padding(), pitch: PROVINCE_PITCH, bearing: 0, duration })
}

export function flyToMunicipio(map: Map, bounds: BBox) {
  map.fitBounds(bounds, { padding: padding(), pitch: MUNICIPIO_PITCH, bearing: 0, duration: 1800, maxZoom: 16 })
}

export function maxBoundsFor([w, s, e, n]: BBox): BBox {
  const m = 2
  return [w - m, s - m, e + m, n + m]
}
