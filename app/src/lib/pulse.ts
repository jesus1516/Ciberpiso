import type { GeoJSONSource, Map } from 'maplibre-gl'
import type { GeoJSON } from 'geojson'

const EMPTY: GeoJSON = { type: 'FeatureCollection', features: [] }
const WAVES: [string, number][] = [['pulse-line-1', 0], ['pulse-line-2', 0.28]]
const easeOut = (t: number) => 1 - (1 - t) ** 3
let frame = 0

export function pulse(map: Map, data: GeoJSON, color: string, ms = 1100) {
  const source = map.getSource<GeoJSONSource>('pulse')
  if (!source) return
  cancelAnimationFrame(frame)
  source.setData(data)
  map.setPaintProperty('pulse-fill', 'fill-color', color)
  for (const [id] of WAVES) map.setPaintProperty(id, 'line-color', color)
  const start = performance.now()

  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms)
    map.setPaintProperty('pulse-fill', 'fill-opacity', 0.55 * (1 - easeOut(t)))
    for (const [id, delay] of WAVES) {
      const k = Math.max(0, Math.min(1, (t - delay) / (1 - delay)))
      map.setPaintProperty(id, 'line-width', 2 + 24 * easeOut(k))
      map.setPaintProperty(id, 'line-blur', 10 * k)
      map.setPaintProperty(id, 'line-opacity', k > 0 ? 0.95 * (1 - k) : 0)
    }
    if (t < 1) frame = requestAnimationFrame(step)
    else source.setData(EMPTY)
  }
  frame = requestAnimationFrame(step)
}
