// Interfaz sobre el terreno 3D: cabecera, cuatro tarjetas ancladas al terreno con líneas
// guía, línea temporal (campañas MODIS + escenario) y selector R0–R3. "Datos completos"
// abre la pestaña de condiciones de la app (clima NASA POWER, suelo y NDVI de la finca).
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { RotationScore } from '../lib/calculator'
import { fieldCentroid, toField } from '../lib/geo'
import type { ProfileKey, RotationKey } from '../lib/indicators'
import { useStore } from '../store'
import type { ExplorerController } from './controller'
import { CROPS, FIRST_SCENARIO_YEAR, LAST_YEAR, cropForYear, type Mode } from './escena'
import { useExplorer, type Seleccion } from './state'
import { APT, DISCLAIMER, PERFILES, ROTACION_CORTA, fmt } from './textos'

// La pestaña de condiciones trae las gráficas (recharts): solo se descarga al abrirla.
const ConditionsTab = lazy(() => import('../components/ConditionsTab').then((m) => ({ default: m.ConditionsTab })))

type CardKey = 'water' | 'market' | 'soil' | 'risk'
type Slot = 's-lt' | 's-lb' | 's-rt' | 's-rb'
const CARDS: CardKey[] = ['water', 'market', 'soil', 'risk']
const DEFAULT_SLOTS: Record<CardKey, Slot> = { water: 's-lt', market: 's-rt', soil: 's-lb', risk: 's-rb' }
const YEARS = Array.from({ length: LAST_YEAR - 2019 }, (_, i) => 2020 + i)

const ICONS: Record<CardKey, React.ReactNode> = {
  water: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z" /></svg>,
  soil: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 8h18M3 13h18M3 18h18" /><path d="M7 8v5M14 13v5M17 8v5" opacity=".6" /></svg>,
  market: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17l5-5 4 3 7-8" /><path d="M15 7h5v5" /></svg>,
  risk: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5" /></svg>,
}
const word = (v: number | null) => (v === null ? '—' : v >= 70 ? 'alta' : v >= 55 ? 'media' : 'baja')
const riskWord = (v: number | null) => (v === null ? '—' : v >= 70 ? 'riesgo bajo' : v >= 55 ? 'riesgo medio' : 'riesgo alto')

function Card({ k, slot, label, value, wordTxt, base, rotation, ev, extra }: {
  k: CardKey; slot: Slot; label: string; value: number | null; wordTxt: string; base: number | null; rotation: RotationKey; ev: string; extra?: React.ReactNode
}) {
  const delta = value !== null && base !== null ? value - base : null
  return (
    <article className={`fx-card glass ${slot}`} data-k={k}>
      <div className="lbl">{ICONS[k]}<span>{label}</span></div>
      <div className="val"><strong>{fmt(value)}</strong><small>/100</small><em>{wordTxt}</em></div>
      <div className="bar"><i style={{ '--v': `${Math.max(0, Math.min(100, value ?? 0))}%` } as React.CSSProperties} /></div>
      {extra}
      <div className="ev">{ev}</div>
      {rotation === 'R0' || delta === null ? (
        <span className="delta">línea base (actual)</span>
      ) : (
        <span className={`delta ${delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : ''}`}>{delta > 0 ? '+' : ''}{fmt(delta, 1)} frente a la actual</span>
      )}
    </article>
  )
}

