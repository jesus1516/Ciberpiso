import * as maplibregl from 'maplibre-gl'
import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { farmByPid, getFarm, getMunicipality, municipalityAt, type MunicipalityProps } from '../lib/farms'
import { areaHa, type Farm } from '../lib/geo'
import { GOLD, LIMITED, NOT_FARMLAND } from '../lib/mapStyle'
import { pulse } from '../lib/pulse'
import { useStore } from '../store'

const f = t.farms
const AUTO_ENTER_ZOOM = 12.5
const button = 'rounded-lg px-3 py-2 text-sm font-medium shadow-sm focus:outline-2 focus:outline-offset-2 focus:outline-white disabled:opacity-50'
const glass = 'rounded-xl bg-black/60 text-white shadow-lg ring-1 ring-white/15 backdrop-blur-md'

type Notice = { kind: 'blocked' | 'warning'; text: string } | null

function toggle(farm: Farm): Notice {
  const { map, selection, toggleFarm } = useStore.getState()
  const apt = farm.properties.apt
  if (apt && NOT_FARMLAND.includes(apt)) {
    if (map) pulse(map, farm, '#ef4444', 700)
    return { kind: 'blocked', text: f.blocked(f.apt[apt]) }
  }
  const selected = selection.some((s) => s.properties.id === farm.properties.id)
  if (map) pulse(map, farm, selected ? '#ffffff' : GOLD, selected ? 600 : 1100)
  toggleFarm(farm)
  return !selected && apt && LIMITED.includes(apt) ? { kind: 'warning', text: f.limitedWarning(f.apt[apt]) } : null
}

function Legend() {
  const items: [string, string][] = [
    [f.legend.farmland, 'border border-white bg-[#b9a26e]'],
    [f.legend.limited, 'border border-white/50 bg-[#4d4636]'],
    [f.legend.notFarmland, 'border border-white/50 bg-zinc-600 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.8)_0_1.5px,transparent_1.5px_5px)]'],
  ]
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/80" aria-label={f.legend.title}>
      {items.map(([label, swatch]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className={`inline-block size-3 rounded-sm ${swatch}`} aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  )
}

function enter(m: MunicipalityProps) {
  useStore.getState().setMunicipality({ key: m.mun, name: m.nombre })
}

const municipalityName = (key: number) => getMunicipality(key)?.properties.nombre ?? ''

export function FarmPicker() {
  const map = useStore((s) => s.map)
  const status = useStore((s) => s.farmsStatus)
  const municipality = useStore((s) => s.municipality)
  const municipalityStatus = useStore((s) => s.municipalityStatus)
  const selection = useStore((s) => s.selection)
  const field = useStore((s) => s.field)
  const indicators = useStore((s) => s.indicators)
  const { clearSelection, confirmField, openProjectFarm, setMunicipality } = useStore.getState()
  const [opening, setOpening] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  useEffect(() => {
    if (!map || status !== 'ready') return
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: 'farm-popup' })
    let hovered: { source: string; id: number } | null = null

    const setHover = (next: { source: string; id: number } | null) => {
      if (hovered?.source === next?.source && hovered?.id === next?.id) return
      if (hovered) map.setFeatureState(hovered, { hover: false })
      if (next) map.setFeatureState(next, { hover: true })
      hovered = next
      map.getCanvas().style.cursor = next ? 'pointer' : ''
    }

    const pick = (point: maplibregl.Point) => {
      const active = useStore.getState().municipality?.key
      const hits = map.queryRenderedFeatures(point, { layers: ['farms-fill', 'municipalities-fill'] })
      const farm = hits.find((h) => h.layer.id === 'farms-fill')
      if (farm) return { farm: getFarm(Number(farm.id)) }
      const muni = hits.find((h) => h.layer.id === 'municipalities-fill' && Number(h.id) !== active)
      return { municipality: muni ? getMunicipality(Number(muni.id))?.properties : undefined }
    }

    const onMove = (e: maplibregl.MapMouseEvent) => {
      const { farm, municipality: m } = pick(e.point)
      if (farm) {
        setHover({ source: 'farms', id: farm.properties.id })
        const project = Boolean(useStore.getState().indicators?.byPid[farm.properties.pid])
        popup.setLngLat(e.lngLat).setText(f.popup(farm.properties, project)).addTo(map)
      } else if (m) {
        setHover({ source: 'municipalities', id: m.mun })
        popup.setLngLat(e.lngLat).setText(f.municipalityPopup(m)).addTo(map)
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
      const { farm, municipality: m } = pick(e.point)
      popup.remove()
      if (farm) setNotice(toggle(farm))
      else if (m) {
        setHover(null)
        enter(m)
      }
    }
    const onMoveEnd = () => {
      if (useStore.getState().municipality || map.getZoom() < AUTO_ENTER_ZOOM) return
      const { lng, lat } = map.getCenter()
      const m = municipalityAt(lng, lat)
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
    const farm = await farmByPid(pid).catch(() => undefined)
    setOpening(false)
    if (!farm) return
    setNotice(null)
    setMunicipality({ key: farm.properties.mun, name: municipalityName(farm.properties.mun) })
    openProjectFarm(farm)
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
        {municipality ? (
          <button onClick={() => setMunicipality(null)} className="rounded px-1 text-white/75 underline-offset-2 hover:text-white hover:underline">
            {f.province}
          </button>
        ) : (
          <span className="px-1 font-semibold">{f.province}</span>
        )}
        {municipality && (
          <>
            <span className="text-white/50" aria-hidden>›</span>
            <span className="px-1 font-semibold" aria-current="page">{municipality.name}</span>
            {municipalityStatus === 'loading' && (
              <span className="ml-1 size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" role="status" aria-label={f.loadingMunicipality} />
            )}
          </>
        )}
      </nav>

      <p className="text-sm">
        {!municipality ? f.hintProvince : municipalityStatus === 'error' ? f.errorMunicipality : selection.length ? f.hintMore : f.hint}
      </p>
      {notice && (
        <p role="status" className={`rounded-lg px-2 py-1.5 text-xs ${notice.kind === 'blocked' ? 'bg-red-500/25 ring-1 ring-red-300/50' : 'bg-amber-400/20 ring-1 ring-amber-300/50'}`}>
          ⚠ {notice.text}
        </p>
      )}
      {municipality && <Legend />}
      {municipality && <p className="text-xs text-white/70">{f.candidateHint}</p>}
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
                  <span className="block text-[11px] text-white/60">{municipalityName(s.properties.mun)}</span>
                </span>
                {s.properties.apt && (
                  <span className="rounded bg-amber-400/25 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100" title={f.apt[s.properties.apt]}>
                    ⚠ {f.aptShort[s.properties.apt]}
                  </span>
                )}
                {indicators?.byPid[s.properties.pid] && (
                  <span className="rounded bg-field px-1.5 py-0.5 text-[10px] font-semibold text-ink">{f.candidate}</span>
                )}
                <span className="tabular-nums text-white/80">{t.map.area(s.properties.ha)}</span>
                <button onClick={() => { toggle(s); setNotice(null) }} aria-label={f.remove(s.properties.pol, s.properties.par)} className="rounded px-1 text-white/70 hover:bg-white/20 hover:text-white">
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
