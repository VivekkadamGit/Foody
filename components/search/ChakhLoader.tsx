'use client'

import { useEffect, useRef } from 'react'

/** "Chakh" written in each script, phonetically. Hindi, Gujarati, Marathi and English lead. */
const WORDS = ['चख', 'ચાખ', 'चाख', 'Chakh', 'চাখ', 'ਚੱਖ', 'சக்', 'చఖ్', 'ಚಖ್', 'ചഖ్', 'چکھ']

const EVERY_MS = 260
const DURATION_MS = 700

const POP: Keyframe[] = [
  { opacity: 0, transform: 'translate(-50%, -50%) translateY(14px) scale(0.6)' },
  { opacity: 1, transform: 'translate(-50%, -50%) scale(1.12)', offset: 0.25 },
  { opacity: 1, transform: 'translate(-50%, -50%) translateY(-4px) scale(1)', offset: 0.45 },
  { opacity: 0, transform: 'translate(-50%, -50%) translateY(-40px) scale(0.95)' },
]

// Reduced motion: same rhythm, no movement.
const FADE: Keyframe[] = [
  { opacity: 0, transform: 'translate(-50%, -50%)' },
  { opacity: 1, transform: 'translate(-50%, -50%)', offset: 0.3 },
  { opacity: 0, transform: 'translate(-50%, -50%)' },
]

/** Search loader: "Chakh" pops up in the centre in one language after another. */
export default function ChakhLoader() {
  const stage = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = stage.current
    if (!el) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let i = 0

    const tick = () => {
      const word = document.createElement('span')
      word.textContent = WORDS[i++ % WORDS.length]
      word.className = 'absolute left-1/2 top-1/2 whitespace-nowrap font-anek text-5xl text-spice opacity-0'
      el.appendChild(word)
      word.animate(still ? FADE : POP, {
        duration: still ? DURATION_MS * 2 : DURATION_MS,
        easing: 'cubic-bezier(.2,.8,.2,1)',
        fill: 'forwards',
      }).onfinish = () => word.remove()
    }

    tick()
    const timer = setInterval(tick, still ? EVERY_MS * 3 : EVERY_MS)
    return () => {
      clearInterval(timer)
      el.replaceChildren()
    }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-24" role="status" aria-live="polite">
      <div ref={stage} className="relative h-28 w-full" aria-hidden="true" />
      <p className="font-anek text-[15px] text-sand-dark">Finding what fits…</p>
    </div>
  )
}
