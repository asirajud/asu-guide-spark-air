import { describe, expect, it } from 'vitest'
import {
  PAGE_READER_MAX_TOKENS,
  DIGEST_MAX_TOKENS,
  CHAT_PAGE_BUDGET_CHARS,
  pageReaderPrompt,
  digestMergePrompt,
  clipPages,
  notebookChatSystemPrompt,
  type PageForPrompt,
} from './notebook-prompts'

describe('pageReaderPrompt', () => {
  it('names the page', () => {
    const result = pageReaderPrompt(3, '')
    expect(result).toContain('page 3 of a student')
    expect(result).toContain('Notes:')
    expect(result).toContain('[illegible]')
  })

  it('omits the context paragraph when the digest is blank', () => {
    const result = pageReaderPrompt(1, '   ')
    expect(result).not.toContain('earlier pages')
  })

  it('includes the digest when present, clipped to 1500 chars', () => {
    const digest = 'x'.repeat(2000)
    const result = pageReaderPrompt(1, digest)
    expect(result).toContain('earlier pages')
    expect(result).toContain('x'.repeat(1500))
    expect(result).not.toContain('x'.repeat(1501))
  })
})

describe('digestMergePrompt', () => {
  it('first page', () => {
    const result = digestMergePrompt('', 'hello', 1)
    expect(result.user).toContain('(empty)')
    expect(result.user).toContain('Page 1 transcription:')
    expect(result.user).toContain('hello')
  })

  it('later page', () => {
    const result = digestMergePrompt('## Topics\n- a (p. 1)', 'more', 2)
    expect(result.user).toContain('- a (p. 1)')
    expect(result.user).toContain('Page 2 transcription:')
  })

  it('the system prompt names all four sections in order', () => {
    const result = digestMergePrompt('', '', 1)
    const system = result.system
    const topicsIndex = system.indexOf('## Topics')
    const keyFactsIndex = system.indexOf('## Key facts')
    const connectionsIndex = system.indexOf('## Connections')
    const openQuestionsIndex = system.indexOf('## Open questions')

    expect(topicsIndex).toBeLessThan(keyFactsIndex)
    expect(keyFactsIndex).toBeLessThan(connectionsIndex)
    expect(connectionsIndex).toBeLessThan(openQuestionsIndex)
    expect(system).toContain('450 words')
  })
})

describe('clipPages', () => {
  it('empty array → ""', () => {
    expect(clipPages([], 100)).toBe('')
  })

  it('within budget, readings are whole', () => {
    const pages: PageForPrompt[] = [
      { position: 1, reading: 'alpha', status: 'read' },
      { position: 2, reading: 'beta', status: 'read' },
    ]
    const result = clipPages(pages, 100)
    expect(result).toContain('### Page 1\nalpha')
    expect(result).toContain('### Page 2\nbeta')
    expect(result).toContain('\n\n')
  })

  it('failed pages are labelled', () => {
    const pages: PageForPrompt[] = [{ position: 1, reading: 'should not appear', status: 'failed' }]
    const result = clipPages(pages, 100)
    expect(result).toContain('[this page could not be read]')
    expect(result).not.toContain('should not appear')
  })

  it('over budget, each page is cut evenly and marked', () => {
    const pages: PageForPrompt[] = [
      { position: 1, reading: 'a'.repeat(100), status: 'read' },
      { position: 2, reading: 'b'.repeat(100), status: 'read' },
    ]
    const result = clipPages(pages, 100)
    expect(result).toContain('a'.repeat(50) + ' […]')
    expect(result).not.toContain('a'.repeat(51))
  })
})

describe('notebookChatSystemPrompt', () => {
  it('names the notebook and includes the digest and pages', () => {
    const pages: PageForPrompt[] = [{ position: 1, reading: 'page text', status: 'read' }]
    const result = notebookChatSystemPrompt('CSE 340', 'facts here', pages, 'Ada')
    expect(result).toContain('CSE 340')
    expect(result).toContain('facts here')
    expect(result).toContain('### Page 1')
    expect(result).toContain('page text')
    expect(result).toContain('Ada')
  })

  it('no name → tells the model not to guess', () => {
    const result = notebookChatSystemPrompt('', '', [], null)
    expect(result).toContain('Do not guess')
    expect(result).not.toContain('first name is')
  })

  it('empty notebook placeholders', () => {
    const result = notebookChatSystemPrompt('', '', [], 'Ada')
    expect(result).toContain('(no pages read yet)')
    expect(result).toContain('(no pages yet)')
  })

  it('constants are sane', () => {
    expect(PAGE_READER_MAX_TOKENS).toBeGreaterThan(0)
    expect(DIGEST_MAX_TOKENS).toBeGreaterThan(0)
    expect(CHAT_PAGE_BUDGET_CHARS).toBeGreaterThan(1000)
  })
})
