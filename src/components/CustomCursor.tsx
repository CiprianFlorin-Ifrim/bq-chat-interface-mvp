// components/CustomCursor.tsx
// JS-driven white donut cursor running at native display refresh via rAF.
// Adds body.ccursor-active on mount to suppress all native cursors (see
// index.css). Removes it cleanly on unmount.
//
// States:
//   default     - plain white ring
//   interactive - ring breathes (CSS animation on #custom-cursor.interactive)
//   clicking    - ring shrinks (CSS class toggled on mousedown/mouseup)
//
// Position is tracked in a ref (not state) so rAF always reads the latest
// coordinates without triggering React renders.

import { useEffect, useRef } from 'react'

// CSS selector for elements that should trigger the interactive state
const INTERACTIVE_SEL = 'a, button, [role="button"], select, label, [data-interactive]'

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const posRef    = useRef({ x: -100, y: -100 })
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    const el = cursorRef.current
    if (!el) return

    document.body.classList.add('ccursor-active')

    // -- Event handlers -------------------------------------------------------

    const onMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY }

      // Interactive state: check the element directly under the pointer
      const target = document.elementFromPoint(e.clientX, e.clientY)
      if (target?.closest(INTERACTIVE_SEL)) {
        el.classList.add('interactive')
      } else {
        el.classList.remove('interactive')
      }
    }

    const onDown  = () => el.classList.add('clicking')
    const onUp    = () => el.classList.remove('clicking')
    const onEnter = () => { el.style.opacity = '1' }
    const onLeave = () => { el.style.opacity = '0' }

    document.addEventListener('mousemove',  onMove)
    document.addEventListener('mousedown',  onDown)
    document.addEventListener('mouseup',    onUp)
    document.addEventListener('mouseenter', onEnter)
    document.addEventListener('mouseleave', onLeave)

    // -- rAF loop: apply latest position without setState ---------------------
    const tick = () => {
      el.style.transform =
        `translate3d(${posRef.current.x - 12}px, ${posRef.current.y - 12}px, 0)`
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    // -- Cleanup --------------------------------------------------------------
    return () => {
      cancelAnimationFrame(rafRef.current)
      document.removeEventListener('mousemove',  onMove)
      document.removeEventListener('mousedown',  onDown)
      document.removeEventListener('mouseup',    onUp)
      document.removeEventListener('mouseenter', onEnter)
      document.removeEventListener('mouseleave', onLeave)
      document.body.classList.remove('ccursor-active')
    }
  }, [])

  return (
    <div id="custom-cursor" ref={cursorRef} aria-hidden>
      <div className="cursor-donut" />
    </div>
  )
}