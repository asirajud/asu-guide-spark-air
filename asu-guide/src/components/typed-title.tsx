'use client'

import { useEffect, useRef, useState } from 'react'

/** ~18ms a character, matching the reply's own reveal cadence. */
const TICK = 18

/**
 * Types a conversation title out character by character, once, when an AIR
 * model has just named it. The point is that a second model doing work becomes
 * legible without a label for it.
 *
 * Everything else — a reload, a manual rename, a re-render — renders instantly,
 * so this never replays for a title the student has already seen.
 */
export function TypedTitle({ text, onDone }: { text: string; onDone: () => void }) {
  const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const [n, setN] = useState(reduced ? text.length : 0)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  }, [onDone])

  useEffect(() => {
    if (reduced || n >= text.length) return
    const id = setTimeout(() => setN((v) => v + 1), TICK)
    return () => clearTimeout(id)
  }, [n, text.length, reduced])

  // Clearing the flag is what stops a later refresh() replaying the animation.
  const finished = n >= text.length
  useEffect(() => {
    if (finished) done.current()
  }, [finished])

  return (
    <>
      {/* The full title is announced once; the partial text is decoration. */}
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex items-baseline">
        {text.slice(0, n)}
        {!finished && (
          <span className="bg-fg/80 ml-0.5 inline-block h-[13px] w-[1.5px] translate-y-[1px] animate-pulse" />
        )}
      </span>
    </>
  )
}
