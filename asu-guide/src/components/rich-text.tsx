'use client'

import { Fragment } from 'react'

/**
 * The small slice of markdown a chat model actually emits: fenced code blocks,
 * inline code, bold, and bullet lists. Deliberately not a full markdown parser —
 * the assistant answers in short prose, and a dependency here would drag in
 * styling that fights the rest of the UI.
 */
export function RichText({ text }: { text: string }) {
  // ```lang\n…\n``` — the closing fence is optional so a mid-stream block still
  // renders as code while it is still arriving.
  const blocks = text.split(/```(\w*)\n?([\s\S]*?)(?:```|$)/g)

  const out: React.ReactNode[] = []
  for (let i = 0; i < blocks.length; i += 3) {
    const prose = blocks[i]
    const lang = blocks[i + 1]
    const code = blocks[i + 2]

    if (prose) out.push(<Prose key={`p${i}`} text={prose} />)
    if (code !== undefined) {
      out.push(
        <div key={`c${i}`} className="my-3 overflow-hidden rounded-2xl bg-[#141414]">
          {lang && (
            <div className="text-muted border-b border-white/6 px-4 py-1.5 text-[11.5px] tracking-wide lowercase">
              {lang}
            </div>
          )}
          <pre className="overflow-x-auto px-4 py-3">
            <code className="font-mono text-[13px] leading-[1.6] whitespace-pre text-[#e8e8e8]">
              {code.replace(/\n$/, '')}
            </code>
          </pre>
        </div>,
      )
    }
  }

  return <>{out}</>
}

function Prose({ text }: { text: string }) {
  const lines = text.split('\n')

  return (
    <>
      {lines.map((line, i) => {
        const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
        const numbered = /^\s*(\d+)\.\s+(.*)$/.exec(line)

        if (bullet) {
          return (
            <span key={i} className="flex gap-2.5 py-[3px]">
              <span aria-hidden className="text-muted mt-[9px] size-[5px] shrink-0 rounded-full bg-current" />
              <span className="min-w-0 flex-1">
                <Inline text={bullet[1]} />
              </span>
            </span>
          )
        }

        if (numbered) {
          return (
            <span key={i} className="flex gap-2.5 py-[3px]">
              <span className="text-muted shrink-0 tabular-nums">{numbered[1]}.</span>
              <span className="min-w-0 flex-1">
                <Inline text={numbered[2]} />
              </span>
            </span>
          )
        }

        return (
          <Fragment key={i}>
            <Inline text={line} />
            {i < lines.length - 1 && <br />}
          </Fragment>
        )
      })}
    </>
  )
}

/** Bold and inline code inside a single line. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <strong key={i} className="font-semibold text-white">
              {part.slice(2, -2)}
            </strong>
          )
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          const body = part.slice(1, -1)

          // Models sometimes cram a whole function into single backticks. Long
          // or brace-bearing spans read as code blocks, not as inline snippets,
          // so promote them rather than letting them wrap through the prose.
          if (body.length > 60 || /[{};]\s*\S/.test(body)) {
            return (
              <span key={i} className="my-3 block overflow-hidden rounded-2xl bg-[#141414]">
                <span className="block overflow-x-auto px-4 py-3">
                  <code className="font-mono text-[13px] leading-[1.6] whitespace-pre text-[#e8e8e8]">
                    {prettyOneLiner(body)}
                  </code>
                </span>
              </span>
            )
          }

          return (
            <code
              key={i}
              className="rounded-md bg-white/8 px-[5px] py-[2px] font-mono text-[0.88em] text-[#e8e8e8]"
            >
              {body}
            </code>
          )
        }
        return <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}

/**
 * Re-break a one-line snippet on its statement and brace boundaries so it is
 * readable. Not a formatter — just enough structure to stop a function reading
 * as a single run-on line.
 */
function prettyOneLiner(code: string): string {
  if (code.includes('\n')) return code

  let depth = 0
  let out = ''
  for (const ch of code) {
    if (ch === '{') {
      depth += 1
      out += ' {\n' + '  '.repeat(depth)
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1)
      out = out.replace(/[ \t]+$/, '') + '\n' + '  '.repeat(depth) + '}'
    } else if (ch === ';') {
      out += ';\n' + '  '.repeat(depth)
    } else {
      out += ch
    }
  }

  return out
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l, i, a) => l.trim() !== '' || (i > 0 && i < a.length - 1))
    .join('\n')
    .trim()
}
