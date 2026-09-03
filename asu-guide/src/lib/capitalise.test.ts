import { describe, expect, it } from 'vitest'
import { capitaliseReply } from './capitalise'

describe('capitaliseReply', () => {
  it('capitalises an ordinary lowercase opening', () => {
    expect(capitaliseReply('hpc stands for high performance computing.')).toBe(
      'Hpc stands for high performance computing.',
    )
  })

  it('leaves an already-capital reply alone', () => {
    expect(capitaliseReply('Hi Azhar, here is what is on.')).toBe('Hi Azhar, here is what is on.')
  })

  it('leaves a backticked code token alone', () => {
    expect(capitaliseReply('`npm install` will do it.')).toBe('`npm install` will do it.')
  })

  it('leaves identifiers, paths and flags alone', () => {
    expect(capitaliseReply('npm-run-all is the package.')).toBe('npm-run-all is the package.')
    expect(capitaliseReply('src/lib/events.ts holds it.')).toBe('src/lib/events.ts holds it.')
    expect(capitaliseReply('--force skips the check.')).toBe('--force skips the check.')
    expect(capitaliseReply('snake_case is the convention.')).toBe('snake_case is the convention.')
    expect(capitaliseReply('python3 is installed.')).toBe('python3 is installed.')
  })

  it('handles leading whitespace without eating it', () => {
    expect(capitaliseReply('\n  hello there')).toBe('\n  Hello there')
  })

  it('leaves non-letter and empty openings alone', () => {
    expect(capitaliseReply('')).toBe('')
    expect(capitaliseReply('   ')).toBe('   ')
    expect(capitaliseReply('42 events today.')).toBe('42 events today.')
    expect(capitaliseReply('¿qué tal?')).toBe('¿qué tal?')
  })

  it('capitalises a single lowercase word', () => {
    expect(capitaliseReply('yes')).toBe('Yes')
  })
})
