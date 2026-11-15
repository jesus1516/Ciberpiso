import { useEffect, useMemo, useRef } from 'react'
import { getFarm } from '../lib/farms'
import { useStore } from '../store'
import { AccessList } from './AccessList'
import { ExplorerController } from './controller'
import { FarmView } from './FarmView'
import { levelMessage, mapSummary } from './messages'
import { applySettings, useSettings } from './settings'
import { SettingsMenu } from './SettingsMenu'
import { SigpacSearch } from './SigpacSearch'
import { useExplorer, type Hover, type Level } from './state'
import { APT, DISCLAIMER, COVER_NAME, fmt } from './texts'
import './explorer.css'
import './access.css'

const DIRECTOR = new URLSearchParams(location.search).has('director')

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function Tooltip({ hover }: { hover: Hover | null }) {
  let body = null
  if (hover?.kind === 'province') {
    const p = hover.p
    body = (
      <>
        <div className="k">Andalucía · province</div>
        <h3>{p.nombre}</h3>
        <div className="m">
          <Metric value={fmt(p.fincas)} label="SIGPAC farms" />
          <Metric value={`${fmt(p.pct_cultivo, 1)} %`} label="cropland" />
          <Metric value={fmt(p.candidatas)} label="candidates" />
        </div>
        <div className="a">{p.id === '29' ? 'Click to enter Málaga →' : 'Tour not available yet'}</div>
      </>
    )
  } else if (hover?.kind === 'municipality') {
    const p = hover.p
    body = (
      <>
        <div className="k">Málaga · municipality</div>
        <h3>{p.nombre}</h3>
        <div className="m">
          <Metric value={fmt(p.fincas)} label="farms" />
          <Metric value={`${fmt(p.pct_cultivo, 1)} %`} label="cropland" />
          <Metric value={fmt(p.candidatas)} label="candidates" />
        </div>
        <div className="a">Rain {fmt(p.lluvia_mm)} mm · deficit {fmt(p.deficit_mm)} mm · click to see its farms →</div>
      </>
    )
  } else if (hover?.kind === 'farm') {
    const p = hover.p
    const blocked = p.apt === 'urbano' || p.apt === 'agua' || p.apt === 'publico'
    body = (
      <>
        <div className="k">{p.cand ? '★ Project candidate · ' : 'Farm · '}SIGPAC {p.pid}</div>
        <h3>{fmt(p.ha, 1)} ha</h3>
        <div className="m">
          <Metric value={`${fmt(p.slope, 1)} %`} label="slope" />
          <Metric value={`${fmt(p.alt)} m`} label="altitude" />
          <Metric value={COVER_NAME[p.cover ?? ''] ?? '—'} label="land cover" />
        </div>
        <div className={`a ${blocked ? 'no' : p.apt ? 'warn' : ''}`}>
          {blocked ? `✕ ${APT[p.apt!]}: cannot be analysed` : p.apt ? `⚠ ${APT[p.apt]}: indicative analysis` : 'Click to see it in 3D →'}
        </div>
      </>
    )
  }
  return (
    <div id="xp-tooltip" className={`tooltip glass ${hover ? 'visible' : ''}`} role="tooltip">
      {body}
    </div>
  )
}

