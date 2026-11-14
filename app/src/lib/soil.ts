import type { FincaDetalle } from './detalle'

export type SoilType = 'sandy' | 'loam' | 'clay'

export type SoilProperties = {
  texture: SoilType
  organicMatterPct: number
  waterHoldingMm: number
  fromData: boolean
}

const DEFAULTS: Record<SoilType, { organicMatterPct: number; waterHoldingMm: number }> = {
  sandy: { organicMatterPct: 0.8, waterHoldingMm: 70 },
  loam: { organicMatterPct: 1.6, waterHoldingMm: 150 },
  clay: { organicMatterPct: 1.9, waterHoldingMm: 175 },
}

// SoilGrids gives soil organic carbon (g/kg); organic matter ≈ 1.724 × carbon (Van Bemmelen factor).
const SOC_TO_SOM = 1.724

export function soilFor(fincas: { ha: number; detalle?: FincaDetalle }[], texture: SoilType): SoilProperties {
  const withSoil = fincas.filter((f) => f.detalle?.suelo?.cos_gkg != null && f.detalle?.suelo?.cad_0_100_mm != null)
  const ha = withSoil.reduce((s, f) => s + f.ha, 0)
  if (!ha) return { texture, ...DEFAULTS[texture], fromData: false }
  const avg = (get: (f: (typeof withSoil)[number]) => number) => withSoil.reduce((s, f) => s + get(f) * f.ha, 0) / ha
  return {
    texture,
    organicMatterPct: Math.round(avg((f) => f.detalle!.suelo!.cos_gkg! / 10) * SOC_TO_SOM * 10) / 10,
    waterHoldingMm: Math.round(avg((f) => f.detalle!.suelo!.cad_0_100_mm!)),
    fromData: true,
  }
}
