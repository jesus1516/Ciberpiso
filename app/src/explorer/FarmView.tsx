// Interface of the farm view: an information column (the 1–3 insights that matter most for this
// farm, header, the four indicator cards, timeline with MODIS campaigns + scenario and the R0–R3
// selector with its recommendation) next to the 3D terrain,
// which carries numbered markers (1–4) that match the cards. "Full data" opens the app's
// conditions tab (POWER climate, soil and NDVI of the farm) as a drawer over the column.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { RotationScore } from '../lib/calculator'
import { fieldCentroid, toField } from '../lib/geo'
import type { ProfileKey, RotationKey } from '../lib/indicators'
import { useStore } from '../store'
import type { ExplorerController } from './controller'
import type { MarkerKey } from './diorama'
import { farmInsights, recommendation, type Insight, type InsightTarget, type Severity } from './insights'
import { FIRST_SCENARIO_YEAR, LAST_YEAR, cropForYear, cropInfo, type Mode } from './scene'
import { SOIL_TEXTURE as SOIL_TEX } from './tokens'
import { useExplorer, type Selection } from './state'
import { DISCLAIMER, PROFILES, SHORT_ROTATION, fmt } from './texts'

// The conditions tab brings the charts (recharts): it is only downloaded when opened.
const ConditionsTab = lazy(() => import('../components/ConditionsTab').then((m) => ({ default: m.ConditionsTab })))

type CardKey = MarkerKey
/** Column order, top to bottom; the number is the one shown on the terrain marker. */
const CARDS: { k: CardKey; n: number; label: string }[] = [
  { k: 'water', n: 1, label: 'Water' },
  { k: 'soil', n: 2, label: 'Soil' },
  { k: 'market', n: 3, label: 'Market' },
  { k: 'risk', n: 4, label: 'Climate risk' },
]
/** Where each marker sits on the terrain (said on the card, so the number is not a riddle). */
const WHERE: Record<CardKey, string> = {
  water: 'lowest point of the farm',
  soil: 'soil profile on the side of the block',
  market: 'centre of the farm',
  risk: 'highest point of the farm',
}
/** Colour of a crop group and the ink that reads on it; the crop's letter is printed on top. */
const cropStyle = (key: string) => ({ '--c': cropInfo(key).color, '--ink': cropInfo(key).ink }) as React.CSSProperties
const YEARS = Array.from({ length: LAST_YEAR - 2019 }, (_, i) => 2020 + i)

const ICONS: Record<CardKey, React.ReactNode> = {
  water: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z" /></svg>,
  soil: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 8h18M3 13h18M3 18h18" /><path d="M7 8v5M14 13v5M17 8v5" opacity=".6" /></svg>,
  market: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17l5-5 4 3 7-8" /><path d="M15 7h5v5" /></svg>,
  risk: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5" /></svg>,
}
// Score → word (and, through `level`, a status colour). The word is the signal, the colour only reinforces it.
type Level = 'good' | 'warn' | 'bad'
const level = (v: number | null): Level | null => (v === null ? null : v >= 70 ? 'good' : v >= 55 ? 'warn' : 'bad')
const word = (v: number | null) => (v === null ? '—' : v >= 70 ? 'high' : v >= 55 ? 'medium' : 'low')
const riskWord = (v: number | null) => (v === null ? '—' : v >= 70 ? 'low risk' : v >= 55 ? 'medium risk' : 'high risk')
const LEVEL_GLYPH: Record<Level, string> = { good: '▲', warn: '■', bad: '▼' } // shape as well as colour

type Hot = { hot: CardKey | null; setHot: (k: CardKey | null) => void }
/** Emphasis: the element behind the top insight (or the one the user picked) stands out, the rest recede. */
type Emph = { emph: InsightTarget | null; pick: (k: InsightTarget) => void }

