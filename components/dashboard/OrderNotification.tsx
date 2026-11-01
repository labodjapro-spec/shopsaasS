'use client'

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import { ShoppingBag, Bell, Volume2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
      { freq: 523.25, start: 0,    duration: 0.12 },
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

// ── Notification native du navigateur ───────────────────────────────────────
async function requestNotifPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const perm = await Notification.requestPermission()
  return perm === 'granted'
}

async function showBrowserNotif(title: string, body: string, url?: string, orderId?: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const options: NotificationOptions = {
    body,
    icon: '/icons/app-192.png',
    badge: '/icons/app-192.png',
    tag: orderId ? `order-${orderId}` : 'new-order',
    data: { url: url || '/dashboard/orders' },
    requireInteraction: true,
  }
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(title, options)
      return
    }
    const notification = new Notification(title, options)
    if (url) notification.onclick = () => { window.focus(); window.location.href = url }
  } catch (error) {
    console.warn('[notifications] Browser notification unavailable:', error)
  }
}

// ── Toast de commande ────────────────────────────────────────────────────────
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
    { duration: 15000, position: 'top-right' },
  )
}

interface OrderNotificationProps {
  storeId: string
}

export default function OrderNotification({ storeId }: OrderNotificationProps) {
  const supabase = useMemo(() => createClient(), [])
  const startedAt = useRef(new Date().toISOString())
  // Persister les IDs connus en sessionStorage pour survivre aux rechargements
  const knownIds = useRef<Set<string>>(new Set(
    JSON.parse(typeof window !== 'undefined' ? (sessionStorage.getItem('shopsaas-known-orders') ?? '[]') : '[]')
  ))
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [promptDismissed, setPromptDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)

  // S'assurer qu'on est bien côté client avant d'accéder à window/Notification
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
    setPushEnabled(window.localStorage.getItem(`shopsaas-push-enabled-${storeId}`) === 'true')
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      void navigator.serviceWorker.ready
        .then(registration => registration.pushManager.getSubscription())
        .then(subscription => {
          if (active && !subscription) {
            window.localStorage.setItem(`shopsaas-push-enabled-${storeId}`, 'false')
            setPushEnabled(false)
          }
        })
        .catch(() => {
          if (active) {
            window.localStorage.setItem(`shopsaas-push-enabled-${storeId}`, 'false')
            setPushEnabled(false)
          }
        })
    } else {
      setPushEnabled(false)
    }
    return () => { active = false }
  }, [storeId])

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Traiter une nouvelle commande ─────────────────────────────────────────
  const handleNewOrder = useCallback((order: {
    id: string
    order_number: string
    customer_name: string
    total: number
    currency: string
  }) => {
    if (knownIds.current.has(order.id)) return
    knownIds.current.add(order.id)
    // Persister pour éviter les doublons après rechargement de page
    try {
      const arr = Array.from(knownIds.current).slice(-100)
      sessionStorage.setItem('shopsaas-known-orders', JSON.stringify(arr))
    } catch { /* silencieux */ }

    if (soundEnabled) playOrderSound(audioRef.current)
    showOrderToast(order)
    void showBrowserNotif(
      `Nouvelle commande ${order.order_number}`,
      `${order.customer_name} · ${order.total.toLocaleString('fr-FR')} ${order.currency}`,
      `/dashboard/orders/${order.id}`,
      order.id,
    )
  }, [soundEnabled])

  // ── Supabase Realtime (temps réel instantané) ────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`orders:${storeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `store_id=eq.${storeId}`,
        },
        async (payload) => {
          const o = payload.new as any
          const { data: market } = o.market_id
            ? await supabase.from('markets').select('currency').eq('id', o.market_id).maybeSingle()
            : { data: null }
          handleNewOrder({
            id: o.id,
            order_number: o.order_number ?? `#${o.id.slice(0, 6).toUpperCase()}`,
            customer_name: o.customer_name ?? 'Client',
            total: Number(o.total) || 0,
            currency: market?.currency ?? 'XOF',
          })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [storeId, handleNewOrder, supabase])

  // ── Polling de secours (toutes les 15 secondes) ──────────────────────────
  useEffect(() => {
    startedAt.current = new Date().toISOString()
    knownIds.current.clear()
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/orders/poll?store_id=${storeId}&since=${encodeURIComponent(startedAt.current)}`,
          { cache: 'no-store' },
        )
        if (!res.ok) return
        const { orders } = await res.json()
        if (!orders?.length) return
        const newest = orders.reduce((latest: string, order: any) =>
          order.created_at && order.created_at > latest ? order.created_at : latest,
          startedAt.current,
        )
        startedAt.current = newest
        orders.forEach((o: any) => handleNewOrder(o))
      } catch { /* silencieux */ }
    }

    // Polling après 8s puis toutes les 15s
    const t = setTimeout(poll, 8_000)
    pollRef.current = setInterval(poll, 15_000)
    return () => {
      clearTimeout(t)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [storeId, handleNewOrder])

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = window.atob(base64)
    return Uint8Array.from(raw, char => char.charCodeAt(0))
  }

  const enablePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      toast.error('Ce navigateur ne prend pas en charge les notifications Push.')
      return
    }
    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isIos && !isInstalled) {
      toast('Sur iPhone/iPad, ajoute d’abord ShopSaaS à l’écran d’accueil, puis ouvre l’icône pour activer Push.', { duration: 7000 })
      return
    }
    const applicationServerKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!applicationServerKey) {
      toast.error('La clé VAPID publique n’est pas configurée dans l’application.')
      return
    }

    setPushBusy(true)
    try {
      const ok = await requestNotifPermission()
      if (!ok) {
        toast.error('Autorise les notifications dans les réglages du navigateur.')
        return
      }
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription() ??
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(applicationServerKey) as BufferSource,
        })
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, subscription: subscription.toJSON() }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Impossible d’enregistrer cet appareil.')
      window.localStorage.setItem(`shopsaas-push-enabled-${storeId}`, 'true')
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
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        const response = await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeId, endpoint: subscription.endpoint }),
        })
        if (!response.ok) throw new Error('Impossible de retirer cet appareil de cette boutique.')
      }
      window.localStorage.setItem(`shopsaas-push-enabled-${storeId}`, 'false')
      setPushEnabled(false)
      toast.success('Les alertes Push sont désactivées sur cet appareil.')
    } catch {
      toast.error('Impossible de désactiver les alertes Push.')
    } finally {
      setPushBusy(false)
    }
  }

  // ── Bandeau d'activation simplifié ─────────────────────────────────────
  if (mounted && !promptDismissed && !pushEnabled) {
    return (
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-900 px-4 py-3 text-white shadow-2xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <Bell className="size-5 shrink-0 text-violet-400" />
            <p className="text-sm font-medium leading-tight">Activer les alertes commandes</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={enablePush}
              disabled={pushBusy}
              className="rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
            >
              {pushBusy ? '…' : 'Activer'}
            </button>
            <button
              onClick={() => setPromptDismissed(true)}
              className="text-xs text-zinc-400 hover:text-white px-1"
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
