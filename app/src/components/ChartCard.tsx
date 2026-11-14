import type { ReactNode } from 'react'
import { DemoBadge } from './DemoBadge'

type Props = { title: ReactNode; note?: ReactNode; demo?: boolean; children: ReactNode }

export function ChartCard({ title, note, demo, children }: Props) {
  return (
    <section className="rounded-xl border border-line bg-white p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {demo && <DemoBadge />}
      </div>
      {children}
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </section>
  )
}

export function StatTile({ label, value, note }: { label: ReactNode; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <p className="text-xs text-ink-2">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      {note && <p className="text-[11px] leading-tight text-muted">{note}</p>}
    </div>
  )
}
