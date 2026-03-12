// lib/api.ts
// Ollama API client.
// Communicates with the default local Ollama server.
//
// Endpoints:
//   GET  /api/tags   -- list installed models
//   POST /api/chat   -- streaming chat completion (NDJSON)
//
// Stream format: one JSON object per line, shape:
//   { message: { role, content }, done: boolean }

import type { Message, OllamaModel } from '@/types/chat'

const BASE = 'http://localhost:11434'

// -- Model list ------------------------------------------------------------

export async function fetchModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${BASE}/api/tags`)
  if (!res.ok) throw new Error(`Could not reach Ollama (${res.status})`)
  const data = await res.json()
  return (data.models ?? []) as OllamaModel[]
}

// -- Streaming chat --------------------------------------------------------

export async function streamChat(
  model:    string,
  history:  Pick<Message, 'role' | 'content'>[],
  onToken:  (token: string) => void,
  signal?:  AbortSignal
): Promise<void> {
  const res = await fetch(`${BASE}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model,
      messages: history.map(m => ({ role: m.role, content: m.content })),
      stream:   true,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama ${res.status}: ${text}`)
  }

  const reader  = res.body!.getReader()
  const decoder = new TextDecoder()
  let   buffer  = ''

  // Read the NDJSON stream line by line
  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Split on newlines; last element may be a partial line -- keep it
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const obj = JSON.parse(line)
        const token = obj?.message?.content
        if (token) onToken(token)
      } catch {
        // Malformed line -- skip silently
      }
    }
  }

  // Flush any remainder in the buffer
  if (buffer.trim()) {
    try {
      const obj = JSON.parse(buffer)
      const token = obj?.message?.content
      if (token) onToken(token)
    } catch {
      // Ignore
    }
  }
}