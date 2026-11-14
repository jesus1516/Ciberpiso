// Interface over the 3D terrain: header, four cards anchored to the terrain with guide
// lines, timeline (MODIS campaigns + scenario) and R0–R3 selector. "Full data"
// opens the app's conditions tab (POWER climate, soil and NDVI of the farm).
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { RotationScore } from '../lib/calculator'
import { fieldCentroid, toField } from '../lib/geo'
import type { ProfileKey, RotationKey } from '../lib/indicators'
import { useStore } from '../store'
import type { ExplorerController } from './controller'
import { CROPS, FIRST_SCENARIO_YEAR, LAST_YEAR, cropForYear, type Mode } from './scene'
import { useExplorer, type Selection } from './state'
import { APT, DISCLAIMER, PROFILES, SHORT_ROTATION, fmt } from './texts'

// The conditions tab brings the charts (recharts): it is only downloaded when opened.
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
const word = (v: number | null) => (v === null ? '—' : v >= 70 ? 'high' : v >= 55 ? 'medium' : 'low')
const riskWord = (v: number | null) => (v === null ? '—' : v >= 70 ? 'low risk' : v >= 55 ? 'medium risk' : 'high risk')

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
        <span className="delta">baseline (current)</span>
      ) : (
        <span className={`delta ${delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : ''}`}>{delta > 0 ? '+' : ''}{fmt(delta, 1)} vs. current</span>
      )}
    </article>
  )
}

function Cards({ sel, rotation, slots }: { sel: Selection; rotation: RotationKey; slots: Record<CardKey, Slot> }) {
  const r: RotationScore | undefined = sel.scores?.[rotation]
  const base = sel.scores?.R0
  if (!r || !base) {
    return (
      <div className="fx-cards">
        <article className="fx-card glass s-lt nodata">
          <div className="lbl"><span>No project data</span></div>
          <div className="ev">This farm has no climate and soil data in the project CSVs, so its rotations cannot be scored.</div>
        </article>
      </div>
    )
  }
  const soil = sel.detail?.suelo
  const prices = r.crops.map((c) => (c === 'barbecho' ? 0 : sel.prices[c]?.eurT ?? null))
  const avgPrice = prices.every((p) => p !== null) ? (prices as number[]).reduce((a, b) => a + b, 0) / prices.length : null
  const priceYear = Math.max(...Object.values(sel.prices).map((p) => p?.year ?? 0))
  return (
    <div className="fx-cards">
      <Card k="water" slot={slots.water} label="Water" value={r.water} wordTxt={word(r.water)} base={base.water} rotation={rotation}
        ev={sel.climate ? `Mean rainfall ${fmt(sel.climate.rain)} mm · deficit ${fmt(sel.climate.deficit)} mm/year` : 'No climate data for the cell'} />
      <Card k="market" slot={slots.market} label="Market" value={r.profit} wordTxt={word(r.profit)} base={base.profit} rotation={rotation}
        ev={avgPrice !== null ? `≈ ${fmt(avgPrice)} €/t on average (${priceYear}) · price proxy, excluding costs` : 'No price for all the crops'} />
      <Card k="soil" slot={slots.soil} label="Soil" value={r.soil} wordTxt={word(r.soil)} base={base.soil} rotation={rotation}
        ev={soil ? `Available water ${fmt(soil.cad_0_100_mm)} mm · pH ${fmt(soil.ph_h2o, 1)}` : 'No SoilGrids data: typical soil'}
        extra={soil?.arcilla_pct != null && soil.limo_pct != null && soil.arena_pct != null && (
          <>
            <div className="tex"><i style={{ width: `${soil.arcilla_pct}%`, background: '#8A5A3C' }} /><i style={{ width: `${soil.limo_pct}%`, background: '#B58E62' }} /><i style={{ width: `${soil.arena_pct}%`, background: '#D8C29A' }} /></div>
            <div className="tex-k"><span>clay {fmt(soil.arcilla_pct)} %</span><span>silt {fmt(soil.limo_pct)} %</span><span>sand {fmt(soil.arena_pct)} %</span></div>
          </>
        )} />
      <Card k="risk" slot={slots.risk} label="Climate risk" value={r.risk} wordTxt={riskWord(r.risk)} base={base.risk} rotation={rotation}
        ev={sel.climate ? `${fmt(sel.climate.hotDays)} hot days in May–Jun · ${fmt(sel.climate.frostDays)} frost days` : 'No climate data for the cell'} />
    </div>
  )
}

/** Side panel with the app's conditions tab (POWER climate, soil, NDVI). */
function FullData({ sel, onClose }: { sel: Selection; onClose: () => void }) {
  useEffect(() => {
    const field = toField([sel.farm])
    const [lon, lat] = fieldCentroid(field)
    useStore.setState({ selection: [sel.farm], field })
    useStore.getState().loadFarmData()
    useStore.getState().loadClimate(lat, lon)
  }, [sel])
  return (
    <aside className="xp-sheet bg-surface text-ink" aria-label="Full data for the farm">
      <header>
        <div>
          <h2>Full data</h2>
          <p>Farm {sel.farm.properties.pol}-{sel.farm.properties.par} · {sel.municipality}</p>
        </div>
        <button onClick={onClose} aria-label="Close full data">✕</button>
      </header>
      <div className="body">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}><ConditionsTab /></Suspense>
      </div>
    </aside>
  )
}

