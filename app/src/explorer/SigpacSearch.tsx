// Search by SIGPAC reference or municipality name, top centre. Goes from any level straight to
// the municipality or the farm with the explorer transitions.
import { useMemo, useRef, useState } from 'react'
import { loadMunicipality } from '../lib/farms'
import type { Farm } from '../lib/geo'
import type { ExplorerController } from './controller'
import { suggest, type Suggestion } from './sigpac'
import { useExplorer } from './state'
import { fmt } from './texts'

const LIST_ID = 'sigpac-options'

function label(s: Exclude<Suggestion, { kind: 'hint' }>) {
  return s.kind === 'farm'
    ? { main: `Polygon ${s.ref.pol} · parcel ${s.ref.par}`, sub: s.m.nombre }
    : { main: s.m.nombre, sub: `${fmt(s.m.fincas)} farms` }
}

export function SigpacSearch({ ctrl }: { ctrl: React.RefObject<ExplorerController | null> }) {
  const phase = useExplorer((s) => s.phase)
  const loading = useExplorer((s) => s.phase === 'loading')
  const here = useExplorer((s) => s.municipality)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  // The list only exists once the map has loaded; `loading` re-runs this when it does.
  const all = useMemo(() => (loading ? [] : (ctrl.current?.municipalityList() ?? [])), [ctrl, loading])
  const items = useMemo(() => suggest(text, all, here), [text, all, here])
  const options = items.filter((s): s is Exclude<Suggestion, { kind: 'hint' }> => s.kind !== 'hint')
  const hint = items.find((s) => s.kind === 'hint')
  const showList = open && !!text.trim() && (options.length > 0 || !!hint || !!error)

  async function choose(s: Exclude<Suggestion, { kind: 'hint' }> | undefined) {
    const c = ctrl.current
    if (!s || !c || busy || useExplorer.getState().phase !== 'idle') return
    setError(null)
    let farm: Farm | undefined
    if (s.kind === 'farm') {
      setBusy(true)
      try {
        const farms = await loadMunicipality(s.m.mun)
        farm = farms.features.find((f) => f.properties.pol === s.ref.pol && f.properties.par === s.ref.par)
      } catch {
        setBusy(false)
        setError('Could not load the farms. Check your connection and try again.')
        return
      }
      setBusy(false)
      if (!farm) {
        setError(`${s.m.nombre} has no SIGPAC parcel ${s.ref.pol}/${s.ref.par}`)
        return
      }
    }
    setText('')
    setOpen(false)
    input.current?.blur()
    await c.jumpTo(s.m, farm)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      if (options.length) setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(options[active] ?? options[0])
    } else if (e.key === 'Escape') {
      if (text) setText('')
      else input.current?.blur()
      setOpen(false)
    }
  }

  return (
    <div className={`search glass ${showList ? 'open' : ''}`} role="search">
      <svg className="lens" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.2-4.2" />
      </svg>
      <input
        ref={input}
        type="search"
        value={text}
        placeholder="SIGPAC parcel or municipality"
        aria-label="Search a farm by SIGPAC reference (municipality, polygon, parcel) or a municipality by name"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={LIST_ID}
        aria-activedescendant={showList && options[active] ? `${LIST_ID}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        disabled={loading}
        onChange={(e) => {
          setText(e.target.value)
          setActive(0)
          setError(null)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {busy && <i className="spin" aria-hidden />}
      {showList && (
        <div className="drop">
          {options.length > 0 && (
            <ul id={LIST_ID} role="listbox" aria-label="Results">
              {options.map((s, i) => {
                const l = label(s)
                return (
                  <li
                    key={`${s.kind}-${s.m.mun}-${i}`}
                    id={`${LIST_ID}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    aria-disabled={phase !== 'idle'}
                    onMouseEnter={() => setActive(i)}
                    // mousedown (not click) so the input does not lose focus and close the list first.
                    onMouseDown={(e) => {
                      e.preventDefault()
                      choose(s)
                    }}
                  >
                    <span>{l.main}</span>
                    <small>{l.sub}</small>
                  </li>
                )
              })}
            </ul>
          )}
          {(error || (hint && hint.kind === 'hint')) && (
            <p className={error ? 'err' : ''} role={error ? 'alert' : 'status'}>
              {error ?? (hint as Extract<Suggestion, { kind: 'hint' }>).text}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