function Narrative({ ctrl }: { ctrl: React.RefObject<ExplorerController | null> }) {
  const level = useExplorer((s) => s.level)
  const phase = useExplorer((s) => s.phase)
  const totals = useExplorer((s) => s.totals)
  const municipality = useExplorer((s) => s.municipality)
  const farms = useExplorer((s) => s.farmsCount)
  if (level === 3) return null
  return (
    <section className="narrative" aria-label="Where you are" inert={phase !== 'idle'}>
      {level === 0 && (
        <div className="scene" key="l0">
          <p className="eyebrow">Step 1 of 4 · Andalucía</p>
          <h1 id="xp-heading" tabIndex={-1}>Where is your farm?</h1>
          <p>Pick a province. The full tour, with farms and rotations, is available for Málaga.</p>
          <div className="fact"><strong>{fmt(totals.andalucia)}</strong><span>SIGPAC farms<br />in the 8 provinces</span></div>
          <div className="hint">Click on Málaga</div>
          <AccessList level={0} ctrl={ctrl} />
        </div>
      )}
      {level === 1 && (
        <div className="scene" key="l1">
          <p className="eyebrow">Step 2 of 4 · Málaga</p>
          <h1 id="xp-heading" tabIndex={-1}>Choose the municipality</h1>
          <p>The colour shows what share of its farms is cropland according to the satellite (ESA WorldCover).</p>
          <div className="legend-scale"><div className="bar" /><div className="ticks"><span>0 %</span><span>cropland farms</span><span>{fmt(totals.maxCropland)} %</span></div></div>
          <div className="fact"><strong>{fmt(totals.malaga)}</strong><span>farms in<br />{totals.municipalities} municipalities</span></div>
          <div className="hint">Click on a municipality</div>
          <AccessList level={1} ctrl={ctrl} />
        </div>
      )}
      {level === 2 && municipality && (
        <div className="scene" key={`l2-${municipality.mun}`}>
          <p className="eyebrow">Step 3 of 4 · Málaga</p>
          <h1 id="xp-heading" tabIndex={-1}>{municipality.nombre}</h1>
          <p>
            {farms === null ? 'Loading its farms…' : `${fmt(farms)} SIGPAC farms.`} Zoom in and pick one
            {municipality.candidatas ? `; the ${municipality.candidatas} gold ones are project candidates` : ''}.
          </p>
          <ul className="chips">
            <li><i className="sw-ok" aria-hidden />Farmland</li>
            {municipality.candidatas > 0 && <li><i className="sw-cand" aria-hidden>★</i>Candidate</li>}
            <li><i className="sw-lim" aria-hidden />Limited (with warning)</li>
            <li><i className="sw-no" aria-hidden />Not farmland</li>
          </ul>
          <div className="hint">Click on a farm to see it in 3D</div>
          <AccessList level={2} ctrl={ctrl} />
        </div>
      )}
    </section>
  )
}

const LEVEL_NAMES = ['Andalucía', 'Málaga', '', 'Farm']

function Crumbs({ go }: { go: (l: Level) => void }) {
  const level = useExplorer((s) => s.level)
  const phase = useExplorer((s) => s.phase)
  const municipality = useExplorer((s) => s.municipality)
  const sel = useExplorer((s) => s.sel)
  const names = [LEVEL_NAMES[0], LEVEL_NAMES[1], municipality?.nombre ?? '', sel ? `Farm ${sel.farm.properties.pol}-${sel.farm.properties.par}` : 'Farm']
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {names.slice(0, level + 1).map((name, l) => (
        <span key={l}>
          {l > 0 && <i>/</i>}
          <button className="crumb" disabled={phase !== 'idle' || l >= level} aria-current={l === level ? 'step' : undefined} onClick={() => go(l as Level)}>
            {name}
          </button>
        </span>
      ))}
    </nav>
  )
}

function Director({ ctrl }: { ctrl: React.RefObject<ExplorerController | null> }) {
  const speed = useExplorer((s) => s.speed)
  return (
    <aside className="director glass">
      <header><b>Director · testing</b></header>
      <div className="row">
        {[1, 0.5, 0.25].map((v) => (
          <button key={v} className="d" aria-pressed={speed === v} onClick={() => ctrl.current?.setSpeed(v)}>{v}×</button>
        ))}
      </div>
      <p>Remove <code>?director</code> from the URL to hide this panel.</p>
    </aside>
  )
}

