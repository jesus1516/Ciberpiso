import { useState, type FormEvent } from 'react'
import { t } from '../i18n'
import { municipalityAt, provinceBbox } from '../lib/farms'
import { useStore } from '../store'

type Place = { place_id: number; display_name: string; lat: string; lon: string; boundingbox: [string, string, string, string] }

export function SearchBox() {
  const map = useStore((s) => s.map)
  const setMunicipality = useStore((s) => s.setMunicipality)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle')

  async function search(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setStatus('loading')
    try {
      const [w, s, e, n] = provinceBbox()
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=en&bounded=1&viewbox=${w},${n},${e},${s}&q=${encodeURIComponent(query)}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(String(res.status))
      const places: Place[] = await res.json()
      setResults(places)
      setStatus(places.length ? 'idle' : 'empty')
    } catch {
      setResults([])
      setStatus('error')
    }
  }

  function go(place: Place) {
    const [south, north, west, east] = place.boundingbox.map(Number)
    const m = municipalityAt(Number(place.lon), Number(place.lat))
    if (m) setMunicipality({ key: m.properties.mun, name: m.properties.nombre, bounds: [west, south, east, north] })
    else map?.fitBounds([[west, south], [east, north]], { maxZoom: 15, duration: 2000 })
    setResults([])
    setQuery(place.display_name.split(',')[0])
  }

  return (
    <div className="relative w-full">
      <form onSubmit={search} className="flex gap-2" role="search">
        <label htmlFor="place-search" className="sr-only">{t.map.searchPlaceholder}</label>
        <input
          id="place-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.map.searchPlaceholder}
          className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm shadow-sm focus:outline-2 focus:outline-brand"
        />
        <button className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#184f95] disabled:opacity-60" disabled={status === 'loading'}>
          {status === 'loading' ? t.map.searching : t.map.search}
        </button>
      </form>
      {(status === 'empty' || status === 'error') && (
        <p className="mt-1 rounded bg-white/95 px-2 py-1 text-xs text-ink-2" role="status">
          {status === 'empty' ? t.map.noResults : t.map.searchError}
        </p>
      )}
      {results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-white text-sm shadow-lg">
          {results.map((p) => (
            <li key={p.place_id}>
              <button onClick={() => go(p)} className="block w-full px-3 py-2 text-left hover:bg-neutral-100 focus:bg-neutral-100">
                {p.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
