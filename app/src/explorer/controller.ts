// Funnel Andalucía → Málaga → municipality → farm, with its transitions.
//
// Andalucía ⇄ Málaga: the camera dives into a cloud bank and the map swaps layers
// while the screen is covered. Málaga ⇄ municipality: the outline is traced, a low mist
// drifts along the edges and the municipality farms appear during the flight.
// Municipality → farm: the map flies to the farm from straight above, hands a snapshot of itself
// to the 3D terrain, which then rises. Farms that are not cropland (urban, water,
// public domain) cannot be opened; limited ones (forest, slope, rock) can, with a warning.
import bbox from '@turf/bbox'
import type { Feature, FeatureCollection, LineString, MultiPolygon, Polygon } from 'geojson'
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { calculateScores, ROTATIONS, scenarioFor } from '../lib/calculator'
import { latestPrice, loadCommon, loadDetails } from '../lib/detail'
import { loadMunicipality, loadMunicipalities } from '../lib/farms'
import type { Farm, FarmProps } from '../lib/geo'
import type { RotationKey } from '../lib/indicators'
import { HATCH, hatchImage, LIMITED, NOT_FARMLAND } from '../lib/mapStyle'
import { pulse } from '../lib/pulse'
import type { CloudLayer, CloudVariant } from './clouds'
import type { FarmDiorama } from './diorama'
import { tileFor, type BBox, type FarmScene } from './scene'
import { ACCENT, MAP, RAMP } from './tokens'
import { APT } from './texts'
import { reducedMotion, use3d } from './settings'
import { showToast, useExplorer, type FarmItem, type Level, type MunicipalityInfo, type ProvinceProps } from './state'

maplibregl.setWorkerUrl(workerUrl)

type Geo = Polygon | MultiPolygon
type FC<P = Record<string, unknown>> = FeatureCollection<Geo, P>
type Camera = { center: [number, number]; zoom: number; pitch: number; bearing: number }

const DATA = `${import.meta.env.BASE_URL}data`
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }
const AMBER = ACCENT // the one accent (tokens.ts)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const range = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
/**
 * The farms the keyboard list offers: farmland only (urban, water and public-domain farms cannot be
 * analysed and are not listed), candidates first, then by area. Limited farms (forest, steep, rock)
 * can be opened from the map with a warning, so they are listed too and say so.
 */
export function farmListOf(features: Farm[]): FarmItem[] {
  return features
    .filter((f) => !f.properties.apt || !NOT_FARMLAND.includes(f.properties.apt))
    .map(({ properties: p }) => ({ id: p.id, pid: p.pid, pol: p.pol, par: p.par, ha: p.ha, cand: p.cand > 0, apt: p.apt }))
    .sort((a, b) => Number(b.cand) - Number(a.cand) || b.ha - a.ha)
}
const mercX = (lon: number) => (lon + 180) / 360
const mercY = (lat: number) => {
  const s = Math.sin((lat * Math.PI) / 180)
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)
}
const lonOf = (x: number) => x * 360 - 180
const latOf = (y: number) => (360 / Math.PI) * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - 90
const outerRings = (g: Geo) => (g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((p) => p[0]))
const toLines = (g: Geo): FeatureCollection<LineString> => ({
  type: 'FeatureCollection',
  features: outerRings(g).map((coordinates) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })),
})
/** Large rectangle with holes: darkens everything outside the territory of the current level. */
const focusMask = (geoms: Geo[]): Feature<Polygon> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: [[[-25, 20], [20, 20], [20, 55], [-25, 55], [-25, 20]], ...geoms.flatMap(outerRings)] },
})
const boundsOf = (f: Feature | FeatureCollection): [[number, number], [number, number]] => {
  const [w, s, e, n] = bbox(f)
  return [[w, s], [e, n]]
}
const intersects = (a: BBox, b: BBox) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]

/** Zoom "towards a fixed point": the point that ends up centred approaches in a straight line, like a pinch. */
function cameraPath(a: Camera, b: Camera) {
  const ax = mercX(a.center[0]), ay = mercY(a.center[1]), bx = mercX(b.center[0]), by = mercY(b.center[1])
  const k = 2 ** -(b.zoom - a.zoom)
  const fixed = Math.abs(1 - k) > 1e-3
  const fx = fixed ? (bx - ax * k) / (1 - k) : 0, fy = fixed ? (by - ay * k) / (1 - k) : 0
  return (e: number) => {
    const z = lerp(a.zoom, b.zoom, e)
    const s = 2 ** -(z - a.zoom)
    const x = fixed ? fx + (ax - fx) * s : lerp(ax, bx, e)
    const y = fixed ? fy + (ay - fy) * s : lerp(ay, by, e)
    return { center: [lonOf(x), latOf(y)] as [number, number], zoom: z }
  }
}

const CLEAR = 'rgba(0,0,0,0)' // colour-ok: fully transparent, not a visible colour
function traceExpr(p: number, color: string): maplibregl.ExpressionSpecification {
  const q = Math.min(0.999, Math.max(0.0005, p))
  return ['interpolate', ['linear'], ['line-progress'], 0, color, q, color, Math.min(1, q + 0.0005), CLEAR, 1, CLEAR]
}
const hoverState = (on: unknown, off: unknown): maplibregl.ExpressionSpecification => ['case', ['boolean', ['feature-state', 'hover'], false], on, off] as maplibregl.ExpressionSpecification

