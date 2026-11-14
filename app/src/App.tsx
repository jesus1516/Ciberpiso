import { useEffect } from 'react'
import { AboutModal } from './components/AboutModal'
import { Dashboard } from './components/Dashboard'
import { Disclaimer } from './components/Disclaimer'
import { Header } from './components/Header'
import { MapScreen } from './components/MapScreen'
import { MapView } from './components/MapView'
import { useStore } from './store'

export default function App() {
  const step = useStore((s) => s.step)
  useEffect(() => {
    useStore.getState().loadIndicators()
  }, [])
  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <MapView />
      <Header />
      {step === 'map' ? <MapScreen /> : <Dashboard />}
      <Disclaimer />
      <AboutModal />
    </div>
  )
}
