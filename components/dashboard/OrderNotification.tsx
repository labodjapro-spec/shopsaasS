'use client'

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import { ShoppingBag, Bell, Volume2, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isIosDevice, isStandaloneDisplay } from '@/lib/pwa/install'
import { isPushFlagEnabled, removePushSubscription, savePushSubscription, setPushFlag } from '@/lib/push/browser'

const ORDER_SOUND_PATH = '/sounds/shopify-order.mp3'
let sharedAudioContext: AudioContext | null = null

function playFallbackOrderSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    sharedAudioContext ??= new AudioCtx()
    const ctx = sharedAudioContext
    if (ctx.state === 'suspended') void ctx.resume()
    const notes = [
      { freq: 523.25, start: 0, duration: 0.12 },
      { freq: 659.25, start: 0.13, duration: 0.12 },
      { freq: 783.99, start: 0.26, duration: 0.25 },
    ]
    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gain.gain.setValueAtTime(0, ctx.currentTime + start)
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration + 0.05)
    })
  } catch { /* silencieux */ }
}

function playOrderSound(audio: HTMLAudioElement | null) {
  if (audio) {
    audio.currentTime = 0
    void audio.play().catch(playFallbackOrderSound)
    return
  }
  playFallbackOrderSound()
}

function showOrderToast(order: { id: string; order_number: string; customer_name: string; total: number; currency: string }) {
  toast.custom(
    (t) => (
      <div
        className={`relative flex w-[min(440px,calc(100vw-32px))] items-center gap-3 rounded-2xl border-2 border-violet-200 bg-white p-4 shadow-2xl transition-all duration-300 ${
          t.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div className="relative shrink-0">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 shadow-lg shadow-violet-200">
            <ShoppingBag className="size-6 text-white" />
          </div>
          <span className="absolute -right-1 -top-1 size-4 rounded-full border-2 border-white bg-emerald-500 animate-pulse" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-black tracking-tight text-zinc-950">Nouvelle commande</p>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">Reçue</span>
          </div>
          <p className="mt-1 truncate text-sm text-zinc-600">
            {order.customer_name} · <span className="font-bold text-violet-700">{order.order_number}</span>
          </p>
          {order.total > 0 && (
            <p className="mt-1 text-base font-black text-emerald-700">
              {order.total.toLocaleString('fr-FR')} {order.currency}
            </p>
          )}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              toast.dismiss(t.id)
              window.location.href = `/dashboard/orders/${order.id}`
            }}
            className="mt-3 inline-flex items-center justify-center rounded-xl bg-violet-700 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-violet-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2"
          >
            Voir la commande <span aria-hidden="true" className="ml-1">→</span>
          </button>
        </div>
        <button
          type="button"
          aria-label="Fermer la notification"
          onClick={(event) => { event.stopPropagation(); toast.dismiss(t.id) }}
          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
        >×</button>
      </div>
    ),
    { id: `order-toast-${order.id}`, duration: 15000, position: 'top-right' },
  )
}

function showDeliveryReminderToast(reminder: {
  id: string
  order_number: string
  customer_name: string
  customer_city?: string
  customer_address?: string
  total: number
  currency: string
  note?: string
}) {
  const locationText = [reminder.customer_city, reminder.customer_address].filter(Boolean).join(' · ')
  toast.custom(
    (t) => (
      <div
        className={`relative flex w-[min(440px,calc(100vw-32px))] items-center gap-3 rounded-2xl border-2 border-blue-300 bg-white p-4 shadow-2xl transition-all duration-300 ${
          t.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div className="relative shrink-0">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg shadow-blue-200">
            <Truck className="size-6 text-white" />
          </div>
          <span className="absolute -right-1 -top-1 size-4 rounded-full border-2 border-white bg-amber-500 animate-ping" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-black tracking-tight text-zinc-950">🚚 Livraison maintenant !</p>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-blue-800">
              Programmée
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-zinc-700">
            {reminder.customer_name} · <span className="font-bold text-blue-700">{reminder.order_number}</span>
          </p>
          {locationText && (
            <p className="mt-0.5 truncate text-xs font-medium text-zinc-500">📍 {locationText}</p>
          )}
          {reminder.note && (
            <p className="mt-0.5 truncate text-xs font-semibold text-amber-700">📝 {reminder.note}</p>
          )}
          {reminder.total > 0 && (
            <p className="mt-1 text-base font-black text-blue-700">
              {reminder.total.toLocaleString('fr-FR')} {reminder.currency}
            </p>
          )}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              toast.dismiss(t.id)
              window.location.href = `/dashboard/orders/${reminder.id}`
            }}
            className="mt-3 inline-flex items-center justify-center rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
          >
            Ouvrir la commande à livrer <span aria-hidden="true" className="ml-1">→</span>
          </button>
        </div>
        <button
          type="button"
          aria-label="Fermer la notification"
          onClick={(event) => { event.stopPropagation(); toast.dismiss(t.id) }}
          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
        >×</button>
      </div>
    ),
    { id: `reminder-toast-${reminder.id}`, duration: 25000, position: 'top-right' },
  )
}

