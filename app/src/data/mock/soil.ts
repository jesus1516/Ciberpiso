import { seeded } from './seed'

export type SoilType = 'sandy' | 'loam' | 'clay'

export type SoilProperties = {
  texture: SoilType
  organicMatterPct: number
  drainage: 'excessive' | 'good' | 'moderate' | 'poor'
  waterHoldingMm: number
}

const base: Record<SoilType, Omit<SoilProperties, 'texture'>> = {
  sandy: { organicMatterPct: 0.8, drainage: 'excessive', waterHoldingMm: 70 },
  loam: { organicMatterPct: 1.6, drainage: 'good', waterHoldingMm: 150 },
  clay: { organicMatterPct: 1.9, drainage: 'moderate', waterHoldingMm: 175 },
}

export function mockSoil(lat: number, lon: number, texture: SoilType): SoilProperties {
  const rand = seeded(lat, lon, 3)
  const b = base[texture]
  return {
    texture,
    organicMatterPct: Math.round((b.organicMatterPct + (rand() - 0.5) * 0.8) * 10) / 10,
    drainage: texture === 'clay' && rand() > 0.6 ? 'poor' : b.drainage,
    waterHoldingMm: Math.round(b.waterHoldingMm + (rand() - 0.5) * 30),
  }
}
