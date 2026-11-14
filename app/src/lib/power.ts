export type Daily = {
  dates: string[]
  t2m: number[]
  tmin: number[]
  prec: number[]
  rad: number[]
  rh: number[]
}

export type PowerSource = 'live' | 'cache' | 'sample'
export type PowerResult = { daily: Daily; source: PowerSource; place?: string }

const PARAMS = 'T2M,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,RH2M'
const MAX_AGE_MS = 7 * 24 * 3600 * 1000

const ymd = (d: Date) => d.toISOString().slice(0, 10).replaceAll('-', '')

function yesterday() {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return ymd(d)
}

const cacheKey = (lat: number, lon: number) => `power:v1:${lat.toFixed(1)},${lon.toFixed(1)}`

function readCache(key: string): { savedAt: number; daily: Daily } | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCache(key: string, daily: Daily) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), daily }))
  } catch {
    /* storage full or blocked: skip caching */
  }
}

type PowerResponse = { properties: { parameter: Record<string, Record<string, number>> } }

function normalize(json: PowerResponse): Daily {
  const p = json.properties.parameter
  const dates = Object.keys(p.T2M).sort()
  const pick = (name: string) => dates.map((d) => p[name][d])
  return { dates, t2m: pick('T2M'), tmin: pick('T2M_MIN'), prec: pick('PRECTOTCORR'), rad: pick('ALLSKY_SFC_SW_DWN'), rh: pick('RH2M') }
}

export async function fetchPower(lat: number, lon: number): Promise<PowerResult> {
  const key = cacheKey(lat, lon)
  const cached = readCache(key)
  if (cached && Date.now() - cached.savedAt < MAX_AGE_MS) return { daily: cached.daily, source: 'cache' }

  try {
    const url =
      `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${PARAMS}&community=AG` +
      `&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}&start=20150101&end=${yesterday()}&format=JSON`
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
    if (!res.ok) throw new Error(`POWER ${res.status}`)
    const daily = normalize(await res.json())
    writeCache(key, daily)
    return { daily, source: 'live' }
  } catch {
    if (cached) return { daily: cached.daily, source: 'cache' }
    const sample = (await import('../data/sample-power.json')).default
    return { daily: sample, source: 'sample', place: sample.place }
  }
}