function Card({ k, value, wordTxt, base, rotation, ev, extra, hot, setHot, emph, pick }: {
  k: CardKey; value: number | null; wordTxt: string; base: number | null; rotation: RotationKey; ev: string; extra?: React.ReactNode
} & Hot & Emph) {
  const { n, label } = CARDS.find((c) => c.k === k)!
  const delta = value !== null && base !== null ? value - base : null
  const on = () => setHot(k)
  const off = () => setHot(null)
  const state = emph === null ? '' : emph === k ? 'emph' : 'recede'
  return (
    <article className={`fx-card glass ${hot === k ? 'hot' : ''} ${state}`} data-k={k} tabIndex={0}
      title={state === 'recede' ? `${label}: ${ev}. Click to show the details.` : undefined}
      onMouseEnter={on} onMouseLeave={off} onFocus={on} onBlur={off} onClick={() => pick(k)}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(k) } }}>
      <div className="lbl"><span className="num" aria-label={`Marker ${n} on the terrain`} title={`Marker ${n} on the terrain: ${WHERE[k]}`}>{n}</span>{ICONS[k]}<span>{label}</span></div>
      <div className="val"><strong>{fmt(value)}</strong><small>/100</small><em className="word" data-lv={level(value) ?? undefined}>{level(value) && <span aria-hidden="true">{LEVEL_GLYPH[level(value)!]} </span>}{wordTxt}</em></div>
      <div className="bar"><i style={{ '--v': `${Math.max(0, Math.min(100, value ?? 0))}%` } as React.CSSProperties} /></div>
      {rotation === 'R0' || delta === null ? (
        <span className="delta">baseline (current)</span>
      ) : (
        <span className={`delta ${delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : ''}`}>{delta > 0.05 && <span aria-hidden="true">▲ </span>}{delta < -0.05 && <span aria-hidden="true">▼ </span>}{delta > 0 ? '+' : ''}{fmt(delta, 1)} vs. current</span>
      )}
      {extra}
      <div className="ev">{ev}</div>
    </article>
  )
}

