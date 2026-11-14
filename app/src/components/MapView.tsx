import * as maplibregl from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { GIBS_LAYERS, gibsTiles, type GibsId } from '../lib/gibs'
import { disable3D, enable3D, flyToField } from '../lib/terrain'
import { useStore } from '../store'

const EMPTY = { type: 'FeatureCollection' as const, features: [] }

const style: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    },
    field: { type: 'geojson', data: EMPTY },
  },
  layers: [
    { id: 'esri', type: 'raster', source: 'esri' },
    { id: 'field-fill', type: 'fill', source: 'field', paint: { 'fill-color': '#facc15', 'fill-opacity': 0.22 } },
    { id: 'field-glow', type: 'line', source: 'field', paint: { 'line-color': '#facc15', 'line-width': 10, 'line-opacity': 0.3, 'line-blur': 4 } },
    { id: 'field-line', type: 'line', source: 'field', paint: { 'line-color': '#facc15', 'line-width': 3 } },
  ],
}

export function MapView() {
  const container = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const map = useStore((s) => s.map)
  const field = useStore((s) => s.field)
  const step = useStore((s) => s.step)
  const layers = useStore((s) => s.layers)
  const gibsDate = useStore((s) => s.gibsDate)

  useEffect(() => {
    let instance: maplibregl.Map
    try {
      instance = new maplibregl.Map({
        container: container.current!,
        style,
        center: [-4.5, 37.5],
        zoom: 2.2,
        maxPitch: 85,
        attributionControl: { compact: true },
      })
    } catch {
      setFailed(true)
      return
    }
    instance.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    instance.on('load', () => useStore.getState().setMap(instance))
    instance.on('error', (e) => {
      const sourceId = 'sourceId' in e ? String(e.sourceId) : ''
      if (!sourceId.startsWith('gibs-')) return
      const { layers, setLayer } = useStore.getState()
      const id = sourceId.slice(5) as GibsId
      if (!layers[id].error) setLayer(id, { error: true })
    })
    return () => {
      useStore.getState().setMap(null)
      instance.remove()
    }
  }, [])

  useEffect(() => {
    const source = map?.getSource<maplibregl.GeoJSONSource>('field')
    source?.setData(field ?? EMPTY)
  }, [map, field])

  useEffect(() => {
    if (!map) return
    for (const l of GIBS_LAYERS) {
      const id = `gibs-${l.id}`
      const { visible, opacity } = layers[l.id]
      const tiles = [gibsTiles(l, gibsDate)]
      const source = map.getSource<maplibregl.RasterTileSource>(id)
      if (!source) {
        if (!visible) continue
        map.addSource(id, { type: 'raster', tiles, tileSize: 256, maxzoom: l.level, attribution: 'NASA GIBS / ESDIS' })
        map.addLayer({ id, type: 'raster', source: id }, 'field-fill')
      } else if (source.tiles?.[0] !== tiles[0]) {
        source.setTiles(tiles)
      }
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
      map.setPaintProperty(id, 'raster-opacity', opacity)
    }
  }, [map, layers, gibsDate])

  useEffect(() => {
    if (!map || step !== 'dashboard') return
    const { field, setTerrain, setPanelOpen } = useStore.getState()
    if (!field) return
    const ok = enable3D(map, () => setTerrain('flat'))
    setTerrain(ok ? 'on' : 'flat')
    flyToField(map, field, ok)
    map.once('moveend', () => setPanelOpen(true))
    return () => {
      disable3D(map)
      map.easeTo({ padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 0 })
    }
  }, [map, step])

  return (
    <>
      <div ref={container} className="absolute inset-0" aria-label="Map" role="region" />
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-neutral-900 p-6 text-center text-white">
          <p className="max-w-sm">{t.map.webglError}</p>
        </div>
      )}
    </>
  )
}
