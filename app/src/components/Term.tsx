import { useId, type ReactNode } from 'react'
import { t } from '../i18n'

export type TermId = keyof typeof t.glossary

export function Term({ id, children }: { id: TermId; children: ReactNode }) {
  const tipId = useId()
  return (
    <span className="group relative inline-block">
      <button type="button" aria-describedby={tipId} className="cursor-help underline decoration-dotted decoration-1 underline-offset-2 focus:outline-2 focus:outline-brand">
        {children}
      </button>
      <span
        role="tooltip"
        id={tipId}
        className="invisible absolute left-0 top-full z-50 mt-1 w-60 rounded-md bg-ink px-2.5 py-2 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {t.glossary[id]}
      </span>
    </span>
  )
}