interface OrderNotificationProps {
  storeIds: string[]
}

export default function OrderNotification({ storeIds }: OrderNotificationProps) {
  const supabase = useMemo(() => createClient(), [])
  const startedAt = useRef(new Date().toISOString())
  const knownIds = useRef<Set<string>>(new Set(
    JSON.parse(typeof window !== 'undefined' ? (sessionStorage.getItem('shopsaas-known-orders') ?? '[]') : '[]')
  ))
  const knownReminders = useRef<Set<string>>(new Set())
  const nextReminderTimer = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [promptDismissed, setPromptDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const storeKey = storeIds.join(',')

  useEffect(() => {
    setMounted(true)
    setSoundEnabled(window.localStorage.getItem('shopsaas-order-sound-enabled') === 'true')
    audioRef.current = new Audio(ORDER_SOUND_PATH)
    audioRef.current.preload = 'auto'
    const unlockAudio = () => {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      sharedAudioContext ??= new AudioCtx()
      if (sharedAudioContext.state === 'suspended') void sharedAudioContext.resume()
    }
    window.addEventListener('pointerdown', unlockAudio, { once: true })
    return () => window.removeEventListener('pointerdown', unlockAudio)
  }, [])

  useEffect(() => {
    let active = true
    setPushEnabled(isPushFlagEnabled())
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setPushEnabled(false)
      return
    }
    void (async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (!active) return
        if (Notification.permission === 'granted' && (subscription || isPushFlagEnabled())) {
          await savePushSubscription()
          if (active) setPushEnabled(true)
          return
        }
        if (!subscription) {
          setPushFlag(false)
          setPushEnabled(false)
        }
      } catch {
        setPushFlag(false)
        if (active) setPushEnabled(false)
      }
    })()
    return () => { active = false }
  }, [])

  const rememberOrder = useCallback((id: string) => {
    if (knownIds.current.has(id)) return false
    knownIds.current.add(id)
    try {
      sessionStorage.setItem('shopsaas-known-orders', JSON.stringify(Array.from(knownIds.current).slice(-100)))
    } catch { /* silencieux */ }
    return true
  }, [])

  const handleNewOrder = useCallback((order: {
    id: string
    order_number: string
    customer_name: string
    total: number
    currency: string
  }) => {
    if (!rememberOrder(order.id)) return
    if (soundEnabled) playOrderSound(audioRef.current)
    showOrderToast(order)
  }, [rememberOrder, soundEnabled])

  const handleDeliveryReminder = useCallback((reminder: {
    id: string
    order_number: string
    customer_name: string
    customer_city?: string
    customer_address?: string
    total: number
    currency: string
    scheduledAt?: string
    note?: string
  }) => {
    const key = `${reminder.id}:${reminder.scheduledAt || ''}`
    if (knownReminders.current.has(key)) return
    knownReminders.current.add(key)
    if (soundEnabled) playOrderSound(audioRef.current)
    showDeliveryReminderToast(reminder)
  }, [soundEnabled])

  useEffect(() => {
    const channels = storeIds.map((storeId) =>
      supabase
        .channel(`orders:${storeId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
          async (payload) => {
            const o = payload.new as any
            if (knownIds.current.has(o.id)) return
            const { data: market } = o.market_id
              ? await supabase.from('markets').select('currency').eq('id', o.market_id).maybeSingle()
              : { data: null }
            handleNewOrder({
              id: o.id,
              order_number: o.order_number ?? `#${String(o.id).slice(0, 6).toUpperCase()}`,
              customer_name: o.customer_name ?? 'Client',
              total: Number(o.total) || 0,
              currency: market?.currency ?? 'XOF',
            })
          },
        )
        .subscribe()
    )
    return () => { channels.forEach((channel) => { supabase.removeChannel(channel) }) }
  }, [handleNewOrder, storeKey, storeIds, supabase])

  useEffect(() => {
    if (!storeIds.length) return

    const checkReminders = async () => {
      try {
        const res = await fetch(`/api/orders/reminders?store_ids=${encodeURIComponent(storeIds.join(','))}`)
        const data = await res.json().catch(() => ({ dueReminders: [], upcoming: [] }))
        for (const rem of data.dueReminders ?? []) {
          handleDeliveryReminder(rem)
        }

        // Schedule an exact timeout for the soonest upcoming scheduled order
        if (nextReminderTimer.current) {
          window.clearTimeout(nextReminderTimer.current)
          nextReminderTimer.current = null
        }
        const upcoming = Array.isArray(data.upcoming) ? data.upcoming : []
        if (upcoming.length > 0) {
          const soonestMs = Math.min(
            ...upcoming
              .map((u: any) => new Date(u.scheduledAt).getTime() - Date.now())
              .filter((ms: number) => !Number.isNaN(ms) && ms >= 0),
          )
          if (Number.isFinite(soonestMs) && soonestMs <= 2147483647) {
            nextReminderTimer.current = window.setTimeout(() => {
              void checkReminders()
            }, Math.max(500, soonestMs + 500))
          }
        }
      } catch { /* silencieux */ }
    }

    const poll = async () => {
      void checkReminders()
      if (document.visibilityState !== 'visible') return
      try {
        const response = await fetch(`/api/orders/poll?store_ids=${encodeURIComponent(storeIds.join(','))}&since=${encodeURIComponent(startedAt.current)}`)
        const data = await response.json().catch(() => ({ orders: [] }))
        for (const order of data.orders ?? []) handleNewOrder(order)
      } catch { /* silencieux */ }
    }

    void checkReminders()
    const timer = window.setInterval(poll, 20000)
    const onVisible = () => { if (document.visibilityState === 'visible') void poll() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      if (nextReminderTimer.current) window.clearTimeout(nextReminderTimer.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [handleNewOrder, handleDeliveryReminder, storeKey, storeIds])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (data?.type !== 'ORDER_PUSH') return
      const orderId = data.orderId || String(data.tag || '').replace(/^(order|delivery-reminder)-/, '')
      const amountText = String(data.amount || '')
      const amountNumber = Number(data.total) || Number(amountText.replace(/[^\d.,]/g, '').replace(/\s/g, '').replace(',', '.')) || 0

      if (data.reminder) {
        handleDeliveryReminder({
          id: orderId || `rem-${Date.now()}`,
          order_number: data.orderNumber || 'Commande',
          customer_name: data.customer || 'Client',
          total: amountNumber,
          currency: data.currency || '',
          note: data.note || '',
        })
        return
      }

      handleNewOrder({
        id: orderId || `push-${Date.now()}`,
        order_number: data.orderNumber || 'Commande',
        customer_name: data.customer || 'Client',
        total: amountNumber,
        currency: data.currency || '',
      })
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [handleNewOrder, handleDeliveryReminder])

  const enablePush = async () => {
    if (isIosDevice() && !isStandaloneDisplay()) {
      toast('Sur iPhone/iPad, installe d’abord ShopSaaS sur l’écran d’accueil, puis ouvre l’icône pour activer les alertes.', { duration: 7000 })
      return
    }
    setPushBusy(true)
    try {
      await savePushSubscription()
      setPushEnabled(true)
      toast.success('Les notifications de commandes sont activées sur cet appareil.')
    } catch (error: any) {
      toast.error(error?.message || 'Impossible d’activer les notifications Push.')
    } finally {
      setPushBusy(false)
    }
  }

  const enableSound = () => {
    window.localStorage.setItem('shopsaas-order-sound-enabled', 'true')
    setSoundEnabled(true)
    playOrderSound(audioRef.current)
    toast.success('Son de commande activé.')
  }

  const disablePush = async () => {
    setPushBusy(true)
    try {
      await removePushSubscription()
      setPushEnabled(false)
      toast.success('Les alertes Push sont désactivées sur cet appareil.')
    } catch {
      toast.error('Impossible de désactiver les alertes Push.')
    } finally {
      setPushBusy(false)
    }
  }

  if (mounted && !promptDismissed && (!soundEnabled || !pushEnabled)) {
    return (
      <div className="fixed bottom-20 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 md:bottom-6">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-900 px-4 py-3 text-white shadow-2xl">
          <div className="flex min-w-0 items-center gap-2.5">
            <Bell className="size-5 shrink-0 text-violet-400" />
            <p className="text-sm font-medium leading-tight">
              {!soundEnabled ? 'Activer le son des commandes' : 'Activer les alertes commandes'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!soundEnabled && (
              <button
                onClick={enableSound}
                className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-violet-700"
              >
                <Volume2 className="size-3.5" />
                Son
              </button>
            )}
            {!pushEnabled && (
              <button
                onClick={enablePush}
                disabled={pushBusy}
                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                {pushBusy ? '…' : 'Push'}
              </button>
            )}
            {pushEnabled && (
              <button onClick={disablePush} className="text-xs text-zinc-400 hover:text-white">Off</button>
            )}
            <button
              onClick={() => setPromptDismissed(true)}
              className="px-1 text-xs text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
