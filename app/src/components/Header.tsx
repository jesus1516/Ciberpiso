import { t } from '../i18n'
import { useStore } from '../store'

export function Header() {
  const setAboutOpen = useStore((s) => s.setAboutOpen)
  return (
    <header className="pointer-events-none absolute left-3 right-3 top-3 z-20 flex items-center gap-2 sm:left-4">
      <div className="pointer-events-auto rounded-lg bg-black/60 px-3 py-1.5 text-white">
        <span className="font-semibold">{t.appName}</span>
        <span className="ml-2 hidden text-sm text-white/80 sm:inline">{t.appTagline}</span>
      </div>
      <button
        onClick={() => setAboutOpen(true)}
        className="pointer-events-auto rounded-lg bg-black/60 px-3 py-1.5 text-sm text-white hover:bg-black/80 focus:outline-2 focus:outline-white"
      >
        {t.about}
      </button>
    </header>
  )
}
