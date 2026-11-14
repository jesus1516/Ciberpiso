// Cloud layer for the scale transitions (Andalucía → Málaga and Málaga → municipality).
// A transparent WebGL canvas over the map: the camera flies through fBm cloud layers
// spread in depth. Halfway they cover the screen (the map swaps layers unnoticed)
// and then open up like a tunnel. It is only drawn while it lasts.
import * as THREE from 'three'

export type CloudVariant = 'clouds' | 'mist'

const VARIANTS: Record<CloudVariant, { coverage: number; ring: number; veil: number; opacity: number; duration: number }> = {
  // Andalucía → Málaga: full cloud bank, total whiteout halfway.
  clouds: { coverage: 0.64, ring: 0, veil: 0.96, opacity: 1, duration: 2900 },
  // Málaga → municipality: low mist that only passes along the edges, no whiteout.
  mist: { coverage: 0.8, ring: 1, veil: 0.2, opacity: 0.8, duration: 2100 },
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const bell = (t: number, c: number, w: number) => Math.exp(-(((t - c) / w) ** 2))

const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform float uT;
  uniform float uTime;
  uniform float uAspect;
  uniform float uOpacity;
  uniform float uVeil;
  uniform float uCoverage;
  uniform float uRing;
  uniform float uSeed;
  uniform vec3 uLight;
  uniform vec3 uShadow;
  uniform vec3 uWarm;
  uniform vec3 uVeilColor;
  varying vec2 vUv;

  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) {
vec2 i = floor(p), f = fract(p);
vec2 u = f * f * (3.0 - 2.0 * f);
return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);
  // 5-octave fBm that also returns the first 3 (reused for lighting).
  float fbm(vec2 p, out float coarse) {
float v = 0.0, a = 0.5;
for (int i = 0; i < 5; i++) {
  v += a * noise(p); p = ROT * p * 2.03 + vec2(1.7, 9.2); a *= 0.5;
  if (i == 2) coarse = v / 0.875;
}
return v;
  }
  // Short version for shading: fine detail does not change the light.
  float fbm3(vec2 p) {
float v = 0.0, a = 0.5;
for (int i = 0; i < 3; i++) { v += a * noise(p); p = ROT * p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
return v / 0.875;
  }

  void main() {
vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
float roll = sin(3.14159 * uT) * 0.05;
q = mat2(cos(roll), -sin(roll), sin(roll), cos(roll)) * q;
float r = length(q / vec2(max(uAspect, 1.0) * 0.5, 0.5));
float cam = 0.5 - 0.5 * cos(3.14159 * uT);
vec3 C = vec3(0.0);
float A = 0.0;
const int N = 8;
for (int i = N - 1; i >= 0; i--) {
  float fi = float(i) / float(N - 1);
  float z = 0.1 + 0.9 * fi;
  float d = z - cam;
  if (d < -0.03) continue;
  float w = smoothstep(-0.03, 0.06, d) * (1.0 - smoothstep(0.26, 0.48, d));
  if (w < 0.002) continue;
  float dd = max(d, 0.0) + 0.04;
  vec2 drift = vec2(uTime * 0.012 * (0.6 + fi), uTime * 0.004);
  vec2 p = q * dd * 7.5 + vec2(fi * 37.1 + uSeed, fi * 17.3 - uSeed) + drift;
  float coarse;
  float n = fbm(p, coarse);
  float bank = 1.0 - smoothstep(0.06, 0.2, abs(z - 0.52));
  float edgeOnly = smoothstep(0.25, 0.85, r);
  float mask = mix(mix(edgeOnly, 1.0, bank), edgeOnly, uRing);
  // After the bank: a fixed central gap in the layer which, as it gets closer, grows on screen
  // and opens the clouds towards the edges (tunnel effect).
  float after = smoothstep(0.58, 0.64, z) * (1.0 - uRing);
  float tunnel = smoothstep(0.02, 0.07, r * dd);
  mask = mix(mask, tunnel, after);
  float cov = uCoverage * mix(0.62, 1.0, max(bank, after * 0.9) * (1.0 - uRing));
  float a = smoothstep(1.0 - cov, 1.0 - cov + 0.24, n) * w * mask;
  if (a < 0.002) continue;
  // Light from the top left: if there is more cloud towards the sun, this point is in shadow.
  float n2 = fbm3(p + vec2(-0.05, 0.06));
  float shade = clamp(0.7 + (coarse - n2) * 5.5, 0.0, 1.0);
  shade *= 1.0 - 0.18 * smoothstep(0.55, 0.95, n);
  vec3 col = mix(uShadow, uLight, shade);
  col = mix(col, uWarm, 0.2 * shade * shade);
  C = C * (1.0 - a) + col * a;
  A = A * (1.0 - a) + a;
}
C *= uOpacity; A *= uOpacity;
vec3 veil = mix(uVeilColor * 1.02, uVeilColor * 0.94, smoothstep(0.2, 1.2, r));
C = C * (1.0 - uVeil) + veil * uVeil;
A = A * (1.0 - uVeil) + uVeil;
gl_FragColor = vec4(C / max(A, 1e-4), A);
  }`;

export type PlayOptions = {
  variant?: CloudVariant
  duration?: number
  /** true = go up (go back) */
  reverse?: boolean
  /** linear progress 0..1 of the time, every frame */
  onProgress?: (t: number) => void
  /** once, when the screen is covered */
  onCover?: () => void
  /** slow-motion multiplier (1 = normal) */
  speed?: number
  seed?: number
}

export class CloudLayer {
  private parent: HTMLElement
  private canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  private cfg = VARIANTS.clouds
  private running: { cancel: () => void } | null = null
  private uniforms = {
    uT: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 }, uOpacity: { value: 0 }, uVeil: { value: 0 },
    uCoverage: { value: 0.6 }, uRing: { value: 0 }, uSeed: { value: 0 },
    uLight: { value: new THREE.Color('#FFFCF6') },
    uShadow: { value: new THREE.Color('#A9B2B8') },
    uWarm: { value: new THREE.Color('#FFE3B8') },
    uVeilColor: { value: new THREE.Color('#F5F1EA') },
  }
  private onResize = () => this.resize()

  constructor(parent: HTMLElement, zIndex = 40) {
    this.parent = parent
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'cloud-layer'
    Object.assign(this.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: String(zIndex), display: 'none' })
    parent.appendChild(this.canvas)
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: false, premultipliedAlpha: false })
    this.renderer.setClearColor(0x000000, 0)
    // The clouds are soft: half resolution is enough and leaves the GPU free for the map.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * 0.5)
    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        fragmentShader: FRAGMENT,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    )
    this.quad.frustumCulled = false
    this.scene.add(this.quad)
    window.addEventListener('resize', this.onResize)
  }

  resize() {
    const w = this.parent.clientWidth || window.innerWidth
    const h = this.parent.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    this.uniforms.uAspect.value = w / h
  }

  setVariant(variant: CloudVariant, seed = Math.random() * 100) {
    this.cfg = VARIANTS[variant]
    this.uniforms.uCoverage.value = this.cfg.coverage
    this.uniforms.uRing.value = this.cfg.ring
    this.uniforms.uSeed.value = seed
  }

  /** Visual state for a progress p∈[0,1]. */
  render(p: number, time = performance.now() / 1000) {
    this.uniforms.uT.value = p
    this.uniforms.uTime.value = time
    this.uniforms.uOpacity.value = this.cfg.opacity * clamp01(p / 0.06) * clamp01((1 - p) / 0.08)
    this.uniforms.uVeil.value = this.cfg.veil * bell(p, 0.5, 0.06)
    this.renderer.render(this.scene, this.camera)
  }

  play(o: PlayOptions = {}): Promise<void> {
    const variant = o.variant ?? 'clouds'
    const duration = (o.duration ?? VARIANTS[variant].duration) / (o.speed || 1)
    this.running?.cancel()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      o.onProgress?.(1)
      o.onCover?.()
      return Promise.resolve()
    }
    this.resize()
    this.setVariant(variant, o.seed)
    this.canvas.style.display = 'block'
    return new Promise((resolve) => {
      const start = performance.now()
      let covered = false
      let frame = 0
      let cancelled = false
      const step = (now: number) => {
        if (cancelled) return
        const t = clamp01((now - start) / duration)
        this.render(o.reverse ? 1 - t : t)
        o.onProgress?.(t)
        if (!covered && t >= 0.5) {
          covered = true
          o.onCover?.()
        }
        if (t < 1) frame = requestAnimationFrame(step)
        else {
          this.running = null
          this.canvas.style.display = 'none'
          resolve()
        }
      }
      this.running = {
        cancel: () => {
          cancelled = true
          cancelAnimationFrame(frame)
          this.canvas.style.display = 'none'
          if (!covered) o.onCover?.()
          resolve()
        },
      }
      frame = requestAnimationFrame(step)
    })
  }

  dispose() {
    this.running?.cancel()
    window.removeEventListener('resize', this.onResize)
    this.quad.geometry.dispose()
    this.quad.material.dispose()
    this.renderer.dispose()
    this.canvas.remove()
  }
}