function Cards({ sel, rotation, hot, setHot, emph, pick }: { sel: Selection; rotation: RotationKey } & Hot & Emph) {
  const r: RotationScore | undefined = sel.scores?.[rotation]
  const base = sel.scores?.R0
  if (!r || !base) {
    return (
      <div className="fx-cards">
        <article className="fx-card glass nodata">
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
  const h = { hot, setHot, rotation, emph, pick }
  return (
    <div className="fx-cards">
      <Card k="water" value={r.water} wordTxt={word(r.water)} base={base.water} {...h}
        ev={sel.climate ? `Mean rainfall ${fmt(sel.climate.rain)} mm · deficit ${fmt(sel.climate.deficit)} mm/year` : 'No climate data for the cell'} />
      <Card k="soil" value={r.soil} wordTxt={word(r.soil)} base={base.soil} {...h}
        ev={soil ? `Available water ${fmt(soil.cad_0_100_mm)} mm · pH ${fmt(soil.ph_h2o, 1)}` : 'No SoilGrids data: typical soil'}
        extra={soil?.arcilla_pct != null && soil.limo_pct != null && soil.arena_pct != null && (
          <div className="tex-row">
            <div className="tex"><i style={{ width: `${soil.arcilla_pct}%`, background: SOIL_TEX.clay }} /><i style={{ width: `${soil.limo_pct}%`, background: SOIL_TEX.silt }} /><i style={{ width: `${soil.arena_pct}%`, background: SOIL_TEX.sand }} /></div>
            <div className="tex-k"><span>clay {fmt(soil.arcilla_pct)} %</span><span>silt {fmt(soil.limo_pct)} %</span><span>sand {fmt(soil.arena_pct)} %</span></div>
          </div>
        )} />
      <Card k="market" value={r.profit} wordTxt={word(r.profit)} base={base.profit} {...h}
        ev={avgPrice !== null ? `≈ ${fmt(avgPrice)} €/t on average (${priceYear}) · price proxy, no costs` : 'No price for all the crops'} />
      <Card k="risk" value={r.risk} wordTxt={riskWord(r.risk)} base={base.risk} {...h}
        ev={sel.climate ? `${fmt(sel.climate.hotDays)} hot days in May–Jun · ${fmt(sel.climate.frostDays)} frost days` : 'No climate data for the cell'} />
    </div>
  )
}

const SEVERITY: Record<Severity, string> = { critical: 'Critical', warning: 'Warning', good: 'Opportunity' }
const SEVERITY_ICON: Record<Severity, React.ReactNode> = {
  critical: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17v.5" /></svg>,
  warning: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.5" /></svg>,
  good: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16.5 9" /></svg>,
}

/**
 * The 1–3 insights of the farm (insights.ts), most important first and largest. The others are
 * one-line disclosures. Pointing at one highlights its card; opening one emphasises that card.
 */
function Insights({ items, setHot, pick }: { items: Insight[] } & Pick<Hot, 'setHot'> & Pick<Emph, 'pick'>) {
  if (!items.length) return null
  const [top, ...rest] = items
  const card = (t: InsightTarget | null) => (t && t !== 'rotations' ? t : null)
  const point = (i: Insight) => ({ onMouseEnter: () => setHot(card(i.target)), onMouseLeave: () => setHot(null) })
  return (
    <section className="fx-insights" aria-label="What matters on this farm">
      <article className={`ins top ${top.severity}`} {...point(top)}>
        <p className="sev">{SEVERITY_ICON[top.severity]}{SEVERITY[top.severity]}</p>
        <h2>{top.headline}</h2>
        <p className="why">{top.detail}</p>
      </article>
      {rest.length > 0 && (
        <ul className="ins-more">
          {rest.map((i) => (
            <li key={i.id} className={`ins ${i.severity}`} {...point(i)}>
              <details onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open && i.target) pick(i.target) }}>
                <summary>{SEVERITY_ICON[i.severity]}<span className="vh">{SEVERITY[i.severity]}: </span><span className="hl">{i.headline}</span></summary>
                <p className="why">{i.detail}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
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
  // highlighted card) starts from scratch.
  return <div className="fx">{sel && <FarmPanel key={sel.farm.properties.id} sel={sel} ctrl={ctrl} />}</div>
}

function FarmPanel({ sel, ctrl }: { sel: Selection; ctrl: React.RefObject<ExplorerController | null> }) {
  const view = useExplorer((s) => s.view)
  const synthetic = useExplorer((s) => s.synthetic)
  const [playing, setPlaying] = useState(false)
  const [showFullData, setShowFullData] = useState(false)
  const [hot, setHot] = useState<CardKey | null>(null)
  const [picked, setPicked] = useState<InsightTarget | null>(null)
  const col = useRef<HTMLElement>(null)
  const live = useRef<HTMLParagraphElement>(null)
  const dio = () => ctrl.current?.dio ?? null

  // Numbered markers on the terrain, one per card (only when the farm has scores). Hovering a
  // marker highlights its card; clicking it brings the card into view and focuses it.
  useEffect(() => {
    const d = ctrl.current?.dio
    if (!d || !sel.scores) return
    return d.attachOverlay({
      markers: CARDS.map(({ k, n, label }) => ({ key: k, n, label: `${n} · ${label}: ${WHERE[k]}` })),
      onHover: setHot,
      onSelect: (k) => {
        setPicked(k)
        const card = col.current?.querySelector<HTMLElement>(`.fx-card[data-k="${k}"]`)
        card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        card?.focus({ preventScroll: true })
      },
    })
  }, [sel, ctrl])
  useEffect(() => ctrl.current?.dio?.highlight(hot), [hot, ctrl])

  const p = sel.farm.properties
  const crop = cropForYear(sel.farmScene, view.year, view.rotation)
  const best = sel.scores ? (Object.keys(sel.scores) as RotationKey[]).find((k) => sel.scores![k].rank[view.profile] === 1) : undefined
  const legendKeys = [...new Set(YEARS.map((y) => cropForYear(sel.farmScene, y, view.rotation).key))]
  const insights = useMemo(() => farmInsights({
    scores: sel.scores,
    climate: sel.climate,
    soil: sel.detail?.suelo ?? null,
    slope: sel.farm.properties.slope ?? sel.detail?.pendiente_pct ?? null,
    apt: sel.farm.properties.apt,
    cover: sel.farm.properties.cover ?? sel.detail?.cobertura_dominante ?? null,
    landCover: sel.detail?.cobertura ?? null,
    seasons: sel.farmScene.rot,
    profile: view.profile,
  }), [sel, view.profile])
  const rec = useMemo(() => recommendation(sel.scores, view.profile), [sel, view.profile])
  // The element behind the top insight is emphasised until the user picks another one.
  const emph = sel.scores ? picked ?? insights[0]?.target ?? null : null
  const pick = (k: InsightTarget) => setPicked(k)

  // Announce the key point once, when the farm view opens: the live region is in the page
  // (empty) before its text arrives, which is what makes screen readers read it.
  const announcement = insights.length
    ? `Key point for this farm: ${insights[0].headline}.${insights.length > 1 ? ` Also: ${insights.slice(1).map((i) => i.headline).join('; ')}.` : ''}`
    : ''
  const [opening] = useState(announcement) // the text when the view opened; not re-announced on later changes
  useEffect(() => {
    if (!opening) return
    const t = window.setTimeout(() => { if (live.current) live.current.textContent = opening }, 700)
    return () => clearTimeout(t)
  }, [opening])

  const play = (from?: number) => {
    setPlaying(true)
    dio()?.play(from, () => setPlaying(false))
  }
  const stop = () => {
    dio()?.stopPlay()
    setPlaying(false)
  }

  return (
    <div className="fx-panel">
      <aside className="fx-col" ref={col} aria-label="Farm information">
        <p className="vh" aria-live="polite" ref={live} />
        <Insights items={insights} setHot={setHot} pick={pick} />

        <header className="fx-head">
          <p className="eyebrow">{p.cand ? 'Project candidate' : 'Farm'} · {sel.municipality}</p>
          <div className="fx-title">
            <h2>{fmt(p.ha, 1)}<small>ha</small></h2>
            <div className="now">
              <i className="crop-sw" style={cropStyle(crop.key)} aria-hidden="true">{cropInfo(crop.key).letter}</i>
              <b>{cropInfo(crop.key).label}</b>
              <span>{crop.observed ? `campaign ${view.year} · MODIS` : `${view.year} · scenario ${view.rotation}`}</span>
            </div>
          </div>
          <p className="fx-meta">SIGPAC {p.pid} · {fmt(sel.detail?.recintos)} enclosures · {fmt(p.alt)} m · slope {fmt(p.slope, 1)} %</p>
        </header>

        <Cards sel={sel} rotation={view.rotation} hot={hot} setHot={setHot} emph={emph} pick={pick} />

        <section className={`fx-dock glass ${emph === 'rotations' ? 'emph' : ''}`} aria-label="Campaigns and rotations">
          <div className="tl">
            <button className="play" aria-label={playing ? 'Pause' : 'Play campaigns'} onClick={() => (playing ? stop() : play())}>
              {playing ? <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg> : <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z" /></svg>}
            </button>
            <div className="years" data-scn={`Scenario ${view.rotation}`}>
              {YEARS.map((y) => {
                const c = cropForYear(sel.farmScene, y, view.rotation)
                return (
                  <button key={y} className={`year ${y >= FIRST_SCENARIO_YEAR ? 'future' : ''}`} aria-current={y === view.year} title={`${y} · ${cropInfo(c.key).label}${y >= FIRST_SCENARIO_YEAR ? ' (scenario)' : ' (observed)'}`}
                    onClick={() => { stop(); dio()?.setYear(y) }}>
                    <i style={cropStyle(c.key)} aria-hidden="true">{cropInfo(c.key).letter}</i><span>{String(y).slice(2)}</span>
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
                {code === best && <i className="best" title="Best rotation for this priority">★</i>}
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
            {rec && <p className="rec"><b>Recommendation</b> {rec}</p>}
          </div>
        </section>

        <p className="fx-note">
          Real relief (DEM) exaggerated ×{fmt(view.exaggeration, 1)}. Scores from the project calculator on the farm's CSV data. {DISCLAIMER}
        </p>
      </aside>

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
        <button className="icon-btn" aria-label="Re-centre view" title="Re-centre view" onClick={() => dio()?.resetView()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5" /><path d="M4 4v4.5h4.5" /></svg>
        </button>
        <button className="full-data-btn" aria-pressed={showFullData} onClick={() => setShowFullData(!showFullData)}>Full data</button>
      </div>

      <aside className="fx-legend" aria-label="Terrain legend">
        <div className="sw">{legendKeys.map((k) => <span key={k}><i style={cropStyle(k)} aria-hidden="true">{cropInfo(k).letter}</i>{cropInfo(k).label}</span>)}</div>
        {synthetic && <span className="badge-synth">Offline: synthetic relief or orthophoto</span>}
      </aside>

      {showFullData && <FullData sel={sel} onClose={() => setShowFullData(false)} />}
    </div>
  )
}
