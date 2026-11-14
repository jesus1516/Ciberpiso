import { AboutModal } from './components/AboutModal'
import { Explorer } from './explorer/Explorer'

export default function App() {
  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <Explorer />
      <AboutModal />
    </div>
  )
}
