import { useEffect, useRef } from 'react'
import { getFinca } from '../lib/fincas'
import { useStore } from '../store'
import { ExplorerController } from './controller'
import { FincaView } from './FincaView'
import { useExplorer, type Hover, type Level } from './state'
import { APT, DISCLAIMER, NOMBRE_COBERTURA, fmt } from './textos'
import './explorer.css'

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
  if (hover?.kind === 'provincia') {
    const p = hover.p
    body = (
      <>
        <div className="k">Andalucía · provincia</div>
        <h3>{p.nombre}</h3>
        <div className="m">
          <Metric value={fmt(p.fincas)} label="fincas SIGPAC" />
          <Metric value={`${fmt(p.pct_cultivo, 1)} %`} label="de cultivo" />
          <Metric value={fmt(p.candidatas)} label="candidatas" />
        </div>
        <div className="a">{p.id === '29' ? 'Clic para entrar en Málaga →' : 'Recorrido aún no preparado'}</div>
      </>
    )
  } else if (hover?.kind === 'municipio') {
    const p = hover.p
    body = (
      <>
        <div className="k">Málaga · municipio</div>
        <h3>{p.nombre}</h3>
        <div className="m">
          <Metric value={fmt(p.fincas)} label="fincas" />
          <Metric value={`${fmt(p.pct_cultivo, 1)} %`} label="de cultivo" />
          <Metric value={fmt(p.candidatas)} label="candidatas" />
        </div>
        <div className="a">Lluvia {fmt(p.lluvia_mm)} mm · déficit {fmt(p.deficit_mm)} mm · clic para ver sus fincas →</div>
      </>
    )
  } else if (hover?.kind === 'finca') {
    const p = hover.p
    const blocked = p.apt === 'urbano' || p.apt === 'agua' || p.apt === 'publico'
    body = (
      <>
        <div className="k">{p.cand ? '★ Candidata del proyecto · ' : 'Finca · '}SIGPAC {p.pid}</div>
        <h3>{fmt(p.ha, 1)} ha</h3>
        <div className="m">
          <Metric value={`${fmt(p.slope, 1)} %`} label="pendiente" />
          <Metric value={`${fmt(p.alt)} m`} label="altitud" />
          <Metric value={NOMBRE_COBERTURA[p.cover ?? ''] ?? '—'} label="cobertura" />
        </div>
        <div className={`a ${blocked ? 'no' : p.apt ? 'warn' : ''}`}>
          {blocked ? `${APT[p.apt!]}: no se puede analizar` : p.apt ? `⚠ ${APT[p.apt]}: análisis orientativo` : 'Clic para verla en 3D →'}
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

function Narrative() {
  const level = useExplorer((s) => s.level)
  const totals = useExplorer((s) => s.totals)
  const municipio = useExplorer((s) => s.municipio)
  const fincas = useExplorer((s) => s.fincasCount)
  if (level === 3) return null
  return (
    <section className="narrative" aria-live="polite">
      {level === 0 && (
        <div className="scene" key="l0">
          <p className="eyebrow">Paso 1 de 4 · Andalucía</p>
          <h1>¿Dónde está tu finca?</h1>
          <p>Elige una provincia. El recorrido completo, con fincas y rotaciones, está preparado para Málaga.</p>
          <div className="fact"><strong>{fmt(totals.andalucia)}</strong><span>fincas SIGPAC<br />en las 8 provincias</span></div>
          <div className="hint">Haz clic en Málaga</div>
        </div>
      )}
      {level === 1 && (
        <div className="scene" key="l1">
          <p className="eyebrow">Paso 2 de 4 · Málaga</p>
          <h1>Elige el municipio</h1>
          <p>El color indica qué parte de sus fincas son de cultivo según el satélite (ESA WorldCover).</p>
          <div className="legend-scale"><div className="bar" /><div className="ticks"><span>0 %</span><span>fincas de cultivo</span><span>{fmt(totals.maxCultivo)} %</span></div></div>
          <div className="fact"><strong>{fmt(totals.malaga)}</strong><span>fincas en<br />{totals.municipios} municipios</span></div>
          <div className="hint">Haz clic en un municipio</div>
        </div>
      )}
      {level === 2 && municipio && (
        <div className="scene" key={`l2-${municipio.mun}`}>
          <p className="eyebrow">Paso 3 de 4 · Málaga</p>
          <h1>{municipio.nombre}</h1>
          <p>
            {fincas === null ? 'Cargando sus fincas…' : `${fmt(fincas)} fincas SIGPAC.`} Acerca el mapa y elige una
            {municipio.candidatas ? `; las ${municipio.candidatas} doradas son candidatas del proyecto` : ''}.
          </p>
          <ul className="chips">
            <li><i className="sw-ok" />Cultivable</li>
            {municipio.candidatas > 0 && <li><i className="sw-cand" />Candidata</li>}
            <li><i className="sw-lim" />Limitada (con aviso)</li>
            <li><i className="sw-no" />No cultivable</li>
          </ul>
          <div className="hint">Clic en una finca para verla en 3D</div>
        </div>
      )}
    </section>
  )
}

const LEVEL_NAMES = ['Andalucía', 'Málaga', '', 'Finca']

function Crumbs({ go }: { go: (l: Level) => void }) {
  const level = useExplorer((s) => s.level)
  const phase = useExplorer((s) => s.phase)
  const municipio = useExplorer((s) => s.municipio)
  const sel = useExplorer((s) => s.sel)
  const names = [LEVEL_NAMES[0], LEVEL_NAMES[1], municipio?.nombre ?? '', sel ? `Finca ${sel.finca.properties.pol}-${sel.finca.properties.par}` : 'Finca']
  return (
    <nav className="crumbs" aria-label="Ruta">
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
      <header><b>Director · pruebas</b></header>
      <div className="row">
        {[1, 0.5, 0.25].map((v) => (
          <button key={v} className="d" aria-pressed={speed === v} onClick={() => ctrl.current?.setSpeed(v)}>{v}×</button>
        ))}
      </div>
      <p>Quita <code>?director</code> de la URL para ocultar este panel.</p>
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

  useEffect(() => {
    const c = new ExplorerController(app.current!, mapEl.current!, dioEl.current!)
    ctrl.current = c
    if (DIRECTOR) Object.assign(window, { __xp: { ctrl: c, state: useExplorer, getFinca } })
    const onResize = () => c.resize()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (e.target as HTMLElement).closest('input, textarea, select')) return
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
    <div ref={app} className="xp" data-level={level} data-phase={phase}>
      <div ref={mapEl} className="xp-map" role="application" aria-label="Mapa de Andalucía y Málaga" />
      <div className="scrim" />
      <header className="masthead">
        <img src={`${import.meta.env.BASE_URL}brand/ciberpiso-icon.svg`} alt="" width={36} height={36} />
        <div><b>Ciberpiso</b><span>Del territorio a la parcela</span></div>
        <button className="sources" onClick={() => setAboutOpen(true)}>Fuentes</button>
      </header>
      <Narrative />
      <div ref={dioEl} />
      <FincaView ctrl={ctrl} />
      <Crumbs go={go} />
      <button className="back" disabled={phase !== 'idle' || level === 0} onClick={() => go((level - 1) as Level)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="m9 6-6 6 6 6M3 12h18" /></svg>
        Volver <kbd>Esc</kbd>
      </button>
      {level < 3 && <p className="disclaimer">{DISCLAIMER}</p>}
      <Tooltip hover={hover} />
      <div className={`toast glass ${toast ? 'visible' : ''} ${toast?.kind ?? ''}`} role="status">
        {toast && (<><strong>{toast.title}</strong><p>{toast.body}</p></>)}
      </div>
      <div className={`prep glass ${preparing ? 'visible' : ''}`} role="status"><i />{level >= 2 || sel ? 'Levantando el terreno…' : 'Cargando las fincas…'}</div>
      {DIRECTOR && <Director ctrl={ctrl} />}
      <div className={`loading ${phase !== 'loading' ? 'done' : ''}`}>
        <div><b>Ciberpiso</b><span>{error ?? 'Trazando el territorio'}</span></div>
      </div>
    </div>
  )
}
