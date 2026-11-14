import * as maplibregl from 'maplibre-gl'
import { useEffect } from 'react'
import { t } from '../i18n'
import { getFinca } from '../lib/fincas'
import { areaHa, type Finca } from '../lib/geo'
import { pulse } from '../lib/pulse'
import { useStore } from '../store'

const f = t.fincas
function toggle(finca: Finca) {
  const { map, selection, toggleFinca } = useStore.getState()
  const selected = selection.some((s) => s.properties.id === finca.properties.id)
  if (map) pulse(map, finca, selected ? '#ffffff' : '#facc15', selected ? 600 : 1100)
  toggleFinca(finca)
}

const button = 'rounded-lg px-3 py-2 text-sm font-medium shadow-sm focus:outline-2 focus:outline-offset-2 focus:outline-white disabled:opacity-50'

export function FincaPicker() {
  const map = useStore((s) => s.map)
  const status = useStore((s) => s.fincasStatus)
  const selection = useStore((s) => s.selection)
  const field = useStore((s) => s.field)
  const { clearSelection, confirmField } = useStore.getState()

  useEffect(() => {
    if (!map || status !== 'ready') return
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: 'finca-popup' })
    const setHover = (id: number) => {
      map.setFilter('fincas-hover-fill', ['==', ['get', 'id'], id])
      map.setFilter('fincas-hover-line', ['==', ['get', 'id'], id])
    }
    const onMove = (e: maplibregl.MapLayerMouseEvent) => {
      const finca = getFinca(Number(e.features?.[0]?.id))
      if (!finca) return
      setHover(finca.properties.id)
      map.getCanvas().style.cursor = 'pointer'
      popup.setLngLat(e.lngLat).setText(f.popup(finca.properties)).addTo(map)
    }
    const onLeave = () => {
      setHover(-1)
      map.getCanvas().style.cursor = ''
      popup.remove()
    }
    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const finca = getFinca(Number(e.features?.[0]?.id))
      popup.remove()
      if (finca) toggle(finca)
    }
    map.on('mousemove', 'fincas-fill', onMove)
    map.on('mouseleave', 'fincas-fill', onLeave)
    map.on('click', 'fincas-fill', onClick)
    return () => {
      map.off('mousemove', 'fincas-fill', onMove)
      map.off('mouseleave', 'fincas-fill', onLeave)
      map.off('click', 'fincas-fill', onClick)
      onLeave()
    }
  }, [map, status])

  if (status !== 'ready') {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-black/70 p-3 text-sm text-white" role="status">
        {status === 'loading' && <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />}
        {status === 'loading' ? f.loading : f.error}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-black/70 p-3 text-white">
      <p className="text-sm">{selection.length ? f.hintMore : f.hint}</p>
      {selection.length > 0 && (
        <>
          <ul className="max-h-36 space-y-1 overflow-y-auto text-sm" aria-label={f.selected}>
            {selection.map((s) => (
              <li key={s.properties.id} className="flex items-center gap-2 rounded bg-white/10 px-2 py-1">
                <span className="size-2.5 shrink-0 rounded-full bg-field" aria-hidden />
                <span className="flex-1">{f.name(s.properties.pol, s.properties.par)}</span>
                <span className="tabular-nums text-white/80">{t.map.area(s.properties.ha)}</span>
                <button onClick={() => toggle(s)} aria-label={f.remove(s.properties.pol, s.properties.par)} className="rounded px-1 text-white/70 hover:bg-white/20 hover:text-white">
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex-1 font-semibold" aria-live="polite">{f.total(selection.length, field ? areaHa(field) : 0)}</span>
            <button onClick={clearSelection} className={`${button} bg-white/15 text-white hover:bg-white/25`}>{f.clear}</button>
            <button onClick={confirmField} className={`${button} bg-field text-ink hover:bg-yellow-300`}>{f.confirm}</button>
          </div>
        </>
      )}
    </div>
  )
}
