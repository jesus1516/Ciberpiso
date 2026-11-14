import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import { t } from '../i18n'
import { crop } from '../lib/crops'
import type { Strategy } from '../lib/rotations'
import { PRIORITY_KEYS, type Level } from '../lib/scoring'
import { useStore } from '../store'
import { CoverTimeline } from './CoverTimeline'
import { DemoBadge } from './DemoBadge'
import { VulnerabilityStrip } from './VulnerabilityStrip'

const STRATEGY_COLORS = { A: '#2a78d6', B: '#eb6834', C: '#1baf7a' }
const r = t.rotations

const levelClass: Record<Level, string> = {
  low: 'bg-green-100 text-green-900',
  medium: 'bg-amber-100 text-amber-900',
  high: 'bg-red-100 text-red-900',
}

function Uncertainty({ level }: { level: Level }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${levelClass[level]}`}>{r.uncertainty}: {r.levels[level]}</span>
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-2">{title}</h4>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
        {items.map((i) => <li key={i}>{i}</li>)}
      </ul>
    </section>
  )
}

export function RotationCard({ strategy }: { strategy: Strategy }) {
  const priorities = useStore((s) => s.priorities)
  const { analysis: a, id } = strategy
  const color = STRATEGY_COLORS[id]
  const radar = PRIORITY_KEYS.map((k) => ({ criterion: t.priorities.labels[k], score: a.scores[k].score }))

  return (
    <article className="flex flex-col gap-3 rounded-xl border-2 bg-white p-3" style={{ borderColor: color }} aria-labelledby={`strategy-${id}`}>
      <header className="flex items-start gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: color }} aria-hidden>
          {id}
        </span>
        <div className="flex-1">
          <h3 id={`strategy-${id}`} className="font-semibold leading-tight">{id}. {r.names[id]}</h3>
          <ol className="mt-1 flex flex-wrap gap-1 text-[11px]">
            {strategy.years.map((ids, i) => (
              <li key={i} className="rounded bg-neutral-100 px-1.5 py-0.5">
                <span className="text-muted">{r.year(i + 1)}:</span> {ids.length ? ids.map((c) => crop(c).name).join(' + ') : r.fallow}
              </li>
            ))}
          </ol>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold leading-none">{a.total}</p>
          <p className="text-[10px] text-muted">{r.total}</p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Uncertainty level={a.uncertainty} />
        <span className="text-[11px] text-muted">{r.totalNote}</span>
      </div>

      <div className="h-44" role="img" aria-label={radar.map((d) => `${d.criterion} ${d.score}`).join(', ')}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radar} outerRadius="68%">
            <PolarGrid stroke="#e1e0d9" />
            <PolarAngleAxis dataKey="criterion" tick={{ fill: '#52514e', fontSize: 10 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="score" stroke={color} fill={color} fillOpacity={0.25} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-2">{r.scoresTitle}</h4>
        <ul className="mt-1 space-y-1">
          {PRIORITY_KEYS.map((k) => {
            const s = a.scores[k]
            return (
              <li key={k}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm">
                    <span className="w-32 shrink-0 truncate">{t.priorities.labels[k]}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                      <span className="block h-full rounded-full" style={{ width: `${s.score}%`, background: color }} />
                    </span>
                    <span className="w-7 text-right font-semibold tabular-nums">{s.score}</span>
                    <span className="w-14 text-[10px] text-muted">{r.weight(priorities[k])}</span>
                    <span className="text-xs text-muted group-open:rotate-90" aria-hidden>›</span>
                  </summary>
                  <p className="mt-1 rounded bg-neutral-50 p-2 text-xs text-ink-2">
                    {s.reason}
                    {s.demoInputs.length > 0 && <span className="mt-1 block text-amber-900">{r.demoInputs(s.demoInputs.join(', '))}</span>}
                    <span className="mt-1 block"><Uncertainty level={s.uncertainty} /></span>
                  </p>
                </details>
              </li>
            )
          })}
        </ul>
      </section>

      <CoverTimeline coverage={a.coverage} bareMonths={a.bareMonths} />
      <VulnerabilityStrip seasons={a.seasons} />

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-2">{r.sections.why}</h4>
        <p className="mt-1 text-sm">{strategy.why}</p>
      </section>
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-2">{r.sections.evidence}</h4>
        <ul className="mt-1 space-y-1 text-sm">
          {strategy.evidence.map((e) => (
            <li key={e.text}>
              <span className="mr-1 font-semibold">{e.source}</span>
              {e.demo && <DemoBadge />} {e.text}
            </li>
          ))}
        </ul>
      </section>
      <List title={r.sections.benefits} items={strategy.benefits} />
      <List title={r.sections.risks} items={strategy.risks} />
      <List title={r.sections.gaps} items={strategy.gaps} />
    </article>
  )
}
