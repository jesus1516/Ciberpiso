// Content of the "Full data" drawer, in the explorer's look. Four tabs (Farm, Soil, Vegetation,
// Climate); each opens with its key numbers and has at most two charts, so nothing is crammed.
// Data: the farm detail already loaded for the 3D (sel.detail), the climate cell of the project
// (store farmData.common) and the live POWER series (store climate). Colours: tokens.ts only.
import { useId, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { t } from '../i18n'
import { soilTexture, type FarmDetail } from '../lib/detail'
import { useStore } from '../store'
import type { Selection } from './state'
import { ACCENT, CROP_COLORS, NEUTRAL, SOIL_TEXTURE, STATUS } from './tokens'
import './fulldata.css'

const s = t.farm
const c = t.conditions
const COVERS = t.farms.covers

const fmt = (v: number | null | undefined, digits = 1, unit = '') => (v == null ? '—' : `${v.toLocaleString('en', { maximumFractionDigits: digits })}${unit}`)

// Charts on the dark panel.
const AXIS = { tick: { fill: NEUTRAL['n-300'], fontSize: 11 }, axisLine: { stroke: NEUTRAL['n-500'] }, tickLine: false } as const
const GRID = { stroke: NEUTRAL['n-600'], vertical: false } as const
const TIP = {
  contentStyle: { background: NEUTRAL['n-800'], border: `1px solid ${NEUTRAL['n-500']}`, borderRadius: 8, color: NEUTRAL['n-100'], fontSize: 12 },
  labelStyle: { color: NEUTRAL['n-200'] },
  itemStyle: { color: NEUTRAL['n-100'] },
  cursor: { fill: NEUTRAL['n-700'] },
} as const
const RAIN = STATUS.good
const DEFICIT = STATUS.warn
const NDVI = CROP_COLORS.legume
const H = 150

type Tab = 'farm' | 'soil' | 'vegetation' | 'climate'
const TABS: [Tab, string][] = [['farm', 'Farm'], ['soil', 'Soil'], ['vegetation', 'Vegetation'], ['climate', 'Climate']]

function Tiles({ items }: { items: [React.ReactNode, React.ReactNode, React.ReactNode?][] }) {
  return (
    <dl className="fd-tiles">
      {items.map(([label, value, note], i) => (
        <div key={i} className="fd-tile">
          <dt>{label}</dt>
          <dd>{value}</dd>
          {note && <small>{note}</small>}
        </div>
      ))}
    </dl>
  )
}

function Card({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="fd-card">
      <h3>{title}</h3>
      {children}
      {note && <p className="fd-note">{note}</p>}
    </section>
  )
}

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="fd-rows">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Bars({ rows }: { rows: [string, number | null][] }) {
  return (
    <ul className="fd-bars">
      {rows.map(([label, value]) => (
        <li key={label}>
          <span>{label}</span>
          <span className="track" aria-hidden="true"><span style={{ width: `${Math.min(100, value ?? 0)}%` }} /></span>
          <b>{fmt(value, 0, ' %')}</b>
        </li>
      ))}
    </ul>
  )
}

function FarmTab({ sel, d }: { sel: Selection; d: FarmDetail }) {
  const p = sel.farm.properties
  const covers = Object.entries(d.cobertura).filter(([, v]) => (v ?? 0) > 0).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
  return (
    <>
      {p.apt && <p className="fd-warn" role="note"><b>Warning</b> {s.aptWarning(t.farms.apt[p.apt] ?? p.apt)}</p>}
      <Tiles items={[[s.area, fmt(p.ha, 1, ' ha')], [s.plots, d.recintos], [s.altitude, fmt(d.altitud_m, 0, ' m')], [s.slope, fmt(d.pendiente_pct, 1, ' %')]]} />
      <Card title={s.recordTitle} note={s.recordNote}>
        <Rows
          rows={[
            [s.parcel, p.pid],
            [s.municipality, sel.municipality],
            ['Project candidate', p.cand ? 'Yes' : 'No'],
            ['Dominant cover', d.cobertura_dominante ? (COVERS[d.cobertura_dominante] ?? d.cobertura_dominante) : '—'],
            ['Estimated pattern', d.rotacion_estimada ?? '—'],
          ]}
        />
      </Card>
      <Card title={s.coverTitle} note="ESA WorldCover (10 m), share of the farm.">
        <Bars rows={covers.map(([k, v]) => [COVERS[k] ?? k, v])} />
      </Card>
    </>
  )
}

function SoilTab({ d }: { d: FarmDetail }) {
  const so = d.suelo
  if (!so) return <p className="fd-empty">{s.noSoil}</p>
  const texture = soilTexture(so)
  const parts: [string, number | null, string][] = [[s.sand, so.arena_pct, SOIL_TEXTURE.sand], [s.silt, so.limo_pct, SOIL_TEXTURE.silt], [s.clay, so.arcilla_pct, SOIL_TEXTURE.clay]]
  return (
    <>
      <Card title={`${s.texture}: ${texture ? s.soils[texture] : '—'}`}>
        <div className="fd-stack" aria-hidden="true">
          {parts.map(([k, v, col]) => <span key={k} style={{ width: `${v ?? 0}%`, background: col }} />)}
        </div>
        <ul className="fd-legend">
          {parts.map(([k, v, col]) => <li key={k}><i style={{ background: col }} aria-hidden="true" />{k} <b>{fmt(v, 0, ' %')}</b></li>)}
        </ul>
      </Card>
      <Tiles
        items={[
          [s.organicCarbon, fmt(so.cos_gkg, 1, ' g/kg')],
          [s.ph, fmt(so.ph_h2o, 1)],
          [s.nitrogen, fmt(so.nitrogeno_gkg, 2, ' g/kg')],
          [s.cec, fmt(so.cic_cmolkg, 1, ' cmol/kg')],
          [s.water, fmt(so.cad_0_100_mm, 0, ' mm')],
          [s.stones, fmt(so.gruesos_pct, 0, ' %')],
        ]}
      />
      <p className="fd-note">{s.soilNote}{so.pct_superficie_con_dato != null ? ` Data covers ${fmt(so.pct_superficie_con_dato, 0)} % of the farm.` : ''}</p>
    </>
  )
}

function VegetationTab({ d }: { d: FarmDetail }) {
  const series = d.ndvi.filter(([, v]) => v !== null).map(([date, ndvi]) => ({ date, ndvi }))
  const feno = d.fenologia
  const k = d.campanas
  return (
    <>
      <Tiles
        items={[
          ['Summer NDVI peak', fmt(d.ndvi_jun_ago_max, 2), 'June–August, highest value'],
          ['Winter-crop seasons', fmt(k.invierno, 0)],
          ['Summer-crop seasons', fmt(k.verano, 0)],
          ['Fallow seasons', fmt(k.barbecho, 0)],
        ]}
      />
      {feno.length > 0 ? (
        <Card title={s.vegetationTitle} note={s.vegetationNote}>
          <ol className="fd-chips" aria-label={s.observedRotation}>
            {feno.map((f) => <li key={f.campana}><span>{f.campana}</span>{s.classes[f.clase_estimada ?? 'sin_datos'] ?? f.clase_estimada}</li>)}
          </ol>
          {series.length > 0 && (
            <ResponsiveContainer width="100%" height={H}>
              <LineChart data={series} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="date" {...AXIS} tickFormatter={(v: string) => v.slice(0, 4)} minTickGap={40} />
                <YAxis {...AXIS} domain={[0, 1]} />
                <Tooltip {...TIP} formatter={(v) => [v, 'NDVI']} />
                <Line dataKey="ndvi" stroke={NDVI} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      ) : (
        <p className="fd-empty">{s.noVegetation(d.rotacion_estimada)}</p>
      )}
    </>
  )
}

function ClimateTab({ d }: { d: FarmDetail }) {
  const common = useStore((st) => st.farmData.common)
  const climate = useStore((st) => st.climate)
  const cell = common?.celdas[d.celda]
  if (!cell) return <p className="fd-empty" role="status">Loading the climate of this farm…</p>
  const r = cell.resumen
  const seasons = cell.campanas.map((x) => ({ ...x, name: String(x.campana) }))
  const last = cell.campanas.at(-1)
  const live = climate.status === 'ready' && climate.data ? climate.data : null
  const months = live?.monthly.map((m) => ({ name: t.months[m.month], balance: Math.round(m.balance * 10) / 10 })) ?? []
  return (
    <>
      <Tiles
        items={[
          [s.meanRain, fmt(r.lluvia_media_mm, 0, ' mm'), s.since(seasons[0]?.campana)],
          [s.dryYear, fmt(r.lluvia_p20_mm, 0, ' mm'), s.dryYearNote(r.campana_mas_seca)],
          [s.deficit, fmt(r.deficit_medio_mm, 0, ' mm'), s.deficitNote],
          ['Hot days May–Jun', fmt(r.dias_calor_may_jun_media, 1), 'Mean per season, ≥ 32 °C'],
          [s.heatDays, fmt(r.dias_calor_jul_ago_media, 1), s.heatDaysNote],
          ['Frost days', fmt(r.dias_helada_media, 1), 'Mean per season'],
          ['Spring soil moisture', last?.gwetroot_mar_may_anomalia == null ? '—' : `${last.gwetroot_mar_may_anomalia >= 0 ? '+' : ''}${fmt(last.gwetroot_mar_may_anomalia, 2)}`, `Anomaly in ${last?.campana ?? '—'}; below 0 = drier spring`],
        ]}
      />
      <Card title={s.rainTitle} note={s.rainNote(r.lat, r.lon)}>
        <ResponsiveContainer width="100%" height={H}>
          <BarChart data={seasons} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="name" {...AXIS} minTickGap={8} />
            <YAxis {...AXIS} />
            <Tooltip {...TIP} />
            <ReferenceLine y={r.lluvia_p20_mm} stroke={ACCENT} strokeDasharray="5 4" />
            <Bar dataKey="lluvia_mm" name={s.rain} fill={RAIN} radius={[3, 3, 0, 0]} maxBarSize={12} />
            <Bar dataKey="deficit_mm" name={s.deficitSeries} fill={DEFICIT} radius={[3, 3, 0, 0]} maxBarSize={12} />
          </BarChart>
        </ResponsiveContainer>
        <ul className="fd-legend">
          <li><i style={{ background: RAIN }} aria-hidden="true" />{s.rain}</li>
          <li><i style={{ background: DEFICIT }} aria-hidden="true" />{s.deficitSeries}</li>
          <li><i className="dash" aria-hidden="true" />{s.dryYear}</li>
        </ul>
      </Card>
      <Card title={c.balanceChart} note={live ? `${c.perDecade(live.rainTrendPerDecade, 'mm')} of rain, ${c.perDecade(live.tempTrendPerDecade, '°C')}. ${c.trendCaution}` : undefined}>
        {live ? (
          <>
            {climate.source === 'sample' && <p className="fd-warn" role="alert"><b>Sample data</b> {c.sampleWarning(climate.place ?? '')}</p>}
            <ResponsiveContainer width="100%" height={H}>
              <BarChart data={months} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" {...AXIS} interval={0} />
                <YAxis {...AXIS} />
                <ReferenceLine y={0} stroke={NEUTRAL['n-300']} />
                <Tooltip {...TIP} formatter={(v) => [`${v} mm`, c.balance]} />
                <Bar dataKey="balance" maxBarSize={18} radius={2}>
                  {months.map((m) => <Cell key={m.name} fill={m.balance >= 0 ? RAIN : DEFICIT} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <ul className="fd-legend">
              <li><i style={{ background: RAIN }} aria-hidden="true" />Rain above ref. ET</li>
              <li><i style={{ background: DEFICIT }} aria-hidden="true" />Below (deficit)</li>
            </ul>
          </>
        ) : (
          <p className="fd-empty" role="status">{c.loading}</p>
        )}
      </Card>
    </>
  )
}

export function FullDataPanel({ sel }: { sel: Selection }) {
  const [tab, setTab] = useState<Tab>('farm')
  const uid = useId()
  const list = useRef<HTMLDivElement>(null)
  const d = sel.detail
  // Arrow keys move between the tabs (WAI-ARIA tabs pattern); Tab goes into the panel.
  const onKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex(([k]) => k === tab)
    const next = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1
    if (next < 0) return
    e.preventDefault()
    setTab(TABS[next][0])
    list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }
  return (
    <div className="fd">
      <div ref={list} className="fd-tabs" role="tablist" aria-label="Data about this farm" onKeyDown={onKey}>
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" id={`${uid}-${k}`} aria-selected={tab === k} aria-controls={`${uid}-panel`} tabIndex={tab === k ? 0 : -1} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="fd-panel" role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-${tab}`}>
        {!d ? (
          <p className="fd-empty">{s.missing}</p>
        ) : tab === 'farm' ? (
          <FarmTab sel={sel} d={d} />
        ) : tab === 'soil' ? (
          <SoilTab d={d} />
        ) : tab === 'vegetation' ? (
          <VegetationTab d={d} />
        ) : (
          <ClimateTab d={d} />
        )}
      </div>
    </div>
  )
}
