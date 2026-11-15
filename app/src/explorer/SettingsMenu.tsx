// Settings (text size, high contrast, reduced motion, 3D on/off). A button that opens a small
// non-modal dialog: focus moves into it, Esc closes it and returns focus to the button, and
// clicking elsewhere closes it. Everything is saved by settings.ts.
import { useEffect, useId, useRef, useState } from 'react'
import { TEXT_SIZES, resetSettings, updateSettings, useSettings } from './settings'
import { useFocusTrap } from './useFocusTrap'

function Panel({ onClose, opener }: { onClose: () => void; opener: React.RefObject<HTMLButtonElement | null> }) {
  const s = useSettings()
  const ref = useRef<HTMLDivElement>(null)
  const uid = useId()
  useFocusTrap(ref, onClose, () => ref.current?.querySelector<HTMLElement>('input:checked, input') ?? null, () => opener.current)
  return (
    <div ref={ref} className="settings-panel glass" role="dialog" aria-labelledby={`${uid}-t`} tabIndex={-1}>
      <div className="head">
        <h2 id={`${uid}-t`}>Settings</h2>
        <button type="button" className="x" onClick={onClose} aria-label="Close settings">✕</button>
      </div>
      <fieldset>
        <legend>Text size</legend>
        <div className="opts">
          {TEXT_SIZES.map((v) => (
            <label key={v}>
              <input type="radio" name={`${uid}-ts`} checked={s.textSize === v} onChange={() => updateSettings({ textSize: v })} />
              <span>{v} %</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="row">
        <input type="checkbox" checked={s.highContrast} onChange={(e) => updateSettings({ highContrast: e.target.checked })} />
        <span><b>High contrast</b><small>Black background, white text, stronger borders.</small></span>
      </label>
      <label className="row">
        <input type="checkbox" checked={s.reduceMotion} onChange={(e) => updateSettings({ reduceMotion: e.target.checked })} />
        <span><b>Reduce motion</b><small>No flights, clouds or fades. Also on when your device asks for it.</small></span>
      </label>
      <label className="row">
        <input type="checkbox" checked={!s.use3d} onChange={(e) => updateSettings({ use3d: !e.target.checked })} />
        <span><b>Turn off the 3D terrain</b><small>For slow devices: a flat map and a data table replace the 3D and the clouds. Applies from the next farm you open.</small></span>
      </label>
      <button type="button" className="reset" onClick={resetSettings}>Reset to defaults</button>
    </div>
  )
}

export function SettingsMenu({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  // Clicking outside closes the panel (without stealing the click).
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])
  return (
    <div ref={wrap} className={`settings ${className}`}>
      <button ref={btn} type="button" className="settings-btn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></svg>
        <span>Settings</span>
      </button>
      {open && <Panel onClose={() => setOpen(false)} opener={btn} />}
    </div>
  )
}
