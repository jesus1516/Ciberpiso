import { t } from '../i18n'
import { FarmPicker } from './FarmPicker'
import { SearchBox } from './SearchBox'

export function MapScreen() {
  return (
    <div className="absolute left-3 right-3 top-16 z-10 flex max-w-md flex-col gap-2 sm:left-4">
      <p className="rounded-xl bg-black/60 px-3 py-2 text-sm text-white shadow-lg ring-1 ring-white/15 backdrop-blur-md">{t.map.intro}</p>
      <SearchBox />
      <FarmPicker />
    </div>
  )
}
