export type Market = { score: number; note: string }

const scores: Record<string, number> = {
  wheat: 70, barley: 58, corn: 80, sunflower: 62, chickpea: 66, faba: 55, alfalfa: 68,
  vetch: 30, rye: 25, canola: 72, sorghum: 50, olive: 82, almond: 85,
}

export function mockMarket(cropId: string): Market {
  return { score: scores[cropId] ?? 40, note: 'Demo market suitability index (0–100), not real prices.' }
}
