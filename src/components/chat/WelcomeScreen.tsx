// components/chat/WelcomeScreen.tsx
// Centred welcome text that floats above the input bar (z-index 700).
// pointer-events: none -- the input below is always reachable.
//
// Animation sequence:
//   mount      - text invisible + shifted down 18px
//   +500ms     - text slides up and fades in over 1.4s
//   visible=false - container fades to opacity 0 over 0.5s

import { useEffect, useState } from 'react'
import { cn }                  from '@/lib/utils'

interface Props { visible: boolean }

export default function WelcomeScreen({ visible }: Props) {
  const [textShow, setTextShow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setTextShow(true), 500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className={cn('welcome-container', !visible && 'welcome-container--hidden')}
      aria-hidden={!visible}
    >
      <p className={cn('welcome-text', textShow && 'welcome-text--show')}>
        What can I help you with?
      </p>
    </div>
  )
}