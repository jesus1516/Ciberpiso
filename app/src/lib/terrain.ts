import type { Map, PaddingOptions, SkySpecification } from 'maplibre-gl'
import { fieldBbox, fieldCentroid, type Field } from './geo'
import { BASE_LAYER } from './mapStyle'

const TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
export const EXAGGERATION = 1.5
const FIELD_PITCH = 50

const sky: SkySpecification = {
  'sky-color': '#7fb2e5',
  'horizon-color': '#f3e7cf',
  'fog-color': '#e9dfcb',
  'sky-horizon-blend': 0.6,
  'horizon-fog-blend': 0.7,
  'fog-ground-blend': 0.85,
  'atmosphere-blend': 0.8,
}

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
        BASE_LAYER,
      )
    }
    map.setTerrain({ source: 'dem', exaggeration: EXAGGERATION })
    map.setSky(sky)
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
  map.setSky({ 'atmosphere-blend': 0 })
  map.easeTo({ pitch: 0, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 800 })
}

export function flyToField(map: Map, field: Field, pitched: boolean) {
  const padding = panelPadding()
  const camera = map.cameraForBounds(fieldBbox(field), { padding })
  const zoom = Math.min((camera?.zoom ?? 15) - (pitched ? 0.4 : 0), 17)
  map.flyTo({
    center: fieldCentroid(field),
    zoom,
    pitch: pitched ? FIELD_PITCH : 0,
    bearing: pitched ? -25 : 0,
    padding,
    duration: 4200,
    curve: 1.5,
  })
}
