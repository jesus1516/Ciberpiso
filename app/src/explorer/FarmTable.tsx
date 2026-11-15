// Data table alternative to the 3D terrain: the indicators of every rotation for this farm, in a
// real <table> that screen readers can navigate cell by cell. Shown over the terrain on request,
// and always when the 3D is switched off.
import type { RotationScore } from '../lib/calculator'
import type { ProfileKey, RotationKey } from '../lib/indicators'
import { cropInfo } from './scene'
import type { Selection } from './state'
import { PROFILES, SHORT_ROTATION, fmt } from './texts'

const ROTATIONS: RotationKey[] = ['R0', 'R1', 'R2', 'R3']

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

export function FarmTable({ sel, profile, rotation, onPick }: {
  sel: Selection; profile: ProfileKey; rotation: RotationKey; onPick?: (r: RotationKey) => void
}) {
  const p = sel.farm.properties
  const profileName = PROFILES.find(([k]) => k === profile)?.[1] ?? profile
  const rows = sel.scores ? tableRows(sel.scores, profile) : []
  return (
    <section className="fx-table glass" aria-labelledby="fx-table-title">
      <h2 id="fx-table-title">Data table: indicators per rotation</h2>
      <p className="meta">
        Farm {p.pol}-{p.par} · {fmt(p.ha, 1)} ha · {sel.municipality} · altitude {fmt(p.alt)} m · slope {fmt(p.slope, 1)} %
      </p>
      {rows.length === 0 ? (
        <p>This farm has no climate and soil data in the project CSVs, so its rotations cannot be scored.</p>
      ) : (
        <div className="scroll" tabIndex={0} role="region" aria-label="Table of indicators per rotation (scrolls sideways on small screens)">
          <table>
            <caption>Scores from 0 to 100 for each rotation. The final score and the rank use the priority “{profileName}”. Higher is better, also for climate risk.</caption>
            <thead>
              <tr>
                <th scope="col">Rotation</th>
                <th scope="col">Crops</th>
                <th scope="col">Water</th>
                <th scope="col">Soil</th>
                <th scope="col">Market</th>
                <th scope="col">Climate risk</th>
                <th scope="col">Final score</th>
                <th scope="col">Rank</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} aria-current={r.code === rotation ? 'true' : undefined} className={r.code === rotation ? 'cur' : undefined}>
                  <th scope="row">
                    {onPick ? <button type="button" onClick={() => onPick(r.code)} aria-label={`Show rotation ${r.code}, ${r.name}`}>{r.code} {r.name}</button> : <>{r.code} {r.name}</>}
                    {r.code === rotation && <span className="vh"> (shown)</span>}
                  </th>
                  <td>{r.crops}</td>
                  <td>{fmt(r.water, 1)}</td>
                  <td>{fmt(r.soil, 1)}</td>
                  <td>{fmt(r.market, 1)}</td>
                  <td>{fmt(r.risk, 1)}</td>
                  <td><strong>{fmt(r.score, 1)}</strong></td>
                  <td>{r.rank === null ? '—' : r.rank === 1 ? '1 ★ best' : r.rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
