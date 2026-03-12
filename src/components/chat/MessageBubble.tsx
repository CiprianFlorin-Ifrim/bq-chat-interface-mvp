// components/chat/MessageBubble.tsx
// Single chat message. Memoized so only the actively-streaming message
// re-renders during token delivery.
//
// Uses Streamdown for assistant output -- handles incomplete markdown
// gracefully during streaming with no layout shifts.

import { memo }           from 'react'
import { Streamdown }     from 'streamdown'
import 'streamdown/styles.css'
import type { Message }   from '@/types/chat'
import { cn }             from '@/lib/utils'
import ThinkingIndicator  from './ThinkingIndicator'

interface Props { message: Message }

const MessageBubble = memo(function MessageBubble({ message }: Props) {
  const { role, content, isStreaming } = message
  const isUser = role === 'user'

  return (
    <div className={cn('message', isUser ? 'message--user' : 'message--assistant')}>
      <div
        className={cn(
          'message__content',
          isUser ? 'message__content--user' : 'message__content--assistant'
        )}
      >
        {isUser ? (
          <span>{content}</span>

        ) : content === '' && isStreaming ? (
          <ThinkingIndicator />

        ) : (
          // Streamdown handles incomplete markdown during streaming,
          // and isAnimating drives its built-in streaming caret.
          <Streamdown isAnimating={!!isStreaming}>
            {content}
          </Streamdown>
        )}
      </div>
    </div>
  )
})

export default MessageBubble