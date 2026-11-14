import { t } from '../i18n'
import { daysAgo, GIBS_LAYERS, GIBS_MIN_DATE } from '../lib/gibs'
import { useStore } from '../store'
import { Term } from './Term'

export function LayersTab() {
  const { layers, gibsDate, setLayer, setGibsDate } = useStore()
  const s = t.layers

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-2">{s.intro}</p>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {s.date}
        <input
          type="date"
          value={gibsDate}
          min={GIBS_MIN_DATE}
          max={daysAgo(1)}
          onChange={(e) => e.target.value && setGibsDate(e.target.value)}
          className="w-44 rounded-lg border border-line bg-white px-2 py-1.5"
        />
      </label>

      {GIBS_LAYERS.map((l) => {
        const state = layers[l.id]
        const info = s.items[l.id]
        return (
          <section key={l.id} className="rounded-xl border border-line bg-white p-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={state.visible}
                onChange={(e) => setLayer(l.id, { visible: e.target.checked })}
                className="mt-1 size-4 accent-brand"
              />
              <span className="flex-1">
                <span className="block text-sm font-semibold">{info.name}</span>
                <span className="block text-xs text-ink-2">{info.description}</span>
                <span className="block text-[11px] text-muted">{l.layer} · {l.resolution}</span>
              </span>
            </label>
            {l.id === 'ndvi' && <p className="mt-1 pl-7 text-xs"><Term id="ndvi">NDVI</Term></p>}
            {l.id === 'smap' && <p className="mt-1 pl-7 text-xs"><Term id="soilMoistureAnomaly">{s.moistureHelp}</Term></p>}
            <label className="mt-2 flex items-center gap-3 pl-7 text-xs text-ink-2">
              {s.opacity}
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={state.opacity}
                disabled={!state.visible}
                onChange={(e) => setLayer(l.id, { opacity: Number(e.target.value) })}
                className="flex-1 accent-brand disabled:opacity-40"
              />
              <span className="w-9 text-right tabular-nums">{Math.round(state.opacity * 100)}%</span>
            </label>
            {state.visible && <img src={l.legend} alt={s.legend(info.name)} className="mt-2 w-full max-w-xs pl-7" loading="lazy" />}
            {state.visible && state.error && (
              <p role="alert" className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">⚠ {s.error}</p>
            )}
          </section>
        )
      })}
      <p className="text-xs text-muted">{s.note}</p>
    </div>
  )
}
