// hooks/useAutoResize.ts
// Textarea auto-height hook.
// Shrinks to content height on every input event, capped at MAX_PX.
// Call reset() after clearing the value to return to minimum height.

import { useCallback, type RefObject } from 'react'

const MAX_PX = 220

export function useAutoResize(ref: RefObject<HTMLTextAreaElement>) {
  const resize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_PX)}px`
  }, [ref])

  const reset = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
  }, [ref])

  return { resize, reset }
}