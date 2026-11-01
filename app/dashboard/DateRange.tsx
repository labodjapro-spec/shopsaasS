'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS_FR = ['Lu','Ma','Me','Je','Ve','Sa','Di']

const PRESETS = [
  { label: "Aujourd'hui", value: 'today' },
  { label: 'Hier', value: 'yesterday' },
  { label: '7 derniers jours', value: '7d' },
  { label: '30 derniers jours', value: '30d' },
  { label: 'Ce mois-ci', value: 'month' },
  { label: 'Mois dernier', value: 'lastmonth' },
]

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

interface MonthGridProps {
  month: Date
  from: string
  to: string
  hovering: string
  onPick: (v: string) => void
  onHover: (v: string) => void
}

function MonthGrid({ month, from, to, hovering, onPick, onHover }: MonthGridProps) {
  const year = month.getFullYear()
  const m = month.getMonth()
  const firstDay = new Date(year, m, 1)
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  const offset = (firstDay.getDay() + 6) % 7 // Mon=0

  const cells: (string | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(isoDate(new Date(year, m, d)))
  }
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="min-w-[224px]">
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
                'relative py-1.5 text-xs font-medium transition-colors rounded-lg',
                isEndpoint
                  ? 'bg-violet-600 text-white'
                  : inRange
                    ? 'bg-violet-100 text-violet-800'
                    : 'text-zinc-700 hover:bg-violet-50 hover:text-violet-700',
                isFrom ? 'rounded-l-full' : '',
                isTo ? 'rounded-r-full' : '',
              ].join(' ')}
            >
              {parseInt(v.slice(-2))}
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
  const [leftMonth, setLeftMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() - 1, 1)
  })
  const rightMonth = new Date(leftMonth.getFullYear(), leftMonth.getMonth() + 1, 1)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fermer si clic dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function setRange(range: string) {
    const next = new URLSearchParams(params.toString())
    next.set('range', range)
    next.delete('from')
    next.delete('to')
    router.push(`?${next.toString()}`)
    setOpen(false)
  }

  function pickDate(value: string) {
    const next = new URLSearchParams(params.toString())
    next.set('range', 'custom')
    if (!fromParam || (fromParam && toParam)) {
      next.set('from', value)
      next.delete('to')
    } else if (value < fromParam) {
      next.set('from', value)
      next.set('to', fromParam)
      setOpen(false)
    } else {
      next.set('to', value)
      setOpen(false)
    }
    router.push(`?${next.toString()}`)
  }

  // Label affiché dans le bouton
  const activePreset = PRESETS.find(p => p.value === current)
  let displayLabel = activePreset?.label ?? 'Période'
  if (current === 'custom') {
    if (fromParam && toParam) {
      const fmt = (s: string) => new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      displayLabel = `${fmt(fromParam)} → ${fmt(toParam)}`
    } else if (fromParam) {
      displayLabel = `À partir du ${new Date(fromParam).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
    } else {
      displayLabel = 'Personnalisée'
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:border-violet-300 hover:text-violet-700 transition-colors"
      >
        <CalendarDays className="size-4 text-zinc-400" />
        <span>{compact ? 'Période' : displayLabel}</span>
        <span className="text-xs text-violet-600 font-semibold">{compact ? displayLabel : ''}</span>
        <ChevronRight className={`size-4 text-zinc-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className={`absolute top-11 z-50 flex flex-col sm:flex-row gap-0 rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden ${align === 'left' ? 'left-0' : 'right-0'}`}
          style={{ minWidth: 'min(100vw - 1rem, 520px)', maxWidth: '100vw' }}>
          {/* Colonne gauche — presets */}
          <div className="border-b sm:border-b-0 sm:border-r border-zinc-100 p-3 sm:min-w-[160px] bg-zinc-50/60">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 px-2">Raccourcis</p>
            {PRESETS.map(preset => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setRange(preset.value)}
                className={`w-full text-left rounded-xl px-3 py-2 text-sm transition-colors mb-0.5 ${
                  current === preset.value && current !== 'custom'
                    ? 'bg-violet-600 text-white font-semibold'
                    : 'text-zinc-700 hover:bg-white hover:shadow-sm'
                }`}
              >
                {preset.label}
              </button>
            ))}
            <div className="my-2 border-t border-zinc-200" />
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params.toString())
                next.set('range', 'custom')
                next.delete('from'); next.delete('to')
                router.push(`?${next.toString()}`)
              }}
              className={`w-full text-left rounded-xl px-3 py-2 text-sm transition-colors ${
                current === 'custom'
                  ? 'bg-violet-600 text-white font-semibold'
                  : 'text-zinc-700 hover:bg-white hover:shadow-sm'
              }`}
            >
              Personnalisée
            </button>
          </div>

          {/* Calendrier — un mois sur mobile, deux sur desktop */}
          <div className="flex flex-col p-4 gap-3">
            <div className="flex items-center justify-between mb-1">
              <button type="button" onClick={() => setLeftMonth(new Date(leftMonth.getFullYear(), leftMonth.getMonth() - 1, 1))} className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500">
                <ChevronLeft className="size-4" />
              </button>
              {fromParam && !toParam && (
                <span className="text-xs text-violet-600 font-medium bg-violet-50 px-3 py-1 rounded-full">
                  Sélectionnez la date de fin
                </span>
              )}
              {!fromParam && <span className="text-xs text-zinc-400">Choisir la période</span>}
              {fromParam && toParam && (
                <button type="button" onClick={() => { const next = new URLSearchParams(params.toString()); next.delete('from'); next.delete('to'); next.set('range', 'custom'); router.push(`?${next.toString()}`) }} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-500 transition-colors">
                  <X className="size-3" /> Réinitialiser
                </button>
              )}
              <button type="button" onClick={() => setLeftMonth(new Date(leftMonth.getFullYear(), leftMonth.getMonth() + 1, 1))} className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500">
                <ChevronRight className="size-4" />
              </button>
            </div>

            {/* Un mois sur mobile, deux sur sm+ */}
            <div className="flex gap-6" onMouseLeave={() => setHovering('')}>
              <MonthGrid month={leftMonth} from={fromParam} to={toParam} hovering={hovering} onPick={pickDate} onHover={setHovering} />
              <div className="hidden sm:block">
                <MonthGrid month={rightMonth} from={fromParam} to={toParam} hovering={hovering} onPick={pickDate} onHover={setHovering} />
              </div>
            </div>

            {fromParam && (
              <div className="border-t border-zinc-100 pt-3 flex items-center justify-between text-xs text-zinc-500">
                <span>
                  {fromParam && <span className="font-semibold text-violet-700">{new Date(fromParam).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>}
                  {toParam && <> → <span className="font-semibold text-violet-700">{new Date(toParam).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span></>}
                </span>
                {fromParam && toParam && (
                  <button type="button" onClick={() => setOpen(false)} className="bg-violet-600 text-white rounded-lg px-3 py-1.5 font-semibold hover:bg-violet-700 transition-colors">
                    Appliquer
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
