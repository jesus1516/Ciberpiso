import { useMemo } from 'react'
import { t } from '../i18n'
import { heatStress } from '../lib/climate'
import { CROPS } from '../lib/crops'
import { latestPrice } from '../lib/detalle'
import { fieldCentroid } from '../lib/geo'
import { buildStrategies } from '../lib/rotations'
import { soilFor } from '../lib/soil'
import { useStore } from '../store'
import { CoverLegend } from './CoverTimeline'
import { RealRotations } from './RealRotations'
import { RotationCard } from './RotationCard'

export function RotationsTab() {
  const { climate, field, constraints, priorities, selection, indicators, farmData } = useStore()

  const strategies = useMemo(() => {
    if (!climate.data || !field || farmData.status === 'loading') return null
    const [, lat] = fieldCentroid(field)
    const fincas = selection.map((f) => ({ ha: f.properties.ha, detalle: farmData.byId[f.properties.id] }))
    const ctx = {
      climate: climate.data,
      climateReal: climate.source !== 'sample',
      constraints,
      soil: soilFor(fincas, constraints.soil),
      heat: heatStress(climate.data.monthly),
      prices: Object.fromEntries(CROPS.map((c) => [c.id, latestPrice(farmData.comun?.precios[c.id])?.eurT ?? null])),
      southern: lat < 0,
    }
    return buildStrategies(ctx, priorities)
  }, [climate, field, constraints, priorities, selection, farmData])

  const candidate = selection.length === 1 ? indicators?.byPid[selection[0].properties.pid] : undefined
  if (candidate) return <RealRotations candidate={candidate} />

  if (!strategies) {
    return (
      <div className="flex items-center gap-3 py-8 text-sm text-ink-2" role="status">
        <span className="size-5 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden />
        {t.rotations.waiting}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-2">{t.rotations.intro}</p>
      {climate.source === 'sample' && (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">⚠ {t.conditions.sampleWarning(climate.place ?? '')}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CoverLegend />
        <p className="text-xs text-muted">{t.rotations.uncertaintyNote}</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {strategies.map((s) => <RotationCard key={s.id} strategy={s} />)}
      </div>
      <aside className="rounded-xl border border-brand/40 bg-blue-50 p-3">
        <h3 className="font-semibold text-brand">{t.rotations.humanTitle}</h3>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
          {t.rotations.human.map((h) => <li key={h}>{h}</li>)}
        </ul>
      </aside>
    </div>
  )
}