export function Explorer() {
  const app = useRef<HTMLDivElement>(null)
  const mapEl = useRef<HTMLDivElement>(null)
  const dioEl = useRef<HTMLDivElement>(null)
  const ctrl = useRef<ExplorerController | null>(null)
  const level = useExplorer((s) => s.level)
  const phase = useExplorer((s) => s.phase)
  const hover = useExplorer((s) => s.hover)
  const toast = useExplorer((s) => s.toast)
  const preparing = useExplorer((s) => s.preparing)
  const error = useExplorer((s) => s.error)
  const sel = useExplorer((s) => s.sel)
  const setAboutOpen = useStore((s) => s.setAboutOpen)
  const municipality = useExplorer((s) => s.municipality)
  const farmsCount = useExplorer((s) => s.farmsCount)
  const municipalityList = useExplorer((s) => s.municipalityList)
  const moving = useExplorer((s) => s.moving)
  const flat = useExplorer((s) => s.flat)
  const settings = useSettings()

  // Settings → <html> (text scale, contrast, motion), then re-frame what depends on the column width.
  const sizeSeen = useRef(settings.textSize)
  useEffect(() => {
    applySettings(settings)
    if (sizeSeen.current !== settings.textSize) {
      sizeSeen.current = settings.textSize
      requestAnimationFrame(() => requestAnimationFrame(() => ctrl.current?.refit()))
    }
  }, [settings])
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => applySettings()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // After each transition focus moves to the heading of the new level, so a keyboard or screen-reader
  // user lands at the top of what changed instead of on a control that no longer exists.
  const lastPhase = useRef(phase)
  useEffect(() => {
    if (lastPhase.current === 'transitioning' && phase === 'idle') {
      const before = document.activeElement
      const t = window.setTimeout(() => {
        // If the person (or a dialog) already moved focus somewhere else in the meantime, leave it there:
        // on a slow computer this timer can fire well after they pressed a button.
        const now = document.activeElement
        if (now && now !== before && now !== document.body && document.contains(now)) return
        document.getElementById('xp-heading')?.focus({ preventScroll: true })
      }, 60)
      lastPhase.current = phase
      return () => clearTimeout(t)
    }
    lastPhase.current = phase
  }, [phase])

  const farmName = sel ? `Farm ${sel.farm.properties.pol}-${sel.farm.properties.par}` : 'Farm'
  const announcement = phase === 'loading' ? '' : phase === 'transitioning' ? moving : levelMessage(level, { municipality: municipality?.nombre ?? '', farms: farmsCount, farm: farmName, ha: sel?.farm.properties.ha ?? 0, municipalities: municipalityList.length, flat })
  const summary = useMemo(() => mapSummary(level, { municipality: municipality?.nombre ?? '', farms: farmsCount, municipalities: municipalityList.length, flat }), [level, municipality, farmsCount, municipalityList.length, flat])

  useEffect(() => {
    const c = new ExplorerController(app.current!, mapEl.current!, dioEl.current!)
    ctrl.current = c
    if (DIRECTOR) Object.assign(window, { __xp: { ctrl: c, state: useExplorer, getFarm } })
    const onResize = () => c.resize()
    const onKey = (e: KeyboardEvent) => {
      // Esc belongs to dialogs, drawers, menus and text fields first; only a "free" Esc goes back a level.
      if (e.key !== 'Escape' || e.defaultPrevented || (e.target as HTMLElement).closest('dialog, [role="dialog"], input:not([role="combobox"]), textarea, select')) return
      const { level } = useExplorer.getState()
      if (level > 0) c.go((level - 1) as Level)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
      c.dispose()
      ctrl.current = null
    }
  }, [])

  const go = (l: Level) => ctrl.current?.go(l)

  return (
    <div ref={app} className="xp" data-level={level} data-phase={phase} data-flat={flat}>
      <div ref={mapEl} className="xp-map" role="region" aria-label="Map of Andalucía and Málaga" aria-describedby="xp-map-summary" />
      <p id="xp-map-summary" className="vh">{summary}</p>
      <p className="vh" role="status" aria-live="polite" aria-atomic="true" data-testid="announcer">{announcement}</p>
      <div className="scrim" />
      <header className="masthead">
        <img src={`${import.meta.env.BASE_URL}brand/ciberpiso-icon.svg`} alt="" width={36} height={36} />
        <div><b>Ciberpiso</b><span>From territory to farm</span></div>
        <button className="sources" onClick={() => setAboutOpen(true)}>Sources</button>
        <SettingsMenu />
        {/* In the masthead row so it can never cover it; hidden with the masthead on the farm view. */}
        <SigpacSearch ctrl={ctrl} />
      </header>
      <main className="xp-main" aria-label="Explorer">
        <Narrative ctrl={ctrl} />
        <div ref={dioEl} />
        <FarmView ctrl={ctrl} />
      </main>
      <Crumbs go={go} />
      <button className="back" disabled={phase !== 'idle' || level === 0} onClick={() => go((level - 1) as Level)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="m9 6-6 6 6 6M3 12h18" /></svg>
        Back <kbd>Esc</kbd>
      </button>
      {level < 3 && <p className="disclaimer">{DISCLAIMER}</p>}
      <Tooltip hover={hover} />
      <div className={`toast glass ${toast ? 'visible' : ''} ${toast?.kind ?? ''}`} role="status">
        {toast && (<><strong>{toast.title}</strong><p>{toast.body}</p></>)}
      </div>
      <div className={`prep glass ${preparing ? 'visible' : ''}`} role="status"><i />{level >= 2 || sel ? 'Raising the terrain…' : 'Loading the farms…'}</div>
      {DIRECTOR && <Director ctrl={ctrl} />}
      <div className={`loading ${phase !== 'loading' ? 'done' : ''}`}>
        <div><b>Ciberpiso</b><span>{error ?? 'Tracing the territory'}</span></div>
      </div>
    </div>
  )
}
