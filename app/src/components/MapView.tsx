import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { flyToMunicipio, flyToProvincia, maxBoundsFor } from '../lib/camera'
import { getMunicipio, loadMunicipio, loadMunicipios, municipioBbox, provinciaBbox } from '../lib/fincas'
import { GIBS_LAYERS, gibsTiles, type GibsId } from '../lib/gibs'
import { BASE_LAYER, EMPTY, GOLD, HATCH, hatchImage, municipioPaint, style } from '../lib/mapStyle'
import { pulse } from '../lib/pulse'
import { disable3D, enable3D, flyToField } from '../lib/terrain'
import { useStore } from '../store'

maplibregl.setWorkerUrl(workerUrl)

const MAP_LAYERS = ['municipios-fill', 'municipios-line', 'municipios-focus', 'fincas-limited', 'fincas-blocked-tint', 'fincas-blocked', 'fincas-candidate-fill', 'fincas-candidate-line']

export function MapView() {
  const container = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const map = useStore((s) => s.map)
  const ready = useStore((s) => s.fincasStatus === 'ready')
  const field = useStore((s) => s.field)
  const step = useStore((s) => s.step)
  const layers = useStore((s) => s.layers)
  const gibsDate = useStore((s) => s.gibsDate)
  const municipio = useStore((s) => s.municipio)
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
      loadMunicipios()
        .then((data) => {
          instance.getSource<maplibregl.GeoJSONSource>('municipios')?.setData(data)
          instance.setMaxBounds(maxBoundsFor(provinciaBbox()))
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
    if (!map || !ready) return
    const level = municipio ? 'municipio' : 'provincia'
    const paint = municipioPaint[level]
    map.setPaintProperty('municipios-fill', 'fill-color', paint['fill-color'])
    map.setPaintProperty('municipios-fill', 'fill-opacity', paint['fill-opacity'])
    map.removeFeatureState({ source: 'municipios' })
    const fincas = map.getSource<maplibregl.GeoJSONSource>('fincas')
    if (!municipio) {
      fincas?.setData(EMPTY)
      if (useStore.getState().step === 'map') flyToProvincia(map, provinciaBbox(), 2200)
      return
    }
    map.setFeatureState({ source: 'municipios', id: municipio.key }, { active: true })
    const feature = getMunicipio(municipio.key)
    if (feature && useStore.getState().step === 'map') {
      flyToMunicipio(map, municipio.bounds ?? municipioBbox(feature))
      pulse(map, feature, GOLD, 1200)
    }
    let current = true
    const { setMunicipioStatus } = useStore.getState()
    setMunicipioStatus('loading')
    loadMunicipio(municipio.key)
      .then((data) => {
        if (!current) return
        fincas?.setData(data)
        setMunicipioStatus('ready')
      })
      .catch(() => current && setMunicipioStatus('error'))
    return () => {
      current = false
    }
  }, [map, ready, municipio])

  useEffect(() => {
    if (!map) return
    const pids = Object.keys(indicators?.byPid ?? {})
    const filter: maplibregl.FilterSpecification = ['in', ['get', 'pid'], ['literal', pids]]
    map.setFilter('fincas-candidate-fill', filter)
    map.setFilter('fincas-candidate-line', filter)
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
        map.addSource(id, { type: 'raster', tiles, tileSize: 256, maxzoom: l.level, attribution: 'NASA GIBS / ESDIS' })
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
    map.setPaintProperty('fincas-fill', 'fill-opacity', 0)
    map.setPaintProperty('fincas-line', 'line-opacity', 0)
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
      map.setPaintProperty('fincas-fill', 'fill-opacity', 0.04)
      map.setPaintProperty('fincas-line', 'line-opacity', 0.5)
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
