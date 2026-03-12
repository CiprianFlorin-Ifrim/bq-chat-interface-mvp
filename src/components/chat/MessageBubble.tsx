// components/chat/MessageBubble.tsx
// Single chat message. Memoized so only the actively-streaming message
// re-renders during token delivery; all settled messages stay frozen.
//
// Rendering matrix:
//   user + any content        -> surface-coloured pill, plain text
//   assistant + empty + streaming -> ThinkingIndicator (dots)
//   assistant + content + streaming -> rendered markdown + blinking caret
//   assistant + content + done     -> rendered markdown, no caret

import { memo }                  from 'react'
import type { Message }          from '@/types/chat'
import { renderMarkdown }        from '@/lib/markdown'
import { cn }                    from '@/lib/utils'
import ThinkingIndicator         from './ThinkingIndicator'

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
          // User: plain pre-wrap text inside the pill
          <span>{content}</span>

        ) : content === '' && isStreaming ? (
          // Assistant: waiting for first token
          <ThinkingIndicator />

        ) : (
          // Assistant: streamed / complete markdown
          <>
            <span
              className="message__markdown"
              // renderMarkdown output is sanitised (no user HTML injected)
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
            {isStreaming && <span className="message__cursor" aria-hidden />}
          </>
        )}
      </div>
    </div>
  )
})

export default MessageBubble