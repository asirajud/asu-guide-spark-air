/**
 * The inline markdown a chat model actually emits, as tokens.
 *
 * Split out of the renderer so the tricky part — deciding what is emphasis and
 * what is arithmetic — can be tested without mounting React.
 */
export type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'bolditalic'; text: string }
  | { kind: 'code'; text: string }

/**
 * Order matters: the longest fence has to win, or `***x***` is read as a bold
 * run with stray asterisks around it, and `**x**` as two empty italics.
 *
 * Emphasis is deliberately fussy about its edges. A `*` that touches a word
 * character on the outside is multiplication (`5*3*2`), not markup, and one
 * that touches whitespace on the inside is a stray asterisk the model left
 * behind. Underscores get the same treatment so `snake_case_name` survives.
 */
const INLINE = new RegExp(
  [
    '\\*\\*\\*(?!\\s)([^*\\n]+?)(?<!\\s)\\*\\*\\*', // ***bold italic***
    '\\*\\*(?!\\s)([^*\\n]+?)(?<!\\s)\\*\\*', // **bold**
    '`([^`\\n]+)`', // `code`
    '(?<![\\w*])\\*(?!\\s)([^*\\n]+?)(?<!\\s)\\*(?![\\w*])', // *italic*
    '(?<![\\w_])_(?!\\s)([^_\\n]+?)(?<!\\s)_(?![\\w_])', // _italic_
  ].join('|'),
  'g',
)

export function tokenizeInline(text: string): InlineToken[] {
  const out: InlineToken[] = []
  let last = 0

  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) })

    const [, bi, bold, code, star, underscore] = m
    if (bi !== undefined) out.push({ kind: 'bolditalic', text: bi })
    else if (bold !== undefined) out.push({ kind: 'bold', text: bold })
    else if (code !== undefined) out.push({ kind: 'code', text: code })
    else out.push({ kind: 'italic', text: (star ?? underscore) as string })

    last = m.index + m[0].length
  }

  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}
