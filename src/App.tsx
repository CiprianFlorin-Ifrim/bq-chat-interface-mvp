// App.tsx
// Root component. Derives all layout state from useChat phase.
//
// Phase -> UI mapping:
//   welcome     -- neuron sphere centred, input pill visible
//   classifying -- neuron sphere scrambling fast, input pill hidden
//   revealing   -- neuron sphere lighting up, input pill hidden
//   chatting    -- neuron sphere hidden, chat window + input visible

import { useCallback }     from 'react'
import { cn }              from '@/lib/utils'
import { useChat }         from '@/hooks/useChat'
import { FEATURES }        from '@/config'
import CustomCursor        from '@/components/CustomCursor'
import WelcomeScreen       from '@/components/chat/WelcomeScreen'
import ChatWindow          from '@/components/chat/ChatWindow'
import InputBar            from '@/components/chat/InputBar'
import NeuronSphere        from '@/components/NeuronSphere'

export default function App() {
  const { state, sendMessage } = useChat()

  const { phase, neuronState, activeDomains, messages, isThinking } = state

  const chatActive    = phase === 'chatting'
  const hasHistory    = messages.length > 0
  const isPillFading  = phase === 'classifying' || phase === 'revealing'
  const showPill      = phase === 'welcome' || chatActive || isPillFading
  const sphereHidden  = chatActive
  const chatFaded     = isPillFading && hasHistory
  const layoutActive  = chatActive || (isPillFading && hasHistory)

  const handleSend = useCallback((text: string) => {
    sendMessage(text)
  }, [sendMessage])

  return (
    <>
      <CustomCursor />

      {FEATURES.WELCOME_SCREEN && (
        <WelcomeScreen visible={phase === 'welcome'} />
      )}

      {/* Neuron sphere -- fixed overlay, always mounted for smooth transitions */}
      <NeuronSphere
        hidden={sphereHidden}
        expanding={isPillFading}
        animState={neuronState}
        activeDomains={activeDomains}
      />

      <div className={cn('layout', layoutActive && 'layout--active')}>

        <header className="app-header">
          <img src="/logo_charcoal.png" alt="Logo" className="app-header__logo" />
        </header>

        {(chatActive || chatFaded) && (
          <ChatWindow messages={messages} faded={chatFaded} />
        )}

        {showPill && (
          <div className={cn(
            'input-wrapper',
            chatActive && 'input-wrapper--active',
            isPillFading && 'input-wrapper--fading'
          )}>
            <InputBar
              isThinking={isThinking}
              onSend={handleSend}
            />
          </div>
        )}

      </div>
    </>
  )
}