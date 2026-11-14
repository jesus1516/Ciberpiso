import { useState } from 'react'
import { t } from '../i18n'
import type { Candidate, Confidence, ProfileKey, Rotation, RotationKey } from '../lib/indicators'

const ORDER: RotationKey[] = ['R0', 'R1', 'R2', 'R3']
const PROFILES: ProfileKey[] = ['water_first', 'soil_first', 'profit_first']
const COLORS: Record<RotationKey, string> = {
  R0: '#2a78d6',
  R1: '#1baf7a',
  R2: '#eb6834',
  R3: '#7c5cbf',
}
const LEVEL_CLASS: Record<Confidence, string> = {
  low: 'bg-red-100 text-red-900',
  medium: 'bg-amber-100 text-amber-900',
  high: 'bg-green-100 text-green-900',
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h5 className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">{title}</h5>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  )
}

function ScoreBar({ label, value, color, note }: { label: string; value: number | null; color: string; note?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 truncate">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
        <span className="block h-full rounded-full" style={{ width: `${value ?? 0}%`, background: color }} />
      </span>
      <span className="w-8 text-right font-semibold tabular-nums">{value ?? '—'}</span>
      {note && <span className="hidden text-[10px] text-muted sm:inline">{note}</span>}
    </div>
  )
}

function RotationCard({ rid, rotation, profile }: { rid: RotationKey; rotation: Rotation; profile: ProfileKey }) {
  const ranking = rotation.rankings[profile]
  const score = ranking.final_score ?? ranking.partial_score
  const color = COLORS[rid]
  const winner = ranking.rank === 1

  return (
    <article className="flex flex-col gap-3 rounded-xl border-2 bg-white p-3" style={{ borderColor: color }}>
      <header className="flex items-start gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: color }} aria-hidden>
          {ranking.rank ? t.real.rank(ranking.rank) : t.real.noRank}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">{rid}. {rotation.name}</h3>
          <p className="mt-0.5 text-[11px] text-muted">{rotation.crops.join(' · ')}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold leading-none tabular-nums">{score ?? '—'}</p>
          <p className="text-[10px] text-muted">{t.real.score}</p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
        {winner && <span className="rounded-full bg-field px-2 py-0.5 text-[10px] font-semibold text-ink">{t.real.winner}</span>}
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${LEVEL_CLASS[rotation.confidence]}`}>
          {t.real.confidence}: {t.real.levels[rotation.confidence]}
        </span>
        {ranking.partial && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-ink-2">{t.real.partial}</span>}
      </div>

      <div className="space-y-1">
        <ScoreBar label={t.real.scores.water} value={rotation.water} color={color} note={`P20 ${rotation.water_p20}`} />
        <ScoreBar label={t.real.scores.soil} value={rotation.soil} color={color} />
        <ScoreBar label={t.real.scores.profit} value={rotation.profit} color={color} note={rotation.profit === null ? t.real.noProfit : rotation.market.price_source} />
        <ScoreBar label={t.real.scores.risk} value={rotation.risk} color={color} />
      </div>

      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">{t.real.sections.why}</h4>
        <p className="mt-1 text-xs leading-relaxed">{rotation.why}</p>
      </section>

      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">{t.real.sections.evidence}</h4>
        <ul className="mt-1 space-y-1.5 text-xs">
          {rotation.evidence.map((e, i) => (
            <li key={`${e.source}-${i}`} className="rounded bg-neutral-50 p-1.5">
              <span className="font-semibold">{e.source}</span>
              {e.date && <span className="text-muted"> · {e.date}</span>}
              {e.value && <span className="mt-0.5 block">{e.value}</span>}
              {e.note && <span className="mt-0.5 block text-muted">{e.note}</span>}
              {e.url && (
                <a href={e.url} target="_blank" rel="noreferrer" className="mt-0.5 inline-block text-brand underline">
                  {t.real.source} ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>

      <List title={t.real.sections.benefits} items={rotation.benefits} />
      <List title={t.real.sections.gaps} items={rotation.data_gaps} />
      <List title={t.real.sections.risks} items={rotation.review_risks} />

      <details className="rounded-lg border border-line bg-neutral-50 p-2">
        <summary className="cursor-pointer text-xs font-semibold">{t.real.sections.indicators}</summary>
        <dl className="mt-2 space-y-2 text-[11px]">
          {(Object.keys(rotation.indicators) as (keyof Rotation['indicators'])[]).map((key) => {
            const ind = rotation.indicators[key]
            return (
              <div key={key} className="rounded bg-white p-2">
                <dt className="font-semibold">{t.real.scores[key]}</dt>
                <dd className="mt-0.5 text-ink-2">
                  {t.real.value}: {ind.value ?? t.real.noRank} · {t.real.unit}: {ind.unit}
                  <br />
                  {t.real.source}: {ind.source} · {t.real.date}: {ind.date}
                  <br />
                  {t.real.confidence}: {t.real.levels[ind.confidence]} · {t.real.gap}: {ind.gap}
                </dd>
              </div>
            )
          })}
        </dl>
      </details>
    </article>
  )
}

export function RealRotations({ candidate }: { candidate: Candidate }) {
  const [profile, setProfile] = useState<ProfileKey>('water_first')
  const ordered = ORDER
    .map((rid) => ({ rid, rotation: candidate.rotations[rid] }))
    .sort((a, b) => (a.rotation.rankings[profile].rank ?? 99) - (b.rotation.rankings[profile].rank ?? 99))

  return (
    <div className="flex flex-col gap-3">
      <header className="rounded-xl border border-brand/30 bg-blue-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">{t.real.badge}</span>
          <h2 className="font-semibold">{candidate.parcela_id}</h2>
        </div>
        <p className="mt-1 text-xs text-ink-2">{t.real.farm(candidate.parcela_id, candidate.superficie_ha, candidate.rotacion_estimada)}</p>
        <p className="mt-2 text-xs">{t.real.intro}</p>
        <p className="mt-1 text-[11px] text-muted">{t.real.note}</p>
      </header>

      <div role="tablist" aria-label={t.real.profile} className="flex flex-wrap gap-1">
        {PROFILES.map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={profile === key}
            onClick={() => setProfile(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${profile === key ? 'bg-brand text-white' : 'bg-neutral-100 text-ink-2 hover:bg-neutral-200'}`}
          >
            {t.real.profiles[key]}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {ordered.map(({ rid, rotation }) => <RotationCard key={rid} rid={rid} rotation={rotation} profile={profile} />)}
      </div>

      <p className="rounded-lg border border-line bg-white p-2 text-[11px] text-muted">{t.real.footer}</p>
    </div>
  )
}
