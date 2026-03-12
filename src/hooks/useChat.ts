// hooks/useChat.ts
// Central chat state manager.
//
// State shape:
//   messages[]      - full conversation history
//   isThinking      - true while a response is in-flight
//   selectedModel   - active Ollama model name
//   availableModels - names returned by /api/tags on mount
//
// Streaming flow:
//   1. User message appended immediately
//   2. Empty assistant placeholder (isStreaming=true) appended
//   3. Tokens from Ollama appended to placeholder in setState callbacks
//   4. On stream end: isStreaming=false, isThinking=false
//   5. On abort: silent cleanup (user navigated / sent new message)
//
// A stateRef mirrors the current state so sendMessage (useCallback with
// empty deps) always reads fresh values without stale-closure bugs.

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Message }                              from '@/types/chat'
import { fetchModels, streamChat }                   from '@/lib/api'

const uid = (): string => Math.random().toString(36).slice(2, 10)

interface ChatState {
  messages:        Message[]
  isThinking:      boolean
  selectedModel:   string
  availableModels: string[]
}

const INITIAL: ChatState = {
  messages:        [],
  isThinking:      false,
  selectedModel:   '',
  availableModels: [],
}

export function useChat() {
  const [state, setState] = useState<ChatState>(INITIAL)
  const stateRef          = useRef(state)
  const abortRef          = useRef<AbortController | null>(null)

  // Keep stateRef in sync on every render so sendMessage reads latest state
  stateRef.current = state

  // Fetch available models once on mount
  useEffect(() => {
    fetchModels()
      .then(models => {
        const names = models.map(m => m.name)
        setState(s => ({
          ...s,
          availableModels: names,
          selectedModel:   names[0] ?? '',
        }))
      })
      .catch(() => {
        // Ollama unreachable -- the user will see an error on first send
      })
  }, [])

  // ------------------------------------------------------------------
  // setModel -- exposed so InputBar can update the selector
  // ------------------------------------------------------------------
  const setModel = useCallback((model: string) => {
    setState(s => ({ ...s, selectedModel: model }))
  }, [])

  // ------------------------------------------------------------------
  // sendMessage
  // ------------------------------------------------------------------
  const sendMessage = useCallback(async (content: string) => {
    const { isThinking, selectedModel, messages } = stateRef.current
    if (!content.trim() || isThinking || !selectedModel) return

    // Cancel any previous in-flight request
    abortRef.current?.abort()
    const controller  = new AbortController()
    abortRef.current  = controller

    const userMsg: Message = { id: uid(), role: 'user', content }
    const asstId           = uid()
    const asstPlaceholder: Message = {
      id:          asstId,
      role:        'assistant',
      content:     '',
      isStreaming: true,
    }

    // Snapshot history for the API call before mutating state
    const history = [...messages, userMsg]

    setState(s => ({
      ...s,
      isThinking: true,
      messages:   [...s.messages, userMsg, asstPlaceholder],
    }))

    try {
      await streamChat(
        selectedModel,
        history,
        (token) => {
          setState(s => ({
            ...s,
            messages: s.messages.map(m =>
              m.id === asstId ? { ...m, content: m.content + token } : m
            ),
          }))
        },
        controller.signal
      )
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return

      const errText = err instanceof Error ? err.message : String(err)
      setState(s => ({
        ...s,
        messages: s.messages.map(m =>
          m.id === asstId
            ? { ...m, content: `Error: ${errText}`, isStreaming: false }
            : m
        ),
      }))
    } finally {
      setState(s => ({
        ...s,
        isThinking: false,
        messages:   s.messages.map(m =>
          m.id === asstId ? { ...m, isStreaming: false } : m
        ),
      }))
    }
  }, []) // empty deps -- reads state via stateRef

  return { state, sendMessage, setModel }
}