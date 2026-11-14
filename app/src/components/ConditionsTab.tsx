import { Bar, BarChart, Cell, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { mockHeatStress } from '../data/mock/ecostress'
import { mockSoilMoistureAnomaly } from '../data/mock/smap'
import { t } from '../i18n'
import { fieldCentroid } from '../lib/geo'
import { useStore } from '../store'
import { axis, ChartCard, colors, grid, StatTile } from './ChartCard'
import { SoilCard } from './SoilCard'
import { Term } from './Term'

const H = 150
const fmtDate = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
const r1 = (v: number) => Math.round(v * 10) / 10

export function ConditionsTab() {
  const climate = useStore((s) => s.climate)
  const field = useStore((s) => s.field)

  if (climate.status !== 'ready' || !climate.data || !field) {
    return (
      <div className="flex items-center gap-3 py-8 text-sm text-ink-2" role="status">
        <span className="size-5 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden />
        {t.conditions.loading}
      </div>
    )
  }

  const c = climate.data
  const [lon, lat] = fieldCentroid(field)
  const months = c.monthly.map((m) => ({ ...m, name: t.months[m.month], rain: r1(m.rain), et0: r1(m.et0), balance: r1(m.balance), temp: r1(m.temp), tmin: r1(m.tmin), frostDays: r1(m.frostDays) }))
  const annual = c.annual.map((a) => ({ ...a, rain: Math.round(a.rain), rainTrend: Math.round(a.rainTrend), temp: r1(a.temp), tempTrend: r1(a.tempTrend) }))
  const moisture = mockSoilMoistureAnomaly(lat, lon).map((p) => ({ ...p, name: t.months[p.month] }))
  const heat = mockHeatStress(lat, lon, c.monthly).map((p) => ({ ...p, name: t.months[p.month] }))

  return (
    <div className="flex flex-col gap-3">
      {climate.source === 'sample' && (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">⚠ {t.conditions.sampleWarning(climate.place ?? '')}</p>
      )}
      {climate.source === 'cache' && <p className="text-xs text-muted">{t.conditions.fromCache}</p>}
      <p className="text-xs text-muted">{t.conditions.source(fmtDate(c.firstDate), fmtDate(c.lastDate))}</p>

      <div className="grid grid-cols-2 gap-2">
        <StatTile label={t.conditions.annualRain} value={`${Math.round(c.annualRain)} mm`} />
        <StatTile label={t.conditions.meanTemp} value={`${c.meanTemp.toFixed(1)} °C`} />
        <StatTile label={<Term id="frostRisk">{t.conditions.frostDays}</Term>} value={c.frostDaysYear.toFixed(1)} />
        <StatTile label={t.conditions.rainVariability} value={`± ${Math.round(c.rainStd)} mm`} note={t.conditions.variabilityNote(c.rainCv)} />
      </div>

      <ChartCard title={t.conditions.monthlyRain}>
        <ResponsiveContainer width="100%" height={H}>
          <BarChart data={months} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="name" {...axis} interval={0} />
            <YAxis {...axis} />
            <Tooltip formatter={(v) => [`${v} mm`, t.conditions.rain]} />
            <Bar dataKey="rain" fill={colors.rain} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t.conditions.monthlyTemp}>
        <ResponsiveContainer width="100%" height={H}>
          <LineChart data={months} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="name" {...axis} interval={0} />
            <YAxis {...axis} />
            <Tooltip formatter={(v) => `${v} °C`} />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="temp" name={t.conditions.meanSeries} stroke={colors.temp} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="tmin" name={t.conditions.minSeries} stroke={colors.tmin} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={<Term id="frostRisk">{t.conditions.frostChart}</Term>} note={t.conditions.frostNote}>
        <ResponsiveContainer width="100%" height={H - 20}>
          <BarChart data={months} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="name" {...axis} interval={0} />
            <YAxis {...axis} allowDecimals={false} />
            <Tooltip formatter={(v) => [v, t.conditions.frostDays]} />
            <Bar dataKey="frostDays" fill={colors.tmin} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title={<><Term id="waterBalance">{t.conditions.balanceChart}</Term></>}
        note={<>{t.conditions.balanceNote} <Term id="et">ET</Term></>}
      >
        <ResponsiveContainer width="100%" height={H}>
          <BarChart data={months} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="name" {...axis} interval={0} />
            <YAxis {...axis} />
            <ReferenceLine y={0} stroke="#898781" />
            <Tooltip
              content={({ active, payload }) => {
                const m = active && payload?.[0]?.payload
                if (!m) return null
                return (
                  <div className="rounded border border-line bg-white px-2 py-1 text-xs shadow">
                    <p className="font-semibold">{m.name}</p>
                    <p>{t.conditions.rain}: {m.rain} mm</p>
                    <p>{t.conditions.et0}: {m.et0} mm</p>
                    <p>{t.conditions.balance}: {m.balance} mm</p>
                  </div>
                )
              }}
            />
            <Bar dataKey="balance" maxBarSize={18} radius={2}>
              {months.map((m) => <Cell key={m.month} fill={m.balance >= 0 ? colors.rain : colors.deficit} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t.conditions.trendRain} note={`${t.conditions.perDecade(c.rainTrendPerDecade, 'mm')}. ${t.conditions.trendCaution}`}>
        <ResponsiveContainer width="100%" height={H}>
          <ComposedChart data={annual} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="year" {...axis} />
            <YAxis {...axis} />
            <Tooltip />
            <Bar dataKey="rain" name={t.conditions.rain} fill={colors.rain} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Line dataKey="rainTrend" name={t.conditions.trendLabel} stroke={colors.trend} strokeDasharray="5 4" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t.conditions.trendTemp} note={t.conditions.perDecade(c.tempTrendPerDecade, '°C')}>
        <ResponsiveContainer width="100%" height={H}>
          <LineChart data={annual} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="year" {...axis} />
            <YAxis {...axis} domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(v: number) => v.toFixed(1)} />
            <Tooltip />
            <Line dataKey="temp" name={t.conditions.meanTemp} stroke={colors.temp} strokeWidth={2} dot={{ r: 3 }} />
            <Line dataKey="tempTrend" name={t.conditions.trendLabel} stroke={colors.trend} strokeDasharray="5 4" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={<Term id="soilMoistureAnomaly">{t.conditions.smapChart}</Term>} note={t.conditions.smapNote} demo>
        <ResponsiveContainer width="100%" height={H - 20}>
          <BarChart data={moisture} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="name" {...axis} interval={0} />
            <YAxis {...axis} />
            <ReferenceLine y={0} stroke="#898781" />
            <Tooltip formatter={(v) => [`${v} pp`, t.conditions.anomaly]} />
            <Bar dataKey="anomaly" maxBarSize={18} radius={2}>
              {moisture.map((m) => <Cell key={m.month} fill={m.anomaly >= 0 ? colors.rain : colors.deficit} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t.conditions.heatChart} note={t.conditions.heatNote} demo>
        <ResponsiveContainer width="100%" height={H - 20}>
          <BarChart data={heat} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="name" {...axis} interval={0} />
            <YAxis {...axis} domain={[0, 1]} />
            <Tooltip formatter={(v) => [v, t.conditions.stress]} />
            <Bar dataKey="stress" fill={colors.temp} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <SoilCard />
    </div>
  )
}