function style(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      esri: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, bounds: [-10.5, 34.8, 0.5, 40.5], attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' },
      dem: { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 12, attribution: 'Terrain: Mapzen Terrarium / AWS Open Data' },
      resto: { type: 'geojson', data: EMPTY },
      prov: { type: 'geojson', data: EMPTY, promoteId: 'id', attribution: 'Boundaries: IGN via es-atlas (CC BY 4.0)' },
      muni: { type: 'geojson', data: EMPTY, promoteId: 'mun' },
      muniTrace: { type: 'geojson', data: EMPTY, lineMetrics: true },
      // Up to z14: beyond that it is upscaled. Slicing tens of thousands of farms at every zoom
      // saturates the worker and delays the other layers.
      farms: { type: 'geojson', data: EMPTY, promoteId: 'id', maxzoom: 14, buffer: 32, tolerance: 0.5, attribution: 'Farms: SIGPAC (FEGA, CC BY 4.0)' },
      sel: { type: 'geojson', data: EMPTY, lineMetrics: true },
      focus: { type: 'geojson', data: EMPTY },
      pulse: { type: 'geojson', data: EMPTY },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': MAP.bg } },
      { id: 'sat', type: 'raster', source: 'esri', paint: { 'raster-saturation': -0.8, 'raster-opacity': 0.3, 'raster-contrast': 0.05, 'raster-brightness-max': 0.85, 'raster-fade-duration': 150 } },
      { id: 'hill', type: 'hillshade', source: 'dem', paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': MAP.hillShadow, 'hillshade-highlight-color': MAP.hillHighlight, 'hillshade-accent-color': MAP.hillAccent, 'hillshade-illumination-direction': 315 } },
      { id: 'resto-fill', type: 'fill', source: 'resto', paint: { 'fill-color': MAP.rest, 'fill-opacity': 0.78 } },
      { id: 'resto-line', type: 'line', source: 'resto', paint: { 'line-color': MAP.restLine, 'line-width': 0.6 } },
      { id: 'focus-mask', type: 'fill', source: 'focus', paint: { 'fill-color': MAP.focusMask, 'fill-opacity': 0.5 } },
      { id: 'prov-fill', type: 'fill', source: 'prov', paint: { 'fill-color': hoverState(AMBER, ['case', ['==', ['get', 'id'], '29'], MAP.provinceHome, MAP.province]), 'fill-opacity': hoverState(0.55, 0.42) } },
      { id: 'prov-line', type: 'line', source: 'prov', paint: { 'line-color': ['case', ['==', ['get', 'id'], '29'], AMBER, MAP.provinceLine], 'line-width': ['case', ['==', ['get', 'id'], '29'], 1.6, 0.9] } },
      { id: 'malaga-glow', type: 'line', source: 'prov', filter: ['==', ['get', 'id'], '29'], paint: { 'line-color': AMBER, 'line-width': 8, 'line-blur': 6, 'line-opacity': 0.35 } },
      { id: 'muni-fill', type: 'fill', source: 'muni', layout: { visibility: 'none' }, paint: { 'fill-color': MAP.province, 'fill-opacity': 0.72 } },
      { id: 'muni-line', type: 'line', source: 'muni', layout: { visibility: 'none' }, paint: { 'line-color': MAP.muniLine, 'line-width': 0.7 } },
      { id: 'muni-hover', type: 'line', source: 'muni', layout: { visibility: 'none' }, paint: { 'line-color': AMBER, 'line-width': 2.2, 'line-opacity': hoverState(1, 0) } },
      { id: 'muni-trace-glow', type: 'line', source: 'muniTrace', layout: { 'line-join': 'round' }, paint: { 'line-width': 10, 'line-blur': 6, 'line-opacity': 0.5, 'line-gradient': traceExpr(0, AMBER) } },
      { id: 'muni-trace', type: 'line', source: 'muniTrace', layout: { 'line-join': 'round' }, paint: { 'line-width': 2.6, 'line-gradient': traceExpr(0, MAP.trace) } },
      { id: 'farms-fill', minzoom: 8.5, type: 'fill', source: 'farms', layout: { visibility: 'none' }, paint: { 'fill-color': MAP.farm, 'fill-opacity': hoverState(0.24, 0.02) } },
      { id: 'farms-line', minzoom: 8.5, type: 'line', source: 'farms', layout: { visibility: 'none' }, paint: { 'line-color': MAP.farm, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.18, 13, 0.4, 16, 0.6], 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.25, 15, 1.1] } },
      { id: 'farms-limited', minzoom: 8.5, type: 'fill', source: 'farms', filter: ['in', ['get', 'apt'], ['literal', LIMITED]], layout: { visibility: 'none' }, paint: { 'fill-color': MAP.limited, 'fill-opacity': 0.42 } },
      { id: 'farms-blocked-tint', minzoom: 8.5, type: 'fill', source: 'farms', filter: ['in', ['get', 'apt'], ['literal', NOT_FARMLAND]], layout: { visibility: 'none' }, paint: { 'fill-color': MAP.blocked, 'fill-opacity': 0.6 } },
      { id: 'farms-blocked', minzoom: 8.5, type: 'fill', source: 'farms', filter: ['in', ['get', 'apt'], ['literal', NOT_FARMLAND]], layout: { visibility: 'none' }, paint: { 'fill-pattern': HATCH, 'fill-opacity': 0.55 } },
      { id: 'farms-cand', minzoom: 8.5, type: 'fill', source: 'farms', filter: ['==', ['get', 'cand'], 1], layout: { visibility: 'none' }, paint: { 'fill-color': AMBER, 'fill-opacity': hoverState(0.85, 0.6) } },
      { id: 'farms-cand-line', minzoom: 8.5, type: 'line', source: 'farms', filter: ['==', ['get', 'cand'], 1], layout: { visibility: 'none' }, paint: { 'line-color': MAP.highlight, 'line-width': 1.2 } },
      { id: 'farms-hover', minzoom: 8.5, type: 'line', source: 'farms', layout: { visibility: 'none' }, paint: { 'line-color': MAP.highlight, 'line-width': 2.4, 'line-opacity': hoverState(1, 0) } },
      { id: 'sel-glow', type: 'line', source: 'sel', layout: { 'line-join': 'round' }, paint: { 'line-width': 12, 'line-blur': 7, 'line-opacity': 0.55, 'line-gradient': traceExpr(0, AMBER) } },
      { id: 'sel-line', type: 'line', source: 'sel', layout: { 'line-join': 'round' }, paint: { 'line-width': 2.8, 'line-gradient': traceExpr(0, MAP.highlight) } },
      { id: 'pulse-fill', type: 'fill', source: 'pulse', paint: { 'fill-opacity': 0 } },
      { id: 'pulse-line-1', type: 'line', source: 'pulse', paint: { 'line-opacity': 0 } },
      { id: 'pulse-line-2', type: 'line', source: 'pulse', paint: { 'line-opacity': 0 } },
    ],
  }
}

const FARM_LAYERS = ['farms-fill', 'farms-line', 'farms-limited', 'farms-blocked-tint', 'farms-blocked', 'farms-cand', 'farms-cand-line', 'farms-hover']

