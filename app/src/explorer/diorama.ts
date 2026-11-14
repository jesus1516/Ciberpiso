// 3D terrain of the selected farm ("territory tile").
//
// Cuts a square of real terrain around the farm (Mapzen Terrarium DEM and Esri
// orthophoto, the same ones as the map), raises it as a block with a soil profile on
// the sides and draws the farm on top: SIGPAC boundary, crop per campaign (MODIS) or per
// rotation scenario, trees (WorldCover + orthophoto canopies) and anchors for the
// cards. The entry starts flat from above, fitted to the rectangle the farm occupied
// on the map and with a snapshot of the map itself, so the hand-over goes unnoticed.
//
// Performance: it only paints while something changes, normals are computed once and, if
// the first frames are slow, resolution and shadows drop. Offline, the terrain and
// orthophoto are synthesised.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import type { ProfileKey, RotationKey } from '../lib/indicators'
import { COVER_COLORS, CROPS, FIRST_SCENARIO_YEAR, LAST_YEAR, cropForYear, rings, yearLetter, type Anchor, type Anchors, type BBox, type Escena, type Geometry, type Mode, type ViewState } from './escena'

type Rect = { x: number; y: number; w: number; h: number }
type View = { radius: number; polar: number; azimuth: number; ty: number; offset: { x: number; y: number } }

const ESRI = (z: number, x: number, y: number) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
const TERRARIUM = (z: number, x: number, y: number) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`

// ------------------------------------------------------------ utilities
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const range = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOut = (t: number) => 1 - (1 - t) ** 3
const backOut = (t: number) => 1 + 2.6 * (t - 1) ** 3 + 1.6 * (t - 1) ** 2
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const mercX = (lon: number) => (lon + 180) / 360
const mercY = (lat: number) => {
  const s = Math.sin((lat * Math.PI) / 180)
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)
}
type Frame = {
  mx0: number; mx1: number; my0: number; my1: number; Sx: number; Sz: number; S: number; lat: number
  uv: (lon: number, lat: number) => [number, number]
  world: (u: number, v: number) => [number, number]
}
function makeFrame([w, s, e, n]: BBox): Frame {
  const lat = (s + n) / 2
  const mx0 = mercX(w), mx1 = mercX(e), my0 = mercY(n), my1 = mercY(s)
  const Sx = (e - w) * 111320 * Math.cos((lat * Math.PI) / 180), Sz = (n - s) * 110574
  return {
    mx0, mx1, my0, my1, Sx, Sz, S: Math.max(Sx, Sz), lat,
    uv: (lon, la) => [(mercX(lon) - mx0) / (mx1 - mx0), (mercY(la) - my0) / (my1 - my0)],
    world: (u, v) => [(u - 0.5) * Sx, (v - 0.5) * Sz],
  }
}

// ------------------------------------------------------------ tiles
function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = setTimeout(() => {
      img.src = ''
      reject(new Error('timeout'))
    }, 15000)
    img.onload = () => { clearTimeout(timer); resolve(img) }
    img.onerror = () => { clearTimeout(timer); reject(new Error(url)) }
    img.src = url
  })
}

/** Pastes the tiles that cover the frame. native=true keeps pixels (DEM). */
async function stitch(frame: Frame, z: number, urlFor: typeof ESRI, out: number, native: boolean) {
  const n = 2 ** z * 256
  const px0 = frame.mx0 * n, px1 = frame.mx1 * n, py0 = frame.my0 * n, py1 = frame.my1 * n
  const tx0 = Math.floor(px0 / 256), tx1 = Math.floor((px1 - 1e-6) / 256)
  const ty0 = Math.floor(py0 / 256), ty1 = Math.floor((py1 - 1e-6) / 256)
  const canvas = document.createElement('canvas')
  let sx = 1, sy = 1, ox = tx0 * 256, oy = ty0 * 256
  if (native) {
    canvas.width = (tx1 - tx0 + 1) * 256
    canvas.height = (ty1 - ty0 + 1) * 256
  } else {
    canvas.width = canvas.height = out
    sx = out / (px1 - px0); sy = out / (py1 - py0); ox = px0; oy = py0
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: native })!
  ctx.imageSmoothingEnabled = !native
  ctx.imageSmoothingQuality = 'high'
  const jobs: Promise<void>[] = []
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      jobs.push(loadImage(urlFor(z, tx, ty)).then((img) => ctx.drawImage(img, (tx * 256 - ox) * sx, (ty * 256 - oy) * sy, 256 * sx, 256 * sy)))
    }
  }
  const res = await Promise.allSettled(jobs)
  return { canvas, failed: res.filter((r) => r.status === 'rejected').length, total: jobs.length, px0, px1, py0, py1, ox: tx0 * 256, oy: ty0 * 256 }
}

/** Moving average of radius 2 in one direction: O(n) per pass. */
function boxBlur(h: Float32Array, W: number, H: number, dx: number, dy: number) {
  const o = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0, c = 0
      for (let k = -2; k <= 2; k++) {
        const xx = x + k * dx, yy = y + k * dy
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue
        s += h[yy * W + xx]; c++
      }
      o[y * W + x] = s / c
    }
  }
  return o
}

type Dem = { synthetic: boolean; sample: (u: number, v: number) => number }
type Ortho = { synthetic: boolean; canvas: HTMLCanvasElement }

async function loadDEM(frame: Frame): Promise<Dem> {
  const st = await stitch(frame, frame.S < 2600 ? 15 : 14, TERRARIUM, 0, true)
  if (st.failed === st.total) throw new Error('DEM sin teselas')
  const { width: W, height: H } = st.canvas
  const px = st.canvas.getContext('2d')!.getImageData(0, 0, W, H).data
  let h = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) h[i] = px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768
  // The source DEM is ~30 m and shows steps at z15: two 5×5 box passes.
  for (let pass = 0; pass < 2; pass++) h = boxBlur(boxBlur(h, W, H, 1, 0), W, H, 0, 1)
  return {
    synthetic: false,
    sample(u, v) {
      const x = st.px0 + u * (st.px1 - st.px0) - st.ox - 0.5
      const y = st.py0 + v * (st.py1 - st.py0) - st.oy - 0.5
      const x0 = Math.max(0, Math.min(W - 2, Math.floor(x))), y0 = Math.max(0, Math.min(H - 2, Math.floor(y)))
      const fx = clamp01(x - x0), fy = clamp01(y - y0)
      const a = h[y0 * W + x0], b = h[y0 * W + x0 + 1], c = h[(y0 + 1) * W + x0], d = h[(y0 + 1) * W + x0 + 1]
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
    },
  }
}
function syntheticDEM(seed: number): Dem {
  const r = rng(seed)
  const waves = Array.from({ length: 6 }, (_, i) => ({ kx: (r() - 0.5) * (3 + i * 2.2), kz: (r() - 0.5) * (3 + i * 2.2), p: r() * 6.28, a: 22 / (1 + i * 0.9) }))
  return { synthetic: true, sample: (u, v) => 600 + waves.reduce((s, w) => s + Math.sin(u * w.kx * 3.1 + v * w.kz * 3.1 + w.p) * w.a, 0) }
}
async function loadOrtho(frame: Frame): Promise<Ortho> {
  // ~1100 px of real image is enough for the on-screen block: z16 on almost all
  // farms (≈16 tiles) and z17 only on small ones. The texture does not exceed 2048.
  const mPerPx = 156543.034 * Math.cos((frame.lat * Math.PI) / 180)
  const z = Math.max(13, Math.min(17, Math.round(Math.log2((mPerPx * 1100) / frame.S))))
  const native = frame.S / (mPerPx / 2 ** z)
  const out = Math.min(2048, Math.max(1024, 2 ** Math.ceil(Math.log2(native))))
  const st = await stitch(frame, z, ESRI, out, false)
  if (st.failed > st.total * 0.3) throw new Error('ortofoto incompleta')
  return { canvas: st.canvas, synthetic: false }
}
function syntheticOrtho(seed: number): Ortho {
  const c = document.createElement('canvas')
  c.width = c.height = 1024
  const ctx = c.getContext('2d')!
  const r = rng(seed)
  ctx.fillStyle = '#8E8566'
  ctx.fillRect(0, 0, 1024, 1024)
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${90 + r() * 70},${85 + r() * 60},${55 + r() * 40},${0.18 + r() * 0.3})`
    ctx.beginPath()
    ctx.arc(r() * 1024, r() * 1024, 8 + r() * 70, 0, 6.283)
    ctx.fill()
  }
  return { canvas: c, synthetic: true }
}