export function FarmView({ ctrl }: { ctrl: React.RefObject<ExplorerController | null> }) {
  const sel = useExplorer((s) => s.sel)
  // One instance per farm: when switching farm or leaving, its state (playback, panel,
  // card positions) starts from scratch.
  return <div className="fx">{sel && <FarmPanel key={sel.farm.properties.id} sel={sel} ctrl={ctrl} />}</div>
}

function FarmPanel({ sel, ctrl }: { sel: Selection; ctrl: React.RefObject<ExplorerController | null> }) {
  const view = useExplorer((s) => s.view)
  const synthetic = useExplorer((s) => s.synthetic)
  const [slots, setSlots] = useState(DEFAULT_SLOTS)
  const [playing, setPlaying] = useState(false)
  const [showFullData, setShowFullData] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const dio = () => ctrl.current?.dio ?? null

  // Guide lines from each card to its point on the terrain. The card rectangles are
  // read at most every 400 ms so as not to force a layout recalculation per frame.
  useEffect(() => {
    const d = ctrl.current?.dio
    const panel = root.current
    if (!d || !panel) return
    let rects: Record<string, DOMRect> | null = null
    let host: DOMRect | null = null
    let at = 0
    let last = ''
    return d.attachOverlay({
      label: `${fmt(sel.farm.properties.ha, 1)} ha`,
      // Each card goes to the side of the screen where its point falls: so the guides do not cross the block.
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

  const p = sel.farm.properties
  const crop = cropForYear(sel.farmScene, view.year, view.rotation)
  const best = sel.scores ? (Object.keys(sel.scores) as RotationKey[]).find((k) => sel.scores![k].rank[view.profile] === 1) : undefined
  const legendKeys = [...new Set(YEARS.map((y) => cropForYear(sel.farmScene, y, view.rotation).key))]
  const isPermanent = sel.farmScene.rot?.split('-').every((l) => l === 'P') || p.cover === 'arbolado'

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
        <p className="eyebrow">{p.cand ? 'Project candidate' : 'Farm'} · {sel.municipality}</p>
        <h2>{fmt(p.ha, 1)}<small>ha</small></h2>
        <p className="fx-meta">SIGPAC {p.pid} · {fmt(sel.detail?.recintos)} enclosures · {fmt(p.alt)} m · slope {fmt(p.slope, 1)} %</p>
        <div className="now">
          <i style={{ background: CROPS[crop.key]?.color ?? '#777' }} />
          <b>{CROPS[crop.key]?.label ?? crop.key}</b>
          <span>{crop.observed ? `campaign ${view.year} · MODIS` : `${view.year} · scenario ${view.rotation}`}</span>
        </div>
        {p.apt && <p className="warn">⚠ {APT[p.apt]}: herbaceous rotations fit less well here.</p>}
        {!p.apt && isPermanent && <p className="warn">This looks like a permanent crop (tree cover); rotations are indicative.</p>}
      </header>

      <div className="fx-tools">
        <div className="seg" role="group" aria-label="Terrain style">
          {(['satellite', 'model'] as Mode[]).map((m) => (
            <button key={m} aria-pressed={view.mode === m} onClick={() => dio()?.setMode(m)}>{m === 'satellite' ? 'Satellite' : 'Model'}</button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Relief exaggeration">
          {[1, 2, 3.5].map((e) => (
            <button key={e} aria-pressed={Math.abs(view.exaggeration - e) < 0.01} onClick={() => dio()?.setExaggeration(e)}>×{fmt(e, e % 1 ? 1 : 0)}</button>
          ))}
        </div>
        <button className="icon-btn" aria-label="Re-centre view" onClick={() => dio()?.resetView()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5" /><path d="M4 4v4.5h4.5" /></svg>
        </button>
        <button className="full-data-btn" aria-pressed={showFullData} onClick={() => setShowFullData(!showFullData)}>Full data</button>
      </div>

      <Cards sel={sel} rotation={view.rotation} slots={slots} />

      <section className="fx-dock glass" aria-label="Campaigns and rotations">
        <div className="tl">
          <button className="play" aria-label={playing ? 'Pause' : 'Play campaigns'} onClick={() => (playing ? stop() : play())}>
            {playing ? <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg> : <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z" /></svg>}
          </button>
          <div className="years" data-scn={`Scenario ${view.rotation}`}>
            {YEARS.map((y) => {
              const c = cropForYear(sel.farmScene, y, view.rotation)
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
              <span>{SHORT_ROTATION[code]}</span>
              {code === best && <i className="best">★ best</i>}
            </button>
          ))}
          <div className="prio">
            <label>Priority</label>
            <div className="seg">
              {PROFILES.map(([k, l]) => (
                <button key={k} aria-pressed={k === view.profile} onClick={() => dio()?.setProfile(k as ProfileKey)}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <aside className="fx-legend">
        <div className="sw">{legendKeys.map((k) => <span key={k}><i style={{ background: CROPS[k]?.color }} />{CROPS[k]?.label ?? k}</span>)}</div>
        <div className="note">
          Real relief (DEM) exaggerated ×{fmt(view.exaggeration, 1)}. Scores from the project calculator on the farm's CSV data. {DISCLAIMER}
          {synthetic && <><br /><span className="badge-synth">Offline: synthetic relief or orthophoto</span></>}
        </div>
      </aside>

      {showFullData && <FullData sel={sel} onClose={() => setShowFullData(false)} />}
    </div>
  )
}
