'use client'

import { useEffect, useRef, useState } from 'react'
import { CouncilIcon } from './icons'
import { RichText } from './rich-text'

type Mode = 'discuss' | 'check'
type Panel = 'study' | 'rubric'
type Seat = {
  roleName: string
  text: string
  model: string
  ms: number
  failed: boolean
  error: string
}
type Synthesis = {
  text: string
  model: string
  ms: number
  failed: boolean
  error: string
}
type DoneSummary = {
  modelMap: Record<string, string | null>
  totalMs: number
}
type AnswerResult = {
  verdict: 'UNDERSTOOD' | 'NOT_YET'
  explanation: string
  model: string
  ms: number
}

type CouncilEvent =
  | {
      type: 'session_start'
      roster: string[]
    }
  | {
      type: 'panelist'
      index: number
      role_name: string
      text: string
      model: string
      ms: number
    }
  | {
      type: 'panelist_failed'
      index: number
      role_name: string
      error: string
    }
  | {
      type: 'moderator'
      text: string
      model: string
      ms: number
    }
  | {
      type: 'moderator_failed'
      error: string
    }
  | {
      type: 'done'
      model_map: Record<string, string | null>
      total_ms: number
    }
  | {
      type: 'error'
      error: string
    }

const PANELISTS = 4

function createSeats(): Seat[] {
  return Array.from({ length: PANELISTS }, () => ({
    roleName: '',
    text: '',
    model: '',
    ms: 0,
    failed: false,
    error: '',
  }))
}

const EMPTY_SYNTHESIS: Synthesis = {
  text: '',
  model: '',
  ms: 0,
  failed: false,
  error: '',
}