type Sources = { frame: Frame; dem: Dem; ortho: Ortho }
const sourceCache = new Map<string, Promise<Sources>>()

/** Downloads terrain and orthophoto for the tile (can be called when hovering over the farm). */
export function prefetch(key: string, tile: BBox) {
  if (!sourceCache.has(key)) {
    const frame = makeFrame(tile)
    const seed = Number(key.slice(-6)) || 7
    sourceCache.set(key, Promise.all([loadDEM(frame).catch(() => syntheticDEM(seed)), loadOrtho(frame).catch(() => syntheticOrtho(seed))]).then(([dem, ortho]) => ({ frame, dem, ortho })))
    if (sourceCache.size > 12) sourceCache.delete(sourceCache.keys().next().value!)
  }
  return sourceCache.get(key)!
}

// ------------------------------------------------------------ shaders
const NOISE_GLSL = /* glsl */ `
  float cpHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float cpNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(cpHash(i), cpHash(i + vec2(1.0, 0.0)), f.x), mix(cpHash(i + vec2(0.0, 1.0)), cpHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float cpFbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * cpNoise(p); p *= 2.03; a *= 0.5; } return v; }
`

type Uniforms = Record<string, THREE.IUniform>

function terrainMaterial(ortho: THREE.Texture, uniforms: Uniforms) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0, map: ortho })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tMask; uniform sampler2D tCropA; uniform sampler2D tCropB;
        uniform sampler2D tSnap; uniform float uSnap;
        uniform float uSweep; uniform float uMode; uniform float uFocus; uniform float uLit;
        uniform float uTime; uniform float uShadowAmt; uniform vec2 uSweepDir;
        ${NOISE_GLSL}`)
      .replace('#include <map_fragment>', `
        vec4 orthoC = texture2D(map, vMapUv);
        vec4 mk = texture2D(tMask, vMapUv);
        vec4 ca = texture2D(tCropA, vMapUv);
        vec4 cb = texture2D(tCropB, vMapUv);
        float sc = dot(vMapUv - 0.5, uSweepDir) + 0.5 + (cpNoise(vMapUv * 42.0) - 0.5) * 0.045;
        float edge = uSweep * 1.32 - 0.16;
        float tB = 1.0 - smoothstep(edge - 0.018, edge + 0.018, sc);
        vec4 crop = mix(ca, cb, tB);
        float own = mk.r;
        float glint = (1.0 - smoothstep(0.0, 0.022, abs(sc - edge))) * step(0.001, uSweep) * step(uSweep, 0.999) * own;
        float lum = dot(orthoC.rgb, vec3(0.2126, 0.7152, 0.0722));
        // Satellite: the orthophoto leads; outside the farm it fades out, inside it is tinted with the crop.
        vec3 grey = mix(vec3(lum), orthoC.rgb, 0.4) * vec3(0.66, 0.70, 0.60);
        vec3 sat = mix(orthoC.rgb, grey, uFocus * (1.0 - own));
        sat = mix(sat, mix(sat, sat * crop.rgb * 2.2, 0.55), crop.a * own * uFocus);
        // Model: flat crop colours over a "paper" that keeps the light of the photo.
        vec3 paper = mix(vec3(0.16, 0.18, 0.11), vec3(0.50, 0.46, 0.33), smoothstep(0.02, 0.22, lum));
        vec3 maq = mix(paper, crop.rgb, crop.a * 0.94);
        maq *= 0.86 + 0.5 * clamp(lum - 0.08, -0.2, 0.3);
        maq = mix(maq, maq * vec3(0.62, 0.66, 0.58), uFocus * (1.0 - own) * 0.5);
        vec3 col = mix(sat, maq, uMode);
        col = mix(col, col * 0.55, mk.b * (0.3 + 0.45 * uMode) * uFocus);
        col += vec3(0.95, 0.68, 0.30) * mk.g * 0.32 * uFocus;
        col += vec3(1.0, 0.85, 0.5) * glint * 0.55;
        float cs = smoothstep(0.5, 0.78, cpFbm(vMapUv * 2.1 + vec2(uTime * 0.007, uTime * 0.003)));
        col *= 1.0 - cs * 0.2 * uShadowAmt;
        // Hand-over from the map: at first exactly the MapLibre canvas snapshot is visible.
        col = mix(col, texture2D(tSnap, vMapUv).rgb, uSnap);
        diffuseColor.rgb *= col;
        vec3 unlitColor = diffuseColor.rgb;`)
      .replace('#include <opaque_fragment>', `outgoingLight = mix(unlitColor, outgoingLight, uLit);
        #include <opaque_fragment>`)
  }
  return m
}

