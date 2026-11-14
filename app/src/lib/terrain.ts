import type { Map, PaddingOptions } from 'maplibre-gl'
import { fieldBbox, fieldCentroid, type Field } from './geo'

const TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
export const EXAGGERATION = 1.5

const demSource = {
  type: 'raster-dem' as const,
  tiles: [TERRARIUM],
  encoding: 'terrarium' as const,
  tileSize: 256,
  maxzoom: 15,
  attribution: 'Terrain: Mapzen Terrarium / AWS Open Data',
}

export function panelPadding(): PaddingOptions {
  if (window.innerWidth >= 1024) return { top: 60, bottom: 80, left: 60, right: 500 }
  return { top: 70, bottom: Math.round(window.innerHeight * 0.5), left: 24, right: 24 }
}

export function enable3D(map: Map, onFail: () => void): boolean {
  try {
    if (!map.getSource('dem')) map.addSource('dem', demSource)
    if (!map.getSource('hillshade-dem')) map.addSource('hillshade-dem', demSource)
    if (!map.getLayer('hillshade')) {
      map.addLayer(
        {
          id: 'hillshade',
          type: 'hillshade',
          source: 'hillshade-dem',
          paint: { 'hillshade-exaggeration': 0.3, 'hillshade-shadow-color': '#000000' },
        },
        'field-fill',
      )
    }
    map.setTerrain({ source: 'dem', exaggeration: EXAGGERATION })
  } catch {
    onFail()
    return false
  }

  let errors = 0
  const onError = (e: object) => {
    const sourceId = 'sourceId' in e ? e.sourceId : null
    if (sourceId !== 'dem' && sourceId !== 'hillshade-dem') return
    errors += 1
    if (errors === 3) {
      map.off('error', onError)
      disable3D(map)
      onFail()
    }
  }
  map.on('error', onError)
  return true
}

export function disable3D(map: Map) {
  try {
    map.setTerrain(null)
  } catch {
    /* terrain already off */
  }
  if (map.getLayer('hillshade')) map.removeLayer('hillshade')
  map.easeTo({ pitch: 0, bearing: 0, duration: 800 })
}

export function flyToField(map: Map, field: Field, pitched: boolean) {
  const padding = panelPadding()
  const camera = map.cameraForBounds(fieldBbox(field), { padding })
  const zoom = Math.min((camera?.zoom ?? 15) - (pitched ? 0.4 : 0), 17)
  map.flyTo({
    center: fieldCentroid(field),
    zoom,
    pitch: pitched ? 65 : 0,
    bearing: pitched ? -35 : 0,
    padding,
    duration: 4200,
    curve: 1.5,
  })
}

export function estimateSlopePct(map: Map, field: Field): number | null {
  const [west, south, east, north] = fieldBbox(field)
  const n = 5
  const lat = (south + north) / 2
  const dx = ((east - west) / (n - 1)) * 111_320 * Math.cos((lat * Math.PI) / 180)
  const dy = ((north - south) / (n - 1)) * 111_320
  const grid: number[][] = []
  for (let i = 0; i < n; i++) {
    grid.push([])
    for (let j = 0; j < n; j++) {
      const z = map.queryTerrainElevation([west + ((east - west) * j) / (n - 1), south + ((north - south) * i) / (n - 1)])
      if (z === null) return null
      grid[i].push(z / EXAGGERATION)
    }
  }
  const slopes: number[] = []
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const gx = (grid[i][j + 1] - grid[i][j]) / dx
      const gy = (grid[i + 1][j] - grid[i][j]) / dy
      slopes.push(Math.hypot(gx, gy) * 100)
    }
  }
  return slopes.reduce((a, b) => a + b, 0) / slopes.length
}

export function slopeClass(pct: number) {
  if (pct < 2) return 'flat' as const
  if (pct < 8) return 'gentle' as const
  if (pct < 15) return 'moderate' as const
  return 'steep' as const
}
