import { t } from '../i18n'

export function Disclaimer() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-2 pb-1">
      <p role="note" className="pointer-events-auto rounded-t-md bg-ink/85 px-3 py-1 text-center text-xs font-medium text-white">
        ⚠ {t.disclaimer}
      </p>
    </div>
  )
}
