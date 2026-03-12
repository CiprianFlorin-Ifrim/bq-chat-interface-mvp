// components/chat/ChatWindow.tsx
// Scrollable message list.
//
// Scroll strategy: a zero-height sentinel div sits after the last message.
// scrollTop = scrollHeight is set on every content change -- simpler and
// cheaper than scrollIntoView which can trigger layout recalculations.

import { useEffect, useRef }  from 'react'
import type { Message }        from '@/types/chat'
import { cn }                  from '@/lib/utils'
import MessageBubble           from './MessageBubble'

interface Props { messages: Message[]; faded?: boolean }

export default function ChatWindow({ messages, faded }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lastContent  = messages[messages.length - 1]?.content

  // Scroll to bottom on new message or new token
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length, lastContent])

  return (
    <div className={cn('chat-window', faded && 'chat-window--faded')} ref={containerRef}>
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {/* Sentinel -- scroll target */}
      <div className="chat-window__sentinel" aria-hidden />
    </div>
  )
}