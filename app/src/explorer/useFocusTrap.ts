// Keeps keyboard focus inside a dialog or drawer while it is open and gives it back afterwards.
// On open: remembers the element that had focus and moves focus into the container (to `initial`
// or the first focusable element). Tab / Shift+Tab wrap around inside. Esc calls `onEscape`.
// On close (unmount): focus returns to the element that opened it.
import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

/** Visible, focusable elements inside a container, in DOM order. */
export function focusables(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
}

export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, onEscape: () => void, initial?: () => HTMLElement | null, returnTo?: () => HTMLElement | null) {
  const esc = useRef(onEscape)
  const first = useRef(initial)
  const back = useRef(returnTo)
  // The latest callbacks are kept without re-running the trap on every render.
  useEffect(() => {
    esc.current = onEscape
    first.current = initial
    back.current = returnTo
  })
  useEffect(() => {
    const root = ref.current
    if (!root) return
    // Safari does not focus a button when it is clicked, so the opener can be named explicitly.
    const opener = back.current?.() ?? (document.activeElement as HTMLElement | null)
    ;(first.current?.() ?? focusables(root)[0] ?? root).focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        esc.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables(root)
      if (!items.length) { e.preventDefault(); return }
      const a = document.activeElement as HTMLElement | null
      const i = a ? items.indexOf(a) : -1
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); items[items.length - 1].focus() }
      else if (!e.shiftKey && (i === items.length - 1 || i === -1)) { e.preventDefault(); items[0].focus() }
    }
    root.addEventListener('keydown', onKey)
    return () => {
      root.removeEventListener('keydown', onKey)
      // Back to the control that opened it (if it is still on the page).
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true })
    }
  }, [ref])
}
