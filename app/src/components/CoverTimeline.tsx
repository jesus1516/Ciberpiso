import { t } from '../i18n'

const FULL = '#008300'
const SOME = '#9fd39f'
const BARE = '#a0703c'

const colorFor = (v: number) => (v >= 0.99 ? FULL : v <= 0.01 ? BARE : SOME)
const labelFor = (v: number) => (v >= 0.99 ? t.rotations.cover.full : v <= 0.01 ? t.rotations.cover.bare : t.rotations.cover.some)

export function CoverTimeline({ coverage, bareMonths }: { coverage: number[]; bareMonths: number }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-ink-2">{t.rotations.bareTitle}</h4>
      <ol className="mt-1 grid grid-cols-12 gap-0.5">
        {coverage.map((v, m) => (
          <li key={m} className="flex flex-col items-center gap-0.5" title={`${t.months[m]}: ${labelFor(v)}`}>
            <span className="h-5 w-full rounded-sm" style={{ background: colorFor(v) }} aria-hidden />
            <span className="text-[10px] text-muted">{t.months[m][0]}</span>
            <span className="sr-only">{`${t.months[m]}: ${labelFor(v)}`}</span>
          </li>
        ))}
      </ol>
      <p className="mt-1 text-[11px] text-ink-2">{t.rotations.bareNote(bareMonths)}</p>
    </div>
  )
}

export function CoverLegend() {
  return (
    <ul className="flex flex-wrap gap-3 text-xs text-ink-2">
      {[FULL, SOME, BARE].map((c, i) => (
        <li key={c} className="flex items-center gap-1">
          <span className="size-3 rounded-sm" style={{ background: c }} aria-hidden />
          {[t.rotations.cover.full, t.rotations.cover.some, t.rotations.cover.bare][i]}
        </li>
      ))}
    </ul>
  )
}
