import { useEffect, useRef } from 'react'
import { t } from '../i18n'
import { useStore } from '../store'
import { DemoBadge } from './DemoBadge'

const a = t.aboutModal

export function AboutModal() {
  const { aboutOpen, setAboutOpen } = useStore()
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (aboutOpen) dialog.current?.showModal()
    else dialog.current?.close()
  }, [aboutOpen])

  return (
    <dialog
      ref={dialog}
      onClose={() => setAboutOpen(false)}
      aria-labelledby="about-title"
      className="m-auto max-h-[85dvh] w-[min(640px,calc(100vw-2rem))] rounded-2xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-3 p-5 text-sm">
        <div className="flex items-start justify-between gap-2">
          <h2 id="about-title" className="text-lg font-semibold">{a.title}</h2>
          <button onClick={() => setAboutOpen(false)} className="rounded-md px-2 py-1 text-ink-2 hover:bg-neutral-100">{a.close}</button>
        </div>
        <p>{a.intro}</p>
        <section>
          <h3 className="font-semibold">{a.real}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">{a.realItems.map((i) => <li key={i}>{i}</li>)}</ul>
        </section>
        <section>
          <h3 className="flex items-center gap-2 font-semibold">{a.demo} <DemoBadge /></h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">{a.demoItems.map((i) => <li key={i}>{i}</li>)}</ul>
          <p className="mt-1 text-ink-2">{a.catalog}</p>
        </section>
        <section>
          <h3 className="font-semibold">{a.ackTitle}</h3>
          <p className="mt-1">{a.ackPower}</p>
          <p className="mt-1">{a.ackGibs}</p>
          <p className="mt-1 text-ink-2">{a.endorsement}</p>
        </section>
        <p className="rounded-lg bg-amber-50 p-2 font-medium text-amber-900">⚠ {t.disclaimer}</p>
      </div>
    </dialog>
  )
}
