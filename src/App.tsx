// App.tsx
// Root component. Owns the single piece of layout state: chatActive.
//
// When chatActive is false (initial):
//   - WelcomeScreen is opaque and centred
//   - Input is centred vertically via .layout (flexbox center)
//   - ChatWindow is not mounted
//
// When chatActive is true (after first send):
//   - .layout--active switches flexbox to column from top
//   - .input-wrapper--active shifts input to the bottom
//   - ChatWindow mounts and fills available space
//   - WelcomeScreen fades to opacity 0 via .welcome-overlay--hidden

import { useState, useCallback }  from 'react'
import { cn }                      from '@/lib/utils'
import { useChat }                 from '@/hooks/useChat'
import CustomCursor                from '@/components/CustomCursor'
import WelcomeScreen               from '@/components/chat/WelcomeScreen'
import ChatWindow                  from '@/components/chat/ChatWindow'
import InputBar                    from '@/components/chat/InputBar'

export default function App() {
  const [chatActive, setChatActive]    = useState(false)
  const { state, sendMessage, setModel } = useChat()

  const handleSend = useCallback((text: string) => {
    if (!chatActive) setChatActive(true)
    sendMessage(text)
  }, [chatActive, sendMessage])

  return (
    <>
      <CustomCursor />
      <WelcomeScreen visible={!chatActive} />

      <div className={cn('layout', chatActive && 'layout--active')}>

        {/* Top-left app name */}
        <header className="app-header">
          Chat
        </header>

        {/* Message history -- only mounted once the first message is sent */}
        {chatActive && (
          <ChatWindow messages={state.messages} />
        )}

        {/* Input -- centred in idle, pinned at bottom in active */}
        <div className={cn('input-wrapper', chatActive && 'input-wrapper--active')}>
          <InputBar
            isThinking={state.isThinking}
            selectedModel={state.selectedModel}
            availableModels={state.availableModels}
            onSend={handleSend}
            onModelChange={setModel}
          />
        </div>

      </div>
    </>
  )
}