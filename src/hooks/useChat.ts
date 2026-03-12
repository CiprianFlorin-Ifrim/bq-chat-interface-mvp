// hooks/useChat.ts
// Central chat state manager.
//
// First message flow:
//   1. User sends -> phase = 'classifying', neurons scramble fast
//   2. qwen classifies domains (awaited)
//   3. phase = 'revealing', neurons light up with edges and labels
//   4. Hold for REVEAL_HOLD_MS
//   5. phase = 'chatting', user bubble + assistant stream begin
//
// Subsequent messages follow normal streaming flow within 'chatting'.

import { useState, useCallback, useRef } from 'react'
import type { Message, NeuronAnimState, AppPhase } from '@/types/chat'
import { streamChat, generateFull, classifyDomains } from '@/lib/api'
import { CHAT_MODEL, CLASSIFIER_MODEL, STREAMING_MODE, SYSTEM_PROMPT, MS_PER_DOMAIN, POST_REVEAL_HOLD_MS, SCRAMBLE_DURING_WAIT, PERSIST_CHAT_MODE } from '@/config'

const uid = (): string => Math.random().toString(36).slice(2, 10)

interface ChatState {
  messages:      Message[]
  isThinking:    boolean
  selectedModel: string
  phase:         AppPhase
  neuronState:   NeuronAnimState
  activeDomains: number[]
}

const INITIAL: ChatState = {
  messages:      [],
  isThinking:    false,
  selectedModel: CHAT_MODEL,
  phase:         'welcome',
  neuronState:   'idle',
  activeDomains: [],
}

