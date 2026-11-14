import { t } from '../i18n'
import { FincaPicker } from './FincaPicker'
import { SearchBox } from './SearchBox'

export function MapScreen() {
  return (
    <div className="absolute left-3 right-3 top-16 z-10 flex max-w-md flex-col gap-2 sm:left-4">
      <p className="rounded-lg bg-black/60 px-3 py-2 text-sm text-white">{t.map.intro}</p>
      <SearchBox />
      <FincaPicker />
    </div>
  )
}
