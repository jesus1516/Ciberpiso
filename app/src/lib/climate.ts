import type { Daily } from './power'

export type Monthly = {
  month: number
  temp: number
  tmin: number
  rain: number
  frostDays: number
  et0: number
  balance: number
}

export type Annual = { year: number; rain: number; temp: number; rainTrend: number; tempTrend: number }

export type Climate = {
  monthly: Monthly[]
  annual: Annual[]
  annualRain: number
  annualEt0: number
  meanTemp: number
  frostDaysYear: number
  rainStd: number
  rainCv: number
  rainTrendPerDecade: number
  tempTrendPerDecade: number
  firstDate: string
  lastDate: string
}

const valid = (v: number | null | undefined): v is number => typeof v === 'number' && v > -998

export function turcEt0(temp: number, radMJ: number, rh: number) {
  if (temp <= 0 || !valid(radMJ)) return 0
  const base = 0.013 * (temp / (temp + 15)) * (23.8846 * radMJ + 50)
  return rh < 50 ? base * (1 + (50 - rh) / 70) : base
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)

function linearFit(xs: number[], ys: number[]) {
  const mx = mean(xs)
  const my = mean(ys)
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0)
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0)
  const slope = den ? num / den : 0
  return { slope, at: (x: number) => my + slope * (x - mx) }
}

type Bucket = { year: number; month: number; days: number; rain: number; et0: number; frost: number; temp: number; tmin: number }

export function computeClimate(d: Daily): Climate {
  const buckets = new Map<string, Bucket>()
  d.dates.forEach((date, i) => {
    const t = d.t2m[i]
    const p = d.prec[i]
    if (!valid(t) || !valid(p)) return
    const year = Number(date.slice(0, 4))
    const month = Number(date.slice(4, 6)) - 1
    const key = `${year}-${month}`
    const b = buckets.get(key) ?? { year, month, days: 0, rain: 0, et0: 0, frost: 0, temp: 0, tmin: 0 }
    const tmin = valid(d.tmin[i]) ? d.tmin[i] : t
    b.days += 1
    b.rain += p
    b.et0 += turcEt0(t, d.rad[i], valid(d.rh[i]) ? d.rh[i] : 60)
    b.frost += tmin <= 0 ? 1 : 0
    b.temp += t
    b.tmin += tmin
    buckets.set(key, b)
  })

  const full = [...buckets.values()].filter((b) => b.days >= 25)

  const monthly: Monthly[] = Array.from({ length: 12 }, (_, month) => {
    const ms = full.filter((b) => b.month === month)
    const rain = mean(ms.map((b) => b.rain))
    const et0 = mean(ms.map((b) => b.et0))
    return {
      month,
      temp: mean(ms.map((b) => b.temp / b.days)),
      tmin: mean(ms.map((b) => b.tmin / b.days)),
      rain,
      frostDays: mean(ms.map((b) => b.frost)),
      et0,
      balance: rain - et0,
    }
  })

  const years = [...new Set(full.map((b) => b.year))].filter((y) => full.filter((b) => b.year === y).length === 12)
  const raw = years.map((year) => {
    const ms = full.filter((b) => b.year === year)
    return { year, rain: ms.reduce((s, b) => s + b.rain, 0), temp: mean(ms.map((b) => b.temp / b.days)) }
  })
  const rainFit = linearFit(raw.map((a) => a.year), raw.map((a) => a.rain))
  const tempFit = linearFit(raw.map((a) => a.year), raw.map((a) => a.temp))
  const annual = raw.map((a) => ({ ...a, rainTrend: rainFit.at(a.year), tempTrend: tempFit.at(a.year) }))

  const rains = raw.map((a) => a.rain)
  const rainMean = mean(rains)
  const rainStd = Math.sqrt(mean(rains.map((r) => (r - rainMean) ** 2)))
  const sum = (key: 'rain' | 'et0' | 'frostDays') => monthly.reduce((s, m) => s + m[key], 0)

  return {
    monthly,
    annual,
    annualRain: sum('rain'),
    annualEt0: sum('et0'),
    meanTemp: mean(monthly.map((m) => m.temp)),
    frostDaysYear: sum('frostDays'),
    rainStd,
    rainCv: rainMean ? rainStd / rainMean : 0,
    rainTrendPerDecade: rainFit.slope * 10,
    tempTrendPerDecade: tempFit.slope * 10,
    firstDate: d.dates[0],
    lastDate: d.dates.findLast((_, i) => valid(d.t2m[i])) ?? d.dates[d.dates.length - 1],
  }
}