function Cards({ sel, rotation, slots }: { sel: Seleccion; rotation: RotationKey; slots: Record<CardKey, Slot> }) {
  const r: RotationScore | undefined = sel.scores?.[rotation]
  const base = sel.scores?.R0
  if (!r || !base) {
    return (
      <div className="fx-cards">
        <article className="fx-card glass s-lt nodata">
          <div className="lbl"><span>Sin datos del proyecto</span></div>
          <div className="ev">Esta finca no tiene clima y suelo en los CSV del proyecto, así que no se pueden puntuar las rotaciones.</div>
        </article>
      </div>
    )
  }
  const soil = sel.detalle?.suelo
  const prices = r.crops.map((c) => (c === 'barbecho' ? 0 : sel.prices[c]?.eurT ?? null))
  const avgPrice = prices.every((p) => p !== null) ? (prices as number[]).reduce((a, b) => a + b, 0) / prices.length : null
  const priceYear = Math.max(...Object.values(sel.prices).map((p) => p?.year ?? 0))
  return (
    <div className="fx-cards">
      <Card k="water" slot={slots.water} label="Agua" value={r.water} wordTxt={word(r.water)} base={base.water} rotation={rotation}
        ev={sel.climate ? `Lluvia media ${fmt(sel.climate.lluvia)} mm · déficit ${fmt(sel.climate.deficit)} mm/año` : 'Sin clima de la celda'} />
      <Card k="market" slot={slots.market} label="Mercado" value={r.profit} wordTxt={word(r.profit)} base={base.profit} rotation={rotation}
        ev={avgPrice !== null ? `≈ ${fmt(avgPrice)} €/t de media (${priceYear}) · proxy de precio, sin costes` : 'Sin precio para todos los cultivos'} />
      <Card k="soil" slot={slots.soil} label="Suelo" value={r.soil} wordTxt={word(r.soil)} base={base.soil} rotation={rotation}
        ev={soil ? `Agua disponible ${fmt(soil.cad_0_100_mm)} mm · pH ${fmt(soil.ph_h2o, 1)}` : 'Sin dato SoilGrids: suelo típico'}
        extra={soil?.arcilla_pct != null && soil.limo_pct != null && soil.arena_pct != null && (
          <>
            <div className="tex"><i style={{ width: `${soil.arcilla_pct}%`, background: '#8A5A3C' }} /><i style={{ width: `${soil.limo_pct}%`, background: '#B58E62' }} /><i style={{ width: `${soil.arena_pct}%`, background: '#D8C29A' }} /></div>
            <div className="tex-k"><span>arcilla {fmt(soil.arcilla_pct)} %</span><span>limo {fmt(soil.limo_pct)} %</span><span>arena {fmt(soil.arena_pct)} %</span></div>
          </>
        )} />
      <Card k="risk" slot={slots.risk} label="Riesgo climático" value={r.risk} wordTxt={riskWord(r.risk)} base={base.risk} rotation={rotation}
        ev={sel.climate ? `${fmt(sel.climate.calor)} días de calor en may–jun · ${fmt(sel.climate.heladas)} de helada` : 'Sin clima de la celda'} />
    </div>
  )
}

/** Panel lateral con la pestaña de condiciones de la app (clima POWER, suelo, NDVI). */
function DatosCompletos({ sel, onClose }: { sel: Seleccion; onClose: () => void }) {
  useEffect(() => {
    const field = toField([sel.finca])
    const [lon, lat] = fieldCentroid(field)
    useStore.setState({ selection: [sel.finca], field })
    useStore.getState().loadFarmData()
    useStore.getState().loadClimate(lat, lon)
  }, [sel])
  return (
    <aside className="xp-sheet bg-surface text-ink" aria-label="Datos completos de la finca">
      <header>
        <div>
          <h2>Datos completos</h2>
          <p>Finca {sel.finca.properties.pol}-{sel.finca.properties.par} · {sel.municipio}</p>
        </div>
        <button onClick={onClose} aria-label="Cerrar datos completos">✕</button>
      </header>
      <div className="body">
        <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><ConditionsTab /></Suspense>
      </div>
    </aside>
  )
}

export function FincaView({ ctrl }: { ctrl: React.RefObject<ExplorerController | null> }) {
  const sel = useExplorer((s) => s.sel)
  // Una instancia por finca: al cambiar de finca o salir, su estado (reproducción, panel,
  // posición de tarjetas) empieza de cero.
  return <div className="fx">{sel && <FincaPanel key={sel.finca.properties.id} sel={sel} ctrl={ctrl} />}</div>
}

