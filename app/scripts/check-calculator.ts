// Comprueba que lib/calculator.ts reproduce las notas del pipeline en las 26 candidatas.
// Uso (Node 24): node scripts/check-calculator.ts
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { calculateScores, scenarioFor } from '../src/lib/calculator.ts'

const data = (p: string) => new URL(`../public/data/${p}`, import.meta.url)
const comun = JSON.parse(readFileSync(data('comun_29.json'), 'utf8'))
const detalle = JSON.parse(gunzipSync(readFileSync(data('detalle/29015.json.gz'))).toString())
const indicators = JSON.parse(readFileSync(data('indicators_antequera.json'), 'utf8'))

let diffs = 0
let checked = 0
for (const c of indicators.candidates) {
  const scenario = scenarioFor(detalle[c.finca_key], comun)
  if (!scenario) { console.log('sin escenario', c.finca_key); diffs++; continue }
  const ours = calculateScores(scenario)
  for (const [rid, r] of Object.entries<any>(c.rotations)) {
    const o = ours[rid as keyof typeof ours]
    for (const k of ['water', 'water_p20', 'soil', 'profit', 'risk'] as const) {
      const mine = k === 'water_p20' ? o.waterP20 : o[k]
      checked++
      if (Math.abs((mine ?? NaN) - r[k]) > 0.05) { diffs++; console.log(c.finca_key, rid, k, 'pipeline', r[k], 'app', mine) }
    }
    for (const p of ['water_first', 'soil_first', 'profit_first'] as const) {
      checked += 2
      if (Math.abs((o.score[p] ?? NaN) - r.rankings[p].final_score) > 0.05) { diffs++; console.log(c.finca_key, rid, p, 'final', r.rankings[p].final_score, o.score[p]) }
      if (o.rank[p] !== r.rankings[p].rank) { diffs++; console.log(c.finca_key, rid, p, 'rank', r.rankings[p].rank, o.rank[p]) }
    }
  }
}
console.log(`${checked} valores comparados, ${diffs} diferencias`)
process.exit(diffs ? 1 : 0)
