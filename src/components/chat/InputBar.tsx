// components/chat/InputBar.tsx
// Composed input control: auto-resizing textarea, model selector, send button.
//
// Behaviour:
//   Enter        -> send (preventDefault to block newline)
//   Shift+Enter  -> newline (default browser behaviour)
//   Textarea     -> grows with content up to MAX_PX, then scrolls
//   Send button  -> disabled + low opacity while isThinking
//
// Uses ShadCN Button + Textarea for accessible, theme-consistent base;
// model picker uses a native <select> (lighter than the Radix one).

import { useRef, type KeyboardEvent }                    from 'react'
import { Button }                                         from '@/components/ui/button'
import { Textarea }                                       from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAutoResize }                                  from '@/hooks/useAutoResize'

interface Props {
  isThinking:      boolean
  selectedModel:   string
  availableModels: string[]
  onSend:          (text: string) => void
  onModelChange:   (model: string) => void
}

export default function InputBar({
  isThinking,
  selectedModel,
  availableModels,
  onSend,
  onModelChange,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { resize, reset } = useAutoResize(textareaRef)

  const handleSend = () => {
    const val = textareaRef.current?.value.trim() ?? ''
    if (!val || isThinking) return
    onSend(val)
    if (textareaRef.current) textareaRef.current.value = ''
    reset()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="input-bar">
      <Textarea
        ref={textareaRef}
        className="input-bar__textarea"
        placeholder="Ask anything..."
        rows={1}
        disabled={isThinking}
        onInput={resize}
        onKeyDown={handleKeyDown}
        aria-label="Chat input"
      />

      <div className="input-bar__controls">
        {/* Model picker -- native select for minimal bundle cost */}
        <Select
          value={selectedModel}
          onValueChange={onModelChange}
          disabled={isThinking}
        >
          <SelectTrigger className="input-bar__model-select" aria-label="Select model">
            <SelectValue placeholder="Loading models..." />
          </SelectTrigger>
          <SelectContent side="bottom" align="end">
            {availableModels.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Send button */}
        <Button
          className="input-bar__send"
          variant="ghost"
          size="icon"
          onClick={handleSend}
          disabled={isThinking}
          aria-label="Send message"
          data-interactive="true"
        >
          <SendIcon />
        </Button>
      </div>
    </div>
  )
}

// Inline SVG -- avoids pulling in lucide-react for a single icon
function SendIcon() {
  return (
    <svg
      width="15" height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 12L2 2l4 10-4 10 20-10z" />
    </svg>
  )
}