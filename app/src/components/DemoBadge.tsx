import { t } from '../i18n'

export function DemoBadge() {
  return (
    <span title={t.demoTitle} className="inline-flex items-center rounded-full border border-dashed border-amber-700 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
      {t.demo}
    </span>
  )
}
