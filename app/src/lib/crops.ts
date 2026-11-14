import catalog from '../data/crops.json'

export type Crop = (typeof catalog)[number]

export const CROPS: Crop[] = catalog

const byId = new Map(CROPS.map((c) => [c.id, c]))
export const crop = (id: string) => byId.get(id)!

export function cropMonths(c: Crop, southern: boolean) {
  return c.months.map((m) => (southern ? ((m + 5) % 12) : m - 1))
}
