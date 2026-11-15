/**
 * Off-main-thread loader of a municipality's farms (T-05). Antequera's file is 1.6 MB gzip / 9.8 MB
 * of GeoJSON with 14,529 farms; decompressing and parsing it on the main thread happened in the
 * middle of the entry transition. The worker parses it and hands back:
 *   - the decompressed text as a Blob, which MapLibre loads through a blob: URL in its own worker,
 *   - the properties of every farm, its bounding box and its geometry as a JSON string, so the main
 *     thread only parses the geometry of the farms it actually uses (the open farm, its neighbours).
 */
import type { FarmProps } from './geo'

export type FarmsRequest = { req: number; url: string }
export type FarmsResponse =
  | { req: number; ok: true; props: FarmProps[]; geoms: string[]; boxes: Float64Array; blob: Blob }
  | { req: number; ok: false; error: string }

type Geometry = { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] }

function box(g: Geometry, out: Float64Array, i: number) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  for (const poly of polys) for (const ring of poly) for (const [x, y] of ring) {
    if (x < w) w = x
    if (x > e) e = x
    if (y < s) s = y
    if (y > n) n = y
  }
  out.set([w, s, e, n], i * 4)
}

self.onmessage = async (e: MessageEvent<FarmsRequest>) => {
  const { req, url } = e.data
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`farms ${res.status}`)
    const bytes = new Uint8Array(await res.arrayBuffer())
    const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b
    const stream = new Blob([bytes]).stream()
    const text = await new Response(gzipped ? stream.pipeThrough(new DecompressionStream('gzip')) : stream).text()
    const features = (JSON.parse(text) as { features: { properties: FarmProps; geometry: Geometry }[] }).features
    const props: FarmProps[] = new Array(features.length)
    const geoms: string[] = new Array(features.length)
    const boxes = new Float64Array(features.length * 4)
    features.forEach((f, i) => {
      props[i] = f.properties
      geoms[i] = JSON.stringify(f.geometry)
      box(f.geometry, boxes, i)
    })
    const blob = new Blob([text], { type: 'application/geo+json' })
    self.postMessage({ req, ok: true, props, geoms, boxes, blob } satisfies FarmsResponse, { transfer: [boxes.buffer] })
  } catch (err) {
    self.postMessage({ req, ok: false, error: String(err) } satisfies FarmsResponse)
  }
}
