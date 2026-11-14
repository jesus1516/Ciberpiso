import { t } from '../i18n'
import { areaHa } from '../lib/geo'
import { useStore, type Tab } from '../store'
import { ConditionsTab } from './ConditionsTab'
import { LayersTab } from './LayersTab'
import { PrioritiesTab } from './PrioritiesTab'
import { RotationsTab } from './RotationsTab'

const tabs: Tab[] = ['conditions', 'layers', 'priorities', 'rotations']

export function Dashboard() {
  const { field, panelOpen, tab, terrain, setTab, setPanelOpen, resetField } = useStore()
  const wide = tab === 'rotations'

  return (
    <>
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="absolute bottom-10 right-3 z-30 rounded-lg bg-white px-4 py-2 text-sm font-semibold shadow-lg focus:outline-2 focus:outline-brand lg:bottom-auto lg:top-3"
        >
          {t.dashboard.expand}
        </button>
      )}
      <aside
        aria-label={t.dashboard.title}
        aria-hidden={!panelOpen}
        inert={!panelOpen}
        className={`absolute inset-x-0 bottom-7 z-30 flex h-[55dvh] flex-col rounded-t-2xl bg-surface shadow-2xl transition-[transform,width] duration-500 ease-out
          lg:inset-x-auto lg:bottom-9 lg:right-3 lg:top-16 lg:h-auto lg:rounded-2xl
          ${wide ? 'lg:w-[min(1180px,calc(100vw-1.5rem))]' : 'lg:w-[460px]'}
          ${panelOpen ? 'translate-y-0 lg:translate-x-0' : 'translate-y-[110%] lg:translate-x-[110%] lg:translate-y-0'}`}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 pb-2 pt-3">
          <div className="flex-1">
            <h2 className="font-semibold">{t.dashboard.title}</h2>
            {field && <p className="text-xs text-muted">{t.map.area(areaHa(field))}</p>}
          </div>
          <button onClick={resetField} className="rounded-md px-2 py-1 text-sm text-brand hover:bg-neutral-100">{t.dashboard.newField}</button>
          <button onClick={() => setPanelOpen(false)} className="rounded-md px-2 py-1 text-sm text-ink-2 hover:bg-neutral-100" aria-label={t.dashboard.collapse}>
            ✕
          </button>
        </div>
        {terrain === 'flat' && <p className="bg-amber-50 px-4 py-1 text-xs text-amber-900" role="status">{t.map.flatFallback}</p>}
        <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line px-2">
          {tabs.map((id) => (
            <button
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls="tab-panel"
              onClick={() => setTab(id)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === id ? 'border-brand text-brand' : 'border-transparent text-ink-2 hover:text-ink'}`}
            >
              {t.dashboard.tabs[id]}
            </button>
          ))}
        </div>
        <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex-1 overflow-y-auto p-4 pb-14 lg:pb-4">
          {tab === 'conditions' && <ConditionsTab />}
          {tab === 'layers' && <LayersTab />}
          {tab === 'priorities' && <PrioritiesTab />}
          {tab === 'rotations' && <RotationsTab />}
        </div>
      </aside>
    </>
  )
}