export function useChat() {
  const [state, setState] = useState<ChatState>(INITIAL)
  const stateRef          = useRef(state)
  const abortRef          = useRef<AbortController | null>(null)
  const revealTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sendIdRef         = useRef<number>(0)

  stateRef.current = state

  const sendMessage = useCallback(async (content: string) => {
    const { isThinking, selectedModel, phase, messages } = stateRef.current
    if (!content.trim() || isThinking || !selectedModel) return

    // Block new sends during the reveal sequence
    if (phase === 'classifying' || phase === 'revealing') return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (revealTimerRef.current) clearTimeout(revealTimerRef.current)

    sendIdRef.current++
    const sendId = sendIdRef.current

    // ---------------------------------------------------------------
    // FIRST MESSAGE -- classify and generate run concurrently.
    // Neurons reveal when classify resolves. Chat transitions after
    // REVEAL_HOLD_MS regardless of whether generate has finished.
    // If !STREAMING_MODE the full response is buffered and shown at once.
    // ---------------------------------------------------------------
    if (phase === 'welcome') {
      setState(s => ({
        ...s,
        phase:         'classifying',
        neuronState:   'processing',
        activeDomains: [],
      }))

      const systemMsg: Message = { id: uid(), role: 'assistant', content: SYSTEM_PROMPT }
      const userMsg:   Message = { id: uid(), role: 'user',      content              }
      const asstId             = uid()

      // Full history sent to the main model includes system prompt
      const history = [
        { role: 'assistant' as const, content: SYSTEM_PROMPT },
        { role: 'user'      as const, content                },
      ]

      // -- Fire both requests concurrently ----------------------------------

      // 1. Classification
      const classifyPromise = classifyDomains(
        content, CLASSIFIER_MODEL, controller.signal
      ).catch(() => [] as number[])

      // 2. Main model response -- only prefetch in non-streaming mode.
      //    In streaming mode we start the stream fresh after the reveal.
      let streamedContent = ''
      let streamError     = ''

      // -- When classification resolves -> reveal ---------------------------
      const domains = await classifyPromise
      if (sendIdRef.current !== sendId) return

      // Non-streaming: fire generate NOW so it runs concurrently with the
      // neuron reveal animation. Streaming: fired fresh after the reveal.
      const generatePromise = (!STREAMING_MODE)
        ? generateFull(selectedModel, history, controller.signal)
            .then(text => { streamedContent = text })
            .catch((err: unknown) => {
              if ((err as Error).name !== 'AbortError')
                streamError = err instanceof Error ? err.message : String(err)
            })
        : Promise.resolve()

      // Reveal duration: ms per identified domain only.
      // Post-reveal waiting is handled explicitly below for each mode.
      const revealDuration = domains.length * MS_PER_DOMAIN

      setState(s => ({
        ...s,
        phase:         'revealing',
        neuronState:   domains.length > 0 ? 'classified' : 'idle',
        activeDomains: domains,
      }))

      // -- After neuron reveal animation completes --------------------------
      revealTimerRef.current = setTimeout(async () => {
        if (sendIdRef.current !== sendId) return

        if (STREAMING_MODE) {
          // Optional fast scramble of revealed neurons during the hold pause
          if (SCRAMBLE_DURING_WAIT && domains.length > 0) {
            setState(s => ({ ...s, neuronState: 'waiting' }))
          }

          // Hold for POST_REVEAL_HOLD_MS, then start stream
          await new Promise(res => setTimeout(res, POST_REVEAL_HOLD_MS))
          if (sendIdRef.current !== sendId) return

          setState(s => ({
            ...s,
            phase:         'chatting',
            neuronState:   'idle',
            activeDomains: [],
            isThinking:    true,
            messages:      [
              userMsg,
              { id: asstId, role: 'assistant' as const, content: '', isStreaming: true },
            ],
          }))

          try {
            await streamChat(selectedModel, history, (token) => {
              setState(s => ({
                ...s,
                messages: s.messages.map(m =>
                  m.id === asstId ? { ...m, content: m.content + token } : m
                ),
              }))
            }, controller.signal)
          } catch (err: unknown) {
            if ((err as Error).name === 'AbortError') return
            const txt = err instanceof Error ? err.message : String(err)
            setState(s => ({
              ...s,
              messages: s.messages.map(m =>
                m.id === asstId
                  ? { ...m, content: `Error: ${txt}`, isStreaming: false }
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

        } else {
          // Non-streaming -- if generate hasn't finished, scramble revealed
          // neurons while waiting, then transition as soon as it resolves.
          if (SCRAMBLE_DURING_WAIT && domains.length > 0) {
            setState(s => ({ ...s, neuronState: 'waiting' }))
          }

          await generatePromise
          if (sendIdRef.current !== sendId) return

          const finalContent = streamError
            ? `Error: ${streamError}`
            : streamedContent

          setState(s => ({
            ...s,
            phase:         'chatting',
            neuronState:   'idle',
            activeDomains: [],
            isThinking:    false,
            messages:      [
              userMsg,
              { id: asstId, role: 'assistant' as const, content: finalContent, isStreaming: false },
            ],
          }))
        }
      }, revealDuration)

      return
    }

    // ---------------------------------------------------------------
    // SUBSEQUENT MESSAGES
    // PERSIST_CHAT_MODE = true  -> normal streaming, stay in chat
    // PERSIST_CHAT_MODE = false -> full classify + reveal cycle again
    // ---------------------------------------------------------------
    if (!PERSIST_CHAT_MODE) {
      // Reset back to classifying -- chat history stays but fades in UI
      setState(s => ({
        ...s,
        phase:         'classifying',
        neuronState:   'processing',
        activeDomains: [],
      }))

      const history = [
        { role: 'assistant' as const, content: SYSTEM_PROMPT },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content },
      ]

      const userMsg: Message = { id: uid(), role: 'user', content }
      const asstId           = uid()

      const classifyPromise = classifyDomains(
        content, CLASSIFIER_MODEL, controller.signal
      ).catch(() => [] as number[])

      let streamedContent = ''
      let streamError     = ''

      const domains = await classifyPromise
      if (sendIdRef.current !== sendId) return

      const generatePromise = (!STREAMING_MODE)
        ? generateFull(selectedModel, history, controller.signal)
            .then(text => { streamedContent = text })
            .catch((err: unknown) => {
              if ((err as Error).name !== 'AbortError')
                streamError = err instanceof Error ? err.message : String(err)
            })
        : Promise.resolve()

      const revealDuration = domains.length * MS_PER_DOMAIN

      setState(s => ({
        ...s,
        phase:         'revealing',
        neuronState:   domains.length > 0 ? 'classified' : 'idle',
        activeDomains: domains,
      }))

      revealTimerRef.current = setTimeout(async () => {
        if (sendIdRef.current !== sendId) return

        if (STREAMING_MODE) {
          if (SCRAMBLE_DURING_WAIT && domains.length > 0)
            setState(s => ({ ...s, neuronState: 'waiting' }))

          await new Promise(res => setTimeout(res, POST_REVEAL_HOLD_MS))
          if (sendIdRef.current !== sendId) return

          setState(s => ({
            ...s,
            phase:         'chatting',
            neuronState:   'idle',
            activeDomains: [],
            isThinking:    true,
            messages:      [...s.messages, userMsg,
              { id: asstId, role: 'assistant' as const, content: '', isStreaming: true }],
          }))

          try {
            await streamChat(selectedModel, history, (token) => {
              setState(s => ({
                ...s,
                messages: s.messages.map(m =>
                  m.id === asstId ? { ...m, content: m.content + token } : m
                ),
              }))
            }, controller.signal)
          } catch (err: unknown) {
            if ((err as Error).name === 'AbortError') return
            const txt = err instanceof Error ? err.message : String(err)
            setState(s => ({
              ...s,
              messages: s.messages.map(m =>
                m.id === asstId
                  ? { ...m, content: `Error: ${txt}`, isStreaming: false }
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
        } else {
          if (SCRAMBLE_DURING_WAIT && domains.length > 0)
            setState(s => ({ ...s, neuronState: 'waiting' }))

          await generatePromise
          if (sendIdRef.current !== sendId) return

          const finalContent = streamError ? `Error: ${streamError}` : streamedContent

          setState(s => ({
            ...s,
            phase:         'chatting',
            neuronState:   'idle',
            activeDomains: [],
            isThinking:    false,
            messages:      [...s.messages, userMsg,
              { id: asstId, role: 'assistant' as const, content: finalContent, isStreaming: false }],
          }))
        }
      }, revealDuration)

      return
    }

    // PERSIST_CHAT_MODE = true -- normal streaming, no neuron replay
    const userMsg: Message = { id: uid(), role: 'user', content }
    const asstId           = uid()
    const placeholder: Message = {
      id: asstId, role: 'assistant', content: '', isStreaming: true,
    }

    const history = [
      { role: 'assistant' as const, content: SYSTEM_PROMPT },
      ...messages,
      userMsg,
    ]

    setState(s => ({
      ...s,
      isThinking: true,
      messages:   [...s.messages, userMsg, placeholder],
    }))

    try {
      await streamChat(selectedModel, history, (token) => {
        setState(s => ({
          ...s,
          messages: s.messages.map(m =>
            m.id === asstId ? { ...m, content: m.content + token } : m
          ),
        }))
      }, controller.signal)
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return
      const txt = err instanceof Error ? err.message : String(err)
      setState(s => ({
        ...s,
        messages: s.messages.map(m =>
          m.id === asstId
            ? { ...m, content: `Error: ${txt}`, isStreaming: false }
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
  }, [])

  return { state, sendMessage }
}