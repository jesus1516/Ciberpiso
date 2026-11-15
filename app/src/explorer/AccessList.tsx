// Keyboard and screen-reader way to do what the map does with the mouse: a searchable list of the
// provinces / municipalities / farms of the current level (ARIA 1.2 "combobox with listbox popup").
// Tab reaches it, typing filters, ↑ ↓ Home End move, Enter chooses (the same transition as a click),
// Esc closes the list. The focus stays in the input; the highlighted option is `aria-activedescendant`.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { farmEntry, filterEntries, fold, MAX_OPTIONS, type ListEntry } from './listing'
import { useExplorer } from './state'
import { fmt } from './texts'
import type { ExplorerController } from './controller'
import type { Level } from './state'

function Combobox({ label, hint, entries, onChoose, noun }: {
  label: string; hint: string; entries: ListEntry[]; onChoose: (id: string) => void; noun: string
}) {
  const uid = useId()
  const inputId = `${uid}-in`, listId = `${uid}-list`
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const list = useRef<HTMLUListElement>(null)

  const matches = useMemo(() => filterEntries(entries, query), [entries, query])
  const shown = matches.slice(0, MAX_OPTIONS)
  const activeId = open && shown[active] ? `${uid}-opt-${shown[active].id}` : undefined

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  const choose = (e: ListEntry | undefined) => {
    if (!e) return
    setOpen(false)
    onChoose(e.id)
  }
  const onKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    const last = shown.length - 1
    switch (ev.key) {
      case 'ArrowDown':
        ev.preventDefault()
        if (!open) setOpen(true)
        else setActive((a) => Math.min(last, a + 1))
        break
      case 'ArrowUp':
        ev.preventDefault()
        if (!open) setOpen(true)
        else setActive((a) => Math.max(0, a - 1))
        break
      case 'Home':
        if (open) { ev.preventDefault(); setActive(0) }
        break
      case 'End':
        if (open) { ev.preventDefault(); setActive(last) }
        break
      case 'Enter':
        if (open && shown[active]) { ev.preventDefault(); choose(shown[active]) }
        break
      case 'Escape':
        // Closes the list, then clears the text; with both done Esc goes back a level (Explorer.tsx).
        if (open) { ev.preventDefault(); ev.stopPropagation(); setOpen(false) }
        else if (query) { ev.preventDefault(); ev.stopPropagation(); setQuery('') }
        break
    }
  }

  const count = matches.length === 0 ? `No ${noun} match “${query}”.` : matches.length > shown.length ? `Showing the first ${shown.length} of ${fmt(matches.length)} ${noun}. Type to narrow the list.` : `${fmt(matches.length)} ${noun}.`

  return (
    <div className="al" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false) }}>
      <label htmlFor={inputId} className="al-label">{label}</label>
      <div className="al-field">
        <input
          id={inputId} type="text" role="combobox" autoComplete="off" spellCheck={false}
          aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={activeId} aria-describedby={`${uid}-hint`}
          placeholder="Type to search" value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onKeyDown={onKeyDown}
        />
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d={open ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} /></svg>
      </div>
      <p id={`${uid}-hint`} className="al-hint">{hint}</p>
      <ul id={listId} ref={list} role="listbox" aria-label={label} className="al-list" hidden={!open}>
        {shown.map((e, i) => (
          <li key={e.id} id={`${uid}-opt-${e.id}`} role="option" aria-selected={i === active} className={i === active ? 'on' : undefined}
            onMouseDown={(ev) => ev.preventDefault()} onClick={() => choose(e)} onMouseMove={() => i !== active && setActive(i)}>
            <span className="t">{e.label}</span>
            <span className="d">{e.detail}</span>
            {e.note && <span className="n">{e.note}</span>}
          </li>
        ))}
      </ul>
      <p className="vh" role="status" aria-live="polite">{open ? count : ''}</p>
    </div>
  )
}

/** The list for the current level: provinces (0), municipalities (1) or farms (2). Nothing at level 3. */
export function AccessList({ level, ctrl }: { level: Level; ctrl: React.RefObject<ExplorerController | null> }) {
  const provinces = useExplorer((s) => s.provinceList)
  const municipalities = useExplorer((s) => s.municipalityList)
  const farms = useExplorer((s) => s.farmList)
  const farmsCount = useExplorer((s) => s.farmsCount)
  const provinceEntries = useMemo<ListEntry[]>(() => provinces.map((p) => ({
    id: p.id, label: p.nombre, detail: `${fmt(p.fincas)} farms`, note: p.id === '29' ? 'Tour available' : 'Tour not available yet', search: fold(p.nombre),
  })), [provinces])
  const municipalityEntries = useMemo<ListEntry[]>(() => municipalities.map((m) => ({
    id: String(m.mun), label: m.nombre, detail: `${fmt(m.fincas)} farms · ${fmt(m.pct_cultivo, 1)} % cropland`, note: m.candidatas ? `★ ${fmt(m.candidatas)} candidates` : undefined, search: fold(m.nombre),
  })), [municipalities])
  const farmEntries = useMemo(() => farms.map(farmEntry), [farms])

  if (level === 0) {
    return <Combobox key="p" label="Choose a province from the list" noun="provinces" hint="Same as clicking the map. Enter opens the highlighted province." entries={provinceEntries} onChoose={(id) => ctrl.current?.chooseProvince(id)} />
  }
  if (level === 1) {
    return <Combobox key="m" label="Choose a municipality from the list" noun="municipalities" hint="Same as clicking the map. Enter opens the highlighted municipality." entries={municipalityEntries} onChoose={(id) => ctrl.current?.chooseMunicipality(Number(id))} />
  }
  if (level === 2) {
    if (farmsCount === null) return <p className="al-hint" role="status">Loading the list of farms…</p>
    return <Combobox key="f" label="Choose a farm from the list" noun="farms" hint="Farmland only, project candidates first, then by area. Type a plot number such as 62-14. Enter opens the farm." entries={farmEntries} onChoose={(id) => ctrl.current?.chooseFarm(Number(id))} />
  }
  return null
}
