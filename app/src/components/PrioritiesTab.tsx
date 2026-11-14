import { t } from '../i18n'
import { CROPS, crop } from '../lib/crops'
import { PRIORITY_KEYS } from '../lib/scoring'
import { useStore, type Irrigation, type SlopeClass } from '../store'
import { observedCrop, soilTexture } from '../lib/detail'
import type { SoilType } from '../lib/soil'

const select = 'w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm'
const p = t.priorities

export function PrioritiesTab() {
  const { priorities, constraints, setPriority, setConstraints, selection, farmData } = useStore()
  const largest = [...selection].sort((a, b) => b.properties.ha - a.properties.ha)[0]
  const detail = largest ? farmData.byId[largest.properties.id] : undefined
  const texture = soilTexture(detail?.suelo ?? null)
  const observed = observedCrop(detail)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-2">{p.intro}</p>

      <fieldset className="rounded-xl border border-line bg-white p-3">
        <legend className="px-1 text-sm font-semibold">{p.heading}</legend>
        {PRIORITY_KEYS.map((key) => (
          <label key={key} className="mt-2 flex items-center gap-3 text-sm">
            <span className="w-40 shrink-0">{p.labels[key]}</span>
            <input
              type="range"
              min={0}
              max={5}
              step={1}
              value={priorities[key]}
              onChange={(e) => setPriority(key, Number(e.target.value))}
              className="flex-1 accent-brand"
            />
            <span className="w-4 text-right font-semibold tabular-nums">{priorities[key]}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="grid gap-3 rounded-xl border border-line bg-white p-3 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">{p.constraints}</legend>
        <div className="text-sm sm:col-span-2">
          <span className="mb-1 block">{p.irrigation}</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={p.irrigation}>
            {(['yes', 'limited', 'no'] as Irrigation[]).map((v) => (
              <label key={v} className={`cursor-pointer rounded-lg border px-3 py-1.5 ${constraints.irrigation === v ? 'border-brand bg-blue-50 font-semibold text-brand' : 'border-line'}`}>
                <input type="radio" name="irrigation" value={v} checked={constraints.irrigation === v} onChange={() => setConstraints({ irrigation: v })} className="sr-only" />
                {p.irrigationOptions[v]}
              </label>
            ))}
          </div>
        </div>
        <label className="text-sm">
          <span className="mb-1 block">{p.currentCrop}</span>
          <select value={constraints.currentCrop} onChange={(e) => setConstraints({ currentCrop: e.target.value })} className={select}>
            {CROPS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {observed && <span className="mt-1 block text-xs text-muted">{p.cropFromData(t.farm.classes[observed.clase], observed.campana, crop(observed.crop).name)}</span>}
        </label>
        <label className="text-sm">
          <span className="mb-1 block">{p.soil}</span>
          <select value={constraints.soil} onChange={(e) => setConstraints({ soil: e.target.value as SoilType })} className={select}>
            {(['sandy', 'loam', 'clay'] as SoilType[]).map((s) => <option key={s} value={s}>{p.soils[s]}</option>)}
          </select>
          {texture && detail?.suelo && (
            <span className="mt-1 block text-xs text-muted">{p.soilFromData(detail.suelo.arcilla_pct ?? 0, detail.suelo.arena_pct ?? 0, p.soils[texture])}</span>
          )}
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block">{p.slope}</span>
          <select value={constraints.slope} onChange={(e) => setConstraints({ slope: e.target.value as SlopeClass })} className={select}>
            {(['flat', 'gentle', 'moderate', 'steep'] as SlopeClass[]).map((s) => <option key={s} value={s}>{p.slopes[s]}</option>)}
          </select>
          <span className="mt-1 block text-xs text-muted">
            {constraints.slopePct !== null ? p.slopeFromRepo(constraints.slopePct) : p.slopeManual}
          </span>
        </label>
      </fieldset>
    </div>
  )
}
