// components/chat/ChatWindow.tsx
// Scrollable message list.
//
// Scroll strategy: a zero-height sentinel div sits after the last message.
// scrollTop = scrollHeight is set on every content change -- simpler and
// cheaper than scrollIntoView which can trigger layout recalculations.

import { useEffect, useRef }  from 'react'
import type { Message }        from '@/types/chat'
import MessageBubble           from './MessageBubble'

interface Props { messages: Message[] }

export default function ChatWindow({ messages }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lastContent  = messages[messages.length - 1]?.content

  // Scroll to bottom on new message or new token
  useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, lastContent])

  return (
    <div className="chat-window" ref={containerRef}>
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {/* Sentinel -- scroll target */}
      <div className="chat-window__sentinel" aria-hidden />
    </div>
  )
}