function wallMaterial(uniforms: Uniforms) {
  const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aDepth; attribute float aAlong; varying float vDepthN; varying float vAlong;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDepthN = aDepth; vAlong = aAlong;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uClay; uniform float uLit; varying float vDepthN; varying float vAlong;
        ${NOISE_GLSL}
        vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }`)
      // Soil profile: dark A horizon, clayey B (darker the more clay), marl and limestone.
      .replace('#include <color_fragment>', `
        float g = vDepthN + (cpNoise(vec2(vAlong * 0.018, vDepthN * 4.0)) - 0.5) * 0.06 + sin(vAlong * 0.011) * 0.012;
        vec3 cA = lin(vec3(0.27, 0.21, 0.15));
        vec3 cB = mix(lin(vec3(0.52, 0.38, 0.25)), lin(vec3(0.36, 0.29, 0.22)), uClay);
        vec3 cC = lin(vec3(0.67, 0.53, 0.35));
        vec3 cR = lin(vec3(0.82, 0.75, 0.60));
        vec3 c = lin(vec3(0.42, 0.47, 0.27));
        c = mix(c, cA, smoothstep(0.010, 0.016, g));
        c = mix(c, cB, smoothstep(0.075, 0.09, g));
        c = mix(c, cC, smoothstep(0.30, 0.315, g));
        c = mix(c, cR, smoothstep(0.56, 0.575, g));
        c *= 0.88 + 0.22 * cpNoise(vec2(vAlong * 0.22, g * 55.0));
        c *= 1.0 - 0.06 * step(0.5, fract(g * 14.0 + cpNoise(vec2(vAlong * 0.03, 1.0)) * 0.4)) * step(0.56, g);
        c *= mix(1.0, 0.7, smoothstep(0.82, 1.0, g));
        diffuseColor.rgb = c;
        vec3 unlitWall = c;`)
      .replace('#include <opaque_fragment>', 'outgoingLight = mix(unlitWall * 0.8, outgoingLight, uLit);\n#include <opaque_fragment>')
  }
  return m
}

function drawRings(ctx: CanvasRenderingContext2D, frame: Frame, geom: Geometry, size: number) {
  for (const poly of rings(geom)) {
    for (const ring of poly) {
      ring.forEach(([lon, lat], i) => {
        const [u, v] = frame.uv(lon, lat)
        if (i === 0) ctx.moveTo(u * size, v * size)
        else ctx.lineTo(u * size, v * size)
      })
      ctx.closePath()
    }
  }
}

type Boundary = { pts: [number, number][]; glow: Line2; core: Line2; curtain: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>; segs: number }
type Tree = { u: number; v: number; s: number; tone: number; delay: number }
type Tween = { start: number; ms: number; fn: (k: number) => void; resolve: () => void }

export type DioramaOptions = {
  onChange?: (state: ViewState) => void
  onFrame?: (anchors: Anchors) => void
  onCardsIn?: (anchors: Anchors) => void
}

export class FincaDiorama {
  container: HTMLElement
  opts: DioramaOptions
  speed = 1
  state: ViewState = { year: 2025, rotation: 'R1', profile: 'water_first', mode: 'satelite', exaggeration: 2 }
  private preferredExaggeration = 2
  escena: Escena | null = null
  synthetic = false
  leaders: SVGSVGElement
  pin: HTMLDivElement
  width = 1
  height = 1

  private bg: HTMLDivElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(32, 1, 1, 100000)
  private controls: OrbitControls
  private sun = new THREE.DirectionalLight('#FFE7C4', 3.1)
  private uniforms: Uniforms
  private blank: THREE.DataTexture
  private snapTex: THREE.Texture | null = null
  private tweens: Tween[] = []
  private viewOffset = { x: 0, y: 0 }
  private active = false
  private raf = 0
  private dragging = false
  private lastBusy = 0
  private perf: { n: number; t0: number } | null = null
  private adapted = false
  private ro: ResizeObserver
  private textures: THREE.Texture[] = []
  // current tile
  private group: THREE.Group | null = null
  private frame!: Frame
  private terrain: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | null = null
  private walls!: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  private cap!: THREE.Mesh
  private catcher!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private wallTop: { v: number; u: number; vv: number }[] = []
  private boundary: Boundary[] = []
  private trees!: { mesh: THREE.InstancedMesh; list: Tree[]; rad: number }
  private farm!: { group: THREE.Group; u: number; v: number }
  private base!: Float32Array
  private N = 220
  private relief = 0
  private depth = 0
  private rise = -1
  private wall = -1
  private dirtyRise = false
  private normalsE = 0
  private ownMask!: Uint8ClampedArray
  private maskSize = 1024
  private anchorsUV!: Record<'water' | 'risk' | 'market' | 'center', [number, number]>
  private centerUV: [number, number] = [0.5, 0.5]
  private cropCanvases: HTMLCanvasElement[] = []
  private cropTex: THREE.CanvasTexture[] = []
  private front = 0

  constructor(container: HTMLElement, opts: DioramaOptions = {}) {
    this.container = container
    this.opts = opts
    container.classList.add('dio')
    this.bg = document.createElement('div')
    this.bg.className = 'dio-bg'
    container.appendChild(this.bg)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    // 1.5 is enough for sharp lines; if the machine is struggling, it drops to 1 (see adapt).
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.domElement.className = 'dio-canvas'
    container.appendChild(this.renderer.domElement)

    const overlay = document.createElement('div')
    overlay.className = 'dio-overlay'
    overlay.innerHTML = '<svg class="dio-leaders" aria-hidden="true"></svg><div class="dio-pin" aria-hidden="true"></div>'
    container.appendChild(overlay)
    this.leaders = overlay.querySelector('svg')!
    this.pin = overlay.querySelector('.dio-pin')!

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, rotateSpeed: 0.55, zoomSpeed: 0.7, enabled: false })
    this.controls.addEventListener('start', () => { this.dragging = true; this.kick() })
    this.controls.addEventListener('end', () => { this.dragging = false; this.kick() })
    this.controls.addEventListener('change', () => this.kick())

    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.scene.add(new THREE.HemisphereLight('#E4E6D6', '#4A3E2C', 1.35), this.sun, this.sun.target)

    this.blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
    this.blank.needsUpdate = true
    this.uniforms = {
      tMask: { value: null }, tCropA: { value: null }, tCropB: { value: null },
      tSnap: { value: this.blank }, uSnap: { value: 0 },
      uSweep: { value: 0 }, uMode: { value: 0 }, uFocus: { value: 0 }, uLit: { value: 0 },
      uTime: { value: 0 }, uShadowAmt: { value: 1 }, uSweepDir: { value: new THREE.Vector2(0.8, -0.6) },
      uClay: { value: 0.5 },
    }
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this.resize()
  }

  // -------------------------------------------------------- construction
  async load(escena: Escena) {
    if (this.escena?.key === escena.key && this.group) return
    const src = await prefetch(escena.key, escena.tile)
    this.clear()
    this.escena = escena
    this.frame = src.frame
    this.synthetic = src.dem.synthetic || src.ortho.synthetic
    const { frame } = this
    const S = frame.S

    const ortho = new THREE.CanvasTexture(src.ortho.canvas)
    ortho.colorSpace = THREE.SRGBColorSpace
    ortho.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    this.textures = [ortho]
    const lum = this.lumGrid(src.ortho.canvas)
    this.buildMask()
    this.centerUV = this.interiorCenter()
    this.cropCanvases = [0, 1].map(() => {
      const c = document.createElement('canvas')
      c.width = c.height = 1024
      return c
    })
    this.cropTex = this.cropCanvases.map((c) => {
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      return t
    })
    this.textures.push(...this.cropTex)
    this.uniforms.tCropA.value = this.cropTex[0]
    this.uniforms.tCropB.value = this.cropTex[1]
    this.front = 0
    this.uniforms.uClay.value = clamp01(((escena.clay ?? 30) - 15) / 30)

    this.group = new THREE.Group()
    this.scene.add(this.group)

    const N = this.N
    const pos = new Float32Array((N + 1) * (N + 1) * 3)
    const uvs = new Float32Array((N + 1) * (N + 1) * 2)
    const base = new Float32Array((N + 1) * (N + 1))
    let hMin = Infinity, hMax = -Infinity
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const k = j * (N + 1) + i
        const u = i / N, v = j / N
        const h = src.dem.sample(u, v)
        base[k] = h
        hMin = Math.min(hMin, h); hMax = Math.max(hMax, h)
        const [x, z] = frame.world(u, v)
        pos[k * 3] = x; pos[k * 3 + 2] = z
        uvs[k * 2] = u; uvs[k * 2 + 1] = 1 - v
      }
    }
    for (let k = 0; k < base.length; k++) base[k] -= hMin
    // In mountains (Ronda, Axarquía) ×2 overflows the block: exaggerated relief does not exceed 20 % of the side.
    this.relief = hMax - hMin
    const E = Math.max(1, Math.min(this.preferredExaggeration, Math.round(((0.2 * S) / Math.max(this.relief, 1)) * 10) / 10))
    this.state.exaggeration = E
    const idx = new Uint32Array(N * N * 6)
    let q = 0
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1
        idx.set([a, c, b, b, c, d], q)
        q += 6
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    geo.setIndex(new THREE.BufferAttribute(idx, 1))
    this.terrain = new THREE.Mesh(geo, terrainMaterial(ortho, this.uniforms))
    this.terrain.castShadow = this.terrain.receiveShadow = true
    this.group.add(this.terrain)
    this.base = base
    this.depth = Math.max(0.075 * S, this.relief * E * 0.7 + 0.045 * S)
    this.normalsE = 0

    this.buildWalls()
    this.buildBoundary()
    this.buildTrees(lum)
    this.buildFarmstead()
    this.buildShadowCatcher()
    this.computeAnchors()

    const sc = this.sun.shadow.camera
    sc.left = sc.bottom = -S * 0.78
    sc.right = sc.top = S * 0.78
    sc.near = S * 0.2
    sc.far = S * 6
    sc.updateProjectionMatrix()
    this.sun.position.set(-0.62 * S * 2, 0.78 * S * 2, -0.34 * S * 2)
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = S * 0.0008
    this.camera.near = S * 0.02
    this.camera.far = S * 30
    this.camera.updateProjectionMatrix()

    this.rise = -1
    this.setRise(0)
    this.paint(this.state.year, true)
    this.controls.minDistance = S * 0.9
    this.controls.maxDistance = S * 4.2
    this.controls.minPolarAngle = 0.32
    this.controls.maxPolarAngle = 1.22
  }

  private lumGrid(canvas: HTMLCanvasElement) {
    const size = 1024
    const c = document.createElement('canvas')
    c.width = c.height = size
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(canvas, 0, 0, size, size)
    let px: Uint8ClampedArray
    try {
      px = ctx.getImageData(0, 0, size, size).data
    } catch {
      return null
    }
    const lum = new Float32Array(size * size)
    for (let i = 0; i < lum.length; i++) lum[i] = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255
    return { size, lum }
  }

  /** RGBA mask: R farm, G glow of the boundary, B boundaries of the neighbouring farms. */
  private buildMask() {
    const size = this.maskSize, { frame } = this, e = this.escena!
    const layer = (draw: (ctx: CanvasRenderingContext2D) => void) => {
      const c = document.createElement('canvas')
      c.width = c.height = size
      const ctx = c.getContext('2d', { willReadFrequently: true })!
      draw(ctx)
      return ctx.getImageData(0, 0, size, size).data
    }
    const own = layer((ctx) => {
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      drawRings(ctx, frame, e.geometry, size)
      ctx.fill('evenodd')
    })
    const glow = layer((ctx) => {
      ctx.lineJoin = 'round'
      for (const [w, a] of [[16, 0.08], [9, 0.18], [4, 0.45]]) {
        ctx.strokeStyle = `rgba(255,255,255,${a})`
        ctx.lineWidth = w
        ctx.beginPath()
        drawRings(ctx, frame, e.geometry, size)
        ctx.stroke()
      }
    })
    const lines = layer((ctx) => {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.4
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (const f of e.neighbors) drawRings(ctx, frame, f.geometry, size)
      ctx.stroke()
    })
    const data = new Uint8Array(size * size * 4)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const p = (y * size + x) * 4
        const o = ((size - 1 - y) * size + x) * 4 // DataTexture: row 0 = south
        data[o] = own[p]
        data[o + 1] = glow[p]
        data[o + 2] = lines[p]
        data[o + 3] = 255
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.generateMipmaps = true
    tex.needsUpdate = true
    this.textures.push(tex)
    this.uniforms.tMask.value = tex
    this.ownMask = own
  }

  private inside(u: number, v: number) {
    const s = this.maskSize
    return this.ownMask[(Math.min(s - 1, Math.floor(v * s)) * s + Math.min(s - 1, Math.floor(u * s))) * 4] > 200
  }

  /** World height at (u,v) for the current "rise" level. */
  heightAt(u: number, v: number, rise = this.rise) {
    const N = this.N
    const x = clamp01(u) * N, y = clamp01(v) * N
    const i = Math.min(N - 1, Math.floor(x)), j = Math.min(N - 1, Math.floor(y))
    const fx = x - i, fy = y - j, b = this.base
    const a = b[j * (N + 1) + i], c1 = b[j * (N + 1) + i + 1], c2 = b[(j + 1) * (N + 1) + i], d = b[(j + 1) * (N + 1) + i + 1]
    return (a + (c1 - a) * fx + (c2 - a) * fy + (a - c1 - c2 + d) * fx * fy) * this.state.exaggeration * Math.max(0, rise)
  }

  private buildWalls() {
    const N = this.N, { frame } = this
    // south, east, north, west (clockwise seen from above)
    const edges: ((t: number) => [number, number])[] = [(t) => [t, 1], (t) => [1, 1 - t], (t) => [1 - t, 0], (t) => [0, t]]
    const count = edges.length * (N + 1) * 2
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3)
    const depth = new Float32Array(count), along = new Float32Array(count)
    const idx: number[] = []
    let v = 0, dist = 0
    this.wallTop = []
    edges.forEach((edge, e) => {
      const normal = [[0, 0, 1], [1, 0, 0], [0, 0, -1], [-1, 0, 0]][e]
      const start = v
      for (let s = 0; s <= N; s++) {
        const [u, vv] = edge(s / N)
        const [x, z] = frame.world(u, vv)
        for (let k = 0; k < 2; k++) {
          pos.set([x, 0, z], v * 3)
          nor.set(normal, v * 3)
          depth[v] = k
          along[v] = dist + (s / N) * (e % 2 ? frame.Sz : frame.Sx)
          if (k === 0) this.wallTop.push({ v, u, vv })
          v++
        }
        if (s > 0) {
          const a = start + (s - 1) * 2, b = a + 1, c = a + 2, d = a + 3
          idx.push(a, b, c, c, b, d)
        }
      }
      dist += e % 2 ? frame.Sz : frame.Sx
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
    geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1))
    geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1))
    geo.setIndex(idx)
    this.walls = new THREE.Mesh(geo, wallMaterial(this.uniforms))
    this.walls.castShadow = this.walls.receiveShadow = true
    this.group!.add(this.walls)
    this.cap = new THREE.Mesh(new THREE.PlaneGeometry(frame.Sx, frame.Sz), new THREE.MeshStandardMaterial({ color: '#211C14', roughness: 1 }))
    this.cap.rotation.x = Math.PI / 2
    this.group!.add(this.cap)
  }

  private buildBoundary() {
    const { frame } = this
    this.boundary = []
    const step = frame.S / 450
    for (const poly of rings(this.escena!.geometry)) {
      const ring = poly[0]
      const pts: [number, number][] = []
      for (let i = 0; i < ring.length - 1; i++) {
        const [ua, va] = frame.uv(ring[i][0], ring[i][1])
        const [ub, vb] = frame.uv(ring[i + 1][0], ring[i + 1][1])
        const n = Math.max(1, Math.ceil(Math.hypot((ub - ua) * frame.Sx, (vb - va) * frame.Sz) / step))
        for (let k = 0; k < n; k++) pts.push([lerp(ua, ub, k / n), lerp(va, vb, k / n)])
      }
      if (pts.length < 2) continue
      pts.push(pts[0])
      const positions = new Float32Array(pts.length * 3)
      pts.forEach(([u, v], i) => {
        const [x, z] = frame.world(u, v)
        positions.set([x, 0, z], i * 3)
      })
      const mk = (width: number, color: string, opacity: number) => {
        const g = new LineGeometry()
        g.setPositions(positions)
        // Always on top: with the flat terrain at the start, the depth test dots it.
        const m = new LineMaterial({ color: new THREE.Color(color), linewidth: width, transparent: true, opacity, depthTest: false, worldUnits: false })
        m.resolution.set(this.width, this.height)
        const l = new Line2(g, m)
        l.frustumCulled = false
        l.renderOrder = 5
        this.group!.add(l)
        return l
      }
      const glow = mk(10, '#E8B86A', 0.22)
      const core = mk(2.6, '#FFF1D2', 0.95)
      // Vertical luminous curtain along the boundary.
      const cnt = pts.length
      const ch = new Float32Array(cnt * 2)
      const cidx: number[] = []
      for (let i = 0; i < cnt; i++) {
        ch[i * 2 + 1] = 1
        if (i < cnt - 1) cidx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3)
      }
      const cgeo = new THREE.BufferGeometry()
      cgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cnt * 6), 3))
      cgeo.setAttribute('aH', new THREE.BufferAttribute(ch, 1))
      cgeo.setIndex(cidx)
      const curtain = new THREE.Mesh(cgeo, new THREE.ShaderMaterial({
        uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#F2C27A') } },
        vertexShader: 'attribute float aH; varying float vH; void main(){ vH = aH; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float uOpacity; uniform vec3 uColor; varying float vH; void main(){ gl_FragColor = vec4(uColor, pow(1.0 - vH, 2.2) * uOpacity); }',
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      }))
      curtain.frustumCulled = false
      curtain.renderOrder = 4
      this.group!.add(curtain)
      this.boundary.push({ pts, glow, core, curtain, segs: pts.length - 1 })
    }
  }

  /** Trees: WorldCover says how many (neighbouring "tree cover" farms and the farm %); the orthophoto, where. */
  private buildTrees(lum: { size: number; lum: Float32Array } | null) {
    const { frame } = this, S = frame.S, e = this.escena!
    const mask = document.createElement('canvas')
    mask.width = mask.height = 512
    const mctx = mask.getContext('2d', { willReadFrequently: true })!
    mctx.fillStyle = '#fff'
    for (const f of e.neighbors) {
      if (f.cover !== 'arbolado') continue
      mctx.beginPath()
      drawRings(mctx, frame, f.geometry, 512)
      mctx.fill('evenodd')
    }
    const ownShare = clamp01(e.arbolado / 100)
    if (ownShare > 0) {
      mctx.fillStyle = `rgba(255,255,255,${ownShare})`
      mctx.beginPath()
      drawRings(mctx, frame, e.geometry, 512)
      mctx.fill('evenodd')
    }
    const m = mctx.getImageData(0, 0, 512, 512).data
    const sp = Math.max(9, Math.min(22, S / 120))
    const r = rng(Number(e.key.slice(-5)) || 3)
    const trees: Tree[] = []
    const nx = Math.floor(frame.Sx / sp), nz = Math.floor(frame.Sz / sp)
    for (let gz = 0; gz < nz && trees.length < 6000; gz++) {
      for (let gx = 0; gx < nx; gx++) {
        const u = (gx + 0.5) / nx, v = (gz + 0.5) / nz
        if (u < 0.01 || u > 0.99 || v < 0.01 || v > 0.99) continue
        const prob = m[(Math.floor(v * 512) * 512 + Math.floor(u * 512)) * 4] / 255
        if (prob <= 0 || r() > prob) continue
        let tu = u + ((r() - 0.5) * 0.6) / nx, tv = v + ((r() - 0.5) * 0.6) / nz
        if (lum) {
          // Look for the canopy (darkest pixel) within the cell.
          const L = lum.size, x0 = Math.floor((gx / nx) * L), x1 = Math.floor(((gx + 1) / nx) * L)
          const y0 = Math.floor((gz / nz) * L), y1 = Math.floor(((gz + 1) / nz) * L)
          let min = 2, mx = 0, my = 0, sum = 0, cnt = 0
          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              const l = lum.lum[y * L + x]
              sum += l; cnt++
              if (l < min) { min = l; mx = x; my = y }
            }
          }
          // Only where there is a real canopy: a patch clearly darker than its surroundings.
          if (cnt && (sum / cnt - min < 0.1 || min > 0.3)) continue
          if (cnt) { tu = (mx + 0.5) / L; tv = (my + 0.5) / L }
        }
        trees.push({ u: tu, v: tv, s: 0.75 + r() * 0.5, tone: r(), delay: 0 })
      }
    }
    const rad = Math.max(3.2, Math.min(7.5, S / 250))
    const geo = new THREE.IcosahedronGeometry(1, 0)
    geo.scale(1, 0.82, 1)
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), Math.max(1, trees.length))
    mesh.count = trees.length
    const c = new THREE.Color(), olive = new THREE.Color('#7A8748')
    trees.forEach((t, i) => mesh.setColorAt(i, c.set('#55663A').lerp(olive, t.tone)))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.castShadow = true
    mesh.frustumCulled = false
    this.group!.add(mesh)
    const [cu, cv] = this.centerUV
    trees.forEach((t) => (t.delay = Math.hypot(t.u - cu, t.v - cv) * 0.9 + r() * 0.12))
    this.trees = { mesh, list: trees, rad }
  }

  /** Interior point of the farm closest to its centre (the centroid may fall outside). */
  private interiorCenter(): [number, number] {
    let sx = 0, sy = 0, n = 0
    const pts: [number, number][] = []
    for (let j = 1; j < 96; j++) {
      for (let i = 1; i < 96; i++) {
        const u = i / 96, v = j / 96
        if (!this.inside(u, v)) continue
        sx += u; sy += v; n++
        pts.push([u, v])
      }
    }
    if (!n) return [0.5, 0.5]
    const cu = sx / n, cv = sy / n
    return pts.reduce((best, p) => (Math.hypot(p[0] - cu, p[1] - cv) < Math.hypot(best[0] - cu, best[1] - cv) ? p : best), pts[0])
  }

  /** Schematic farmhouse (model mode only): whitewashed walls, tiles and cypresses. */
  private buildFarmstead() {
    const { frame } = this, S = frame.S
    const g = new THREE.Group()
    const k = Math.max(1, S / 900)
    const white = new THREE.MeshStandardMaterial({ color: '#F1ECE2', roughness: 0.9 })
    const roof = new THREE.MeshStandardMaterial({ color: '#B4623E', roughness: 0.85, flatShading: true })
    const cyp = new THREE.MeshStandardMaterial({ color: '#2E4A2E', roughness: 1, flatShading: true })
    const box = (w: number, h: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w * k, h * k, d * k), white)
      m.position.set(x * k, (h * k) / 2, z * k)
      m.castShadow = m.receiveShadow = true
      g.add(m)
    }
    const prism = (w: number, d: number, h: number, x: number, z: number, y: number, rotY: number) => {
      const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)])
      const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false })
      geo.translate(0, 0, -d / 2)
      geo.scale(k, k, k)
      const m = new THREE.Mesh(geo, roof)
      m.position.set(x * k, y * k, z * k)
      m.rotation.y = rotY
      m.castShadow = true
      g.add(m)
    }
    box(26, 7, 11, 0, 0)
    box(11, 6, 18, -16, 9)
    prism(12.4, 27, 4.2, 0, 0, 7, Math.PI / 2)
    prism(19, 12, 3.6, -16, 9, 6, 0)
    box(12, 1.6, 0.8, 8, 12)
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(2.2 * k, 16 * k, 6), cyp)
      c.position.set((14 + i * 6.5) * k, 8 * k, -10 * k)
      c.castShadow = true
      g.add(c)
    }
    // Next to the boundary, on the side facing the initial camera (south-west), inwards.
    const [cu, cv] = this.centerUV
    let best: [number, number] = [cu, cv], score = -Infinity
    for (const [lon, lat] of rings(this.escena!.geometry)[0][0]) {
      const [u, v] = frame.uv(lon, lat)
      if (v - u * 0.6 > score) { score = v - u * 0.6; best = [u, v] }
    }
    this.farm = { group: g, u: lerp(best[0], cu, 0.16), v: lerp(best[1], cv, 0.16) }
    g.visible = false
    this.group!.add(g)
  }

  private buildShadowCatcher() {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const ctx = c.getContext('2d')!
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 128)
    grad.addColorStop(0, 'rgba(6,9,5,0.55)')
    grad.addColorStop(0.55, 'rgba(6,9,5,0.22)')
    grad.addColorStop(1, 'rgba(6,9,5,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 256)
    const t = new THREE.CanvasTexture(c)
    this.textures.push(t)
    this.catcher = new THREE.Mesh(new THREE.PlaneGeometry(this.frame.S * 2.1, this.frame.S * 2.1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0 }))
    this.catcher.rotation.x = -Math.PI / 2
    this.group!.add(this.catcher)
  }

  /** Terrain points the cards point to: the lowest (water), the highest (risk) and the centre. */
  private computeAnchors() {
    let lo = { h: Infinity, u: -1, v: -1 }, hi = { h: -Infinity, u: -1, v: -1 }
    for (let j = 2; j < 120; j++) {
      for (let i = 2; i < 120; i++) {
        const u = i / 122, v = j / 122
        if (!this.inside(u, v)) continue
        const h = this.heightAt(u, v, 1)
        if (h < lo.h) lo = { h, u, v }
        if (h > hi.h) hi = { h, u, v }
      }
    }
    const center = this.centerUV
    this.anchorsUV = {
      water: lo.u >= 0 ? [lo.u, lo.v] : center,
      risk: hi.u >= 0 ? [hi.u, hi.v] : center,
      market: center,
      center,
    }
  }

  // -------------------------------------------------------- "rise" animation
  setRise(rise: number, wall = rise) {
    if (!this.terrain) return
    if (rise === this.rise && wall === this.wall && !this.dirtyRise) return
    this.wall = wall
    this.dirtyRise = false
    const E = this.state.exaggeration
    const attr = this.terrain.geometry.attributes.position as THREE.BufferAttribute
    const pos = attr.array as Float32Array
    // Normals computed once with the full relief: during the rise the light is still
    // turning on and it goes unnoticed, and ~5 ms of CPU per frame are saved.
    if (this.normalsE !== E) {
      for (let k = 0; k < this.base.length; k++) pos[k * 3 + 1] = this.base[k] * E
      this.terrain.geometry.computeVertexNormals()
      this.normalsE = E
    }
    for (let k = 0; k < this.base.length; k++) pos[k * 3 + 1] = this.base[k] * E * rise
    attr.needsUpdate = true
    this.rise = rise
    const wattr = this.walls.geometry.attributes.position as THREE.BufferAttribute
    const wp = wattr.array as Float32Array
    const bottom = -this.depth * wall
    for (const t of this.wallTop) {
      wp[t.v * 3 + 1] = this.heightAt(t.u, t.vv, rise)
      wp[(t.v + 1) * 3 + 1] = bottom
    }
    wattr.needsUpdate = true
    this.walls.visible = wall > 0.002
    this.cap.position.y = bottom - 0.2
    this.cap.visible = this.walls.visible
    this.catcher.position.y = bottom - this.frame.S * 0.16
    const lift = this.frame.S * 0.0015
    for (const b of this.boundary) {
      for (const line of [b.glow, b.core]) {
        const data = (line.geometry.attributes.instanceStart as THREE.InterleavedBufferAttribute).data
        const arr = data.array as Float32Array
        for (let i = 0; i < b.segs; i++) {
          arr[i * 6 + 1] = this.heightAt(b.pts[i][0], b.pts[i][1], rise) + lift
          arr[i * 6 + 4] = this.heightAt(b.pts[i + 1][0], b.pts[i + 1][1], rise) + lift
        }
        data.needsUpdate = true
      }
    }
    const [x, z] = this.frame.world(this.farm.u, this.farm.v)
    this.farm.group.position.set(x, this.heightAt(this.farm.u, this.farm.v), z)
  }
  private setTrace(p: number) {
    for (const b of this.boundary) {
      const n = Math.max(0, Math.floor(b.segs * p))
      b.core.geometry.instanceCount = n
      b.glow.geometry.instanceCount = n
      b.core.visible = b.glow.visible = n > 0
    }
  }
  private setCurtain(p: number) {
    const H = (this.frame.S * 0.034 * this.state.exaggeration) / 2
    for (const b of this.boundary) {
      const attr = b.curtain.geometry.attributes.position as THREE.BufferAttribute
      const arr = attr.array as Float32Array
      b.pts.forEach(([u, v], i) => {
        const [x, z] = this.frame.world(u, v)
        const y = this.heightAt(u, v)
        arr.set([x, y, z, x, y + H * p, z], i * 6)
      })
      attr.needsUpdate = true
      b.curtain.material.uniforms.uOpacity.value = 0.42 * Math.min(1, p * 1.4)
      b.curtain.visible = p > 0.001
    }
  }
  private setTrees(p: number) {
    const { mesh, list, rad } = this.trees
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3()
    list.forEach((t, i) => {
      const k = backOut(clamp01((p * 1.25 - t.delay) / 0.35))
      const sc = rad * t.s * Math.max(0.0001, k)
      const [x, z] = this.frame.world(t.u, t.v)
      v.set(x, this.heightAt(t.u, t.v) + sc * 0.7, z)
      s.set(sc, sc, sc)
      mesh.setMatrixAt(i, m.compose(v, q, s))
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.visible = p > 0.001
  }

  // -------------------------------------------------------- crops by year
  private drawCrops(canvas: HTMLCanvasElement, year: number) {
    const ctx = canvas.getContext('2d')!, size = canvas.width, { frame } = this, e = this.escena!
    ctx.clearRect(0, 0, size, size)
    const histIdx = Math.min(5, Math.max(0, year - 2020))
    for (const f of e.neighbors) {
      const color = f.cover === 'cultivo' || !f.cover ? CROPS[yearLetter(f.rot, histIdx)]?.color : COVER_COLORS[f.cover]
      if (!color) continue
      ctx.fillStyle = color
      ctx.beginPath()
      drawRings(ctx, frame, f.geometry, size)
      ctx.fill('evenodd')
    }
    ctx.fillStyle = CROPS[cropForYear(e, year, this.state.rotation).key]?.color ?? '#A3835F'
    ctx.beginPath()
    drawRings(ctx, frame, e.geometry, size)
    ctx.fill('evenodd')
  }
  private paint(year: number, immediate: boolean) {
    const back = 1 - this.front
    this.drawCrops(this.cropCanvases[back], year)
    this.cropTex[back].needsUpdate = true
    if (immediate) {
      this.drawCrops(this.cropCanvases[this.front], year)
      this.cropTex[this.front].needsUpdate = true
      this.uniforms.uSweep.value = 0
      return Promise.resolve()
    }
    this.uniforms.tCropA.value = this.cropTex[this.front]
    this.uniforms.tCropB.value = this.cropTex[back]
    const a = Math.random() * Math.PI * 2
    ;(this.uniforms.uSweepDir.value as THREE.Vector2).set(Math.cos(a), Math.sin(a))
    return this.tween(1150, (t) => (this.uniforms.uSweep.value = easeInOut(t))).then(() => {
      this.front = back
      this.uniforms.tCropA.value = this.cropTex[back]
      this.uniforms.uSweep.value = 0
    })
  }
  setYear(year: number) {
    if (!this.terrain || year === this.state.year) return Promise.resolve()
    this.state.year = year
    this.emit()
    return this.paint(year, false)
  }
  setRotation(rotation: RotationKey) {
    this.state.rotation = rotation
    this.emit()
    return this.state.year >= FIRST_SCENARIO_YEAR && this.terrain ? this.paint(this.state.year, false) : Promise.resolve()
  }
  private playToken = 0
  /** Runs through the campaigns up to 2031 (from 2020 if already at the end); onEnd when it finishes uninterrupted. */
  async play(from: number | undefined, onEnd: () => void) {
    const token = ++this.playToken
    let y = from ?? (this.state.year >= LAST_YEAR ? 2020 : this.state.year + 1)
    while (this.playToken === token && y <= LAST_YEAR) {
      await this.setYear(y)
      await new Promise((r) => setTimeout(r, 520 / this.speed))
      y++
    }
    if (this.playToken === token) onEnd()
  }
  stopPlay() {
    this.playToken++
  }
  /** Connects the card layer: receives the anchors every frame and on entry. Returns the disconnect function. */
  attachOverlay(o: { onFrame: (a: Anchors) => void; onCardsIn: (a: Anchors) => void; label: string }) {
    this.opts.onFrame = o.onFrame
    this.opts.onCardsIn = o.onCardsIn
    this.pin.dataset.label = o.label
    return () => {
      this.opts.onFrame = undefined
      this.opts.onCardsIn = undefined
      this.leaders.innerHTML = ''
      this.stopPlay()
    }
  }
  setProfile(profile: ProfileKey) {
    this.state.profile = profile
    this.emit()
  }
  setMode(mode: Mode) {
    const target = mode === 'maqueta' ? 1 : 0
    this.state.mode = mode
    this.emit()
    if (!this.terrain) {
      this.uniforms.uMode.value = target
      return Promise.resolve()
    }
    const from = this.uniforms.uMode.value as number
    return this.tween(700, (t) => {
      const s = lerp(from, target, easeInOut(t))
      this.uniforms.uMode.value = s
      this.farm.group.scale.setScalar(Math.max(0.001, s))
      this.farm.group.visible = s > 0.01
    })
  }
  async setExaggeration(e: number) {
    this.preferredExaggeration = e
    const from = this.state.exaggeration
    await this.tween(500, (t) => {
      this.state.exaggeration = lerp(from, e, easeInOut(t))
      this.dirtyRise = true
      this.setRise(1)
      this.setCurtain(1)
      this.setTrees(1)
    })
    this.emit()
  }
  private emit() {
    this.opts.onChange?.({ ...this.state })
  }

  // -------------------------------------------------------- camera
  resize() {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight
    this.width = w
    this.height = h
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.applyViewOffset()
    for (const b of this.boundary) {
      b.core.material.resolution.set(w, h)
      b.glow.material.resolution.set(w, h)
    }
    this.leaders.setAttribute('viewBox', `0 0 ${w} ${h}`)
    this.lastBusy = performance.now()
    this.kick()
  }
  private applyViewOffset() {
    const { width: w, height: h } = this
    this.camera.setViewOffset(w, h, -this.viewOffset.x, -this.viewOffset.y, w, h)
    this.camera.updateProjectionMatrix()
  }
  /** Free space for the block according to the card layout. */
  private framePadding() {
    const w = this.width, h = this.height
    if (w < 760) return { top: 150, bottom: Math.min(330, h * 0.42), left: 10, right: 10 }
    return { top: 96, bottom: 168, left: w < 1100 ? 230 : 270, right: w < 1100 ? 230 : 270 }
  }
  /** Top-down camera that fits the tile into a screen rectangle (that of the farm on the map). */
  private topDownFor(rect: Rect): View {
    const fovR = THREE.MathUtils.degToRad(this.camera.fov)
    const H = (this.frame.Sz * this.height) / (2 * Math.tan(fovR / 2) * rect.h)
    return { radius: H, polar: 0.0001, azimuth: 0, ty: 0, offset: { x: rect.x + rect.w / 2 - this.width / 2, y: rect.y + rect.h / 2 - this.height / 2 } }
  }
  private isoView(): View {
    const pad = this.framePadding()
    const fovR = THREE.MathUtils.degToRad(this.camera.fov)
    const availH = this.height - pad.top - pad.bottom, availW = this.width - pad.left - pad.right
    const r = Math.hypot(this.frame.S * 0.8, (this.relief * this.state.exaggeration + this.depth) / 2)
    const dV = (r / Math.sin(fovR / 2)) * (this.height / Math.max(availH, 120))
    const fovH = 2 * Math.atan(Math.tan(fovR / 2) * this.camera.aspect)
    const dH = (r / Math.sin(fovH / 2)) * (this.width / Math.max(availW, 120))
    return {
      radius: Math.max(dV, dH) * 0.64, polar: 0.98, azimuth: -0.55,
      ty: this.relief * this.state.exaggeration * 0.35 - this.depth * 0.18,
      offset: { x: (pad.left - pad.right) / 2, y: (pad.top - pad.bottom) / 2 },
    }
  }
  private setCamera(v: View) {
    const t = new THREE.Vector3(0, v.ty, 0)
    this.camera.position.copy(t).add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(v.radius, v.polar, v.azimuth)))
    this.camera.up.set(0, 1, 0)
    this.camera.lookAt(t)
    this.controls.target.copy(t)
    this.viewOffset = { ...v.offset }
    this.applyViewOffset()
  }
  private lerpView(a: View, b: View, k: number): View {
    return {
      radius: Math.exp(lerp(Math.log(a.radius), Math.log(b.radius), k)), polar: lerp(a.polar, b.polar, k),
      azimuth: lerp(a.azimuth, b.azimuth, k), ty: lerp(a.ty, b.ty, k),
      offset: { x: lerp(a.offset.x, b.offset.x, k), y: lerp(a.offset.y, b.offset.y, k) },
    }
  }
  private currentView(): View {
    const sp = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target))
    return { radius: sp.radius, polar: sp.phi, azimuth: sp.theta, ty: this.controls.target.y, offset: { ...this.viewOffset } }
  }
  /** Avoids the long way round if the camera has turned more than half a turn. */
  private unwrap(from: View, to: View) {
    while (from.azimuth - to.azimuth > Math.PI) from.azimuth -= Math.PI * 2
    while (to.azimuth - from.azimuth > Math.PI) from.azimuth += Math.PI * 2
  }

  // -------------------------------------------------------- loop
  tween(ms: number, fn: (k: number) => void) {
    return new Promise<void>((resolve) => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      this.tweens.push({ start: performance.now(), ms: reduced ? 1 : ms / this.speed, fn, resolve })
      this.kick()
    })
  }
  private kick() {
    if (!this.raf && this.active) this.raf = requestAnimationFrame(this.loop)
  }
  private loop = (now: number) => {
    this.raf = 0
    if (!this.active) return
    this.uniforms.uTime.value = now / 1000
    for (const t of [...this.tweens]) {
      const k = clamp01((now - t.start) / t.ms)
      t.fn(k)
      if (k >= 1) {
        this.tweens.splice(this.tweens.indexOf(t), 1)
        t.resolve()
      }
    }
    const moving = this.controls.enabled && this.controls.update()
    this.renderer.render(this.scene, this.camera)
    const a = this.anchors()
    if (a) {
      this.pin.style.transform = `translate(${a.center.x}px, ${a.center.y}px)`
      this.opts.onFrame?.(a)
    }
    this.adapt(now)
    // It keeps painting only while something changes (animation or camera inertia), and
    // a couple of seconds more for the cloud shadows; at rest it uses no GPU.
    if (this.tweens.length || moving || this.dragging) this.lastBusy = now
    if (now - this.lastBusy < 2500) this.raf = requestAnimationFrame(this.loop)
  }
  /** If the first frames are slow, resolution and shadows drop once. */
  private adapt(now: number) {
    if (this.adapted) return
    const st = (this.perf ??= { n: 0, t0: now })
    st.n++
    if (st.n < 45) return
    this.adapted = true
    const ms = (now - st.t0) / 44
    if (ms <= 26) return
    this.renderer.setPixelRatio(1)
    this.sun.shadow.mapSize.set(1024, 1024)
    this.sun.shadow.map?.dispose()
    this.sun.shadow.map = null
    this.resize()
  }
  private project(u: number, v: number, yExtra = 0): Anchor {
    const [x, z] = this.frame.world(u, v)
    const p = new THREE.Vector3(x, this.heightAt(u, v) + yExtra, z).project(this.camera)
    return { x: (p.x * 0.5 + 0.5) * this.width, y: (-p.y * 0.5 + 0.5) * this.height, behind: p.z > 1 }
  }
  /** Screen positions of the anchors (used by the card panel). */
  anchors(): Anchors | null {
    if (!this.terrain) return null
    const a = this.anchorsUV
    // Soil: centre of the wall most facing the camera, at a third of the depth.
    const cam = this.camera.position
    const walls: [number, number, number, number][] = [[0.5, 1, 0, 1], [1, 0.5, 1, 0], [0.5, 0, 0, -1], [0, 0.5, -1, 0]]
    const best = walls.reduce((b, w) => (cam.x * w[2] + cam.z * w[3] > cam.x * b[2] + cam.z * b[3] ? w : b))
    const [x, z] = this.frame.world(best[0], best[1])
    const p = new THREE.Vector3(x, this.heightAt(best[0], best[1]) - this.depth * 0.32, z).project(this.camera)
    return {
      water: this.project(...a.water),
      risk: this.project(...a.risk),
      market: this.project(...a.market),
      center: this.project(a.center[0], a.center[1], this.frame.S * 0.05),
      soil: { x: (p.x * 0.5 + 0.5) * this.width, y: (-p.y * 0.5 + 0.5) * this.height },
    }
  }

  // -------------------------------------------------------- entry / exit
  /**
   * Enters the farm.
   * fromRect: screen rectangle the tile occupied on the map (top-down view).
   * snapshot: snapshot of the map in that rectangle; the 3D starts identical to the map.
   * traced:   the boundary was already drawn on the map; it is not traced again.
   */
  async enter(o: { fromRect?: Rect; snapshot?: HTMLCanvasElement | null; traced?: boolean; duration?: number } = {}) {
    if (!this.terrain) return
    this.active = true
    this.container.classList.add('active')
    this.resize()
    const from = this.topDownFor(o.fromRect ?? this.defaultRect())
    const to = this.isoView()
    this.controls.enabled = false
    this.setRise(0)
    this.setTrace(o.traced ? 1 : 0)
    this.setCurtain(0)
    this.setTrees(0)
    this.uniforms.uLit.value = 0
    this.uniforms.uFocus.value = 0
    this.snapTex?.dispose()
    this.snapTex = o.snapshot ? new THREE.CanvasTexture(o.snapshot) : null
    if (this.snapTex) this.snapTex.colorSpace = THREE.SRGBColorSpace
    this.uniforms.tSnap.value = this.snapTex ?? this.blank
    this.uniforms.uSnap.value = this.snapTex ? 1 : 0
    this.catcher.material.opacity = 0
    const maqueta = this.state.mode === 'maqueta'
    this.uniforms.uMode.value = maqueta ? 1 : 0
    this.farm.group.visible = maqueta
    this.farm.group.scale.setScalar(maqueta ? 1 : 0.001)
    this.setCamera(from)
    this.container.classList.remove('cards-in')
    this.bg.style.opacity = o.fromRect ? '0' : '1'
    this.kick()
    await this.tween(o.duration ?? 3200, (p) => {
      if (o.fromRect) this.bg.style.opacity = String(range(p, 0.02, 0.3))
      this.uniforms.uFocus.value = easeInOut(range(p, 0, 0.3))
      if (this.snapTex) this.uniforms.uSnap.value = 1 - easeInOut(range(p, 0.1, 0.45))
      this.setRise(easeInOut(range(p, 0.1, 0.62)), easeInOut(range(p, 0.12, 0.58)))
      this.uniforms.uLit.value = easeInOut(range(p, 0.14, 0.55))
      this.setCamera(this.lerpView(from, to, easeInOut(range(p, 0.04, 0.84))))
      if (!o.traced) this.setTrace(easeInOut(range(p, 0.4, 0.8)))
      this.setCurtain(easeOut(range(p, 0.5, 0.86)))
      this.setTrees(range(p, 0.5, 0.95))
      this.catcher.material.opacity = range(p, 0.3, 0.7)
      if (p > 0.78 && !this.container.classList.contains('cards-in')) {
        const a = this.anchors()
        if (a) this.opts.onCardsIn?.(a)
        this.container.classList.add('cards-in')
      }
    })
    this.controls.enabled = true
    this.emit()
  }
  /** Returns to the flat top-down view (to hand control back to the map). */
  async exit(o: { toRect?: Rect; duration?: number } = {}) {
    if (!this.terrain) return
    const from = this.currentView()
    const to = this.topDownFor(o.toRect ?? this.defaultRect())
    this.unwrap(from, to)
    this.controls.enabled = false
    this.container.classList.remove('cards-in')
    await this.tween(o.duration ?? 2400, (p) => {
      const q = 1 - p
      this.setCamera(this.lerpView(from, to, easeInOut(range(p, 0.08, 0.92))))
      this.setTrees(range(q, 0.55, 1))
      this.setCurtain(easeOut(range(q, 0.6, 1)))
      this.setTrace(range(q, 0.5, 0.9))
      this.setRise(easeInOut(range(q, 0.3, 0.9)), easeInOut(range(q, 0.35, 0.92)))
      this.uniforms.uLit.value = easeInOut(range(q, 0.4, 0.9))
      this.uniforms.uFocus.value = easeInOut(range(q, 0, 0.5))
      this.catcher.material.opacity = range(q, 0.4, 0.8)
      if (o.toRect) this.bg.style.opacity = String(range(q, 0, 0.45))
    })
  }
  hide() {
    this.active = false
    this.container.classList.remove('active', 'cards-in')
    cancelAnimationFrame(this.raf)
    this.raf = 0
  }
  private defaultRect(): Rect {
    const pad = this.framePadding()
    const side = Math.min(this.width - pad.left - pad.right, this.height - pad.top - pad.bottom) * 0.9
    return { x: pad.left + (this.width - pad.left - pad.right - side) / 2, y: pad.top + (this.height - pad.top - pad.bottom - side) / 2, w: side, h: side }
  }
  resetView() {
    const from = this.currentView(), to = this.isoView()
    this.unwrap(from, to)
    this.controls.enabled = false
    return this.tween(900, (p) => this.setCamera(this.lerpView(from, to, easeInOut(p)))).then(() => {
      this.controls.enabled = true
    })
  }

  private clear() {
    if (this.group) {
      this.scene.remove(this.group)
      this.group.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        if (m.material) ([] as THREE.Material[]).concat(m.material).forEach((x) => x.dispose())
      })
    }
    this.textures.forEach((t) => t.dispose())
    this.textures = []
    this.boundary = []
    this.group = null
    this.terrain = null
  }
  dispose() {
    this.hide()
    this.clear()
    this.ro.disconnect()
    this.controls.dispose()
    this.renderer.dispose()
  }
}