function FincaPanel({ sel, ctrl }: { sel: Seleccion; ctrl: React.RefObject<ExplorerController | null> }) {
  const view = useExplorer((s) => s.view)
  const synthetic = useExplorer((s) => s.synthetic)
  const [slots, setSlots] = useState(DEFAULT_SLOTS)
  const [playing, setPlaying] = useState(false)
  const [datos, setDatos] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const dio = () => ctrl.current?.dio ?? null

  // Líneas guía de cada tarjeta a su punto del terreno. Los rectángulos de las tarjetas se
  // leen como mucho cada 400 ms para no forzar un recálculo de layout por fotograma.
  useEffect(() => {
    const d = ctrl.current?.dio
    const panel = root.current
    if (!d || !panel) return
    let rects: Record<string, DOMRect> | null = null
    let host: DOMRect | null = null
    let at = 0
    let last = ''
    return d.attachOverlay({
      label: `${fmt(sel.finca.properties.ha, 1)} ha`,
      // Cada tarjeta va al lado de la pantalla donde cae su punto: así las guías no cruzan el bloque.
      onCardsIn: (a) => {
        if (window.innerWidth < 760) return
        const byX = [...CARDS].sort((p, q) => a[p].x - a[q].x)
        const side = (pair: CardKey[], top: Slot, bottom: Slot) => pair.sort((p, q) => a[p].y - a[q].y).map((k, i) => [k, i ? bottom : top] as const)
        setSlots(Object.fromEntries([...side(byX.slice(0, 2), 's-lt', 's-lb'), ...side(byX.slice(2), 's-rt', 's-rb')]) as Record<CardKey, Slot>)
      },
      onFrame: (a) => {
        if (window.innerWidth < 760) return
        const now = performance.now()
        if (!rects || now - at > 400) {
          host = d.container.getBoundingClientRect()
          rects = Object.fromEntries([...panel.querySelectorAll<HTMLElement>('.fx-card[data-k]')].map((el) => [el.dataset.k!, el.getBoundingClientRect()]))
          at = now
        }
        let html = ''
        for (const k of CARDS) {
          const r = rects[k], pt = a[k]
          if (!r || !pt || pt.behind || !host) continue
          const left = r.left - host.left < host.width / 2
          const x0 = Math.round(left ? r.right - host.left : r.left - host.left)
          const y0 = Math.round(r.top - host.top + 26)
          const xm = x0 + (left ? 18 : -18), px = Math.round(pt.x), py = Math.round(pt.y)
          html += `<path d="M${x0},${y0} L${xm},${y0} L${px},${py}"/><circle class="ring" cx="${px}" cy="${py}" r="7"/><circle class="dot" cx="${px}" cy="${py}" r="2.6"/>`
        }
        if (html !== last) {
          d.leaders.innerHTML = html
          last = html
        }
      },
    })
  }, [sel, ctrl])

  const p = sel.finca.properties
  const crop = cropForYear(sel.escena, view.year, view.rotation)
  const best = sel.scores ? (Object.keys(sel.scores) as RotationKey[]).find((k) => sel.scores![k].rank[view.profile] === 1) : undefined
  const legendKeys = [...new Set(YEARS.map((y) => cropForYear(sel.escena, y, view.rotation).key))]
  const permanente = sel.escena.rot?.split('-').every((l) => l === 'P') || p.cover === 'arbolado'

  const play = (from?: number) => {
    setPlaying(true)
    dio()?.play(from, () => setPlaying(false))
  }
  const stop = () => {
    dio()?.stopPlay()
    setPlaying(false)
  }

  return (
    <div className="fx-panel" ref={root}>
      <header className="fx-head">
        <p className="eyebrow">{p.cand ? 'Candidata del proyecto' : 'Finca'} · {sel.municipio}</p>
        <h2>{fmt(p.ha, 1)}<small>ha</small></h2>
        <p className="fx-meta">SIGPAC {p.pid} · {fmt(sel.detalle?.recintos)} recintos · {fmt(p.alt)} m · pendiente {fmt(p.slope, 1)} %</p>
        <div className="now">
          <i style={{ background: CROPS[crop.key]?.color ?? '#777' }} />
          <b>{CROPS[crop.key]?.label ?? crop.key}</b>
          <span>{crop.observed ? `campaña ${view.year} · MODIS` : `${view.year} · escenario ${view.rotation}`}</span>
        </div>
        {p.apt && <p className="warn">⚠ {APT[p.apt]}: las rotaciones de herbáceos encajan peor aquí.</p>}
        {!p.apt && permanente && <p className="warn">Parece un cultivo permanente (arbolado); las rotaciones son orientativas.</p>}
      </header>

      <div className="fx-tools">
        <div className="seg" role="group" aria-label="Estilo del terreno">
          {(['satelite', 'maqueta'] as Mode[]).map((m) => (
            <button key={m} aria-pressed={view.mode === m} onClick={() => dio()?.setMode(m)}>{m === 'satelite' ? 'Satélite' : 'Maqueta'}</button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Exageración del relieve">
          {[1, 2, 3.5].map((e) => (
            <button key={e} aria-pressed={Math.abs(view.exaggeration - e) < 0.01} onClick={() => dio()?.setExaggeration(e)}>×{fmt(e, e % 1 ? 1 : 0)}</button>
          ))}
        </div>
        <button className="icon-btn" aria-label="Recentrar vista" onClick={() => dio()?.resetView()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5" /><path d="M4 4v4.5h4.5" /></svg>
        </button>
        <button className="datos-btn" aria-pressed={datos} onClick={() => setDatos(!datos)}>Datos completos</button>
      </div>

      <Cards sel={sel} rotation={view.rotation} slots={slots} />

      <section className="fx-dock glass" aria-label="Campañas y rotaciones">
        <div className="tl">
          <button className="play" aria-label={playing ? 'Pausar' : 'Reproducir campañas'} onClick={() => (playing ? stop() : play())}>
            {playing ? <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg> : <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z" /></svg>}
          </button>
          <div className="years" data-scn={`Escenario ${view.rotation}`}>
            {YEARS.map((y) => {
              const c = cropForYear(sel.escena, y, view.rotation)
              return (
                <button key={y} className={`year ${y >= FIRST_SCENARIO_YEAR ? 'future' : ''}`} aria-current={y === view.year} title={CROPS[c.key]?.label ?? c.key}
                  style={{ '--c': CROPS[c.key]?.color ?? '#666' } as React.CSSProperties}
                  onClick={() => { stop(); dio()?.setYear(y) }}>
                  <i /><span>{String(y).slice(2)}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="rots">
          {(['R0', 'R1', 'R2', 'R3'] as RotationKey[]).map((code) => (
            <button key={code} className="rot" aria-pressed={code === view.rotation} disabled={!sel.scores}
              onClick={async () => {
                await dio()?.setRotation(code)
                if ((dio()?.state.year ?? 0) < FIRST_SCENARIO_YEAR) play(FIRST_SCENARIO_YEAR)
              }}>
              <b>{code}</b>
              <strong>{fmt(sel.scores?.[code].score[view.profile], 1)}</strong>
              <span>{ROTACION_CORTA[code]}</span>
              {code === best && <i className="best">★ mejor</i>}
            </button>
          ))}
          <div className="prio">
            <label>Prioridad</label>
            <div className="seg">
              {PERFILES.map(([k, l]) => (
                <button key={k} aria-pressed={k === view.profile} onClick={() => dio()?.setProfile(k as ProfileKey)}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <aside className="fx-legend">
        <div className="sw">{legendKeys.map((k) => <span key={k}><i style={{ background: CROPS[k]?.color }} />{CROPS[k]?.label ?? k}</span>)}</div>
        <div className="note">
          Relieve real (DEM) exagerado ×{fmt(view.exaggeration, 1)}. Notas con la calculadora del proyecto sobre los CSV de la finca. {DISCLAIMER}
          {synthetic && <><br /><span className="badge-synth">Sin conexión: relieve u ortofoto sintéticos</span></>}
        </div>
      </aside>

      {datos && <DatosCompletos sel={sel} onClose={() => setDatos(false)} />}
    </div>
  )
}
