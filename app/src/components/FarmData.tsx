import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { t } from '../i18n'
import { axis, colors, grid } from '../lib/chartStyle'
import { soilTexture, type FarmDetail } from '../lib/detail'
import { getMunicipality } from '../lib/farms'
import { useStore } from '../store'
import { ChartCard, StatTile } from './ChartCard'
import { Term } from './Term'

const s = t.farm
const H = 150
const fmt = (v: number | null | undefined, digits = 1, unit = '') => (v == null ? '—' : `${v.toLocaleString('en', { maximumFractionDigits: digits })}${unit}`)

function BarList({ rows }: { rows: [string, number | null][] }) {
  return (
    <ul className="space-y-1 text-xs">
      {rows.map(([label, value]) => (
        <li key={label} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2">
          <span className="text-ink-2">{label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-neutral-100">
            <span className="block h-full rounded-full" style={{ width: `${value ?? 0}%`, background: colors.rain }} />
          </span>
          <span className="text-right tabular-nums">{fmt(value, 0, ' %')}</span>
        </li>
      ))}
    </ul>
  )
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-2">{k}</dt>
          <dd className="font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Vegetation({ d }: { d: FarmDetail }) {
  const series = d.ndvi.filter(([, v]) => v !== null).map(([date, ndvi]) => ({ date, ndvi }))
  const feno = d.fenologia.map((f) => ({ ...f, name: String(f.campana) }))
  return (
    <ChartCard title={<Term id="ndvi">{s.vegetationTitle}</Term>} note={s.vegetationNote}>
      {feno.length > 0 ? (
        <>
          <ol className="mb-2 flex flex-wrap gap-1 text-[11px]" aria-label={s.observedRotation}>
            {feno.map((f) => (
              <li key={f.campana} className="rounded bg-neutral-100 px-1.5 py-0.5">
                <span className="text-muted">{f.campana}:</span> {s.classes[f.clase_estimada ?? 'sin_datos'] ?? f.clase_estimada}
              </li>
            ))}
          </ol>
          {series.length > 0 ? (
            <ResponsiveContainer width="100%" height={H}>
              <LineChart data={series} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="date" {...axis} tickFormatter={(v: string) => v.slice(0, 4)} minTickGap={40} />
                <YAxis {...axis} domain={[0, 1]} />
                <Tooltip formatter={(v) => [v, 'NDVI']} />
                <Line dataKey="ndvi" stroke={colors.ndvi} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={H}>
              <BarChart data={feno} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="name" {...axis} />
                <YAxis {...axis} domain={[0, 1]} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span className="text-ink-2">{v}</span>} />
                <Bar dataKey="ndvi_max" name={s.ndviMax} fill={colors.ndvi} radius={[4, 4, 0, 0]} maxBarSize={16} />
                <Bar dataKey="ndvi_media" name={s.ndviMean} fill={colors.tmin} radius={[4, 4, 0, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-2">{s.noVegetation(d.rotacion_estimada)}</p>
      )}
    </ChartCard>
  )
}

export function FarmData() {
  const selection = useStore((st) => st.selection)
  const farmData = useStore((st) => st.farmData)
  const [chosen, setChosen] = useState<number | null>(null)

  if (farmData.status === 'loading' || farmData.status === 'idle') {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-2" role="status">
        <span className="size-4 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden />
        {s.loading}
      </p>
    )
  }
  if (farmData.status === 'error') return <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">⚠ {s.error}</p>

  const farm = selection.find((f) => f.properties.id === chosen) ?? selection[0]
  if (!farm) return null
  const p = farm.properties
  const d = farmData.byId[p.id]
  if (!d) return <p className="text-sm text-ink-2">{s.missing}</p>
  const cell = farmData.common?.celdas[d.celda]
  const campanas = cell?.campanas.map((c) => ({ ...c, name: String(c.campana) })) ?? []
  const suelo = d.suelo
  const texture = soilTexture(suelo)

  return (
    <section className="flex flex-col gap-3" aria-label={s.title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{s.title}</h3>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-brand">{s.badge}</span>
      </div>
      {selection.length > 1 && (
        <label className="flex items-center gap-2 text-sm">
          {s.chooseFarm}
          <select value={p.id} onChange={(e) => setChosen(Number(e.target.value))} className="flex-1 rounded-lg border border-line bg-white px-2 py-1.5">
            {selection.map((f) => (
              <option key={f.properties.id} value={f.properties.id}>
                {t.farms.name(f.properties.pol, f.properties.par)} · {t.map.area(f.properties.ha)}
              </option>
            ))}
          </select>
        </label>
      )}

      {p.apt && (
        <p role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
          ⚠ {s.aptWarning(t.farms.apt[p.apt] ?? p.apt)}
        </p>
      )}

      <ChartCard title={s.recordTitle} note={s.recordNote}>
        <Rows
          rows={[
            [s.parcel, p.pid],
            [s.municipality, getMunicipality(p.mun)?.properties.nombre ?? String(p.mun)],
            [s.area, t.map.area(p.ha)],
            [s.plots, String(d.recintos)],
            [s.altitude, fmt(d.altitud_m, 0, ' m')],
            [s.slope, fmt(d.pendiente_pct, 1, ' %')],
          ]}
        />
        <h4 className="mb-1 mt-3 text-xs font-semibold text-ink-2">{s.coverTitle}</h4>
        <BarList rows={Object.entries(d.cobertura).filter(([, v]) => (v ?? 0) > 0).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).map(([k, v]) => [t.farms.covers[k] ?? k, v])} />
      </ChartCard>

      <Vegetation d={d} />

      <ChartCard title={s.soilTitle} note={s.soilNote}>
        {suelo ? (
          <>
            <BarList rows={[[s.sand, suelo.arena_pct], [s.silt, suelo.limo_pct], [s.clay, suelo.arcilla_pct]]} />
            <div className="mt-3">
              <Rows
                rows={[
                  [s.texture, texture ? t.priorities.soils[texture] : '—'],
                  [s.organicCarbon, fmt(suelo.cos_gkg, 1, ' g/kg')],
                  [s.ph, fmt(suelo.ph_h2o, 1)],
                  [s.nitrogen, fmt(suelo.nitrogeno_gkg, 2, ' g/kg')],
                  [s.cec, fmt(suelo.cic_cmolkg, 1, ' cmol/kg')],
                  [s.water, fmt(suelo.cad_0_100_mm, 0, ' mm')],
                  [s.stones, fmt(suelo.gruesos_pct, 0, ' %')],
                ]}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-2">{s.noSoil}</p>
        )}
      </ChartCard>

      {cell && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatTile label={s.meanRain} value={fmt(cell.resumen.lluvia_media_mm, 0, ' mm')} note={s.since(campanas[0]?.campana)} />
            <StatTile label={s.dryYear} value={fmt(cell.resumen.lluvia_p20_mm, 0, ' mm')} note={s.dryYearNote(cell.resumen.campana_mas_seca)} />
            <StatTile label={<Term id="waterBalance">{s.deficit}</Term>} value={fmt(cell.resumen.deficit_medio_mm, 0, ' mm')} note={s.deficitNote} />
            <StatTile label={s.heatDays} value={fmt(cell.resumen.dias_calor_jul_ago_media, 1)} note={s.heatDaysNote} />
          </div>
          <ChartCard title={s.rainTitle} note={s.rainNote(cell.resumen.lat, cell.resumen.lon)}>
            <ResponsiveContainer width="100%" height={H}>
              <BarChart data={campanas} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="name" {...axis} minTickGap={8} />
                <YAxis {...axis} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span className="text-ink-2">{v}</span>} />
                <ReferenceLine y={cell.resumen.lluvia_p20_mm} stroke={colors.trend} strokeDasharray="5 4" />
                <Bar dataKey="lluvia_mm" name={s.rain} fill={colors.rain} radius={[3, 3, 0, 0]} maxBarSize={12} />
                <Bar dataKey="deficit_mm" name={s.deficitSeries} fill={colors.deficit} radius={[3, 3, 0, 0]} maxBarSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title={<Term id="soilMoistureAnomaly">{s.moistureTitle}</Term>} note={s.moistureNote}>
            <ResponsiveContainer width="100%" height={H - 20}>
              <BarChart data={campanas} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="name" {...axis} minTickGap={8} />
                <YAxis {...axis} />
                <ReferenceLine y={0} stroke="#898781" />
                <Tooltip formatter={(v) => [v, s.anomaly]} />
                <Bar dataKey="gwetroot_mar_may_anomalia" maxBarSize={12} radius={2}>
                  {campanas.map((c) => <Cell key={c.campana} fill={(c.gwetroot_mar_may_anomalia ?? 0) >= 0 ? colors.rain : colors.deficit} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}
    </section>
  )
}
