import { useEffect, useRef } from 'react'
import { TerraDraw, TerraDrawPolygonMode } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import type { Polygon } from 'geojson'
import { t } from '../i18n'
import { areaHa, squareAround, type Field } from '../lib/geo'
import { useStore } from '../store'

const button = 'rounded-lg px-3 py-2 text-sm font-medium shadow-sm focus:outline-2 focus:outline-offset-2 focus:outline-white'

export function DrawControls() {
  const map = useStore((s) => s.map)
  const field = useStore((s) => s.field)
  const drawMode = useStore((s) => s.drawMode)
  const { setDrawMode, setField, confirmField } = useStore.getState()
  const draw = useRef<TerraDraw | null>(null)

  useEffect(() => {
    if (!map) return
    const instance = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [
        new TerraDrawPolygonMode({
          styles: { fillColor: '#facc15', fillOpacity: 0.25, outlineColor: '#facc15', outlineWidth: 3, closingPointColor: '#ffffff' },
        }),
      ],
    })
    instance.start()
    instance.on('finish', (id) => {
      const feature = instance.getSnapshotFeature(id)
      if (feature?.geometry.type !== 'Polygon') return
      setField({ type: 'Feature', properties: {}, geometry: feature.geometry as Polygon } as Field)
      instance.clear()
      instance.setMode('static')
    })
    draw.current = instance
    return () => {
      instance.stop()
      draw.current = null
    }
  }, [map, setField])

  useEffect(() => {
    if (!map || drawMode !== 'point') return
    const onClick = (e: { lngLat: { lng: number; lat: number } }) => setField(squareAround(e.lngLat.lng, e.lngLat.lat))
    map.getCanvas().style.cursor = 'crosshair'
    map.once('click', onClick)
    return () => {
      map.off('click', onClick)
      map.getCanvas().style.cursor = ''
    }
  }, [map, drawMode, setField])

  function start(mode: 'polygon' | 'point') {
    setField(null)
    draw.current?.clear()
    draw.current?.setMode(mode === 'polygon' ? 'polygon' : 'static')
    setDrawMode(mode)
  }

  function cancel() {
    draw.current?.clear()
    draw.current?.setMode('static')
    setDrawMode('idle')
  }

  if (drawMode !== 'idle') {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-black/70 p-2 text-sm text-white" role="status">
        <span className="flex-1">{drawMode === 'polygon' ? t.map.drawHint : t.map.pointHint}</span>
        <button onClick={cancel} className={`${button} bg-white text-ink`}>{t.map.cancel}</button>
      </div>
    )
  }

  if (field) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-black/70 p-2 text-white">
        <span className="flex-1 text-lg font-semibold" aria-live="polite">{t.map.area(areaHa(field))}</span>
        <button onClick={() => start('polygon')} className={`${button} bg-white/15 text-white hover:bg-white/25`}>{t.map.redraw}</button>
        <button onClick={confirmField} className={`${button} bg-field text-ink hover:bg-yellow-300`}>{t.map.confirm}</button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => start('polygon')} disabled={!map} className={`${button} bg-field text-ink hover:bg-yellow-300 disabled:opacity-60`}>
        {t.map.drawField}
      </button>
      <button onClick={() => start('point')} disabled={!map} className={`${button} bg-white text-ink hover:bg-neutral-100 disabled:opacity-60`}>
        {t.map.dropPoint}
      </button>
    </div>
  )
}
