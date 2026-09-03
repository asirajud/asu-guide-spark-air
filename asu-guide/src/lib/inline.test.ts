import { describe, expect, it } from 'vitest'
import { tokenizeInline } from './inline'

/** Collapses tokens to a compact shape so the expectations stay readable. */
const t = (s: string) => tokenizeInline(s).map((p) => [p.kind, p.text])

describe('tokenizeInline', () => {
  it('renders single-asterisk emphasis (the bug in #8)', () => {
    expect(t('*Fight Club* was on')).toEqual([
      ['italic', 'Fight Club'],
      ['text', ' was on'],
    ])
  })

  it('renders underscore emphasis', () => {
    expect(t('_The Matrix_')).toEqual([['italic', 'The Matrix']])
  })

  it('still renders bold and code', () => {
    expect(t('**bold** and `code`')).toEqual([
      ['bold', 'bold'],
      ['text', ' and '],
      ['code', 'code'],
    ])
  })

  it('does not read arithmetic as emphasis', () => {
    expect(t('5*3*2')).toEqual([['text', '5*3*2']])
    expect(t('2 * 3 * 4')).toEqual([['text', '2 * 3 * 4']])
  })

  it('leaves identifiers alone', () => {
    expect(t('snake_case_name')).toEqual([['text', 'snake_case_name']])
    expect(t('__dunder__')).toEqual([['text', '__dunder__']])
  })

  it('does not mangle triple asterisks', () => {
    expect(t('***very***')).toEqual([['bolditalic', 'very']])
  })

  it('does not treat a bold run as two italics', () => {
    expect(t('**a** **b**')).toEqual([
      ['bold', 'a'],
      ['text', ' '],
      ['bold', 'b'],
    ])
  })

  it('ignores a stray unmatched asterisk', () => {
    expect(t('5 * apples')).toEqual([['text', '5 * apples']])
    expect(t('a * b')).toEqual([['text', 'a * b']])
  })

  it('handles emphasis mid-sentence and back to back', () => {
    expect(t('see *Alien* then *Aliens*')).toEqual([
      ['text', 'see '],
      ['italic', 'Alien'],
      ['text', ' then '],
      ['italic', 'Aliens'],
    ])
  })

  it('passes plain text straight through', () => {
    expect(t('nothing to see')).toEqual([['text', 'nothing to see']])
    expect(t('')).toEqual([])
  })
})
