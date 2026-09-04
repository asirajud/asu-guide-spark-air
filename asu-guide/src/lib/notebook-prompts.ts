export type PageForPrompt = { position: number; reading: string; status: 'read' | 'failed' }

/** Output ceiling for one page transcription. Dense pages run long. */
export const PAGE_READER_MAX_TOKENS = 900
/** Output ceiling for the rewritten understanding. */
export const DIGEST_MAX_TOKENS = 1100
/** 450 words of markdown with bullets and page cites runs past 700 tokens; 700 cut a three-page digest mid-sentence. */
/** Characters of page text the notebook chat may see in total. */
export const CHAT_PAGE_BUDGET_CHARS = 24_000

/**
 * Prompt for transcribing a single notebook page
 */
export function pageReaderPrompt(position: number, digest: string): string {
  const base = `You are transcribing page ${position} of a student's notebook.
Transcribe every word, heading, list item, formula, label and caption exactly as written, preserving order and structure. Plain text with line breaks. Write formulas in plain text.
After the transcription, add a line that says exactly \`Notes:\` followed by two or three sentences describing diagrams, sketches, arrows, crossed-out text, highlighting, or anything visual that words alone would miss.
Do not summarise, do not answer questions, do not add anything that is not on the page. Write \`[illegible]\` where a word cannot be read.`

  if (!digest.trim()) {
    return base
  }

  return `${base}

For context, earlier pages of the same notebook covered the following. Use it only to resolve abbreviations and lists that continue across pages; do not repeat it:
${digest.slice(0, 1500)}`
}

/**
 * Prompt for merging a new page transcription into the notebook understanding
 */
export function digestMergePrompt(
  digest: string,
  reading: string,
  position: number,
): { system: string; user: string } {
  const system = `You maintain a running understanding of a student's notebook. You are given the understanding so far and the transcription of one newly read page. Rewrite the understanding so it covers every page read so far, including this one. Output markdown with exactly these four sections in this order and nothing else:
## Topics — one bullet per topic, each ending with the page numbers it appears on in parentheses, like (p. 1, 3).
## Key facts — bullets: definitions, formulas, dates, names and numbers exactly as written, each with its page number.
## Connections — bullets on how ideas on different pages relate, or a single bullet \`None yet\` if there is only one page.
## Open questions — bullets: things the pages leave unexplained, unfinished or illegible.
Rules: keep the whole output under 450 words; merge duplicates; never drop a fact from an earlier page unless the new page corrects it, in which case keep the correction and say it was corrected; do not invent anything that is not in a page; no preamble, no closing remark, output only the markdown.`

  const user = `Understanding so far (empty if this is the first page):
${digest.trim() || '(empty)'}

Page ${position} transcription:
${reading}`

  return { system, user }
}

/**
 * Renders pages as markdown blocks, respecting character budget
 */
export function clipPages(pages: PageForPrompt[], budgetChars: number): string {
  if (pages.length === 0) return ''

  const totalLength = pages.reduce((sum, page) => sum + page.reading.length, 0)

  if (totalLength <= budgetChars) {
    return pages
      .map((page) =>
        page.status === 'failed'
          ? `### Page ${page.position}\n[this page could not be read]`
          : `### Page ${page.position}\n${page.reading}`,
      )
      .join('\n\n')
  }

  const charsPerPage = Math.floor(budgetChars / pages.length)

  return pages
    .map((page) => {
      if (page.status === 'failed') {
        return `### Page ${page.position}\n[this page could not be read]`
      }

      const text = page.reading.substring(0, charsPerPage)
      const suffix = text.length < page.reading.length ? ' […]' : ''
      return `### Page ${page.position}\n${text}${suffix}`
    })
    .join('\n\n')
}

/**
 * System prompt for notebook chat
 */
export function notebookChatSystemPrompt(
  name: string,
  digest: string,
  pages: PageForPrompt[],
  firstName: string | null,
): string {
  const firstNameLine = firstName
    ? `The student's first name is ${firstName}; you may use it once, then stop.`
    : `Do not guess the student's name.`

  return `You are Sol, a campus assistant for Arizona State University students, running on the ASU AIR platform. Right now you are answering questions about one notebook only, named \`${name}\`.
Answer from the material below. When you use something from a page, name the page like (p. 3). If the answer is not in the notebook, say so plainly instead of guessing, and never pull in outside knowledge as if it came from the pages.
Be concise: one to four short sentences unless the student asks for detail. Plain text, no markdown headings, no bullet lists; use **bold** only when something really must stand out. Start every reply with a capital letter.
${firstNameLine}

## Understanding
${digest.trim() || '(no pages read yet)'}

## Pages
${clipPages(pages, CHAT_PAGE_BUDGET_CHARS) || '(no pages yet)'}`
}
