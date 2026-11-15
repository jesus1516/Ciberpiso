// Pure helpers of the keyboard lists (AccessList.tsx): entries, accent-insensitive filtering, the farm row.
import type { FarmItem } from './state'
import { APT, fmt } from './texts'

export type ListEntry = { id: string; label: string; detail: string; note?: string; search: string }

/** Options rendered at once. Málaga has up to 36,000 farms in one municipality: the rest is reached by typing. */
export const MAX_OPTIONS = 60

/** Entries whose text contains every word typed (case and accents ignored). */
export function filterEntries(items: ListEntry[], query: string): ListEntry[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  return words.length ? items.filter((i) => words.every((w) => i.search.includes(w))) : items
}
export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export const farmEntry = (f: FarmItem): ListEntry => ({
  id: String(f.id),
  label: `Farm ${f.pol}-${f.par}`,
  detail: `${fmt(f.ha, 1)} ha`,
  note: f.cand ? '★ Project candidate' : f.apt ? `⚠ Indicative: ${APT[f.apt]?.toLowerCase() ?? f.apt}` : undefined,
  search: fold(`farm ${f.pol}-${f.par} ${f.pol} ${f.par} ${f.pid} ${f.ha.toFixed(1)} ${f.cand ? 'candidate' : ''}`),
})