export function StudyCouncil() {
  const [mode, setMode] = useState<Mode>('discuss')
  const [panel, setPanel] = useState<Panel>('study')
  const [concept, setConcept] = useState('')
  const [course, setCourse] = useState('')
  const [explainLang, setExplainLang] = useState('English')
  const [quizLang, setQuizLang] = useState('English')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [language, setLanguage] = useState('English')
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneSummary, setDoneSummary] = useState<DoneSummary | null>(null)
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [discussionStarted, setDiscussionStarted] = useState(false)
  const [seats, setSeats] = useState<Seat[]>(createSeats())
  const [synthesis, setSynthesis] = useState<Synthesis>(EMPTY_SYNTHESIS)
  const abortController = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort()
      }
    }
  }, [])

  const stop = () => {
    if (abortController.current) {
      abortController.current.abort()
    }
    abortController.current = null
    setIsRunning(false)
  }

  const resetOutput = () => {
    setSeats(createSeats())
    setSynthesis({ ...EMPTY_SYNTHESIS })
    setDoneSummary(null)
    setResult(null)
    setError(null)
    setDiscussionStarted(false)
  }

  const changeMode = (nextMode: Mode) => {
    stop()
    setError(null)
    setMode(nextMode)
  }

  const startSession = async () => {
    if (!concept.trim() || !course.trim()) {
      setError('Concept and course are required.')
      return
    }
    if (concept.trim().length > 500 || course.trim().length > 100) {
      setError('Concept must be <=500 chars, course <=100.')
      return
    }
    if (mode === 'discuss') {
      if (!explainLang.trim() || !quizLang.trim()) {
        setError('Explain language and quiz language are required.')
        return
      }
      if (explainLang.trim().length > 64 || quizLang.trim().length > 64) {
        setError('Explain language and quiz language must be <=64 chars.')
        return
      }
    } else {
      if (!question.trim() || !answer.trim() || !language.trim()) {
        setError('Question, answer, and language are required.')
        return
      }
      if (
        question.trim().length > 200 ||
        answer.trim().length > 1000 ||
        language.trim().length > 64
      ) {
        setError('Question <=200, answer <=1000, language <=64 chars.')
        return
      }
    }

    stop()
    resetOutput()

    if (mode === 'discuss') {
      await runDiscussion()
    } else {
      await checkAnswer()
    }
  }

  const handleEvent = (event: CouncilEvent) => {
    switch (event.type) {
      case 'session_start': {
        setSeats((prevSeats) => {
          const newSeats = [...prevSeats]
          event.roster.forEach((roleName, index) => {
            if (index < 4) {
              newSeats[index].roleName = roleName || prevSeats[index].roleName
            }
          })
          return newSeats
        })
        break
      }
      case 'panelist': {
        if (Number.isInteger(event.index) && event.index >= 0 && event.index < 4) {
          setSeats((prevSeats) => {
            const newSeats = [...prevSeats]
            newSeats[event.index] = {
              roleName: event.role_name,
              text: event.text,
              model: event.model,
              ms: event.ms,
              failed: false,
              error: '',
            }
            return newSeats
          })
        }
        break
      }
      case 'panelist_failed': {
        if (Number.isInteger(event.index) && event.index >= 0 && event.index < 4) {
          setSeats((prevSeats) => {
            const newSeats = [...prevSeats]
            newSeats[event.index] = {
              roleName: event.role_name,
              text: '',
              model: '',
              ms: 0,
              failed: true,
              error: event.error,
            }
            return newSeats
          })
        }
        break
      }
      case 'moderator': {
        setSynthesis({
          text: event.text,
          model: event.model,
          ms: event.ms,
          failed: false,
          error: '',
        })
        break
      }
      case 'moderator_failed': {
        setSynthesis({
          text: '',
          model: '',
          ms: 0,
          failed: true,
          error: event.error + ' The individual perspectives above remain available.',
        })
        break
      }
      case 'done': {
        setDoneSummary({
          modelMap: event.model_map,
          totalMs: event.total_ms,
        })
        break
      }
      case 'error': {
        setError(event.error)
        break
      }
    }
  }

  const runDiscussion = async () => {
    const controller = new AbortController()
    abortController.current = controller
    setDiscussionStarted(true)
    setIsRunning(true)
    const parseLine = (line: string) => {
      const value = JSON.parse(line) as unknown
      if (typeof value !== 'object' || value === null) {
        throw new Error('Invalid event format')
      }
      if (!('type' in value)) {
        throw new Error('Invalid event format')
      }
      if (typeof (value as Record<string, unknown>).type !== 'string') {
        throw new Error('Invalid event format')
      }
      return value as CouncilEvent
    }
    try {
      const response = await fetch('/api/council/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          concept: concept.trim(),
          course: course.trim(),
          panel,
          explain_language: explainLang.trim(),
          quiz_language: quizLang.trim(),
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        if (response.status === 400) {
          let errorData: unknown
          try {
            errorData = await response.json()
          } catch {
            setError('No response from the server.')
            return
          }
          if (
            typeof errorData !== 'object' ||
            errorData === null ||
            typeof (errorData as Record<string, unknown>).error !== 'string'
          ) {
            setError('No response from the server.')
            return
          }
          setError((errorData as Record<string, unknown>).error as string)
          return
        } else if (response.status === 502) {
          setError('The council could not reach its models. If you are on the ASU VPN, try again.')
          return
        } else {
          setError('No response from the server.')
          return
        }
      }
      if (!response.body) {
        setError('No response from the server.')
        return
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          buffer += decoder.decode()
          break
        }
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.trim()) {
            handleEvent(parseLine(line))
          }
        }
      }
      if (buffer.trim()) {
        handleEvent(parseLine(buffer))
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      setError('No response from the server.')
    } finally {
      if (abortController.current === controller) {
        abortController.current = null
        setIsRunning(false)
      }
    }
  }

  const checkAnswer = async () => {
    const controller = new AbortController()
    abortController.current = controller
    setIsRunning(true)
    try {
      const response = await fetch('/api/council/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: concept.trim(),
          course: course.trim(),
          panel,
          question: question.trim(),
          answer: answer.trim(),
          explain_language: language.trim(),
          quiz_language: language.trim(),
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        if (response.status === 400) {
          let value: unknown
          try {
            value = await response.json()
          } catch {
            setError('No response from the server.')
            return
          }
          if (
            typeof value === 'object' &&
            value !== null &&
            typeof (value as Record<string, unknown>).error === 'string'
          ) {
            setError((value as Record<string, unknown>).error as string)
          } else {
            setError('No response from the server.')
          }
          return
        }
        if (response.status === 502) {
          setError('The council could not reach its models. If you are on the ASU VPN, try again.')
          return
        }
        setError('No response from the server.')
        return
      }
      const value: unknown = await response.json()
      if (typeof value !== 'object' || value === null) {
        setError('No response from the server.')
        return
      }
      const record = value as Record<string, unknown>
      const verdict = typeof record.verdict === 'string' ? record.verdict : null
      const explanation = typeof record.explanation === 'string' ? record.explanation : null
      const model = typeof record.model === 'string' ? record.model : null
      const ms = typeof record.ms === 'number' ? record.ms : null
      if (verdict !== 'UNDERSTOOD' && verdict !== 'NOT_YET') {
        setError('No response from the server.')
        return
      }
      if (
        typeof explanation !== 'string' ||
        typeof model !== 'string' ||
        ms === null ||
        !Number.isFinite(ms)
      ) {
        setError('No response from the server.')
        return
      }
      setResult({
        verdict,
        explanation,
        model,
        ms,
      })
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      setError('No response from the server.')
    } finally {
      if (abortController.current === controller) {
        abortController.current = null
        setIsRunning(false)
      }
    }
  }

  return (
    <div className="thin-scroll relative z-10 flex w-full flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[820px] px-5 pt-6 pb-12">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#3a1723] text-[#ffc627]">
            <CouncilIcon className="size-[22px]" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[20px] font-medium tracking-[-0.02em] text-white">
              Study council
            </h1>
            <p className="text-muted text-[13px]">
              {mode === 'discuss' ? 'Learn a concept' : 'Check my answer'}
            </p>
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.02] p-0">
          <div className="flex">
            <button
              type="button"
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-white/20 ${
                mode === 'discuss'
                  ? 'text-fg bg-white/[0.02] border-b-2 border-[#ffc627]'
                  : 'text-muted hover:text-fg'
              }`}
              aria-pressed={mode === 'discuss'}
              onClick={() => changeMode('discuss')}
            >
              Learn a concept
            </button>
            <button
              type="button"
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-white/20 ${
                mode === 'check'
                  ? 'text-fg bg-white/[0.02] border-b-2 border-[#ffc627]'
                  : 'text-muted hover:text-fg'
              }`}
              aria-pressed={mode === 'check'}
              onClick={() => changeMode('check')}
            >
              Check my answer
            </button>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="concept" className="block text-sm font-medium text-fg mb-1">
                Concept or topic
              </label>
              <input
                id="concept"
                type="text"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                disabled={isRunning}
                required
                maxLength={500}
                className="w-full px-3 py-2 bg-[#282828] border border-white/8 rounded-full text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="course" className="block text-sm font-medium text-fg mb-1">
                Course or subject
              </label>
              <input
                id="course"
                type="text"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                disabled={isRunning}
                required
                maxLength={100}
                className="w-full px-3 py-2 bg-[#282828] border border-white/8 rounded-full text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
              />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-fg">Council approach</legend>
            <div className="flex gap-2">
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 focus-visible:ring-2 focus-visible:ring-white/20 ${
                  panel === 'study'
                    ? 'bg-[#ffc627] text-[#1b1b1b]'
                    : 'bg-[#282828] text-fg hover:bg-[#3a3a3a]'
                }`}
                aria-pressed={panel === 'study'}
                onClick={() => setPanel('study')}
                disabled={isRunning}
                title="Explain from four teaching perspectives"
              >
                Teaching perspectives
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 focus-visible:ring-2 focus-visible:ring-white/20 ${
                  panel === 'rubric'
                    ? 'bg-[#ffc627] text-[#1b1b1b]'
                    : 'bg-[#282828] text-fg hover:bg-[#3a3a3a]'
                }`}
                aria-pressed={panel === 'rubric'}
                onClick={() => setPanel('rubric')}
                disabled={isRunning}
                title="Evaluate from four rubric perspectives"
              >
                Rubric feedback
              </button>
            </div>
          </fieldset>

          {mode === 'discuss' && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-fg mb-1">
                Language options
              </summary>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="explainLang" className="block text-sm font-medium text-fg mb-1">
                    Explanation language
                  </label>
                  <input
                    id="explainLang"
                    type="text"
                    value={explainLang}
                    onChange={(e) => setExplainLang(e.target.value)}
                    disabled={isRunning}
                    required
                    maxLength={64}
                    className="w-full px-3 py-2 bg-[#282828] border border-white/8 rounded-full text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label htmlFor="quizLang" className="block text-sm font-medium text-fg mb-1">
                    Follow-up language
                  </label>
                  <input
                    id="quizLang"
                    type="text"
                    value={quizLang}
                    onChange={(e) => setQuizLang(e.target.value)}
                    disabled={isRunning}
                    required
                    maxLength={64}
                    className="w-full px-3 py-2 bg-[#282828] border border-white/8 rounded-full text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
                  />
                </div>
              </div>
            </details>
          )}

          {mode === 'check' && (
            <>
              <div>
                <label htmlFor="question" className="block text-sm font-medium text-fg mb-1">
                  Question
                </label>
                <input
                  id="question"
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={isRunning}
                  required
                  maxLength={200}
                  className="w-full px-3 py-2 bg-[#282828] border border-white/8 rounded-full text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
                />
              </div>
              <div>
                <label htmlFor="answer" className="block text-sm font-medium text-fg mb-1">
                  Your answer
                </label>
                <textarea
                  id="answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={isRunning}
                  required
                  maxLength={1000}
                  rows={3}
                  className="w-full px-3 py-2 bg-[#282828] border border-white/8 rounded-xl text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 resize-none"
                />
              </div>
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-fg mb-1">
                  Language options
                </summary>
                <div className="mt-2">
                  <label htmlFor="checkLang" className="block text-sm font-medium text-fg mb-1">
                    Feedback language
                  </label>
                  <input
                    id="checkLang"
                    type="text"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={isRunning}
                    required
                    maxLength={64}
                    className="w-full px-3 py-2 bg-[#282828] border border-white/8 rounded-full text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
                  />
                </div>
              </details>
            </>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={startSession}
              disabled={isRunning}
              className="px-6 py-2 bg-[#ffc627] text-[#1b1b1b] text-sm font-medium rounded-full hover:bg-[#ff8f8f] focus:outline-none focus:ring-2 focus:ring-white/20 focus-visible:ring-2 focus-visible:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#1b1b1b] border-t-transparent"></span>
                  Council is working
                </span>
              ) : mode === 'discuss' ? (
                'Ask the council'
              ) : (
                'Check my answer'
              )}
            </button>
            {isRunning && (
              <button
                type="button"
                onClick={stop}
                className="px-6 py-2 bg-[#3a1723] text-[#ff8f8f] text-sm font-medium rounded-full hover:bg-[#281017] focus:outline-none focus:ring-2 focus:ring-white/20 focus-visible:ring-2 focus-visible:ring-white/20 transition-colors"
              >
                Stop
              </button>
            )}
          </div>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="p-4 bg-[#3a1723] border border-[#ff8f8f]/30 text-[#ff8f8f] text-sm rounded-lg"
            >
              {error}
            </div>
          )}

          {result && mode === 'check' && (
            <div
              role="alert"
              aria-live="polite"
              className={`p-4 border rounded-lg text-sm ${
                result.verdict === 'UNDERSTOOD'
                  ? 'bg-green-900/30 border-green-500/30 text-green-100'
                  : 'bg-[#ffc627]/10 border-[#ffc627]/30 text-[#ffe18a]'
              }`}
            >
              <div className="font-medium mb-1">
                {result.verdict === 'UNDERSTOOD' ? 'Understood' : 'Not yet'}
              </div>
              <RichText text={result.explanation} />
              <div className="text-xs text-muted mt-2">
                Model: {result.model} · {result.ms}ms
              </div>
            </div>
          )}

          {mode === 'discuss' && discussionStarted && (
            <div className="space-y-4" aria-live="polite">
              <div className="text-xs uppercase text-muted tracking-wider">Council responses</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {seats.map((seat, i) => (
                  <div key={i} className="bg-[#282828]/60 border border-white/8 rounded-lg p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <CouncilIcon className="size-4 shrink-0" />
                      <span className="text-sm font-medium text-fg truncate">
                        {seat.roleName || `Panelist ${i + 1}`}
                      </span>
                      {seat.model && <span className="text-xs text-muted">via {seat.model}</span>}
                      {seat.ms > 0 && <span className="text-xs text-muted">· {seat.ms}ms</span>}
                    </div>
                    {seat.failed ? (
                      <div className="text-[#ff8f8f] text-sm">{seat.error}</div>
                    ) : seat.text ? (
                      <RichText text={seat.text} />
                    ) : (
                      <div className="text-muted text-sm">Waiting...</div>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-[#282828]/60 border border-white/8 rounded-lg p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <CouncilIcon className="size-4" />
                  <span className="text-sm font-medium text-fg">Council synthesis</span>
                  {synthesis.model && (
                    <span className="text-xs text-muted">via {synthesis.model}</span>
                  )}
                  {synthesis.ms > 0 && (
                    <span className="text-xs text-muted">· {synthesis.ms}ms</span>
                  )}
                </div>
                {synthesis.failed ? (
                  <div className="text-[#ff8f8f] text-sm">{synthesis.error}</div>
                ) : synthesis.text ? (
                  <RichText text={synthesis.text} />
                ) : (
                  <div className="text-muted text-sm">Waiting for panel...</div>
                )}
              </div>

              {doneSummary && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <div className="text-green-100 text-sm">
                    <div className="font-medium mb-1">Council session complete</div>
                    <div className="space-y-1 text-xs">
                      {Object.entries(doneSummary.modelMap).map(([role, model]) => (
                        <div key={role}>
                          {role}: <span className="text-muted">{model || 'unavailable'}</span>
                        </div>
                      ))}
                      <div>Total time: {doneSummary.totalMs}ms</div>
                    </div>
                    <button
                      type="button"
                      onClick={resetOutput}
                      className="mt-2 px-4 py-1 bg-[#ffc627] text-[#1b1b1b] text-xs font-medium rounded-full hover:bg-[#ff8f8f] focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors"
                    >
                      Discuss another concept
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
