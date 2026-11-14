import { mockSoil } from '../data/mock/soil'
import { t } from '../i18n'
import { fieldCentroid } from '../lib/geo'
import { useStore } from '../store'
import { ChartCard } from './ChartCard'

export function SoilCard() {
  const field = useStore((s) => s.field)
  const texture = useStore((s) => s.constraints.soil)
  if (!field) return null
  const [lon, lat] = fieldCentroid(field)
  const soil = mockSoil(lat, lon, texture)
  const rows: [string, string][] = [
    [t.conditions.texture, t.priorities.soils[soil.texture]],
    [t.conditions.organicMatter, `${soil.organicMatterPct} %`],
    [t.conditions.drainage, t.priorities.drainage[soil.drainage]],
    [t.conditions.waterHolding, `${soil.waterHoldingMm} mm/m`],
  ]
  return (
    <ChartCard title={t.conditions.soilTitle} demo>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-2">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </ChartCard>
  )
}