export class ExplorerController {
  map: maplibregl.Map
  dio: FarmDiorama | null = null
  private app: HTMLElement
  private dioEl: HTMLElement
  private clouds: CloudLayer | null = null
  private three: Promise<[typeof import('./clouds'), typeof import('./diorama')]> | null = null
  private provinces: FC<ProvinceProps> | null = null
  private malaga: Feature<Geo, ProvinceProps> | null = null
  private municipalities: FC<MunicipalityInfo> | null = null
  private farms: FC<FarmProps> | null = null
  private farmBoxes = new Map<number, BBox>()
  private munBounds: [[number, number], [number, number]] | null = null
  private hovered: { source: string; id: string | number } | null = null
  private beforeFarm: Camera | null = null
  private labels: maplibregl.Marker[] = []
  private disposed = false
  private prefetchTimer = 0

  constructor(app: HTMLElement, mapEl: HTMLElement, dioEl: HTMLElement) {
    this.app = app
    this.dioEl = dioEl
    this.map = new maplibregl.Map({
      container: mapEl, style: style(), center: [-4.6, 37.4], zoom: 6.4, attributionControl: { compact: true }, renderWorldCopies: false,
      dragPan: false, scrollZoom: false, boxZoom: false, dragRotate: false, keyboard: false, doubleClickZoom: false, touchZoomRotate: false, touchPitch: false,
      maxPitch: 70, fadeDuration: 150,
    })
    this.map.once('load', () => this.init().catch(() => useExplorer.setState({ error: 'Could not load the map data.' })))
  }

  /** three.js (clouds and 3D) lives in a separate chunk that downloads in the background. */
  private loadThree() {
    this.three ??= Promise.all([import('./clouds'), import('./diorama')])
    return this.three.then(([c, d]) => {
      this.clouds ??= new c.CloudLayer(this.app, 40)
      this.dio ??= new d.FarmDiorama(this.dioEl, {
        onChange: (view) => useExplorer.setState({ view }),
      })
      this.dio.speed = useExplorer.getState().speed
      return { clouds: this.clouds, dio: this.dio, diorama: d }
    })
  }

