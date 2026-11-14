// Embudo Andalucía → Málaga → municipio → finca con sus transiciones.
//
// Andalucía ⇄ Málaga: la cámara se zambulle en un banco de nubes y el mapa cambia de
// capas mientras la pantalla está tapada. Málaga ⇄ municipio: se traza el contorno, pasa
// una bruma baja por los bordes y las fincas del municipio aparecen durante el vuelo.
// Municipio → finca: el mapa vuela a la finca en cenital, entrega una captura de sí mismo
// al terreno 3D y este se levanta. Las fincas que no son tierra de cultivo (urbano, agua,
// dominio público) no se pueden abrir; las limitadas (monte, pendiente, roca) sí, con aviso.
import bbox from '@turf/bbox'
import type { Feature, FeatureCollection, LineString, MultiPolygon, Polygon } from 'geojson'
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { calculateScores, ROTATIONS, scenarioFor } from '../lib/calculator'
import { latestPrice, loadComun, loadDetalles } from '../lib/detalle'
import { loadMunicipio, loadMunicipios } from '../lib/fincas'
import type { Finca, FincaProps } from '../lib/geo'
import type { RotationKey } from '../lib/indicators'
import { HATCH, hatchImage, LIMITED, NOT_FARMLAND } from '../lib/mapStyle'
import { pulse } from '../lib/pulse'
import type { CloudLayer, CloudVariant } from './clouds'
import type { FincaDiorama } from './diorama'
import { tileFor, type BBox, type Escena } from './escena'
import { APT } from './textos'
import { showToast, useExplorer, type Level, type MunicipioInfo, type ProvinciaProps } from './state'

maplibregl.setWorkerUrl(workerUrl)

type Geo = Polygon | MultiPolygon
type FC<P = Record<string, unknown>> = FeatureCollection<Geo, P>
type Camera = { center: [number, number]; zoom: number; pitch: number; bearing: number }

const DATA = `${import.meta.env.BASE_URL}data`
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }
const AMBER = '#E8B86A'
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const range = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
/** Rectángulo grande con agujeros: oscurece todo lo que no es el territorio del nivel. */
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

/** Zoom "hacia un punto fijo": el punto que acaba centrado se acerca en línea recta, como un pellizco. */
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

function traceExpr(p: number, color: string): maplibregl.ExpressionSpecification {
  const q = Math.min(0.999, Math.max(0.0005, p))
  return ['interpolate', ['linear'], ['line-progress'], 0, color, q, color, Math.min(1, q + 0.0005), 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,0)']
}
const hoverState = (on: unknown, off: unknown): maplibregl.ExpressionSpecification => ['case', ['boolean', ['feature-state', 'hover'], false], on, off] as maplibregl.ExpressionSpecification

