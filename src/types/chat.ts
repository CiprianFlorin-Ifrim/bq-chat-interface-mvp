// types/chat.ts
// Shared data shapes used across hooks and components.
// Kept minimal -- no runtime overhead.

export type MessageRole = 'user' | 'assistant'

export interface Message {
  id:          string
  role:        MessageRole
  content:     string
  isStreaming?: boolean        // true while tokens are still arriving
}

export interface OllamaModel {
  name:        string
  size:        number
  modified_at: string
}