  private async init() {
    const map = this.map
    if (!map.hasImage(HATCH)) map.addImage(HATCH, hatchImage())
    const [provinces, municipalities, stats] = await Promise.all([
      fetch(`${DATA}/provincias_andalucia.geojson`).then((r) => r.json() as Promise<FC<ProvinceProps>>),
      loadMunicipalities(),
      fetch(`${DATA}/municipios_29_stats.json`).then((r) => (r.ok ? r.json() : {})) as Promise<Record<string, Partial<MunicipalityInfo>>>,
    ])
    if (this.disposed) return
    this.provinces = provinces
    this.malaga = provinces.features.find((f) => f.properties.id === '29') ?? null
    this.municipalities = {
      type: 'FeatureCollection',
      features: municipalities.features.map((f) => ({ ...f, properties: { ...f.properties, ...stats[String(f.properties.mun)] } as MunicipalityInfo })),
    }
    const andalucia = provinces.features.filter((f) => f.properties.and)
    const maxCropland = Math.max(...this.municipalities.features.map((f) => f.properties.pct_cultivo ?? 0), 1)
    this.source('resto').setData({ ...provinces, features: provinces.features.filter((f) => !f.properties.and) })
    this.source('prov').setData({ ...provinces, features: andalucia })
    this.source('muni').setData(this.municipalities)
    map.setPaintProperty('muni-fill', 'fill-color', hoverState(MAP.farm, ['interpolate', ['linear'], ['coalesce', ['get', 'pct_cultivo'], 0], 0, RAMP[0], maxCropland * 0.33, RAMP[1], maxCropland * 0.66, RAMP[2], maxCropland, RAMP[3]]))
    map.setPaintProperty('muni-fill', 'fill-opacity', hoverState(0.6, 0.72))
    useExplorer.setState({
      provinceList: andalucia.map((f) => f.properties),
      municipalityList: this.municipalities.features.map((f) => f.properties).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      totals: {
        andalucia: andalucia.reduce((s, f) => s + (f.properties.fincas ?? 0), 0),
        malaga: this.municipalities.features.reduce((s, f) => s + f.properties.fincas, 0),
        municipalities: this.municipalities.features.length,
        maxCropland,
      },
    })
    this.labelsFor()
    this.events()
    map.getCanvas().tabIndex = -1
    map.jumpTo(this.cameraFor(0))
    this.prepareLevel(0)
    useExplorer.setState({ phase: 'idle' })
    // The clouds of the first transition must be ready before the first click.
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 600))
    idle(() => this.loadThree())
  }

  private source(id: string) {
    return this.map.getSource<maplibregl.GeoJSONSource>(id)!
  }
  private vis(id: string, on: boolean) {
    if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  }
  private paint(id: string, prop: string, value: unknown) {
    if (this.map.getLayer(id)) this.map.setPaintProperty(id, prop as Parameters<maplibregl.Map['setPaintProperty']>[1], value as never)
  }
  private setTrace(prefix: 'muni' | 'sel', p: number) {
    const [glow, line, core] = prefix === 'sel' ? ['sel-glow', 'sel-line', MAP.highlight] : ['muni-trace-glow', 'muni-trace', MAP.trace]
    this.paint(glow, 'line-gradient', traceExpr(p, AMBER))
    this.paint(line, 'line-gradient', traceExpr(p, core))
  }
  /** Opacity of all farm layers relative to their resting value (k = 1). */
  private fadeFarms(k: number) {
    this.paint('farms-fill', 'fill-opacity', hoverState(0.24 * k, 0.02 * k))
    this.paint('farms-line', 'line-opacity', 0.4 * k)
    this.paint('farms-limited', 'fill-opacity', 0.42 * k)
    this.paint('farms-blocked-tint', 'fill-opacity', 0.6 * k)
    this.paint('farms-blocked', 'fill-opacity', 0.55 * k)
    this.paint('farms-cand', 'fill-opacity', hoverState(0.85 * k, 0.6 * k))
    this.paint('farms-cand-line', 'line-opacity', k)
    this.paint('farms-hover', 'line-opacity', hoverState(k, 0))
  }

  // ------------------------------------------------------------ camera
  private padding(level: Level) {
    const w = window.innerWidth
    // The farm is handed to the 3D already centred in the area the information column leaves free.
    if (level === 3 && this.dio) return this.dio.framePadding()
    if (level === 3) {
      const f = this.dioEl.querySelector<HTMLElement>('.dio-frame')
      const h = this.dioEl.clientHeight
      if (f && f.offsetWidth > 40 && f.offsetHeight > 40) return { top: f.offsetTop, left: f.offsetLeft, right: w - f.offsetLeft - f.offsetWidth, bottom: h - f.offsetTop - f.offsetHeight }
    }
    if (w < 760) return { top: level === 2 ? 170 : 230, bottom: 70, left: 20, right: 20 }
    if (level === 3) return { top: 90, bottom: 170, left: 480, right: 30 }
    return { top: 80, bottom: 80, left: w < 1100 ? 330 : 390, right: 70 }
  }
  private boundsFor(level: Level): [[number, number], [number, number]] {
    if (level === 0) return boundsOf({ type: 'FeatureCollection', features: this.provinces!.features.filter((f) => f.properties.and) })
    if (level === 1) return boundsOf(this.malaga!)
    return this.munBounds!
  }
  private cameraFor(level: Level, bounds = this.boundsFor(level)): Camera {
    const c = this.map.cameraForBounds(bounds, { padding: this.padding(level), bearing: 0, pitch: 0 })!
    const center = maplibregl.LngLat.convert(c.center!)
    return { center: [center.lng, center.lat], zoom: c.zoom!, pitch: 0, bearing: 0 }
  }
  private current(): Camera {
    const c = this.map.getCenter()
    return { center: [c.lng, c.lat], zoom: this.map.getZoom(), pitch: this.map.getPitch(), bearing: this.map.getBearing() }
  }
  private animate(ms: number, fn: (t: number) => void) {
    return new Promise<void>((resolve) => {
      const dur = reducedMotion() ? 1 : ms / useExplorer.getState().speed
      const t0 = performance.now()
      const step = (now: number) => {
        const t = clamp01((now - t0) / dur)
        fn(t)
        if (t < 1) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    })
  }
  /** In a municipality the map can be panned and zoomed (within its bounds); elsewhere it cannot. */
  private setInteractive(on: boolean) {
    const m = this.map
    for (const h of [m.dragPan, m.scrollZoom, m.doubleClickZoom, m.touchZoomRotate, m.keyboard]) {
      if (on) h.enable()
      else h.disable()
    }
    // The map canvas is a Tab stop only where the keyboard can do something with it (arrows pan,
    // +/- zoom in a municipality); elsewhere the lists and buttons are the way in.
    m.getCanvas().tabIndex = on ? 0 : -1
    if (on) m.touchZoomRotate.disableRotation()
    if (on && this.munBounds) {
      // The bound starts from the arrival view (which includes the gap for the text): if it were only
      // the municipality, MapLibre would reposition the camera and leave it under the text.
      const fit = this.cameraFor(2)
      const v = m.getBounds()
      const [[mw, ms], [me, mn]] = this.munBounds
      const w = Math.min(v.getWest(), mw), s = Math.min(v.getSouth(), ms), e = Math.max(v.getEast(), me), n = Math.max(v.getNorth(), mn)
      const dx = (e - w) * 0.2, dy = (n - s) * 0.2
      m.setMaxBounds([[w - dx, s - dy], [e + dx, n + dy]])
      m.setMinZoom(fit.zoom - 0.8)
    } else {
      m.setMaxBounds(null)
      m.setMinZoom(0)
    }
  }

  // ------------------------------------------------------------ levels
  /** Shows the layers of the level with their resting style. */
  private prepareLevel(level: Level) {
    const farms = level === 2 || level === 3
    ;['prov-fill', 'prov-line', 'malaga-glow'].forEach((id) => this.vis(id, level === 0))
    ;['muni-fill', 'muni-line', 'muni-hover'].forEach((id) => this.vis(id, level === 1))
    ;['muni-trace', 'muni-trace-glow'].forEach((id) => this.vis(id, level === 2))
    FARM_LAYERS.forEach((id) => this.vis(id, farms))
    this.paint('muni-fill', 'fill-opacity', hoverState(0.6, 0.72))
    this.paint('prov-fill', 'fill-opacity', hoverState(0.55, 0.42))
    this.paint('malaga-glow', 'line-opacity', 0.35)
    this.fadeFarms(1)
    this.paint('farms-line', 'line-opacity', ['interpolate', ['linear'], ['zoom'], 10, 0.18, 13, 0.4, 16, 0.6])
    this.paint('sat', 'raster-saturation', level >= 2 ? -0.35 : -0.8)
    this.paint('sat', 'raster-opacity', level >= 2 ? 0.62 : 0.3)
    this.paint('sat', 'raster-brightness-max', 0.85)
    this.paint('hill', 'hillshade-exaggeration', level >= 2 ? 0.25 : 0.45)
    if (level === 2) this.setTrace('muni', 1)
    const geoms = level === 0 ? this.provinces!.features.filter((f) => f.properties.and).map((f) => f.geometry) : level === 1 ? [this.malaga!.geometry] : this.munFeature() ? [this.munFeature()!.geometry] : []
    if (level <= 2) {
      this.source('focus').setData(focusMask(geoms))
      this.paint('focus-mask', 'fill-opacity', level === 0 ? 0.5 : 0.45)
    }
    this.labels.forEach((m) => m.getElement().classList.toggle('hidden-label', level !== 0))
  }
  private munFeature() {
    const key = useExplorer.getState().municipality?.mun
    return this.municipalities?.features.find((f) => f.properties.mun === key)
  }

  // ------------------------------------------------------------ transitions
  /** Andalucía ⇄ Málaga (clouds) and Málaga ⇄ municipality (mist). */
  private async cloudDive(target: Level, variant: CloudVariant) {
    // With the 3D switched off the clouds (WebGL) are not even downloaded: the map just flies.
    const clouds = use3d() ? (await this.loadThree()).clouds : null
    const { level, speed } = useExplorer.getState()
    const back = target < level
    const a = this.current(), b = this.cameraFor(target)
    const path = cameraPath(a, b)
    const pitchPeak = variant === 'clouds' ? 26 : 18, bearingPeak = variant === 'clouds' ? -8 : 5
    let maskSwapped = false
    if (!back && target === 1) {
      // Anticipation: Málaga lights up and the rest fades out.
      await this.animate(380, (t) => {
        this.paint('prov-fill', 'fill-opacity', ['case', ['==', ['get', 'id'], '29'], lerp(0.42, 0.75, t), lerp(0.42, 0.18, t)])
        this.paint('malaga-glow', 'line-opacity', lerp(0.35, 0.9, t))
      })
    }
    if (!back && target === 2) {
      // Anticipation: the municipality outline is traced and the others fade out.
      const key = useExplorer.getState().municipality!.mun
      this.source('muniTrace').setData(toLines(this.munFeature()!.geometry))
      this.vis('muni-trace', true)
      this.vis('muni-trace-glow', true)
      this.vis('muni-hover', false)
      await this.animate(650, (t) => {
        this.setTrace('muni', easeInOut(t))
        this.paint('muni-fill', 'fill-opacity', ['case', ['==', ['get', 'mun'], key], 0.72, lerp(0.72, 0.22, t)])
      })
    }
    if (back && target === 1) {
      // Municipality → Málaga: farms fade out before the camera pulls back and the source is emptied,
      // so that tiles for tens of thousands of farms are not requested at every zoom of the flight.
      await this.animate(250, (t) => this.fadeFarms(1 - t))
      FARM_LAYERS.forEach((id) => this.vis(id, false))
      this.source('farms').setData(EMPTY)
      this.farms = null
    }
    const key = useExplorer.getState().municipality?.mun
    const opts = {
      variant, reverse: back, speed,
      onProgress: (t: number) => {
        const cam = path(easeInOut(t))
        this.map.jumpTo({ ...cam, pitch: Math.sin(Math.PI * t) * pitchPeak, bearing: Math.sin(Math.PI * t) * bearingPeak })
        if (variant !== 'mist') return
        // The focus mask fades out, changes its hole and fades back in.
        this.paint('focus-mask', 'fill-opacity', 0.45 * Math.abs(1 - 2 * range(t, 0.15, 0.85)))
        if (!maskSwapped && t >= 0.5) {
          maskSwapped = true
          const g = target === 2 ? this.munFeature()?.geometry : this.malaga?.geometry
          if (g) this.source('focus').setData(focusMask([g]))
        }
        const ready = this.farms !== null
        if (back) {
          // Municipality → Málaga: the municipalities come back.
          this.setTrace('muni', 1 - range(t, 0.45, 0.9))
          if (t > 0.3) {
            this.vis('muni-fill', true)
            this.vis('muni-line', true)
            this.paint('muni-fill', 'fill-opacity', 0.72 * range(t, 0.3, 0.75))
          }
          this.paint('sat', 'raster-opacity', lerp(0.62, 0.3, range(t, 0.2, 0.8)))
          this.paint('sat', 'raster-saturation', lerp(-0.35, -0.8, range(t, 0.2, 0.8)))
        } else {
          // Málaga → municipality: no whiteout, so the layers cross-fade during the flight.
          this.paint('muni-fill', 'fill-opacity', ['case', ['==', ['get', 'mun'], key ?? -1], lerp(0.72, 0.08, range(t, 0.25, 0.6)), lerp(0.22, 0, range(t, 0.2, 0.5))])
          // Farms appear at the end, already near their zoom: so they are not sliced at intermediate zooms.
          if (ready && t > 0.72) {
            FARM_LAYERS.forEach((id) => this.vis(id, true))
            this.fadeFarms(range(t, 0.74, 0.98))
          }
          this.paint('sat', 'raster-opacity', lerp(0.3, 0.62, range(t, 0.3, 0.9)))
          this.paint('sat', 'raster-saturation', lerp(-0.8, -0.35, range(t, 0.3, 0.9)))
        }
      },
      onCover: () => {
        if (variant === 'clouds') this.prepareLevel(target)
      },
    }
    if (clouds) await clouds.play(opts)
    else {
      let covered = false
      await this.animate(variant === 'clouds' ? 1100 : 900, (t) => {
        opts.onProgress(t)
        if (!covered && t >= 0.5) {
          covered = true
          opts.onCover()
        }
      })
    }
    this.map.jumpTo(b)
  }

  /** Municipality → farm: the boundary is traced, the map flies to the tile from above and the 3D raises it. */
  private async enterFarm(farm: Farm) {
    if (!use3d()) return this.enterFarmFlat(farm)
    const { dio, diorama } = await this.loadThree()
    const props = farm.properties
    const farmSceneP = this.farmScene(farm)
    farmSceneP.then((sel) => diorama.prefetch(sel.farmScene.key, sel.farmScene.tile))
    this.beforeFarm = this.current()
    this.source('sel').setData(toLines(farm.geometry))
    this.vis('sel-line', true)
    this.vis('sel-glow', true)
    this.clearHover()
    await this.animate(600, (t) => {
      this.setTrace('sel', easeInOut(t))
      this.fadeFarms(lerp(1, 0.35, t))
      this.paint('farms-fill', 'fill-opacity', ['case', ['==', ['get', 'id'], props.id], 0.22, 0])
    })
    const sel = await farmSceneP
    const tile = sel.farmScene.tile
    const b = this.farmCamera(tile)
    const path = cameraPath(this.current(), b)
    this.app.classList.add('handoff')
    // During the flight only the chosen boundary is visible: so farms are not sliced at every zoom.
    FARM_LAYERS.forEach((id) => this.vis(id, false))
    await this.animate(1700, (t) => {
      this.map.jumpTo({ ...path(easeInOut(t)), pitch: Math.sin(Math.PI * t) * 30, bearing: 0 })
      this.paint('sat', 'raster-saturation', lerp(-0.35, 0, range(t, 0.2, 0.9)))
      this.paint('sat', 'raster-opacity', lerp(0.62, 1, range(t, 0.1, 0.8)))
      this.paint('sat', 'raster-brightness-max', lerp(0.85, 1, range(t, 0.2, 0.9)))
      this.paint('hill', 'hillshade-exaggeration', lerp(0.25, 0, range(t, 0.3, 0.9)))
      this.paint('focus-mask', 'fill-opacity', lerp(0.45, 0, range(t, 0, 0.6)))
    })
    this.map.jumpTo(b)
    const wait = window.setTimeout(() => useExplorer.setState({ preparing: true }), 250)
    useExplorer.setState({ sel, view: { ...dio.state } })
    await dio.load(sel.farmScene)
    // A moment for the tiles of this view to paint (without blocking if the network is slow).
    await Promise.race([new Promise((r) => this.map.once('idle', r)), new Promise((r) => setTimeout(r, 600))])
    clearTimeout(wait)
    useExplorer.setState({ preparing: false, synthetic: dio.synthetic })
    const rect = this.tileRect(tile)
    this.vis('sel-line', false)
    this.vis('sel-glow', false)
    const snapshot = await this.snapshot(rect)
    await dio.enter({ fromRect: rect, snapshot, traced: true })
    this.app.classList.remove('handoff')
  }
  /**
   * Map camera for the hand-over to the 3D. The tile is handed over slightly smaller (0.75 zoom
   * levels less is ~3× fewer satellite tiles to download; the 3D rise completes the approach)
   * and centred in the area the farm column leaves free, so the block rises where it will stay.
   * The zoom-out is done around that centre, not around the middle of the screen.
   */
  private farmCamera(tile: BBox): Camera {
    const cam = this.cameraFor(3, [[tile[0], tile[1]], [tile[2], tile[3]]])
    cam.zoom -= 0.75
    const pad = this.padding(3)
    const { clientWidth: w, clientHeight: h } = this.map.getContainer()
    const dx = pad.left + (w - pad.left - pad.right) / 2 - w / 2, dy = pad.top + (h - pad.top - pad.bottom) / 2 - h / 2
    const nw = maplibregl.MercatorCoordinate.fromLngLat([tile[0], tile[3]]), se = maplibregl.MercatorCoordinate.fromLngLat([tile[2], tile[1]])
    const worldPx = 512 * 2 ** cam.zoom
    const c = new maplibregl.MercatorCoordinate((nw.x + se.x) / 2 - dx / worldPx, (nw.y + se.y) / 2 - dy / worldPx).toLngLat()
    cam.center = [c.lng, c.lat]
    return cam
  }
  private tileRect(tile: BBox) {
    const nw = this.map.project([tile[0], tile[3]]), se = this.map.project([tile[2], tile[1]])
    return { x: nw.x, y: nw.y, w: se.x - nw.x, h: se.y - nw.y }
  }
  /** Copy of the map canvas in that rectangle, read right after painting (without preserveDrawingBuffer). */
  private snapshot(rect: { x: number; y: number; w: number; h: number }) {
    return new Promise<HTMLCanvasElement | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 600)
      this.map.once('render', () => {
        clearTimeout(timer)
        try {
          const src = this.map.getCanvas(), k = src.width / src.clientWidth
          const c = document.createElement('canvas')
          c.width = Math.max(1, Math.round(rect.w * k))
          c.height = Math.max(1, Math.round(rect.h * k))
          const ctx = c.getContext('2d', { willReadFrequently: true })!
          ctx.drawImage(src, rect.x * k, rect.y * k, rect.w * k, rect.h * k, 0, 0, c.width, c.height)
          resolve(ctx.getImageData(c.width >> 1, c.height >> 1, 1, 1).data[3] === 0 ? null : c)
        } catch {
          resolve(null)
        }
      })
      this.map.triggerRepaint()
    })
  }
  /**
   * Farm view without the 3D: the map flies to the farm and stays there as a flat satellite
   * picture behind the information column; the data table (FarmTable) replaces the terrain.
   * Used when the 3D is switched off in the settings (slow devices) and when WebGL fails.
   */
  private async enterFarmFlat(farm: Farm) {
    const props = farm.properties
    const farmSceneP = this.farmScene(farm)
    this.beforeFarm = this.current()
    this.source('sel').setData(toLines(farm.geometry))
    this.vis('sel-line', true)
    this.vis('sel-glow', true)
    this.clearHover()
    await this.animate(500, (t) => {
      this.setTrace('sel', easeInOut(t))
      this.fadeFarms(lerp(1, 0.35, t))
      this.paint('farms-fill', 'fill-opacity', ['case', ['==', ['get', 'id'], props.id], 0.22, 0])
    })
    const sel = await farmSceneP
    this.ensureFrame()
    const path = cameraPath(this.current(), this.farmCamera(sel.farmScene.tile))
    FARM_LAYERS.forEach((id) => this.vis(id, false))
    await this.animate(1200, (t) => {
      this.map.jumpTo({ ...path(easeInOut(t)), pitch: 0, bearing: 0 })
      this.paint('sat', 'raster-saturation', lerp(-0.35, 0, range(t, 0.2, 0.9)))
      this.paint('sat', 'raster-opacity', lerp(0.62, 1, range(t, 0.1, 0.8)))
      this.paint('hill', 'hillshade-exaggeration', lerp(0.25, 0, range(t, 0.3, 0.9)))
      this.paint('focus-mask', 'fill-opacity', lerp(0.45, 0, range(t, 0, 0.6)))
    })
    this.map.jumpTo(this.farmCamera(sel.farmScene.tile))
    const { view } = useExplorer.getState()
    useExplorer.setState({ sel, flat: true, synthetic: false, view: { ...view, mode: 'satellite' } })
  }
  /** Invisible box that stands in for the one the 3D creates, so the camera padding is read from the same CSS. */
  private ensureFrame() {
    if (this.dio || this.dioEl.querySelector('.dio-frame')) return
    this.dioEl.classList.add('dio')
    const f = document.createElement('div')
    f.className = 'dio-frame'
    this.dioEl.appendChild(f)
  }
  private async exitFarm() {
    const sel = useExplorer.getState().sel
    if (!sel) return
    const tile = sel.farmScene.tile
    if (useExplorer.getState().flat) {
      this.map.jumpTo(this.farmCamera(tile))
      this.vis('sel-line', true)
      this.vis('sel-glow', true)
      this.setTrace('sel', 1)
      useExplorer.setState({ flat: false })
    } else {
      const { dio } = await this.loadThree()
      this.app.classList.add('handoff')
      this.map.jumpTo(this.farmCamera(tile))
      await dio.exit({ toRect: this.tileRect(tile) })
      this.vis('sel-line', true)
      this.vis('sel-glow', true)
      this.setTrace('sel', 1)
      dio.hide()
      this.app.classList.remove('handoff')
    }
    const path = cameraPath(this.current(), this.beforeFarm ?? this.cameraFor(2))
    await this.animate(1600, (t) => {
      this.map.jumpTo({ ...path(easeInOut(t)), pitch: Math.sin(Math.PI * t) * 22, bearing: 0 })
      this.paint('sat', 'raster-saturation', lerp(0, -0.35, range(t, 0, 0.7)))
      this.paint('sat', 'raster-opacity', lerp(1, 0.62, range(t, 0, 0.7)))
      this.paint('hill', 'hillshade-exaggeration', lerp(0, 0.25, range(t, 0.2, 1)))
      this.paint('focus-mask', 'fill-opacity', 0.45 * range(t, 0.3, 1))
    })
    // The farms come back already at their final zoom.
    FARM_LAYERS.forEach((id) => this.vis(id, true))
    await this.animate(450, (t) => {
      this.fadeFarms(t)
      this.setTrace('sel', 1 - t)
    })
    this.vis('sel-line', false)
    this.vis('sel-glow', false)
    this.prepareLevel(2)
    useExplorer.setState({ sel: null })
  }

  /** Farm data for the 3D and the cards: neighbours, detail, climate and R0–R3 scores. */
  private async farmScene(farm: Farm) {
    const p = farm.properties
    const tile = tileFor(bbox(farm) as BBox)
    const neighbors = (this.farms?.features ?? [])
      .filter((f) => f.properties.id !== p.id && intersects(this.boxOf(f), tile))
      .map((f) => ({ geometry: f.geometry, cover: f.properties.cover, rot: f.properties.rot }))
    const [details, common] = await Promise.all([loadDetails([{ id: p.id, mun: p.mun }]).catch(() => ({})), loadCommon().catch(() => null)])
    const detail = (details as Record<number, import('../lib/detail').FarmDetail>)[p.id] ?? null
    const scenario = detail && common ? scenarioFor(detail, common) : null
    const cell = detail && common ? common.celdas[String(detail.celda)] : null
    const farmScene: FarmScene = {
      key: String(p.id),
      geometry: farm.geometry,
      tile,
      rot: detail?.rotacion_estimada ?? p.rot,
      campaigns: detail?.fenologia.map((f) => ({ y: f.campana, cls: f.clase_estimada })) ?? [],
      trees: detail?.cobertura.arbolado ?? 0,
      clay: detail?.suelo?.arcilla_pct ?? null,
      neighbors,
      crops: Object.fromEntries(Object.entries(ROTATIONS).map(([k, r]) => [k, r.crops])) as Record<RotationKey, string[]>,
    }
    const price = (key: string) => {
      const last = latestPrice(common?.precios[key])
      return last ? { eurT: last.eurT, year: last.year } : null
    }
    return {
      farm,
      municipality: useExplorer.getState().municipality?.nombre ?? '',
      detail,
      scores: scenario ? calculateScores(scenario) : null,
      farmScene,
      climate: cell && scenario ? { rain: cell.resumen.lluvia_media_mm, deficit: cell.resumen.deficit_medio_mm, hotDays: scenario.heatDays, frostDays: scenario.frostDays } : null,
      prices: { trigo: price('wheat'), girasol: price('sunflower'), garbanzo: price('chickpea'), veza: price('vetch') },
    }
  }
  private boxOf(f: Feature<Geo, FarmProps>) {
    let b = this.farmBoxes.get(f.properties.id)
    if (!b) {
      b = bbox(f) as BBox
      this.farmBoxes.set(f.properties.id, b)
    }
    return b
  }

  /** Loads the municipality farms (in parallel with the entry animation). */
  private loadFarms(mun: number) {
    this.farms = null
    this.farmBoxes.clear()
    useExplorer.setState({ farmsCount: null, farmList: [] })
    return loadMunicipality(mun).then((data) => {
      if (useExplorer.getState().municipality?.mun !== mun) return
      this.farms = data as FC<FarmProps>
      this.source('farms').setData(data)
      useExplorer.setState({ farmsCount: data.features.length, farmList: farmListOf(data.features as Farm[]) })
      // Prefetches the municipality detail so opening a farm is instant.
      loadDetails([{ id: -1, mun }]).catch(() => undefined)
      loadCommon().catch(() => undefined)
    })
  }

  /** Changes level with its transition. Ignores clicks while one is in progress. */
  async go(target: Level, opts: { municipality?: MunicipalityInfo; farm?: Farm } = {}) {
    const st = useExplorer.getState()
    if (st.phase !== 'idle' || target === st.level || target < 0 || target > 3) return
    this.clearHover()
    const where = target === 0 ? 'Andalucía' : target === 1 ? 'Málaga' : target === 2 ? (opts.municipality ?? st.municipality)?.nombre ?? 'the municipality' : opts.farm ? `farm ${opts.farm.properties.pol}-${opts.farm.properties.par}` : 'the farm'
    useExplorer.setState({ phase: 'transitioning', toast: null, moving: `Going to ${where}…` })
    this.setInteractive(false)
    try {
      let l = st.level
      while (l !== target) {
        if (target > l) {
          if (l === 0) await this.cloudDive(1, 'clouds')
          else if (l === 1) {
            const m = opts.municipality ?? useExplorer.getState().municipality
            if (!m) break
            const feature = this.municipalities!.features.find((f) => f.properties.mun === m.mun)!
            this.munBounds = boundsOf(feature)
            useExplorer.setState({ municipality: m })
            const loading = this.loadFarms(m.mun)
            await this.cloudDive(2, 'mist')
            if (!this.farms) {
              useExplorer.setState({ preparing: true })
              await loading.catch(() => showToast('Could not load the farms', 'Check your connection and try again.', 'blocked'))
              useExplorer.setState({ preparing: false })
            }
          } else if (l === 2) {
            if (!opts.farm) break
            await this.enterFarm(opts.farm)
          }
          l++
        } else {
          if (l === 3) await this.exitFarm()
          else if (l === 2) {
            useExplorer.setState({ level: 2 })
            await this.cloudDive(1, 'mist')
            this.source('farms').setData(EMPTY)
            this.farms = null
            useExplorer.setState({ municipality: null, farmsCount: null, farmList: [] })
          } else if (l === 1) {
            useExplorer.setState({ level: 1 })
            await this.cloudDive(0, 'clouds')
          }
          l--
        }
        useExplorer.setState({ level: l as Level })
        this.prepareLevel(l as Level)
      }
    } finally {
      useExplorer.setState({ phase: 'idle', moving: '' })
      this.setInteractive(useExplorer.getState().level === 2)
    }
  }

  // ------------------------------------------------------------ hover and click
  private clearHover() {
    if (this.hovered) this.map.setFeatureState(this.hovered, { hover: false })
    this.hovered = null
    useExplorer.setState({ hover: null })
    this.map.getCanvas().style.cursor = ''
  }
  private hover(source: string, id: string | number, ev: maplibregl.MapMouseEvent, make: () => import('./state').Hover) {
    if (useExplorer.getState().phase !== 'idle') return
    if (this.hovered?.id !== id || this.hovered?.source !== source) {
      this.clearHover()
      this.hovered = { source, id }
      this.map.setFeatureState(this.hovered, { hover: true })
      useExplorer.setState({ hover: make() })
    }
    // The tooltip position is written directly: React does not need to repaint on every pixel.
    const tip = document.getElementById('xp-tooltip')
    if (tip) {
      const r = tip.getBoundingClientRect()
      let x = ev.originalEvent.clientX + 18, y = ev.originalEvent.clientY + 18
      if (x + r.width > innerWidth - 12) x -= r.width + 36
      if (y + r.height > innerHeight - 12) y -= r.height + 36
      tip.style.left = `${x}px`
      tip.style.top = `${y}px`
    }
    this.map.getCanvas().style.cursor = 'pointer'
  }
  private events() {
    const map = this.map
    map.on('mousemove', 'prov-fill', (e) => {
      if (useExplorer.getState().level !== 0) return
      const p = e.features![0].properties as ProvinceProps
      this.hover('prov', p.id, e, () => ({ kind: 'province', x: 0, y: 0, p }))
    })
    map.on('mousemove', 'muni-fill', (e) => {
      if (useExplorer.getState().level !== 1) return
      const id = Number(e.features![0].id)
      const p = this.municipalities!.features.find((f) => f.properties.mun === id)!.properties
      this.hover('muni', id, e, () => ({ kind: 'municipality', x: 0, y: 0, p }))
    })
    map.on('mousemove', 'farms-fill', (e) => {
      if (useExplorer.getState().level !== 2) return
      const f = e.features![0]
      const p = f.properties as FarmProps
      this.hover('farms', Number(f.id), e, () => ({ kind: 'farm', x: 0, y: 0, p }))
      const tile = tileFor(bbox(f) as BBox)
      // Preload terrain and orthophoto if the mouse rests for a moment.
      window.clearTimeout(this.prefetchTimer)
      if (!p.apt || !NOT_FARMLAND.includes(p.apt)) this.prefetchTimer = window.setTimeout(() => this.three?.then(([, d]) => d.prefetch(String(p.id), tile)), 350)
    })
    for (const l of ['prov-fill', 'muni-fill', 'farms-fill']) map.on('mouseleave', l, () => this.clearHover())
    map.on('dragstart', () => this.clearHover())
    map.on('click', 'prov-fill', (e) => {
      if (useExplorer.getState().level !== 0) return
      this.chooseProvince((e.features![0].properties as ProvinceProps).id)
    })
    map.on('click', 'muni-fill', (e) => {
      if (useExplorer.getState().level !== 1) return
      this.chooseMunicipality(Number(e.features![0].id))
    })
    map.on('click', 'farms-fill', (e) => {
      this.chooseFarm(Number(e.features![0].id))
    })
  }
  // The same three actions serve the map clicks and the keyboard lists (AccessList.tsx).
  /** Province: Málaga opens; the others say the tour is not available yet. */
  chooseProvince(id: string) {
    const st = useExplorer.getState()
    if (st.level !== 0 || st.phase !== 'idle') return
    const p = st.provinceList.find((x) => x.id === id)
    if (!p) return
    if (p.id === '29') this.go(1)
    else showToast(`${p.nombre} · ${(p.fincas ?? 0).toLocaleString('en-GB')} farms`, 'For now, farm and rotation detail is only available for Málaga.')
  }
  chooseMunicipality(mun: number) {
    const st = useExplorer.getState()
    if (st.level !== 1 || st.phase !== 'idle') return
    const m = this.municipalities?.features.find((f) => f.properties.mun === mun)
    if (m) this.go(2, { municipality: m.properties })
  }
  chooseFarm(id: number) {
    if (useExplorer.getState().level !== 2 || useExplorer.getState().phase !== 'idle') return
    const farm = this.farms?.features.find((f) => f.properties.id === id) as Farm | undefined
    if (!farm) return
    const apt = farm.properties.apt
    if (apt && NOT_FARMLAND.includes(apt)) {
      pulse(this.map, farm, MAP.pulseBlocked, 700)
      showToast('Not farmland', `${APT[apt]}: this farm cannot be analysed (SIGPAC and ESA WorldCover).`, 'blocked')
      return
    }
    if (apt && LIMITED.includes(apt)) showToast('Indicative analysis', `${APT[apt]}: the farm can be opened, but herbaceous rotations fit less well here.`, 'warning')
    this.go(3, { farm })
  }
  private labelsFor() {
    const tweak: Record<string, [number, number]> = { '29': [0.05, -0.12], '04': [0.1, 0], '11': [0.05, 0.05] }
    for (const f of this.provinces!.features.filter((x) => x.properties.and)) {
      const el = document.createElement('div')
      el.className = `province-label${f.properties.id === '29' ? ' malaga' : ''}`
      el.textContent = f.properties.nombre
      const [w, s, e, n] = bbox(f)
      const d = tweak[f.properties.id] ?? [0, 0]
      this.labels.push(new maplibregl.Marker({ element: el }).setLngLat([(w + e) / 2 + d[0], (s + n) / 2 + d[1]]).addTo(this.map))
    }
  }

  setSpeed(speed: number) {
    useExplorer.setState({ speed })
    if (this.dio) this.dio.speed = speed
  }
  /** On window resize, re-frames the current level. */
  resize() {
    const { level, phase } = useExplorer.getState()
    if (phase === 'idle' && level < 2) this.map.jumpTo(this.cameraFor(level))
  }
  /** After a text-size change the column is wider or narrower: frame the level again in the free area. */
  refit() {
    const { level, phase, sel, flat } = useExplorer.getState()
    if (phase !== 'idle') return
    this.map.resize()
    if (level < 2) this.map.jumpTo(this.cameraFor(level))
    else if (level === 3 && sel && flat) this.map.jumpTo(this.farmCamera(sel.farmScene.tile))
    else if (level === 3) this.dio?.reframe()
  }
  dispose() {
    this.disposed = true
    this.clouds?.dispose()
    this.dio?.dispose()
    this.map.remove()
  }
}
