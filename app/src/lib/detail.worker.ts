/**
 * Off-main-thread loader of the per-municipality detail files (T-05). A municipality file is up to
 * 1.5 MB gzip / 16 MB of JSON: decompressing and parsing it on the main thread blocked it for over a
 * second on a slow computer. The worker keeps the last few parsed municipalities and answers with
 * only the farms that were asked for, so the main thread never parses or receives the whole file.
 */
import type { FarmDetail } from './detail'

export type DetailRequest = { req: number; url: string; mun: number; farms: number[] }
export type DetailResponse = { req: number; ok: true; details: Record<number, FarmDetail> } | { req: number; ok: false; error: string }

const KEEP = 3
const cache = new Map<number, Promise<Record<string, FarmDetail>>>()

async function parse(res: Response) {
  if (!res.ok) throw new Error(`detail ${res.status}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b
  const stream = new Blob([bytes]).stream()
  return JSON.parse(await new Response(gzipped ? stream.pipeThrough(new DecompressionStream('gzip')) : stream).text()) as Record<string, FarmDetail>
}

function municipality(url: string, mun: number) {
  let p = cache.get(mun)
  if (p) {
    cache.delete(mun) // most recently used goes last
  } else {
    p = fetch(url).then(parse)
    p.catch(() => cache.delete(mun))
  }
  cache.set(mun, p)
  while (cache.size > KEEP) cache.delete(cache.keys().next().value!)
  return p
}

self.onmessage = async (e: MessageEvent<DetailRequest>) => {
  const { req, url, mun, farms } = e.data
  try {
    const data = await municipality(url, mun)
    const details: Record<number, FarmDetail> = {}
    for (const id of farms) if (data[id]) details[id] = data[id]
    self.postMessage({ req, ok: true, details } satisfies DetailResponse)
  } catch (err) {
    self.postMessage({ req, ok: false, error: String(err) } satisfies DetailResponse)
  }
}
