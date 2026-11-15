import { describe, expect, it } from 'vitest'
import { fold, matchMunicipalities, suggest } from './sigpac'
import type { MunicipalityInfo } from './state'

const mun = (code: number, nombre: string): MunicipalityInfo => ({ mun: 29000 + code, nombre, fincas: 1000, ha: 1, candidatas: 0 })
const ALL = [mun(15, 'Antequera'), mun(84, 'Ronda'), mun(8, 'Alhaurín de la Torre'), mun(7, 'Alhaurín el Grande'), mun(67, 'Málaga'), mun(94, 'Vélez-Málaga')]
const farm = (s: ReturnType<typeof suggest>[number]) => (s.kind === 'farm' ? [s.m.nombre, s.ref.pol, s.ref.par] : s.kind)

describe('SIGPAC search', () => {
  it('folds accents and case', () => {
    expect(fold('  Alhaurín ')).toBe('alhaurin')
  })

  it('finds a farm from the full reference and its short forms', () => {
    for (const q of ['29:15:0:0:100:1', '29:15:100:1', '15:100:1', '15-100-1', '15 / 100 / 1', 'Antequera 100 1', 'antequera 100/1']) {
      expect(suggest(q, ALL, null).map(farm), q).toEqual([['Antequera', 100, 1]])
    }
  })

  it('uses the municipality on screen for polygon and parcel alone', () => {
    expect(suggest('12 7', ALL, ALL[1]).map(farm)).toEqual([['Ronda', 12, 7]])
    expect(suggest('12 7', ALL, null)[0].kind).toBe('hint')
  })

  it('lists municipalities by name, those starting with the text first', () => {
    expect(matchMunicipalities('alhaurin', ALL).map((m) => m.nombre)).toEqual(['Alhaurín de la Torre', 'Alhaurín el Grande'])
    expect(matchMunicipalities('malaga', ALL).map((m) => m.nombre)).toEqual(['Málaga', 'Vélez-Málaga'])
    expect(suggest('ron', ALL, null)).toEqual([{ kind: 'municipality', m: ALL[1] }])
  })

  it('opens a municipality from its SIGPAC code', () => {
    expect(suggest('84', ALL, null)).toEqual([{ kind: 'municipality', m: ALL[1] }])
  })

  it('explains what is wrong instead of guessing', () => {
    expect(suggest('41:15:100:1', ALL, null)).toEqual([{ kind: 'hint', text: 'Province 41 is not available yet: only Málaga (29)' }])
    expect(suggest('29:15:1:0:100:1', ALL, null)[0].kind).toBe('hint')
    expect(suggest('999:100:1', ALL, null)).toEqual([{ kind: 'hint', text: 'Málaga has no municipality with SIGPAC code 999' }])
    expect(suggest('Atlantis 1 2', ALL, null)[0].kind).toBe('hint')
    expect(suggest('Antequera 100', ALL, null)).toEqual([{ kind: 'hint', text: 'Antequera · polygon 100: add the parcel number' }])
    expect(suggest('', ALL, null)).toEqual([])
  })
})
