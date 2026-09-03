'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, Chevron, SearchIcon } from '@/components/icons'

export type Option = { value: string; label: string; group?: string; note?: string }

/**
 * A listbox, not a native <select>.
 *
 * Native selects cannot be styled on macOS — the popup is drawn by the OS in
 * system colours, which on a black dashboard reads as a bug. This keeps the
 * theme and adds what the catalog needs: grouping (recommended first), a filter
 * once the list is long, and full keyboard control.
 */
export function Select({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  label,
  disabled,
}: {
  value: string | null
  options: Option[]
  onChange: (value: string) => void
  placeholder?: string
  label: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const id = useId()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  }, [options, query])

  const selected = options.find((o) => o.value === value) ?? null

  /** Group header for row i, or null when it continues the group above it. */
  const headings = useMemo(
    () => filtered.map((o, i) => (o.group && o.group !== filtered[i - 1]?.group ? o.group : null)),
    [filtered],
  )

  // Closing on an outside click has to be pointerdown: a click listener fires
  // after the button's own onClick and would reopen what it just closed.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  // Focus only. The query and highlight are reset by whoever opens the list, so
  // opening does not cost an extra render pass.
  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  function openList() {
    setQuery('')
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    )
    setOpen(true)
  }

  // Keep the highlighted row visible while arrowing through a long catalog.
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function commit(i: number) {
    const opt = filtered[i]
    if (!opt) return
    onChange(opt.value)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        openList()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(filtered.length - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      commit(active)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div ref={root} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : openList())}
        className={`flex w-full items-center gap-2 rounded-2xl border px-4 py-3 text-left transition-colors ${
          open ? 'border-white/20 bg-[#202124]' : 'border-white/10 bg-[#131314] hover:bg-[#18191a]'
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span
          className={`min-w-0 flex-1 truncate font-mono text-[13.5px] ${
            selected ? 'text-white' : 'text-muted'
          }`}
        >
          {selected?.label ?? placeholder}
        </span>
        {selected?.note && (
          <span className="text-muted shrink-0 rounded-full border border-white/12 px-2 py-0.5 text-[10.5px] tracking-[0.04em] uppercase">
            {selected.note}
          </span>
        )}
        <Chevron
          className={`text-muted size-[16px] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="animate-sheet-in absolute top-[calc(100%+6px)] right-0 left-0 z-30 overflow-hidden rounded-2xl border border-white/10 bg-[#202124] shadow-xl shadow-black/60">
          <div className="flex items-center gap-2 border-b border-white/8 px-3.5 py-2.5">
            <SearchIcon className="text-muted size-[15px] shrink-0" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              placeholder="Filter models"
              aria-label={`Filter ${label}`}
              aria-controls={id}
              className="text-fg placeholder:text-muted min-w-0 flex-1 bg-transparent text-[13.5px] outline-none"
            />
          </div>

          <div
            ref={listRef}
            id={id}
            role="listbox"
            aria-label={label}
            className="thin-scroll max-h-[280px] overflow-y-auto py-1.5"
          >
            {filtered.length === 0 && (
              <p className="text-muted px-4 py-3 text-[13px]">Nothing matches that.</p>
            )}
            {filtered.map((o, i) => {
              const header = headings[i]
              return (
                <div key={o.value}>
                  {header && (
                    <p className="text-muted px-4 pt-2 pb-1 text-[11px] tracking-[0.06em] uppercase">
                      {header}
                    </p>
                  )}
                  <div
                    role="option"
                    aria-selected={o.value === value}
                    data-idx={i}
                    tabIndex={-1}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => commit(i)}
                    className={`flex cursor-pointer items-center gap-2 px-4 py-2 font-mono text-[13px] ${
                      i === active ? 'bg-white/8' : ''
                    } ${o.value === value ? 'text-white' : 'text-fg'}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.note && (
                      <span className="text-muted shrink-0 font-sans text-[10.5px] tracking-[0.04em] uppercase">
                        {o.note}
                      </span>
                    )}
                    {o.value === value && <Check className="text-asu-gold size-[15px] shrink-0" />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
