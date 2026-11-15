// Parses what the farmer types in the SIGPAC search into municipalities and parcel references.
//
// A SIGPAC parcel is province:municipality:aggregate:zone:polygon:parcel. In Málaga the aggregate
// and zone are always 0 and (municipality, polygon, parcel) is unique, so these all find a farm:
//   "29:15:0:0:100:1"  full reference
//   "29:15:100:1"      province, municipality, polygon, parcel
//   "15:100:1"         municipality code, polygon, parcel
//   "Antequera 100 1"  municipality name, polygon, parcel
//   "100 1"            polygon and parcel in the municipality on screen
// Any of space : / - . , separates the numbers. A name alone lists the matching municipalities.
import type { MunicipalityInfo } from './state'

export const PROVINCE_CODE = 29

export type Ref = { pol: number; par: number }
export type Suggestion =
  | { kind: 'municipality'; m: MunicipalityInfo }
  | { kind: 'farm'; m: MunicipalityInfo; ref: Ref }
  | { kind: 'hint'; text: string }

export const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

const isNumber = (s: string) => /^\d+$/.test(s)

/** Municipalities whose name matches, those starting with the text first. */
export function matchMunicipalities(name: string, all: MunicipalityInfo[], limit = 6) {
  const q = fold(name)
  if (!q) return []
  const starts = all.filter((m) => fold(m.nombre).startsWith(q))
  const words = all.filter((m) => !starts.includes(m) && fold(m.nombre).split(/[\s-]+/).some((w) => w.startsWith(q)))
  const inside = all.filter((m) => !starts.includes(m) && !words.includes(m) && fold(m.nombre).includes(q))
  return [...starts, ...words, ...inside].slice(0, limit)
}

/**
 * Turns the typed text into suggestions, best first. `here` is the municipality on screen, used
 * when only polygon and parcel are typed.
 */
export function suggest(text: string, all: MunicipalityInfo[], here: MunicipalityInfo | null): Suggestion[] {
  const tokens = text.trim().split(/[\s:/\-.,]+/).filter(Boolean)
  if (tokens.length === 0) return []
  const firstNumber = tokens.findIndex(isNumber)
  const nameTokens = firstNumber === -1 ? tokens : tokens.slice(0, firstNumber)
  const numbers = firstNumber === -1 ? [] : tokens.slice(firstNumber)
  if (!numbers.every(isNumber)) return [{ kind: 'hint', text: 'Type the municipality, then polygon and parcel: Antequera 100 1' }]
  const n = numbers.map(Number)
  const byCode = (code: number) => all.find((m) => m.mun === PROVINCE_CODE * 1000 + code)

  if (nameTokens.length > 0) {
    const matches = matchMunicipalities(nameTokens.join(' '), all)
    if (matches.length === 0) return [{ kind: 'hint', text: `No municipality in Málaga called “${nameTokens.join(' ')}”` }]
    if (n.length === 0) return matches.map((m) => ({ kind: 'municipality', m }))
    if (n.length === 1) return matches.map((m) => ({ kind: 'hint', text: `${m.nombre} · polygon ${n[0]}: add the parcel number` }))
    if (n.length === 2) return matches.map((m) => ({ kind: 'farm', m, ref: { pol: n[0], par: n[1] } }))
    return [{ kind: 'hint', text: 'After the name, type only polygon and parcel' }]
  }

  // Numbers only.
  if (n.length === 6 || n.length === 4) {
    if (n[0] !== PROVINCE_CODE) return [{ kind: 'hint', text: `Province ${n[0]} is not available yet: only Málaga (29)` }]
    if (n.length === 6 && (n[2] !== 0 || n[3] !== 0)) return [{ kind: 'hint', text: 'No Málaga parcel uses an aggregate or zone other than 0' }]
  }
  if (n.length === 6 || n.length === 4 || n.length === 3) {
    const [code, pol, par] = n.length === 6 ? [n[1], n[4], n[5]] : n.length === 4 ? [n[1], n[2], n[3]] : n
    const m = byCode(code)
    if (!m) return [{ kind: 'hint', text: `Málaga has no municipality with SIGPAC code ${code}` }]
    return [{ kind: 'farm', m, ref: { pol, par } }]
  }
  if (n.length === 2 && here) return [{ kind: 'farm', m: here, ref: { pol: n[0], par: n[1] } }]
  if (n.length === 1) {
    const m = byCode(n[0])
    if (m) return [{ kind: 'municipality', m }]
  }
  return [{ kind: 'hint', text: 'Municipality, polygon and parcel: Antequera 100 1 or 29:15:100:1' }]
}
