import * as maplibregl from 'maplibre-gl'
import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { fincaByPid, getFinca, getMunicipio, municipioAt, type MunicipioProps } from '../lib/fincas'
import { areaHa, type Finca } from '../lib/geo'
import { GOLD } from '../lib/mapStyle'
import { pulse } from '../lib/pulse'
import { useStore } from '../store'

const f = t.fincas
const AUTO_ENTER_ZOOM = 12.5
const button = 'rounded-lg px-3 py-2 text-sm font-medium shadow-sm focus:outline-2 focus:outline-offset-2 focus:outline-white disabled:opacity-50'
const glass = 'rounded-xl bg-black/60 text-white shadow-lg ring-1 ring-white/15 backdrop-blur-md'

function toggle(finca: Finca) {
  const { map, selection, toggleFinca } = useStore.getState()
  const selected = selection.some((s) => s.properties.id === finca.properties.id)
  if (map) pulse(map, finca, selected ? '#ffffff' : GOLD, selected ? 600 : 1100)
  toggleFinca(finca)
}

function enter(m: MunicipioProps) {
  useStore.getState().setMunicipio({ key: m.mun, name: m.nombre })
}

const municipioName = (key: number) => getMunicipio(key)?.properties.nombre ?? ''

export function FincaPicker() {
  const map = useStore((s) => s.map)
  const status = useStore((s) => s.fincasStatus)
  const municipio = useStore((s) => s.municipio)
  const municipioStatus = useStore((s) => s.municipioStatus)
  const selection = useStore((s) => s.selection)
  const field = useStore((s) => s.field)
  const indicators = useStore((s) => s.indicators)
  const { clearSelection, confirmField, openProjectFinca, setMunicipio } = useStore.getState()
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    if (!map || status !== 'ready') return
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: 'finca-popup' })
    let hovered: { source: string; id: number } | null = null

    const setHover = (next: { source: string; id: number } | null) => {
      if (hovered?.source === next?.source && hovered?.id === next?.id) return
      if (hovered) map.setFeatureState(hovered, { hover: false })
      if (next) map.setFeatureState(next, { hover: true })
      hovered = next
      map.getCanvas().style.cursor = next ? 'pointer' : ''
    }

    const pick = (point: maplibregl.Point) => {
      const active = useStore.getState().municipio?.key
      const hits = map.queryRenderedFeatures(point, { layers: ['fincas-fill', 'municipios-fill'] })
      const finca = hits.find((h) => h.layer.id === 'fincas-fill')
      if (finca) return { finca: getFinca(Number(finca.id)) }
      const muni = hits.find((h) => h.layer.id === 'municipios-fill' && Number(h.id) !== active)
      return { municipio: muni ? getMunicipio(Number(muni.id))?.properties : undefined }
    }

    const onMove = (e: maplibregl.MapMouseEvent) => {
      const { finca, municipio: m } = pick(e.point)
      if (finca) {
        setHover({ source: 'fincas', id: finca.properties.id })
        const project = Boolean(useStore.getState().indicators?.byPid[finca.properties.pid])
        popup.setLngLat(e.lngLat).setText(f.popup(finca.properties, project)).addTo(map)
      } else if (m) {
        setHover({ source: 'municipios', id: m.mun })
        popup.setLngLat(e.lngLat).setText(f.municipioPopup(m)).addTo(map)
      } else {
        setHover(null)
        popup.remove()
      }
    }
    const onLeave = () => {
      setHover(null)
      popup.remove()
    }
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const { finca, municipio: m } = pick(e.point)
      popup.remove()
      if (finca) toggle(finca)
      else if (m) {
        setHover(null)
        enter(m)
      }
    }
    const onMoveEnd = () => {
      if (useStore.getState().municipio || map.getZoom() < AUTO_ENTER_ZOOM) return
      const { lng, lat } = map.getCenter()
      const m = municipioAt(lng, lat)
      if (m) enter(m.properties)
    }

    map.on('mousemove', onMove)
    map.on('mouseout', onLeave)
    map.on('click', onClick)
    map.on('moveend', onMoveEnd)
    return () => {
      map.off('mousemove', onMove)
      map.off('mouseout', onLeave)
      map.off('click', onClick)
      map.off('moveend', onMoveEnd)
      onLeave()
    }
  }, [map, status])

  async function openDemo() {
    const pid = Object.keys(indicators?.byPid ?? {})[0]
    if (!pid) return
    setOpening(true)
    const finca = await fincaByPid(pid).catch(() => undefined)
    setOpening(false)
    if (!finca) return
    setMunicipio({ key: finca.properties.mun, name: municipioName(finca.properties.mun) })
    openProjectFinca(finca)
  }

  if (status !== 'ready') {
    return (
      <p className={`${glass} flex items-center gap-2 p-3 text-sm`} role="status">
        {status === 'loading' && <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />}
        {status === 'loading' ? f.loading : f.error}
      </p>
    )
  }

  return (
    <div className={`${glass} flex flex-col gap-2 p-3`}>
      <nav aria-label={f.breadcrumb} className="flex flex-wrap items-center gap-1 text-sm">
        {municipio ? (
          <button onClick={() => setMunicipio(null)} className="rounded px-1 text-white/75 underline-offset-2 hover:text-white hover:underline">
            {f.provincia}
          </button>
        ) : (
          <span className="px-1 font-semibold">{f.provincia}</span>
        )}
        {municipio && (
          <>
            <span className="text-white/50" aria-hidden>›</span>
            <span className="px-1 font-semibold" aria-current="page">{municipio.name}</span>
            {municipioStatus === 'loading' && (
              <span className="ml-1 size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" role="status" aria-label={f.loadingMunicipio} />
            )}
          </>
        )}
      </nav>

      <p className="text-sm">
        {!municipio ? f.hintProvincia : municipioStatus === 'error' ? f.errorMunicipio : selection.length ? f.hintMore : f.hint}
      </p>
      {municipio && <p className="text-xs text-white/70">{f.candidateHint}</p>}
      {indicators && (
        <button
          onClick={openDemo}
          disabled={opening}
          className="self-start rounded-lg bg-field px-3 py-1.5 text-xs font-semibold text-ink hover:bg-yellow-300 disabled:opacity-60"
        >
          {f.demo}
        </button>
      )}

      {selection.length > 0 && (
        <>
          <ul className="max-h-36 space-y-1 overflow-y-auto text-sm" aria-label={f.selected}>
            {selection.map((s) => (
              <li key={s.properties.id} className="flex items-center gap-2 rounded bg-white/10 px-2 py-1">
                <span className="size-2.5 shrink-0 rounded-full bg-field" aria-hidden />
                <span className="flex-1 leading-tight">
                  {f.name(s.properties.pol, s.properties.par)}
                  <span className="block text-[11px] text-white/60">{municipioName(s.properties.mun)}</span>
                </span>
                {indicators?.byPid[s.properties.pid] && (
                  <span className="rounded bg-field px-1.5 py-0.5 text-[10px] font-semibold text-ink">{f.candidate}</span>
                )}
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
