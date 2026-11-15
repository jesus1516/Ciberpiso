import type { RotationScore } from '../lib/calculator'
import type { ProfileKey, RotationKey } from '../lib/indicators'
import { cropInfo } from './scene'
import { SHORT_ROTATION } from './texts'

export const ROTATIONS: RotationKey[] = ['R0', 'R1', 'R2', 'R3']

/** Rows of the table as plain data (also used by the unit test). */
export function tableRows(scores: Record<RotationKey, RotationScore>, profile: ProfileKey) {
  return ROTATIONS.map((k) => {
    const r = scores[k]
    return {
      code: k,
      name: SHORT_ROTATION[k],
      crops: r.crops.map((c) => cropInfo(c).label).join(', '),
      water: r.water,
      soil: r.soil,
      market: r.profit,
      risk: r.risk,
      score: r.score[profile],
      rank: r.rank[profile],
    }
  })
}

