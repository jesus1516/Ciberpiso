import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { GIBS_LAYERS, gibsTiles, type GibsId } from '../lib/gibs'
import bbox from '@turf/bbox'
import { loadFincas } from '../lib/fincas'
import { pulse } from '../lib/pulse'
import { disable3D, enable3D, flyToField } from '../lib/terrain'
import { useStore } from '../store'

maplibregl.setWorkerUrl(workerUrl)

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
    fincas: { type: 'geojson', data: EMPTY, promoteId: 'id', attribution: 'Fincas: SIGPAC (FEGA, CC BY 4.0)' },
    field: { type: 'geojson', data: EMPTY },
    pulse: { type: 'geojson', data: EMPTY },
  },
  layers: [
    { id: 'esri', type: 'raster', source: 'esri' },
    { id: 'fincas-fill', type: 'fill', source: 'fincas', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.04, 'fill-opacity-transition': { duration: 700 } } },
    {
      id: 'fincas-line',
      type: 'line',
      source: 'fincas',
      paint: {
        'line-color': '#ffffff',
        'line-opacity': 0.5,
        'line-opacity-transition': { duration: 700 },
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.3, 15, 1.2],
      },
    },
    {
      id: 'fincas-candidate-fill',
      type: 'fill',
      source: 'fincas',
      filter: ['==', ['get', 'cand'], 1],
      paint: { 'fill-color': '#facc15', 'fill-opacity': 0.08 },
    },
    {
      id: 'fincas-candidate-line',
      type: 'line',
      source: 'fincas',
      filter: ['==', ['get', 'cand'], 1],
      paint: {
        'line-color': '#facc15',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 15, 3],
        'line-opacity': 0.9,
      },
    },
    { id: 'fincas-hover-fill', type: 'fill', source: 'fincas', filter: ['==', ['get', 'id'], -1], paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.22 } },
    { id: 'fincas-hover-line', type: 'line', source: 'fincas', filter: ['==', ['get', 'id'], -1], paint: { 'line-color': '#ffffff', 'line-width': 2.5 } },
    { id: 'field-fill', type: 'fill', source: 'field', paint: { 'fill-color': '#facc15', 'fill-opacity': 0.22 } },
    { id: 'field-glow', type: 'line', source: 'field', paint: { 'line-color': '#facc15', 'line-width': 10, 'line-opacity': 0.3, 'line-blur': 4 } },
    { id: 'field-line', type: 'line', source: 'field', paint: { 'line-color': '#facc15', 'line-width': 3 } },
    { id: 'pulse-fill', type: 'fill', source: 'pulse', paint: { 'fill-opacity': 0 } },
    { id: 'pulse-line-1', type: 'line', source: 'pulse', paint: { 'line-opacity': 0 } },
    { id: 'pulse-line-2', type: 'line', source: 'pulse', paint: { 'line-opacity': 0 } },
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
        center: [-4.56, 37.05],
        zoom: 10,
        maxPitch: 85,
        attributionControl: { compact: true },
      })
    } catch {
      setFailed(true)
      return
    }
    instance.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    instance.on('load', () => {
      useStore.getState().setMap(instance)
      loadFincas()
        .then((data) => {
          instance.getSource<maplibregl.GeoJSONSource>('fincas')?.setData(data)
          instance.fitBounds(bbox(data) as [number, number, number, number], { padding: 40, duration: 1500 })
          useStore.getState().setFincasStatus('ready')
        })
        .catch(() => useStore.getState().setFincasStatus('error'))
    })
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
        map.addLayer({ id, type: 'raster', source: id }, 'fincas-fill')
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
    pulse(map, field, '#facc15', 1300)
    map.setPaintProperty('fincas-fill', 'fill-opacity', 0)
    map.setPaintProperty('fincas-line', 'line-opacity', 0)
    const openPanel = () => setPanelOpen(true)
    const timer = setTimeout(() => {
      const ok = enable3D(map, () => setTerrain('flat'))
      setTerrain(ok ? 'on' : 'flat')
      flyToField(map, field, ok)
      map.once('moveend', openPanel)
    }, 650)
    return () => {
      clearTimeout(timer)
      map.off('moveend', openPanel)
      map.setPaintProperty('fincas-fill', 'fill-opacity', 0.04)
      map.setPaintProperty('fincas-line', 'line-opacity', 0.5)
      disable3D(map)
    }
  }, [map, step])

  return (
    <>
      <div className="absolute inset-0">
        <div ref={container} className="h-full w-full" aria-label="Map" role="region" />
      </div>
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-neutral-900 p-6 text-center text-white">
          <p className="max-w-sm">{t.map.webglError}</p>
        </div>
      )}
    </>
  )
}
