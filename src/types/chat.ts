// types/chat.ts
// Shared data shapes used across hooks and components.

export type MessageRole = 'user' | 'assistant'

export interface Message {
  id:          string
  role:        MessageRole
  content:     string
  isStreaming?: boolean
}

export interface OllamaModel {
  name:        string
  size:        number
  modified_at: string
}

// Neuron canvas animation state
export type NeuronAnimState = 'idle' | 'processing' | 'classified' | 'waiting'

// App phase -- controls which UI layer is visible
//   welcome     -- idle screen, neuron sphere showing, pill visible
//   classifying -- user sent first message, qwen running, pill hidden
//   revealing   -- classification done, neuron reveal playing
//   chatting    -- neuron sphere gone, chat messages visible
export type AppPhase = 'welcome' | 'classifying' | 'revealing' | 'chatting'