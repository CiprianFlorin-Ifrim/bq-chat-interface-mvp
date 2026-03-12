// components/NeuronSphere.tsx
// Free-floating neuron field where each node represents a knowledge domain.
//
// Animation states (driven by props):
//   idle        -- slow organic drift, gentle scramble every ~2.75s
//   processing  -- faster drift, rapid scramble (classifier is running)
//   classified  -- reveal sequence:
//                    1. PRE            fast scramble before reveal
//                    2. REVEAL         domains light up one by one, edges appear,
//                                      labels fade in with 250ms delay
//                    3. SETTLE         inactive nodes fade to near-invisible
//                    4. DONE           lerps carry on, state machine stops
//
// All mutable animation state lives in refs -- zero React renders during the
// rAF loop. Props -> refs sync via separate useEffects.

import { useEffect, useRef } from 'react'
import { cn }                from '@/lib/utils'
import { DOMAINS }           from '@/config'
import { WAIT_SCRAMBLE_SPEED, DOMAIN_NEURON_INTERLINKING } from '@/config'

// -- Props --------------------------------------------------------------------
interface Props {
  hidden:        boolean
  expanding:     boolean
  animState:     'idle' | 'processing' | 'classified' | 'waiting'
  activeDomains: number[]
}

// -- Constants ----------------------------------------------------------------
const N                = 200
const W                = 700
const H                = 700
const NODES_PER_DOMAIN = 10 
const DOMAIN_COUNT     = DOMAINS.length

// Drift speed and scramble config per animation state
const DRIFT_SPD = { idle: 0.115, processing: 0.540, classified: 0.090, waiting: WAIT_SCRAMBLE_SPEED }
const SCRBL_MS  = { idle: 2750,  processing: 550,   classified: 99999, waiting: 500  }
const SCRBL_N   = { idle: 18,    processing: 28,    classified: 0,     waiting: 0     }

const PRE_MS   = 1000    // ms of fast-scramble before reveal starts
const STEP_MS  = 650    // ms between successive domain reveals

// -- Types --------------------------------------------------------------------
interface Node {
  x: number;  y: number
  tx: number; ty: number
  vx: number; vy: number
  phase:         number
  r:             number
  baseLightness: number   // 0-255 greyscale
  baseAlpha:     number
  domain:        number   // -1 = unassigned

  displayAlpha:     number  // lerped toward targetAlpha each frame
  targetAlpha:      number
  labelAlpha:       number  // lerped toward targetLabelAlpha each frame
  targetLabelAlpha: number
  isRevealed:       boolean
}

interface RevealEdge {
  ni: number; nj: number
  alpha:       number
  targetAlpha: number
}

interface RevealCtrl {
  phase:      'pre' | 'revealing' | 'settling' | 'done'
  queue:      number[]    // domain indices yet to reveal
  revealed:   number[]    // domain indices already revealed
  stepLastMs: number
  preStartMs: number      // 0 until first draw tick in pre phase
}

// -- Helpers ------------------------------------------------------------------
const rand  = (lo: number, hi: number) => Math.random() * (hi - lo) + lo
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const lerp  = (a: number, b: number, t: number)   => a + (b - a) * t



// Returns a random point inside the inscribed circle of the canvas
function randCircle(): { x: number; y: number } {
  const cx = W / 2
  const cy = H / 2
  const r  = Math.min(cx, cy) - 40   // radius with padding
  const a  = Math.random() * Math.PI * 2
  const d  = Math.sqrt(Math.random()) * r   // sqrt for uniform distribution
  return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d }
}

// Build N nodes with shuffled domain assignments so same-domain nodes are
// spatially spread rather than clustered by index.
function buildNodes(): Node[] {
  const assign: number[] = []
  for (let d = 0; d < DOMAIN_COUNT; d++)
    for (let k = 0; k < NODES_PER_DOMAIN; k++)
      assign.push(d)
  while (assign.length < N) assign.push(-1)

  // Fisher-Yates shuffle
  for (let i = assign.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[assign[i], assign[j]] = [assign[j], assign[i]]
  }

  return assign.map(domain => {
    const L = Math.floor(rand(18, 195))
    const a = rand(0.28, 0.88)
    return {
      x: randCircle().x, y: randCircle().y,
      tx: randCircle().x, ty: randCircle().y,
      vx: 0, vy: 0,
      phase: rand(0, Math.PI * 2),
      r: rand(1.8, 5.8),
      baseLightness: L, baseAlpha: a, domain,
      displayAlpha: a, targetAlpha: a,
      labelAlpha: 0, targetLabelAlpha: 0,
      isRevealed: false,
    }
  })
}

