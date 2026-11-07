'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'

const MONTHS_FR = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']
const MONTHS_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const DAYS_FR = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']
const PRESETS = [
  { label: "Aujourd'hui", value: 'today' },
  { label: 'Hier', value: 'yesterday' },
  { label: '7 jours', value: '7d' },
  { label: '30 jours', value: '30d' },
  { label: 'Ce mois', value: 'month' },
  { label: 'Mois dernier', value: 'lastmonth' },
]

const STORAGE_KEY = 'shopsaas-daterange'

function saveRange(range: string, from?: string, to?: string) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ range, from: from ?? '', to: to ?? '' })) } catch { /* silent */ }
}

function loadRange() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as { range: string; from: string; to: string } : null
  } catch { return null }
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatShort(value: string) {
  if (!value) return ''
  return new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function MonthGrid({ month, from, to, hovering, onPick, onHover }: {
  month: Date; from: string; to: string; hovering: string
  onPick: (v: string) => void; onHover: (v: string) => void
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
    <div className="w-full min-w-[260px]">
      <p className="mb-2 text-center text-sm font-bold text-zinc-800">{MONTHS_FULL[m]} {year}</p>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {DAYS_FR.map(d => <span key={d} className="py-1 text-[11px] font-semibold text-zinc-400">{d}</span>)}
        {cells.map((v, i) => {
          if (!v) return <span key={`e-${i}`} />
          const isFrom = v === from
          const isTo = v === to
          const effectiveTo = to || hovering
          const inRange = from && effectiveTo && v > from && v < effectiveTo
          return (
            <button
              key={v}
              type="button"
              onClick={() => onPick(v)}
              onMouseEnter={() => onHover(v)}
              className={[
                'h-9 w-full text-sm font-semibold transition-colors rounded-full',
                isFrom || isTo ? 'bg-violet-600 text-white' : inRange ? 'bg-violet-100 text-violet-800' : 'text-zinc-700 hover:bg-violet-50',
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

  // Restaurer depuis localStorage si l'URL n'a pas de range
  useEffect(() => {
    if (params.get('range')) return
    const saved = loadRange()
    if (!saved || saved.range === '7d') return
    const next = new URLSearchParams(params.toString())
    next.set('range', saved.range)
    if (saved.from) next.set('from', saved.from)
    if (saved.to) next.set('to', saved.to)
    router.replace(`?${next.toString()}`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return () => { document.removeEventListener('mousedown', handler); document.body.style.overflow = '' }
  }, [open, mobile, fromParam, toParam])

  function pushParams(next: URLSearchParams) { router.push(`?${next.toString()}`) }

  function setRange(range: string) {
    const next = new URLSearchParams(params.toString())
    next.set('range', range); next.delete('from'); next.delete('to')
    saveRange(range)
    pushParams(next)
    setOpen(false)
  }

  function pickDate(value: string) {
    if (!draftFrom || (draftFrom && draftTo)) { setDraftFrom(value); setDraftTo(''); return }
    if (value < draftFrom) { setDraftTo(draftFrom); setDraftFrom(value); return }
    setDraftTo(value)
  }

  function applyCustom() {
    if (!draftFrom) return
    const next = new URLSearchParams(params.toString())
    next.set('range', 'custom'); next.set('from', draftFrom)
    if (draftTo) next.set('to', draftTo); else next.delete('to')
    saveRange('custom', draftFrom, draftTo || undefined)
    pushParams(next)
    setOpen(false)
  }

  const activePreset = PRESETS.find(p => p.value === current)
  let displayLabel = activePreset?.label ?? 'Période'
  if (current === 'custom') {
    if (fromParam && toParam) displayLabel = `${formatShort(fromParam)} – ${formatShort(toParam)}`
    else if (fromParam) displayLabel = `Depuis ${formatShort(fromParam)}`
    else displayLabel = 'Personnalisée'
  }

  /* ── Presets ── */
  const presetList = (
    <div className={mobile
      ? 'flex gap-2 overflow-x-auto px-4 pb-3 pt-1 scrollbar-none'
      : 'flex w-36 flex-col gap-0.5 border-r border-zinc-100 p-2'
    }>
      {PRESETS.map(preset => (
        <button
          key={preset.value}
          type="button"
          onClick={() => setRange(preset.value)}
          className={[
            mobile
              ? 'shrink-0 rounded-full px-3.5 py-2 text-xs font-bold whitespace-nowrap border'
              : 'w-full rounded-lg px-3 py-2 text-left text-sm font-semibold',
            current === preset.value
              ? 'bg-violet-600 text-white border-violet-600'
              : 'text-zinc-700 hover:bg-zinc-100 border-zinc-200',
          ].join(' ')}
        >
          {preset.label}
        </button>
      ))}
    </div>
  )

  /* ── Calendrier ── */
  const calendarSection = (
    <div className="flex flex-1 flex-col p-3">
      {/* Du / Au */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Du</p>
          <p className="text-sm font-bold text-zinc-800">{draftFrom ? formatShort(draftFrom) : '—'}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Au</p>
          <p className="text-sm font-bold text-zinc-800">{draftTo ? formatShort(draftTo) : '—'}</p>
        </div>
      </div>

      {/* Navigation mois */}
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setLeftMonth(new Date(leftMonth.getFullYear(), leftMonth.getMonth() - 1, 1))} className="flex size-8 items-center justify-center rounded-lg hover:bg-zinc-100">
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-xs font-semibold text-zinc-500">
          {!draftFrom ? 'Choisis la date de début' : !draftTo ? 'Choisis la date de fin' : `${formatShort(draftFrom)} – ${formatShort(draftTo)}`}
        </p>
        <button type="button" onClick={() => setLeftMonth(new Date(leftMonth.getFullYear(), leftMonth.getMonth() + 1, 1))} className="flex size-8 items-center justify-center rounded-lg hover:bg-zinc-100">
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Grilles */}
      <div className="flex gap-4" onMouseLeave={() => setHovering('')}>
        <MonthGrid month={leftMonth} from={draftFrom} to={draftTo} hovering={hovering} onPick={pickDate} onHover={setHovering} />
        {!mobile && (
          <MonthGrid month={rightMonth} from={draftFrom} to={draftTo} hovering={hovering} onPick={pickDate} onHover={setHovering} />
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
        <button type="button" onClick={() => { setDraftFrom(''); setDraftTo('') }} className="text-sm font-semibold text-zinc-400 hover:text-zinc-600">
          Effacer
        </button>
        <button type="button" disabled={!draftFrom} onClick={applyCustom} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40 hover:bg-violet-700 transition">
          Appliquer
        </button>
      </div>
    </div>
  )

  return (
    <div className={`relative ${mobile ? 'w-full' : ''}`} ref={dropdownRef}>
      {/* Bouton déclencheur */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:border-zinc-300 transition md:w-auto"
      >
        <CalendarDays className="size-4 shrink-0 text-violet-500" />
        <span className="truncate">{displayLabel}</span>
      </button>

      {/* Desktop dropdown */}
      {open && !mobile && (
        <div className={`absolute top-11 z-50 flex overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl ${align === 'left' ? 'left-0' : 'right-0'}`}
          style={{ minWidth: 560 }}>
          {presetList}
          {calendarSection}
        </div>
      )}

      {/* Mobile bottom sheet */}
      {open && mobile && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[80] flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 rounded-t-3xl bg-white">
              <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-zinc-200" />
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-base font-bold text-zinc-900">Période</p>
                <button type="button" onClick={() => setOpen(false)} className="flex size-8 items-center justify-center rounded-full bg-zinc-100">
                  <X className="size-4" />
                </button>
              </div>
              {presetList}
            </div>
            {calendarSection}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
