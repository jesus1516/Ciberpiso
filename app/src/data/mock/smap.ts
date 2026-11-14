import { seeded } from './seed'

export type MoisturePoint = { month: number; anomaly: number }

export function mockSoilMoistureAnomaly(lat: number, lon: number): MoisturePoint[] {
  const rand = seeded(lat, lon, 1)
  const now = new Date().getMonth()
  let value = (rand() - 0.5) * 6
  return Array.from({ length: 12 }, (_, i) => {
    value = Math.max(-8, Math.min(8, value * 0.6 + (rand() - 0.5) * 7))
    return { month: (now + i + 1) % 12, anomaly: Math.round(value * 10) / 10 }
  })
}
