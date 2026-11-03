'use client'

import { useState, useTransition } from 'react'
import { Calendar, Clock, BellRing, X, Truck } from 'lucide-react'
import toast from 'react-hot-toast'
import { updateOrderStatus } from '../actions'
import { formatScheduledDateFr } from '@/lib/orders/scheduled'

interface StatusButtonsProps {
  orderId: string
  orderNumber: string
  customerName: string
  customerLocation: string
  amountText: string
  currentStatus: string
  currentScheduledAt?: string | null
  currentScheduleNote?: string
}

const STATUS_OPTIONS = [
  { key: 'new',         label: 'Nouvelle',     color: 'bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200' },
  { key: 'confirmed',   label: 'Confirmée',    color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  { key: 'unreachable', label: 'Injoignable',  color: 'bg-orange-500 hover:bg-orange-600 text-white' },
  { key: 'scheduled',   label: 'Programmée',   color: 'bg-blue-600 hover:bg-blue-700 text-white' },
  { key: 'shipped',     label: 'Expédiée',     color: 'bg-amber-500 hover:bg-amber-600 text-white' },
  { key: 'delivered',   label: 'Livrée',       color: 'bg-green-600 hover:bg-green-700 text-white' },
  { key: 'cancelled',   label: 'Annulée',      color: 'bg-red-600 hover:bg-red-700 text-white' },
  { key: 'returned',    label: 'Retournée',    color: 'bg-zinc-500 hover:bg-zinc-600 text-white' },
]

function toLocalDateInputValue(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toLocalTimeInputValue(d: Date): string {
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function getDefaultScheduleDate(existingIso?: string | null): Date {
  if (existingIso) {
    const parsed = new Date(existingIso)
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
      return parsed
    }
  }
  const d = new Date(Date.now() + 60 * 60 * 1000)
  d.setSeconds(0, 0)
  return d
}

export default function StatusButtons({
  orderId,
  orderNumber,
  customerName,
  customerLocation,
  amountText,
  currentStatus,
  currentScheduledAt,
  currentScheduleNote = '',
}: StatusButtonsProps) {
  const [isPending, startTransition] = useTransition()
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  const initialDate = getDefaultScheduleDate(currentScheduledAt)
  const [dateValue, setDateValue] = useState(() => toLocalDateInputValue(initialDate))
  const [timeValue, setTimeValue] = useState(() => toLocalTimeInputValue(initialDate))
  const [scheduleNote, setScheduleNote] = useState(currentScheduleNote)

  function applyPreset(target: Date) {
    setDateValue(toLocalDateInputValue(target))
    setTimeValue(toLocalTimeInputValue(target))
  }

  function handleStatusClick(statusKey: string) {
    if (statusKey === 'scheduled') {
      const def = getDefaultScheduleDate(currentScheduledAt)
      setDateValue(toLocalDateInputValue(def))
      setTimeValue(toLocalTimeInputValue(def))
      setShowScheduleModal(true)
      return
    }
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, statusKey, '')
      if (res?.error) toast.error(res.error)
    })
  }

  function handleConfirmSchedule(e: React.FormEvent) {
    e.preventDefault()
    if (!dateValue || !timeValue) {
      toast.error('Choisis une date et une heure.')
      return
    }
    const target = new Date(`${dateValue}T${timeValue}:00`)
    if (Number.isNaN(target.getTime())) {
      toast.error('Date ou heure invalide.')
      return
    }
    if (target.getTime() <= Date.now() - 30000) {
      toast.error('Choisis une heure dans le futur.')
      return
    }

    const scheduledIso = target.toISOString()

    // Register reminder in Service Worker as well so it wakes up at the exact timestamp
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.ready
        .then((reg) => {
          reg.active?.postMessage({
            type: 'SCHEDULE_REMINDER',
            orderId,
            orderNumber,
            customer: customerName,
            amount: amountText,
            location: customerLocation,
            note: scheduleNote.trim(),
            url: `/dashboard/orders/${orderId}`,
            fireAt: target.getTime(),
          })
        })
        .catch(() => undefined)
    }

    setShowScheduleModal(false)
    toast.success(`Livraison programmée : ${formatScheduledDateFr(scheduledIso)}`)
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, 'scheduled', scheduleNote.trim(), scheduledIso)
      if (res?.error) toast.error(res.error)
    })
  }

  const previewIso = (() => {
    if (!dateValue || !timeValue) return null
    const d = new Date(`${dateValue}T${timeValue}:00`)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  })()

  return (
    <>
      <div className="space-y-4">
        {currentStatus === 'scheduled' && currentScheduledAt && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            <div className="flex items-start gap-2">
              <BellRing className="mt-0.5 size-4 shrink-0 text-blue-600" />
              <div>
                <p className="font-bold">Livraison programmée : {formatScheduledDateFr(currentScheduledAt)}</p>
                {currentScheduleNote && <p className="mt-0.5 text-blue-700">Note : {currentScheduleNote}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleStatusClick('scheduled')}
              className="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1 font-bold text-white hover:bg-blue-700"
            >
              Modifier
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {STATUS_OPTIONS.map(({ key, label, color }) => (
            <button
              key={key}
              type="button"
              disabled={isPending}
              onClick={() => handleStatusClick(key)}
              className={`
                relative rounded-xl px-3 py-2.5 text-xs font-bold transition-all disabled:opacity-50
                ${color}
                ${currentStatus === key ? 'ring-2 ring-offset-2 ring-zinc-800 scale-[1.03]' : 'opacity-85 hover:opacity-100'}
              `}
            >
              {label}
              {currentStatus === key && (
                <span className="absolute -top-1 -right-1 size-3 rounded-full bg-white border-2 border-zinc-800" />
              )}
            </button>
          ))}
        </div>

        <p className="text-xs text-zinc-400">
          Clique sur <strong>Programmée</strong> pour choisir le jour et l&apos;heure d&apos;alerte de livraison.
        </p>
      </div>

      {/* Pop-up de programmation de livraison */}
      {showScheduleModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setShowScheduleModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <Truck className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-zinc-900">Programmer la livraison</h3>
                  <p className="text-xs text-zinc-500">
                    {customerName} · {orderNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSchedule} className="mt-4 space-y-4">
              {/* Raccourcis rapides */}
              <div>
                <p className="mb-1.5 text-xs font-semibold text-zinc-500">Raccourcis rapides</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => applyPreset(new Date(Date.now() + 2 * 60 * 1000))}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100"
                  >
                    ⚡ +2 min (Test)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(new Date(Date.now() + 60 * 60 * 1000))}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100"
                  >
                    ⏱️ Dans 1 h
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date()
                      d.setDate(d.getDate() + 1)
                      d.setHours(10, 0, 0, 0)
                      applyPreset(d)
                    }}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100"
                  >
                    🌤️ Demain 10h
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date()
                      d.setDate(d.getDate() + 1)
                      d.setHours(14, 0, 0, 0)
                      applyPreset(d)
                    }}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100"
                  >
                    ☀️ Demain 14h
                  </button>
                </div>
              </div>

              {/* Calendrier Date + Heure */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-zinc-700">
                    <Calendar className="size-3.5 text-blue-600" />
                    Jour de livraison
                  </label>
                  <input
                    type="date"
                    required
                    value={dateValue}
                    onChange={(e) => setDateValue(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-semibold text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-zinc-700">
                    <Clock className="size-3.5 text-blue-600" />
                    Heure d&apos;alerte
                  </label>
                  <input
                    type="time"
                    required
                    value={timeValue}
                    onChange={(e) => setTimeValue(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-semibold text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              {/* Note / Rappel pour la livraison */}
              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">
                  Instruction pour la livraison (optionnel)
                </label>
                <input
                  type="text"
                  value={scheduleNote}
                  onChange={(e) => setScheduleNote(e.target.value)}
                  placeholder="Ex: Appeler le client en partant, livrer devant la pharmacie..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {previewIso && (
                <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs font-semibold text-blue-900">
                  <BellRing className="size-4 shrink-0 text-blue-600" />
                  <span>
                    Notification d&apos;alerte livraison prévue : <strong>{formatScheduledDateFr(previewIso)}</strong>
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  <BellRing className="size-3.5" />
                  {isPending ? 'Programmation…' : 'Programmer l’alerte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
