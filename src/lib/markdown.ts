// lib/markdown.ts
// Lightweight markdown -> HTML for chat assistant output.
// No external deps. Handles the practical subset seen in LLM responses:
//   headings (h2-h4), bold, italic, inline code, hr, ul, ol.
//
// Runs once per completed message -- not called on every streaming token,
// so per-call cost is irrelevant to perceived performance.

// -- Inline rules (applied inside every non-structural line) ---------------
function inline(text: string): string {
  return text
    .replace(/`([^`]+)`/g,       '<code class="md-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g,     '<em>$1</em>')
    .replace(/_([^_]+)_/g,       '<em>$1</em>')
}

// -- Main renderer ---------------------------------------------------------
export function renderMarkdown(raw: string): string {
  if (!raw) return ''

  const lines = raw.split('\n')
  const out:   string[] = []
  let   inUl  = false
  let   inOl  = false

  const closeList = () => {
    if (inUl) { out.push('</ul>'); inUl = false }
    if (inOl) { out.push('</ol>'); inOl = false }
  }

  for (const line of lines) {
    // Horizontal rule
    if (/^\s*-{3,}\s*$/.test(line)) {
      closeList()
      out.push('<hr class="md-hr" />')
      continue
    }

    // Headings h4 -> h2 (order matters -- most specific first)
    const hMatch = line.match(/^(#{2,4})\s+(.+)/)
    if (hMatch) {
      closeList()
      const level = hMatch[1].length  // 2, 3, or 4
      out.push(`<h${level} class="md-h${level}">${inline(hMatch[2])}</h${level}>`)
      continue
    }

    // Unordered list item
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)/)
    if (ulMatch) {
      if (!inUl) { closeList(); out.push('<ul class="md-ul">'); inUl = true }
      const indent = ulMatch[1].length * 16
      out.push(`<li style="margin-left:${indent}px">${inline(ulMatch[2])}</li>`)
      continue
    }

    // Ordered list item
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)/)
    if (olMatch) {
      if (!inOl) { closeList(); out.push('<ol class="md-ol">'); inOl = true }
      const indent = olMatch[1].length * 16
      out.push(`<li style="margin-left:${indent}px">${inline(olMatch[2])}</li>`)
      continue
    }

    // Fenced code block fence line -- swallow the delimiter
    if (/^```/.test(line)) {
      closeList()
      continue
    }

    // Empty line
    if (line.trim() === '') {
      closeList()
      out.push('<br />')
      continue
    }

    // Regular paragraph
    closeList()
    out.push(`<p class="md-p">${inline(line)}</p>`)
  }

  closeList()
  return out.join('')
}