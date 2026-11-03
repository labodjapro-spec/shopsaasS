'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'

const MONTHS_FR = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre']
const DAYS_FR = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']
const PRESETS = [
  { label: "Aujourd'hui", value: 'today' },
  { label: 'Hier', value: 'yesterday' },
  { label: '7 derniers jours', value: '7d' },
  { label: '30 derniers jours', value: '30d' },
  { label: 'Ce mois-ci', value: 'month' },
  { label: 'Mois dernier', value: 'lastmonth' },
]

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatShort(value: string) {
  if (!value) return ''
  return new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function MonthGrid({
  month, from, to, hovering, onPick, onHover,
}: {
  month: Date
  from: string
  to: string
  hovering: string
  onPick: (v: string) => void
  onHover: (v: string) => void
}) {
  const year = month.getFullYear()
  const m = month.getMonth()
  const firstDay = new Date(year, m, 1)
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  const offset = (firstDay.getDay() + 6) % 7
  const cells: (string | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(isoDate(new Date(year, m, d)))
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="w-full">
      <p className="mb-3 text-center text-sm font-semibold text-zinc-800">
        {MONTHS_FR[m]} {year}
      </p>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {DAYS_FR.map(d => (
          <span key={d} className="py-1 text-[11px] font-medium text-zinc-400">{d}</span>
        ))}
        {cells.map((v, i) => {
          if (!v) return <span key={`e-${i}`} />
          const isFrom = v === from
          const isTo = v === to
          const isEndpoint = isFrom || isTo
          const effectiveTo = to || hovering
          const inRange = from && effectiveTo && v > from && v < effectiveTo
          return (
            <button
              key={v}
              type="button"
              onClick={() => onPick(v)}
              onMouseEnter={() => onHover(v)}
              className={[
                'h-11 text-sm font-semibold transition-colors',
                isEndpoint ? 'bg-violet-600 text-white' : inRange ? 'bg-violet-100 text-violet-800' : 'text-zinc-700 hover:bg-violet-50',
                isFrom && (to || hovering) ? 'rounded-l-full' : 'rounded-full',
                isTo && from ? 'rounded-r-full' : '',
              ].join(' ')}
            >
              {parseInt(v.slice(-2), 10)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DateRange({ compact = false, align = 'right' }: { compact?: boolean; align?: 'left' | 'right' }) {
  const router = useRouter()
  const params = useSearchParams()
  const current = params.get('range') ?? '7d'
  const fromParam = params.get('from') ?? ''
  const toParam = params.get('to') ?? ''
  const [open, setOpen] = useState(false)
  const [hovering, setHovering] = useState('')
  const [mobile, setMobile] = useState(false)
  const [draftFrom, setDraftFrom] = useState(fromParam)
  const [draftTo, setDraftTo] = useState(toParam)
  const [leftMonth, setLeftMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const rightMonth = new Date(leftMonth.getFullYear(), leftMonth.getMonth() + 1, 1)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sync = () => setMobile(window.innerWidth < 768)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  useEffect(() => {
    if (!open) return
    setDraftFrom(fromParam)
    setDraftTo(toParam)
    const handler = (e: MouseEvent) => {
      if (!mobile && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.body.style.overflow = mobile ? 'hidden' : ''
    return () => {
      document.removeEventListener('mousedown', handler)
      document.body.style.overflow = ''
    }
  }, [open, mobile, fromParam, toParam])

  function pushParams(next: URLSearchParams) {
    router.push(`?${next.toString()}`)
  }

  function setRange(range: string) {
    const next = new URLSearchParams(params.toString())
    next.set('range', range)
    next.delete('from')
    next.delete('to')
    pushParams(next)
    setOpen(false)
  }

  function pickDate(value: string) {
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(value)
      setDraftTo('')
      return
    }
    if (value < draftFrom) {
      setDraftTo(draftFrom)
      setDraftFrom(value)
      return
    }
    setDraftTo(value)
  }

  function applyCustom() {
    if (!draftFrom) return
    const next = new URLSearchParams(params.toString())
    next.set('range', 'custom')
    next.set('from', draftFrom)
    if (draftTo) next.set('to', draftTo)
    else next.delete('to')
    pushParams(next)
    setOpen(false)
  }

  const activePreset = PRESETS.find(p => p.value === current)
  let displayLabel = activePreset?.label ?? 'Periode'
  if (current === 'custom') {
    if (fromParam && toParam) displayLabel = `${formatShort(fromParam)} - ${formatShort(toParam)}`
    else if (fromParam) displayLabel = `Depuis ${formatShort(fromParam)}`
    else displayLabel = 'Personnalisee'
  }

  const presets = (
    <div className={mobile ? 'flex gap-2 overflow-x-auto px-4 pb-1' : 'flex min-w-[168px] flex-col gap-1 border-r border-zinc-100 bg-zinc-50 p-3'}>
      {PRESETS.map(preset => (
        <button
          key={preset.value}
          type="button"
          onClick={() => setRange(preset.value)}
          className={`${mobile ? 'shrink-0 rounded-full bg-zinc-100 px-3 py-2' : 'w-full rounded-xl px-3 py-2.5 text-left hover:bg-white'} text-sm font-semibold ${
            current === preset.value && current !== 'custom'
              ? 'bg-violet-600 text-white hover:bg-violet-600'
              : 'text-zinc-700'
          }`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  )

  const calendar = (
    <div className="flex flex-1 flex-col p-4">
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Du</p>
          <p className="text-sm font-bold text-zinc-800">{draftFrom ? formatShort(draftFrom) : 'Date de debut'}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Au</p>
          <p className="text-sm font-bold text-zinc-800">{draftTo ? formatShort(draftTo) : 'Date de fin'}</p>
        </div>
      </div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setLeftMonth(new Date(leftMonth.getFullYear(), leftMonth.getMonth() - 1, 1))} className="flex size-10 items-center justify-center rounded-full hover:bg-zinc-100">
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-sm font-semibold text-zinc-800">
          {!draftFrom ? 'Choisis la date de debut' : !draftTo ? 'Choisis la date de fin' : `${formatShort(draftFrom)} - ${formatShort(draftTo)}`}
        </p>
        <button type="button" onClick={() => setLeftMonth(new Date(leftMonth.getFullYear(), leftMonth.getMonth() + 1, 1))} className="flex size-10 items-center justify-center rounded-full hover:bg-zinc-100">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className={`flex gap-6 ${mobile ? 'justify-center' : ''}`} onMouseLeave={() => setHovering('')}>
        <MonthGrid month={leftMonth} from={draftFrom} to={draftTo} hovering={hovering} onPick={pickDate} onHover={setHovering} />
        {!mobile && (
          <div className="hidden sm:block">
            <MonthGrid month={rightMonth} from={draftFrom} to={draftTo} hovering={hovering} onPick={pickDate} onHover={setHovering} />
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
        <button
          type="button"
          onClick={() => { setDraftFrom(''); setDraftTo('') }}
          className="text-sm font-semibold text-zinc-500"
        >
          Effacer
        </button>
        <button
          type="button"
          disabled={!draftFrom}
          onClick={applyCustom}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Appliquer
        </button>
      </div>
    </div>
  )

  return (
    <div className={`relative ${mobile ? 'w-full' : ''}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full max-w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 shadow-sm md:w-auto"
      >
        <CalendarDays className="size-4 shrink-0 text-zinc-400" />
        <span className="truncate">{compact ? displayLabel : displayLabel}</span>
      </button>

      {open && !mobile && (
        <div className={`absolute top-12 z-50 flex overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl ${align === 'left' ? 'left-0' : 'right-0'}`}>
          {presets}
          {calendar}
        </div>
      )}

      {open && mobile && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[80] flex items-end bg-black/40 md:hidden" onClick={() => setOpen(false)}>
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="sticky top-0 z-10 rounded-t-3xl bg-white">
              <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-zinc-200" />
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-base font-bold">Periode</p>
                <button type="button" onClick={() => setOpen(false)} className="flex size-9 items-center justify-center rounded-full bg-zinc-100" aria-label="Fermer">
                  <X className="size-4" />
                </button>
              </div>
              {presets}
            </div>
            {calendar}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
