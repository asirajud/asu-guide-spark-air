'use client'

import Image from 'next/image'
import { NotebookIcon } from '@/components/icons'

/** The three notebooks the sidebar offers, and what each one says about itself. */
export const NOTEBOOKS = [
  {
    id: 'transfer-credits',
    name: 'Transfer Credits',
    prompt: 'What is a Notebook, and how is it different from just asking you?',
  },
  {
    id: 'cse-340',
    name: 'CSE 340 — Principles of Programming Languages',
    prompt: 'What is a Notebook, and how is it different from just asking you?',
  },
  {
    id: 'club-fair-2026',
    name: 'Club Fair 2026',
    prompt: 'What is a Notebook, and how is it different from just asking you?',
  },
] as const

export type Notebook = (typeof NOTEBOOKS)[number]

/**
 * A static preview, not a working notebook: one canned exchange that explains
 * the idea, with the composer replaced by a note saying so. Nothing here calls
 * AIR, so it cannot be mistaken for a half-working feature in a demo.
 */
export function NotebookPreview({ notebook }: { notebook: Notebook }) {
  return (
    <div className="thin-scroll relative z-10 flex w-full flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[820px] px-5 pt-6 pb-8">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#3a1723] text-[#ffc627]">
            <NotebookIcon className="size-[22px]" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[20px] font-medium tracking-[-0.02em] text-white">
              {notebook.name}
            </h1>
            <p className="text-muted text-[13px]">Notebook · preview</p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-7">
          <div className="flex justify-end">
            <p className="bg-surface-2 text-fg max-w-[85%] rounded-3xl px-5 py-3.5 text-[17px] leading-[1.4] tracking-[-0.01em]">
              {notebook.prompt}
            </p>
          </div>

          <div className="text-fg flex flex-col gap-4 text-[17px] leading-[1.55] tracking-[-0.01em]">
            <p>
              A chat starts empty every time. A Notebook doesn&apos;t — it&apos;s a place that keeps
              everything you put in it and everything we work out together.
            </p>
            <p>
              Drop in a syllabus, a transfer evaluation, a flyer, a thread of questions. I read all
              of it once, remember what matters, and every later question in that Notebook is
              answered against the whole pile instead of just the last few messages. Ask
              &ldquo;which of these still needs a prerequisite?&rdquo; in week nine and I&apos;ll
              still know what you uploaded in week one.
            </p>
            <p>
              Each Notebook stays its own world. Your CSE 340 notes never leak into your transfer
              paperwork, and neither one drags the other into context.
            </p>
          </div>

          <div className="rounded-3xl border border-white/8 bg-white/[0.02] px-5 py-4">
            <p className="text-muted text-[13.5px] leading-relaxed">
              Not built yet — this is a look at where Sol is going. Chats work today; Notebooks are
              on the roadmap.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-auto w-full max-w-[820px] shrink-0 px-4 pb-5">
        <div className="flex items-center gap-3 rounded-full border border-dashed border-white/12 px-5 py-3.5">
          <Image
            src="/mark-brain.png"
            alt=""
            width={20}
            height={20}
            className="size-5 opacity-50"
          />
          <span className="text-muted text-[15px]">
            Notebooks are coming — start a chat instead
          </span>
        </div>
      </div>
    </div>
  )
}
