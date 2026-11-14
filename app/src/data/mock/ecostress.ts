import type { Monthly } from '../../lib/climate'
import { seeded } from './seed'

export type HeatPoint = { month: number; stress: number }

export function mockHeatStress(lat: number, lon: number, monthly: Monthly[]): HeatPoint[] {
  const rand = seeded(lat, lon, 2)
  return monthly.map((m) => {
    const raw = (m.temp - 14) / 18 + -m.balance / 450 + (rand() - 0.5) * 0.15
    return { month: m.month, stress: Math.round(Math.max(0, Math.min(1, raw)) * 100) / 100 }
  })
}
