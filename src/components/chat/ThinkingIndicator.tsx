// components/chat/ThinkingIndicator.tsx
// Three bouncing dots shown while the assistant placeholder is empty.
// Purely presentational -- no props or state.

export default function ThinkingIndicator() {
  return (
    <span className="thinking-dots" aria-label="Thinking">
      <span aria-hidden />
      <span aria-hidden />
      <span aria-hidden />
    </span>
  )
}