function style(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      esri: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, bounds: [-10.5, 34.8, 0.5, 40.5], attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' },
      dem: { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 12, attribution: 'Terrain: Mapzen Terrarium / AWS Open Data' },
      resto: { type: 'geojson', data: EMPTY },
      prov: { type: 'geojson', data: EMPTY, promoteId: 'id', attribution: 'Límites: IGN vía es-atlas (CC BY 4.0)' },
      muni: { type: 'geojson', data: EMPTY, promoteId: 'mun' },
      muniTrace: { type: 'geojson', data: EMPTY, lineMetrics: true },
      // Hasta z14: más allá se reescala. Trocear decenas de miles de fincas en cada zoom
      // satura el worker y retrasa el resto de capas.
      fincas: { type: 'geojson', data: EMPTY, promoteId: 'id', maxzoom: 14, buffer: 32, tolerance: 0.5, attribution: 'Fincas: SIGPAC (FEGA, CC BY 4.0)' },
      sel: { type: 'geojson', data: EMPTY, lineMetrics: true },
      focus: { type: 'geojson', data: EMPTY },
      pulse: { type: 'geojson', data: EMPTY },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#1E2A1A' } },
      { id: 'sat', type: 'raster', source: 'esri', paint: { 'raster-saturation': -0.8, 'raster-opacity': 0.3, 'raster-contrast': 0.05, 'raster-brightness-max': 0.85, 'raster-fade-duration': 150 } },
      { id: 'hill', type: 'hillshade', source: 'dem', paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': '#0E140B', 'hillshade-highlight-color': '#E7D8B8', 'hillshade-accent-color': '#3B4630', 'hillshade-illumination-direction': 315 } },
      { id: 'resto-fill', type: 'fill', source: 'resto', paint: { 'fill-color': '#121A10', 'fill-opacity': 0.78 } },
      { id: 'resto-line', type: 'line', source: 'resto', paint: { 'line-color': 'rgba(244,233,216,.12)', 'line-width': 0.6 } },
      { id: 'focus-mask', type: 'fill', source: 'focus', paint: { 'fill-color': '#0C120A', 'fill-opacity': 0.5 } },
      { id: 'prov-fill', type: 'fill', source: 'prov', paint: { 'fill-color': hoverState(AMBER, ['case', ['==', ['get', 'id'], '29'], '#6E6A3E', '#2E3B2A']), 'fill-opacity': hoverState(0.55, 0.42) } },
      { id: 'prov-line', type: 'line', source: 'prov', paint: { 'line-color': ['case', ['==', ['get', 'id'], '29'], AMBER, 'rgba(244,233,216,.55)'], 'line-width': ['case', ['==', ['get', 'id'], '29'], 1.6, 0.9] } },
      { id: 'malaga-glow', type: 'line', source: 'prov', filter: ['==', ['get', 'id'], '29'], paint: { 'line-color': AMBER, 'line-width': 8, 'line-blur': 6, 'line-opacity': 0.35 } },
      { id: 'muni-fill', type: 'fill', source: 'muni', layout: { visibility: 'none' }, paint: { 'fill-color': '#2E3B2A', 'fill-opacity': 0.72 } },
      { id: 'muni-line', type: 'line', source: 'muni', layout: { visibility: 'none' }, paint: { 'line-color': 'rgba(20,29,17,.75)', 'line-width': 0.7 } },
      { id: 'muni-hover', type: 'line', source: 'muni', layout: { visibility: 'none' }, paint: { 'line-color': AMBER, 'line-width': 2.2, 'line-opacity': hoverState(1, 0) } },
      { id: 'muni-trace-glow', type: 'line', source: 'muniTrace', layout: { 'line-join': 'round' }, paint: { 'line-width': 10, 'line-blur': 6, 'line-opacity': 0.5, 'line-gradient': traceExpr(0, AMBER) } },
      { id: 'muni-trace', type: 'line', source: 'muniTrace', layout: { 'line-join': 'round' }, paint: { 'line-width': 2.6, 'line-gradient': traceExpr(0, '#F6DDA8') } },
      { id: 'fincas-fill', minzoom: 8.5, type: 'fill', source: 'fincas', layout: { visibility: 'none' }, paint: { 'fill-color': '#F4E9D8', 'fill-opacity': hoverState(0.24, 0.02) } },
      { id: 'fincas-line', minzoom: 8.5, type: 'line', source: 'fincas', layout: { visibility: 'none' }, paint: { 'line-color': '#F4E9D8', 'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.18, 13, 0.4, 16, 0.6], 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.25, 15, 1.1] } },
      { id: 'fincas-limited', minzoom: 8.5, type: 'fill', source: 'fincas', filter: ['in', ['get', 'apt'], ['literal', LIMITED]], layout: { visibility: 'none' }, paint: { 'fill-color': '#0B0F09', 'fill-opacity': 0.42 } },
      { id: 'fincas-blocked-tint', minzoom: 8.5, type: 'fill', source: 'fincas', filter: ['in', ['get', 'apt'], ['literal', NOT_FARMLAND]], layout: { visibility: 'none' }, paint: { 'fill-color': '#3F3F46', 'fill-opacity': 0.6 } },
      { id: 'fincas-blocked', minzoom: 8.5, type: 'fill', source: 'fincas', filter: ['in', ['get', 'apt'], ['literal', NOT_FARMLAND]], layout: { visibility: 'none' }, paint: { 'fill-pattern': HATCH, 'fill-opacity': 0.55 } },
      { id: 'fincas-cand', minzoom: 8.5, type: 'fill', source: 'fincas', filter: ['==', ['get', 'cand'], 1], layout: { visibility: 'none' }, paint: { 'fill-color': AMBER, 'fill-opacity': hoverState(0.85, 0.6) } },
      { id: 'fincas-cand-line', minzoom: 8.5, type: 'line', source: 'fincas', filter: ['==', ['get', 'cand'], 1], layout: { visibility: 'none' }, paint: { 'line-color': '#FFF1D2', 'line-width': 1.2 } },
      { id: 'fincas-hover', minzoom: 8.5, type: 'line', source: 'fincas', layout: { visibility: 'none' }, paint: { 'line-color': '#FFF1D2', 'line-width': 2.4, 'line-opacity': hoverState(1, 0) } },
      { id: 'sel-glow', type: 'line', source: 'sel', layout: { 'line-join': 'round' }, paint: { 'line-width': 12, 'line-blur': 7, 'line-opacity': 0.55, 'line-gradient': traceExpr(0, AMBER) } },
      { id: 'sel-line', type: 'line', source: 'sel', layout: { 'line-join': 'round' }, paint: { 'line-width': 2.8, 'line-gradient': traceExpr(0, '#FFF1D2') } },
      { id: 'pulse-fill', type: 'fill', source: 'pulse', paint: { 'fill-opacity': 0 } },
      { id: 'pulse-line-1', type: 'line', source: 'pulse', paint: { 'line-opacity': 0 } },
      { id: 'pulse-line-2', type: 'line', source: 'pulse', paint: { 'line-opacity': 0 } },
    ],
  }
}

const FINCA_LAYERS = ['fincas-fill', 'fincas-line', 'fincas-limited', 'fincas-blocked-tint', 'fincas-blocked', 'fincas-cand', 'fincas-cand-line', 'fincas-hover']

export class ExplorerController {
  map: maplibregl.Map
  dio: FincaDiorama | null = null
  private app: HTMLElement
  private dioEl: HTMLElement
  private clouds: CloudLayer | null = null
  private three: Promise<[typeof import('./clouds'), typeof import('./diorama')]> | null = null
  private provincias: FC<ProvinciaProps> | null = null
  private malaga: Feature<Geo, ProvinciaProps> | null = null
  private municipios: FC<MunicipioInfo> | null = null
  private fincas: FC<FincaProps> | null = null
  private fincaBoxes = new Map<number, BBox>()
  private munBounds: [[number, number], [number, number]] | null = null
  private hovered: { source: string; id: string | number } | null = null
  private beforeFinca: Camera | null = null
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
    this.map.once('load', () => this.init().catch(() => useExplorer.setState({ error: 'No se han podido cargar los datos del mapa.' })))
  }

  /** three.js (nubes y 3D) va en un trozo aparte que se descarga en segundo plano. */
  private loadThree() {
    this.three ??= Promise.all([import('./clouds'), import('./diorama')])
    return this.three.then(([c, d]) => {
      this.clouds ??= new c.CloudLayer(this.app, 40)
      this.dio ??= new d.FincaDiorama(this.dioEl, {
        onChange: (view) => useExplorer.setState({ view }),
      })
      this.dio.speed = useExplorer.getState().speed
      return { clouds: this.clouds, dio: this.dio, diorama: d }
    })
  }

  private async init() {
    const map = this.map
    if (!map.hasImage(HATCH)) map.addImage(HATCH, hatchImage())
    const [provincias, municipios, stats] = await Promise.all([
      fetch(`${DATA}/provincias_andalucia.geojson`).then((r) => r.json() as Promise<FC<ProvinciaProps>>),
      loadMunicipios(),
      fetch(`${DATA}/municipios_29_stats.json`).then((r) => (r.ok ? r.json() : {})) as Promise<Record<string, Partial<MunicipioInfo>>>,
    ])
    if (this.disposed) return
    this.provincias = provincias
    this.malaga = provincias.features.find((f) => f.properties.id === '29') ?? null
    this.municipios = {
      type: 'FeatureCollection',
      features: municipios.features.map((f) => ({ ...f, properties: { ...f.properties, ...stats[String(f.properties.mun)] } as MunicipioInfo })),
    }
    const andalucia = provincias.features.filter((f) => f.properties.and)
    const maxCultivo = Math.max(...this.municipios.features.map((f) => f.properties.pct_cultivo ?? 0), 1)
    this.source('resto').setData({ ...provincias, features: provincias.features.filter((f) => !f.properties.and) })
    this.source('prov').setData({ ...provincias, features: andalucia })
    this.source('muni').setData(this.municipios)
    map.setPaintProperty('muni-fill', 'fill-color', hoverState('#F4E9D8', ['interpolate', ['linear'], ['coalesce', ['get', 'pct_cultivo'], 0], 0, '#2E3B2A', maxCultivo * 0.33, '#6E7448', maxCultivo * 0.66, '#B39A5A', maxCultivo, AMBER]))
    map.setPaintProperty('muni-fill', 'fill-opacity', hoverState(0.6, 0.72))
    useExplorer.setState({
      totals: {
        andalucia: andalucia.reduce((s, f) => s + (f.properties.fincas ?? 0), 0),
        malaga: this.municipios.features.reduce((s, f) => s + f.properties.fincas, 0),
        municipios: this.municipios.features.length,
        maxCultivo,
      },
    })
    this.labelsFor()
    this.events()
    map.jumpTo(this.cameraFor(0))
    this.prepareLevel(0)
    useExplorer.setState({ phase: 'idle' })
    // Las nubes de la primera transición tienen que estar listas antes del primer clic.
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
    const [glow, line, core] = prefix === 'sel' ? ['sel-glow', 'sel-line', '#FFF1D2'] : ['muni-trace-glow', 'muni-trace', '#F6DDA8']
    this.paint(glow, 'line-gradient', traceExpr(p, AMBER))
    this.paint(line, 'line-gradient', traceExpr(p, core))
  }
  /** Opacidad de todas las capas de fincas respecto a su valor de reposo (k = 1). */
  private fadeFincas(k: number) {
    this.paint('fincas-fill', 'fill-opacity', hoverState(0.24 * k, 0.02 * k))
    this.paint('fincas-line', 'line-opacity', 0.4 * k)
    this.paint('fincas-limited', 'fill-opacity', 0.42 * k)
    this.paint('fincas-blocked-tint', 'fill-opacity', 0.6 * k)
    this.paint('fincas-blocked', 'fill-opacity', 0.55 * k)
    this.paint('fincas-cand', 'fill-opacity', hoverState(0.85 * k, 0.6 * k))
    this.paint('fincas-cand-line', 'line-opacity', k)
    this.paint('fincas-hover', 'line-opacity', hoverState(k, 0))
  }

  // ------------------------------------------------------------ cámara
  private padding(level: Level) {
    const w = window.innerWidth
    if (w < 760) return { top: level === 2 ? 170 : 230, bottom: 70, left: 20, right: 20 }
    if (level === 3) return { top: 90, bottom: 170, left: 280, right: 280 }
    return { top: 80, bottom: 80, left: w < 1100 ? 330 : 390, right: 70 }
  }
  private boundsFor(level: Level): [[number, number], [number, number]] {
    if (level === 0) return boundsOf({ type: 'FeatureCollection', features: this.provincias!.features.filter((f) => f.properties.and) })
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
  /** En un municipio se puede mover y acercar el mapa (dentro de sus límites); en el resto, no. */
  private setInteractive(on: boolean) {
    const m = this.map
    for (const h of [m.dragPan, m.scrollZoom, m.doubleClickZoom, m.touchZoomRotate, m.keyboard]) {
      if (on) h.enable()
      else h.disable()
    }
    if (on) m.touchZoomRotate.disableRotation()
    if (on && this.munBounds) {
      // El límite parte de la vista de llegada (que incluye el hueco del texto): si fuera solo
      // el municipio, MapLibre recolocaría la cámara y lo dejaría debajo del texto.
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

  // ------------------------------------------------------------ niveles
  /** Deja visibles las capas del nivel y su estilo de reposo. */
  private prepareLevel(level: Level) {
    const fincas = level === 2 || level === 3
    ;['prov-fill', 'prov-line', 'malaga-glow'].forEach((id) => this.vis(id, level === 0))
    ;['muni-fill', 'muni-line', 'muni-hover'].forEach((id) => this.vis(id, level === 1))
    ;['muni-trace', 'muni-trace-glow'].forEach((id) => this.vis(id, level === 2))
    FINCA_LAYERS.forEach((id) => this.vis(id, fincas))
    this.paint('muni-fill', 'fill-opacity', hoverState(0.6, 0.72))
    this.paint('prov-fill', 'fill-opacity', hoverState(0.55, 0.42))
    this.paint('malaga-glow', 'line-opacity', 0.35)
    this.fadeFincas(1)
    this.paint('fincas-line', 'line-opacity', ['interpolate', ['linear'], ['zoom'], 10, 0.18, 13, 0.4, 16, 0.6])
    this.paint('sat', 'raster-saturation', level >= 2 ? -0.35 : -0.8)
    this.paint('sat', 'raster-opacity', level >= 2 ? 0.62 : 0.3)
    this.paint('sat', 'raster-brightness-max', 0.85)
    this.paint('hill', 'hillshade-exaggeration', level >= 2 ? 0.25 : 0.45)
    if (level === 2) this.setTrace('muni', 1)
    const geoms = level === 0 ? this.provincias!.features.filter((f) => f.properties.and).map((f) => f.geometry) : level === 1 ? [this.malaga!.geometry] : this.munFeature() ? [this.munFeature()!.geometry] : []
    if (level <= 2) {
      this.source('focus').setData(focusMask(geoms))
      this.paint('focus-mask', 'fill-opacity', level === 0 ? 0.5 : 0.45)
    }
    this.labels.forEach((m) => m.getElement().classList.toggle('hidden-label', level !== 0))
  }
  private munFeature() {
    const key = useExplorer.getState().municipio?.mun
    return this.municipios?.features.find((f) => f.properties.mun === key)
  }

  // ------------------------------------------------------------ transiciones
  /** Andalucía ⇄ Málaga (nubes) y Málaga ⇄ municipio (bruma). */
  private async cloudDive(target: Level, variant: CloudVariant) {
    const { clouds } = await this.loadThree()
    const { level, speed } = useExplorer.getState()
    const back = target < level
    const a = this.current(), b = this.cameraFor(target)
    const path = cameraPath(a, b)
    const pitchPeak = variant === 'clouds' ? 26 : 18, bearingPeak = variant === 'clouds' ? -8 : 5
    let maskSwapped = false
    if (!back && target === 1) {
      // Anticipación: Málaga se enciende y el resto se apaga.
      await this.animate(380, (t) => {
        this.paint('prov-fill', 'fill-opacity', ['case', ['==', ['get', 'id'], '29'], lerp(0.42, 0.75, t), lerp(0.42, 0.18, t)])
        this.paint('malaga-glow', 'line-opacity', lerp(0.35, 0.9, t))
      })
    }
    if (!back && target === 2) {
      // Anticipación: se traza el contorno del municipio y se apagan los demás.
      const key = useExplorer.getState().municipio!.mun
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
      // Municipio → Málaga: las fincas se apagan antes de alejar la cámara y la fuente se vacía,
      // para no pedir teselas de decenas de miles de fincas en cada zoom del vuelo.
      await this.animate(250, (t) => this.fadeFincas(1 - t))
      FINCA_LAYERS.forEach((id) => this.vis(id, false))
      this.source('fincas').setData(EMPTY)
      this.fincas = null
    }
    const key = useExplorer.getState().municipio?.mun
    await clouds.play({
      variant, reverse: back, speed,
      onProgress: (t) => {
        const cam = path(easeInOut(t))
        this.map.jumpTo({ ...cam, pitch: Math.sin(Math.PI * t) * pitchPeak, bearing: Math.sin(Math.PI * t) * bearingPeak })
        if (variant !== 'mist') return
        // La máscara de foco se apaga, cambia de agujero y vuelve a encenderse.
        this.paint('focus-mask', 'fill-opacity', 0.45 * Math.abs(1 - 2 * range(t, 0.15, 0.85)))
        if (!maskSwapped && t >= 0.5) {
          maskSwapped = true
          const g = target === 2 ? this.munFeature()?.geometry : this.malaga?.geometry
          if (g) this.source('focus').setData(focusMask([g]))
        }
        const ready = this.fincas !== null
        if (back) {
          // Municipio → Málaga: vuelven los municipios.
          this.setTrace('muni', 1 - range(t, 0.45, 0.9))
          if (t > 0.3) {
            this.vis('muni-fill', true)
            this.vis('muni-line', true)
            this.paint('muni-fill', 'fill-opacity', 0.72 * range(t, 0.3, 0.75))
          }
          this.paint('sat', 'raster-opacity', lerp(0.62, 0.3, range(t, 0.2, 0.8)))
          this.paint('sat', 'raster-saturation', lerp(-0.35, -0.8, range(t, 0.2, 0.8)))
        } else {
          // Málaga → municipio: sin blanqueo, así que las capas se funden durante el vuelo.
          this.paint('muni-fill', 'fill-opacity', ['case', ['==', ['get', 'mun'], key ?? -1], lerp(0.72, 0.08, range(t, 0.25, 0.6)), lerp(0.22, 0, range(t, 0.2, 0.5))])
          // Las fincas aparecen al final, ya cerca de su zoom: así no se trocean en zooms de paso.
          if (ready && t > 0.72) {
            FINCA_LAYERS.forEach((id) => this.vis(id, true))
            this.fadeFincas(range(t, 0.74, 0.98))
          }
          this.paint('sat', 'raster-opacity', lerp(0.3, 0.62, range(t, 0.3, 0.9)))
          this.paint('sat', 'raster-saturation', lerp(-0.8, -0.35, range(t, 0.3, 0.9)))
        }
      },
      onCover: () => {
        if (variant === 'clouds') this.prepareLevel(target)
      },
    })
    this.map.jumpTo(b)
  }

  /** Municipio → finca: se traza la linde, el mapa vuela a la pieza en cenital y el 3D la levanta. */
  private async enterFinca(finca: Finca) {
    const { dio, diorama } = await this.loadThree()
    const props = finca.properties
    const escenaP = this.escena(finca)
    escenaP.then((sel) => diorama.prefetch(sel.escena.key, sel.escena.tile))
    this.beforeFinca = this.current()
    this.source('sel').setData(toLines(finca.geometry))
    this.vis('sel-line', true)
    this.vis('sel-glow', true)
    this.clearHover()
    await this.animate(600, (t) => {
      this.setTrace('sel', easeInOut(t))
      this.fadeFincas(lerp(1, 0.35, t))
      this.paint('fincas-fill', 'fill-opacity', ['case', ['==', ['get', 'id'], props.id], 0.22, 0])
    })
    const sel = await escenaP
    const tile = sel.escena.tile
    // Se entrega con la pieza algo más pequeña: un nivel de zoom menos son ~4× menos teselas
    // de satélite que descargar; el levantado 3D completa el acercamiento.
    const b = this.cameraFor(3, [[tile[0], tile[1]], [tile[2], tile[3]]])
    b.zoom -= 0.75
    const path = cameraPath(this.current(), b)
    this.app.classList.add('handoff')
    // Durante el vuelo solo se ve la linde elegida: así no se trocean las fincas en cada zoom.
    FINCA_LAYERS.forEach((id) => this.vis(id, false))
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
    await dio.load(sel.escena)
    // Un instante para que se pinten las teselas de esta vista (sin bloquear si la red va lenta).
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
  private tileRect(tile: BBox) {
    const nw = this.map.project([tile[0], tile[3]]), se = this.map.project([tile[2], tile[1]])
    return { x: nw.x, y: nw.y, w: se.x - nw.x, h: se.y - nw.y }
  }
  /** Copia del lienzo del mapa en ese rectángulo, leída justo después de pintar (sin preserveDrawingBuffer). */
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
  private async exitFinca() {
    const { dio } = await this.loadThree()
    const sel = useExplorer.getState().sel
    if (!sel) return
    const tile = sel.escena.tile
    this.app.classList.add('handoff')
    const near = this.cameraFor(3, [[tile[0], tile[1]], [tile[2], tile[3]]])
    near.zoom -= 0.75
    this.map.jumpTo(near)
    await dio.exit({ toRect: this.tileRect(tile) })
    this.vis('sel-line', true)
    this.vis('sel-glow', true)
    this.setTrace('sel', 1)
    dio.hide()
    this.app.classList.remove('handoff')
    const path = cameraPath(this.current(), this.beforeFinca ?? this.cameraFor(2))
    await this.animate(1600, (t) => {
      this.map.jumpTo({ ...path(easeInOut(t)), pitch: Math.sin(Math.PI * t) * 22, bearing: 0 })
      this.paint('sat', 'raster-saturation', lerp(0, -0.35, range(t, 0, 0.7)))
      this.paint('sat', 'raster-opacity', lerp(1, 0.62, range(t, 0, 0.7)))
      this.paint('hill', 'hillshade-exaggeration', lerp(0, 0.25, range(t, 0.2, 1)))
      this.paint('focus-mask', 'fill-opacity', 0.45 * range(t, 0.3, 1))
    })
    // Las fincas vuelven ya en su zoom final.
    FINCA_LAYERS.forEach((id) => this.vis(id, true))
    await this.animate(450, (t) => {
      this.fadeFincas(t)
      this.setTrace('sel', 1 - t)
    })
    this.vis('sel-line', false)
    this.vis('sel-glow', false)
    this.prepareLevel(2)
    useExplorer.setState({ sel: null })
  }

  /** Datos de la finca para el 3D y las tarjetas: vecinas, detalle, clima y notas R0–R3. */
  private async escena(finca: Finca) {
    const p = finca.properties
    const tile = tileFor(bbox(finca) as BBox)
    const neighbors = (this.fincas?.features ?? [])
      .filter((f) => f.properties.id !== p.id && intersects(this.boxOf(f), tile))
      .map((f) => ({ geometry: f.geometry, cover: f.properties.cover, rot: f.properties.rot }))
    const [detalles, comun] = await Promise.all([loadDetalles([{ id: p.id, mun: p.mun }]).catch(() => ({})), loadComun().catch(() => null)])
    const detalle = (detalles as Record<number, import('../lib/detalle').FincaDetalle>)[p.id] ?? null
    const scenario = detalle && comun ? scenarioFor(detalle, comun) : null
    const celda = detalle && comun ? comun.celdas[String(detalle.celda)] : null
    const escena: Escena = {
      key: String(p.id),
      geometry: finca.geometry,
      tile,
      rot: detalle?.rotacion_estimada ?? p.rot,
      campaigns: detalle?.fenologia.map((f) => ({ y: f.campana, cls: f.clase_estimada })) ?? [],
      arbolado: detalle?.cobertura.arbolado ?? 0,
      clay: detalle?.suelo?.arcilla_pct ?? null,
      neighbors,
      crops: Object.fromEntries(Object.entries(ROTATIONS).map(([k, r]) => [k, r.crops])) as Record<RotationKey, string[]>,
    }
    const price = (key: string) => {
      const last = latestPrice(comun?.precios[key])
      return last ? { eurT: last.eurT, year: last.year } : null
    }
    return {
      finca,
      municipio: useExplorer.getState().municipio?.nombre ?? '',
      detalle,
      scores: scenario ? calculateScores(scenario) : null,
      escena,
      climate: celda && scenario ? { lluvia: celda.resumen.lluvia_media_mm, deficit: celda.resumen.deficit_medio_mm, calor: scenario.heatDays, heladas: scenario.frostDays } : null,
      prices: { trigo: price('wheat'), girasol: price('sunflower'), garbanzo: price('chickpea'), veza: price('vetch') },
    }
  }
  private boxOf(f: Feature<Geo, FincaProps>) {
    let b = this.fincaBoxes.get(f.properties.id)
    if (!b) {
      b = bbox(f) as BBox
      this.fincaBoxes.set(f.properties.id, b)
    }
    return b
  }

  /** Carga las fincas del municipio (en paralelo a la animación de entrada). */
  private loadFincas(mun: number) {
    this.fincas = null
    this.fincaBoxes.clear()
    useExplorer.setState({ fincasCount: null })
    return loadMunicipio(mun).then((data) => {
      if (useExplorer.getState().municipio?.mun !== mun) return
      this.fincas = data as FC<FincaProps>
      this.source('fincas').setData(data)
      useExplorer.setState({ fincasCount: data.features.length })
      // Adelanta el detalle del municipio para que abrir una finca sea inmediato.
      loadDetalles([{ id: -1, mun }]).catch(() => undefined)
      loadComun().catch(() => undefined)
    })
  }

  /** Cambia de nivel con su transición. Ignora clics mientras hay una en curso. */
  async go(target: Level, opts: { municipio?: MunicipioInfo; finca?: Finca } = {}) {
    const st = useExplorer.getState()
    if (st.phase !== 'idle' || target === st.level || target < 0 || target > 3) return
    this.clearHover()
    useExplorer.setState({ phase: 'transitioning', toast: null })
    this.setInteractive(false)
    try {
      let l = st.level
      while (l !== target) {
        if (target > l) {
          if (l === 0) await this.cloudDive(1, 'clouds')
          else if (l === 1) {
            const m = opts.municipio ?? useExplorer.getState().municipio
            if (!m) break
            const feature = this.municipios!.features.find((f) => f.properties.mun === m.mun)!
            this.munBounds = boundsOf(feature)
            useExplorer.setState({ municipio: m })
            const loading = this.loadFincas(m.mun)
            await this.cloudDive(2, 'mist')
            if (!this.fincas) {
              useExplorer.setState({ preparing: true })
              await loading.catch(() => showToast('No se han podido cargar las fincas', 'Revisa la conexión y vuelve a intentarlo.', 'blocked'))
              useExplorer.setState({ preparing: false })
            }
          } else if (l === 2) {
            if (!opts.finca) break
            await this.enterFinca(opts.finca)
          }
          l++
        } else {
          if (l === 3) await this.exitFinca()
          else if (l === 2) {
            useExplorer.setState({ level: 2 })
            await this.cloudDive(1, 'mist')
            this.source('fincas').setData(EMPTY)
            this.fincas = null
            useExplorer.setState({ municipio: null, fincasCount: null })
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
      useExplorer.setState({ phase: 'idle' })
      this.setInteractive(useExplorer.getState().level === 2)
    }
  }

  // ------------------------------------------------------------ hover y clic
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
    // La posición del tooltip se escribe directa: no hace falta repintar React en cada píxel.
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
      const p = e.features![0].properties as ProvinciaProps
      this.hover('prov', p.id, e, () => ({ kind: 'provincia', x: 0, y: 0, p }))
    })
    map.on('mousemove', 'muni-fill', (e) => {
      if (useExplorer.getState().level !== 1) return
      const id = Number(e.features![0].id)
      const p = this.municipios!.features.find((f) => f.properties.mun === id)!.properties
      this.hover('muni', id, e, () => ({ kind: 'municipio', x: 0, y: 0, p }))
    })
    map.on('mousemove', 'fincas-fill', (e) => {
      if (useExplorer.getState().level !== 2) return
      const f = e.features![0]
      const p = f.properties as FincaProps
      this.hover('fincas', Number(f.id), e, () => ({ kind: 'finca', x: 0, y: 0, p }))
      const tile = tileFor(bbox(f) as BBox)
      // Precarga relieve y ortofoto si el ratón se queda un momento encima.
      window.clearTimeout(this.prefetchTimer)
      if (!p.apt || !NOT_FARMLAND.includes(p.apt)) this.prefetchTimer = window.setTimeout(() => this.three?.then(([, d]) => d.prefetch(String(p.id), tile)), 350)
    })
    for (const l of ['prov-fill', 'muni-fill', 'fincas-fill']) map.on('mouseleave', l, () => this.clearHover())
    map.on('dragstart', () => this.clearHover())
    map.on('click', 'prov-fill', (e) => {
      if (useExplorer.getState().level !== 0) return
      const p = e.features![0].properties as ProvinciaProps
      if (p.id === '29') this.go(1)
      else showToast(`${p.nombre} · ${(p.fincas ?? 0).toLocaleString('es-ES')} fincas`, 'De momento, el detalle de fincas y rotaciones está preparado para Málaga.')
    })
    map.on('click', 'muni-fill', (e) => {
      if (useExplorer.getState().level !== 1) return
      const id = Number(e.features![0].id)
      const m = this.municipios!.features.find((f) => f.properties.mun === id)
      if (m) this.go(2, { municipio: m.properties })
    })
    map.on('click', 'fincas-fill', (e) => {
      if (useExplorer.getState().level !== 2 || useExplorer.getState().phase !== 'idle') return
      const id = Number(e.features![0].id)
      const finca = this.fincas?.features.find((f) => f.properties.id === id) as Finca | undefined
      if (!finca) return
      const apt = finca.properties.apt
      if (apt && NOT_FARMLAND.includes(apt)) {
        pulse(this.map, finca, '#ef4444', 700)
        showToast('No es tierra de cultivo', `${APT[apt]}: esta finca no se puede analizar (SIGPAC y ESA WorldCover).`, 'blocked')
        return
      }
      if (apt && LIMITED.includes(apt)) showToast('Análisis orientativo', `${APT[apt]}: la finca se puede abrir, pero las rotaciones de herbáceos encajan peor.`, 'warning')
      this.go(3, { finca })
    })
  }
  private labelsFor() {
    const tweak: Record<string, [number, number]> = { '29': [0.05, -0.12], '04': [0.1, 0], '11': [0.05, 0.05] }
    for (const f of this.provincias!.features.filter((x) => x.properties.and)) {
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
  /** Al cambiar el tamaño de la ventana, reencuadra el nivel actual. */
  resize() {
    const { level, phase } = useExplorer.getState()
    if (phase === 'idle' && level < 2) this.map.jumpTo(this.cameraFor(level))
  }
  dispose() {
    this.disposed = true
    this.clouds?.dispose()
    this.dio?.dispose()
    this.map.remove()
  }
}
