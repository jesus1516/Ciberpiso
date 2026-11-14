import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { flyToMunicipality, flyToProvince, maxBoundsFor } from '../lib/camera'
import { getMunicipality, loadMunicipality, loadMunicipalities, municipalityBbox, provinceBbox } from '../lib/farms'
import { GIBS_LAYERS, gibsTiles, type GibsId } from '../lib/gibs'
import { BASE_LAYER, EMPTY, GOLD, HATCH, hatchImage, municipalityPaint, style } from '../lib/mapStyle'
import { pulse } from '../lib/pulse'
import { disable3D, enable3D, flyToField } from '../lib/terrain'
import { useStore } from '../store'

maplibregl.setWorkerUrl(workerUrl)

const MAP_LAYERS = ['municipalities-fill', 'municipalities-line', 'municipalities-focus', 'farms-limited', 'farms-blocked-tint', 'farms-blocked', 'farms-candidate-fill', 'farms-candidate-line']

export function MapView() {
  const container = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const map = useStore((s) => s.map)
  const ready = useStore((s) => s.farmsStatus === 'ready')
  const field = useStore((s) => s.field)
  const step = useStore((s) => s.step)
  const layers = useStore((s) => s.layers)
  const gibsDate = useStore((s) => s.gibsDate)
  const municipality = useStore((s) => s.municipality)
  const indicators = useStore((s) => s.indicators)

  useEffect(() => {
    let instance: maplibregl.Map
    try {
      instance = new maplibregl.Map({
        container: container.current!,
        style,
        center: [-4.6, 36.8],
        zoom: 8,
        maxPitch: 85,
        attributionControl: { compact: true },
      })
    } catch {
      setFailed(true)
      return
    }
    instance.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    instance.on('load', () => {
      if (!instance.hasImage(HATCH)) instance.addImage(HATCH, hatchImage())
      useStore.getState().setMap(instance)
      loadMunicipalities()
        .then((data) => {
          instance.getSource<maplibregl.GeoJSONSource>('municipalities')?.setData(data)
          instance.setMaxBounds(maxBoundsFor(provinceBbox()))
          useStore.getState().setFarmsStatus('ready')
        })
        .catch(() => useStore.getState().setFarmsStatus('error'))
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
    if (!map || !ready) return
    const level = municipality ? 'municipality' : 'province'
    const paint = municipalityPaint[level]
    map.setPaintProperty('municipalities-fill', 'fill-color', paint['fill-color'])
    map.setPaintProperty('municipalities-fill', 'fill-opacity', paint['fill-opacity'])
    map.removeFeatureState({ source: 'municipalities' })
    const farms = map.getSource<maplibregl.GeoJSONSource>('farms')
    if (!municipality) {
      farms?.setData(EMPTY)
      if (useStore.getState().step === 'map') flyToProvince(map, provinceBbox(), 2200)
      return
    }
    map.setFeatureState({ source: 'municipalities', id: municipality.key }, { active: true })
    const feature = getMunicipality(municipality.key)
    if (feature && useStore.getState().step === 'map') {
      flyToMunicipality(map, municipality.bounds ?? municipalityBbox(feature))
      pulse(map, feature, GOLD, 1200)
    }
    let current = true
    const { setMunicipalityStatus } = useStore.getState()
    setMunicipalityStatus('loading')
    loadMunicipality(municipality.key)
      .then((data) => {
        if (!current) return
        farms?.setData(data)
        setMunicipalityStatus('ready')
      })
      .catch(() => current && setMunicipalityStatus('error'))
    return () => {
      current = false
    }
  }, [map, ready, municipality])

  useEffect(() => {
    if (!map) return
    const pids = Object.keys(indicators?.byPid ?? {})
    const filter: maplibregl.FilterSpecification = ['in', ['get', 'pid'], ['literal', pids]]
    map.setFilter('farms-candidate-fill', filter)
    map.setFilter('farms-candidate-line', filter)
  }, [map, indicators])

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
        map.addSource(id, { type: 'raster', tiles, tileSize: 256, maxzoom: l.level, attribution: 'GIBS / ESDIS' })
        map.addLayer({ id, type: 'raster', source: id }, BASE_LAYER)
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
    pulse(map, field, GOLD, 1300)
    map.setPaintProperty('farms-fill', 'fill-opacity', 0)
    map.setPaintProperty('farms-line', 'line-opacity', 0)
    MAP_LAYERS.forEach((id) => map.setLayoutProperty(id, 'visibility', 'none'))
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
      map.setPaintProperty('farms-fill', 'fill-opacity', 0.04)
      map.setPaintProperty('farms-line', 'line-opacity', 0.5)
      MAP_LAYERS.forEach((id) => map.setLayoutProperty(id, 'visibility', 'visible'))
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