// -- Component ----------------------------------------------------------------
export default function NeuronSphere({ hidden, expanding, animState, activeDomains }: Props) {
  const canvasRef        = useRef<HTMLCanvasElement>(null)
  const rafRef           = useRef<number>(0)
  const nodesRef         = useRef<Node[]>([])
  const edgesRef         = useRef<RevealEdge[]>([])
  const revealRef        = useRef<RevealCtrl | null>(null)
  const scrblTimerRef    = useRef<number>(0)
  const frameRef         = useRef<number>(0)

  // Prop mirrors so the rAF loop always reads current values without re-running
  const animStateRef     = useRef(animState)
  const activeDomainsRef = useRef(activeDomains)
  useEffect(() => { animStateRef.current     = animState     }, [animState])
  useEffect(() => { activeDomainsRef.current = activeDomains }, [activeDomains])

  // -- React to state transitions -------------------------------------------
  useEffect(() => {
    const nodes = nodesRef.current
    if (!nodes.length) return

    if (animState === 'classified' && activeDomains.length > 0) {
      edgesRef.current = []
      for (const n of nodes) {
        n.isRevealed       = false
        n.labelAlpha       = 0
        n.targetLabelAlpha = 0
        n.targetAlpha      = n.baseAlpha * 0.55
      }
      revealRef.current = {
        phase:      'pre',
        queue:      [...activeDomains],
        revealed:   [],
        stepLastMs: 0,
        preStartMs: 0,
      }
    } else if (animState === 'idle') {
      revealRef.current = null
      edgesRef.current  = []
      for (const n of nodes) {
        n.isRevealed       = false
        n.targetAlpha      = n.baseAlpha
        n.targetLabelAlpha = 0
      }
    }
  }, [animState, activeDomains])

  // -- rAF draw loop ---------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width  = W
    canvas.height = H
    nodesRef.current = buildNodes()

    const draw = (ts: number) => {
      ctx.clearRect(0, 0, W, H)

      const state  = animStateRef.current
      const nodes  = nodesRef.current
      const reveal = revealRef.current
      const t      = frameRef.current * 0.011

      // -- Scramble timer --------------------------------------------------
      const scrblInterval = SCRBL_MS[state] ?? SCRBL_MS.idle
      if (ts - scrblTimerRef.current > scrblInterval) {
        scrblTimerRef.current = ts

        if (state === 'waiting') {
          // Only scramble revealed nodes -- background nodes stay faded out
          nodes
            .map((n, i) => ({ n, i }))
            .filter(({ n }) => n.isRevealed)
            .sort(() => Math.random() - 0.5)
            .slice(0, 8)
            .forEach(({ i }) => {
              const sp = randCircle(); nodes[i].tx = sp.x; nodes[i].ty = sp.y
            })
        } else {
          const scrblCount = SCRBL_N[state] ?? 18
          Array.from({ length: N }, (_, i) => i)
            .sort(() => Math.random() - 0.5)
            .slice(0, scrblCount)
            .forEach(i => {
              const sp = randCircle(); nodes[i].tx = sp.x; nodes[i].ty = sp.y
            })
        }
      }

      // -- Reveal state machine --------------------------------------------
      if (reveal) {
        if (reveal.phase === 'pre') {
          if (reveal.preStartMs === 0) reveal.preStartMs = ts
          if (ts - reveal.preStartMs > PRE_MS) {
            reveal.phase      = 'revealing'
            reveal.stepLastMs = ts
          }
        }

        else if (reveal.phase === 'revealing') {
          if (ts - reveal.stepLastMs > STEP_MS && reveal.queue.length > 0) {
            reveal.stepLastMs = ts
            const domainIdx   = reveal.queue.shift()!
            reveal.revealed.push(domainIdx)

            // Map domain nodes with their global indices
            const matched = nodes
              .map((n, i) => ({ n, i }))
              .filter(({ n }) => n.domain === domainIdx)

            // Light up nodes for this domain
            for (const { n } of matched) {
              n.isRevealed  = true
              n.targetAlpha = Math.min(0.97, n.baseAlpha * 2.5)
            }

            if (DOMAIN_NEURON_INTERLINKING) {
              // Connect each newly revealed node to every previously revealed node,
              // building a growing cross-domain web with each reveal step.
              const prevRevealed = nodes
                .map((n, i) => ({ n, i }))
                .filter(({ n, i }) =>
                  n.isRevealed &&
                  !matched.some(m => m.i === i)   // exclude nodes just revealed
                )

              for (const cur of matched) {
                for (const prev of prevRevealed) {
                  edgesRef.current.push({
                    ni: cur.i, nj: prev.i,
                    alpha: 0, targetAlpha: 0.18,
                  })
                }
                // Also connect within the matched set (same domain)
                for (const other of matched) {
                  if (other.i <= cur.i) continue
                  edgesRef.current.push({
                    ni: cur.i, nj: other.i,
                    alpha: 0, targetAlpha: 0.28,
                  })
                }
              }
            } else {
              // Original behaviour -- only connect within same domain
              if (matched.length >= 2)
                edgesRef.current.push({
                  ni: matched[0].i, nj: matched[1].i,
                  alpha: 0, targetAlpha: 0.28,
                })
            }

            // Delay label fade-in slightly after node lights up
            const labelNodes = matched.map(m => m.n)
            setTimeout(() => {
              for (const n of labelNodes) n.targetLabelAlpha = 1
            }, 250)
          }

          if (reveal.queue.length === 0) reveal.phase = 'settling'
        }

        else if (reveal.phase === 'settling') {
          // Fade out all non-revealed nodes to near-invisible
          for (const n of nodes)
            if (!n.isRevealed) n.targetAlpha = 0.05
          reveal.phase = 'done'
          // 'done' -- state machine stops; lerps carry on
        }
      }

      // -- Physics ----------------------------------------------------------
      const spd = DRIFT_SPD[state] ?? DRIFT_SPD.idle
      for (const nd of nodes) {
        const dx   = nd.tx - nd.x
        const dy   = nd.ty - nd.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist > 1) {
          nd.vx += (dx / dist) * spd * 0.08
          nd.vy += (dy / dist) * spd * 0.08
        }
        nd.vx += Math.sin(t + nd.phase)       * 0.038
        nd.vy += Math.cos(t + nd.phase * 1.3) * 0.038
        nd.vx *= 0.942
        nd.vy *= 0.942
        nd.x = clamp(nd.x + nd.vx, 20, W - 20)
        nd.y = clamp(nd.y + nd.vy, 20, H - 20)
        if (dist < 3) { const p = randCircle(); nd.tx = p.x; nd.ty = p.y }

        nd.displayAlpha = lerp(nd.displayAlpha, nd.targetAlpha,      0.038)
        nd.labelAlpha   = lerp(nd.labelAlpha,   nd.targetLabelAlpha, 0.045)
      }

      // -- Revealed domain edges --------------------------------------------
      for (const e of edgesRef.current) {
        e.alpha = lerp(e.alpha, e.targetAlpha, 0.048)
        if (e.alpha < 0.008) continue
        ctx.beginPath()
        ctx.moveTo(nodes[e.ni].x, nodes[e.ni].y)
        ctx.lineTo(nodes[e.nj].x, nodes[e.nj].y)
        ctx.strokeStyle = `rgba(38,38,38,${e.alpha.toFixed(3)})`
        ctx.lineWidth   = 0.5
        ctx.stroke()
      }

      // -- Nodes ------------------------------------------------------------
      for (const nd of nodes) {
        if (nd.displayAlpha < 0.004) continue
        const L = nd.baseLightness
        const r = nd.r * (nd.isRevealed ? 1.3 : 1.0)
        ctx.beginPath()
        ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${L},${L},${L},${nd.displayAlpha.toFixed(3)})`
        ctx.fill()
      }

      // -- Domain labels (one per revealed domain, near centroid) -----------
      if (reveal && reveal.revealed.length > 0) {
        ctx.save()
        ctx.font         = '500 10px Inter, sans-serif'
        ctx.textBaseline = 'middle'

        for (const domainIdx of reveal.revealed) {
          const dNodes = nodes.filter(n => n.domain === domainIdx)
          if (!dNodes.length) continue

          const cx = dNodes.reduce((s, n) => s + n.x, 0) / dNodes.length
          const cy = dNodes.reduce((s, n) => s + n.y, 0) / dNodes.length
          const la = dNodes[0].labelAlpha
          if (la < 0.01) continue

          ctx.shadowColor  = 'rgba(238,236,232,0.95)'
          ctx.shadowBlur   = 5
          ctx.fillStyle    = `rgba(38,38,38,${la.toFixed(3)})`
          ctx.fillText((DOMAINS[domainIdx] ?? '').split(':')[0].trim(), cx + 10, cy)
        }

        ctx.restore()
      }

      frameRef.current++
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        'neuron-sphere',
        hidden     && 'neuron-sphere--hidden',
        expanding  && 'neuron-sphere--expanding'
      )}
      aria-hidden
    />
  )
}