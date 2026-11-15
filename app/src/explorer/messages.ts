// What assistive technology is told: the level announcement and the summary of the map region.
import type { Level } from './state'
import { fmt } from './texts'

/** What a screen reader hears when a level is ready (the visible text is in the narrative). */
export function levelMessage(level: Level, o: { municipality: string; farms: number | null; farm: string; ha: number; maxLevelName?: string; municipalities: number; flat: boolean }) {
  if (level === 0) return 'Step 1 of 4: Andalucía. Choose a province from the list or on the map. The full tour is available for Málaga. Escape goes back.'
  if (level === 1) return `Step 2 of 4: Málaga, ${fmt(o.municipalities)} municipalities. Choose a municipality from the list or on the map. Escape goes back to Andalucía.`
  if (level === 2) return `Step 3 of 4: ${o.municipality}. ${o.farms === null ? 'Loading its farms.' : `${fmt(o.farms)} farms.`} Choose a farm from the list or on the map. Escape goes back to Málaga.`
  return `Step 4 of 4: ${o.farm}, ${fmt(o.ha, 1)} hectares in ${o.municipality}. The key points and the four indicators follow. ${o.flat ? 'The data table replaces the 3D terrain. ' : ''}Escape goes back to the municipality.`
}
/** Summary of the map region for assistive technology. */
export function mapSummary(level: Level, o: { municipality: string; farms: number | null; municipalities: number; flat: boolean }) {
  const how = 'The list next to it offers the same choices as clicking the map.'
  if (level === 0) return `Map of Andalucía with its 8 provinces. Málaga is the only province with the full tour. ${how}`
  if (level === 1) return `Map of the province of Málaga with ${fmt(o.municipalities)} municipalities, shaded by their share of cropland. ${how}`
  if (level === 2) return `Map of ${o.municipality}${o.farms === null ? '' : ` with ${fmt(o.farms)} farms`}. Project candidates are starred; urban, water and public-domain farms cannot be opened. ${how} With the map focused, arrow keys pan and plus and minus zoom.`
  return o.flat ? 'Flat satellite map of the selected farm. The data table and the farm column describe it.' : 'Map hidden behind the 3D terrain of the selected farm. The data table and the farm column describe it.'
}

