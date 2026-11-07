'use client'

import { createPortal } from 'react-dom'
import { useRef, useState, useTransition } from 'react'
import { createPublicOrder } from './actions'
import { getMetaBrowserContext, hasMetaTrackingConsent, trackMetaBrowserEvent } from '@/lib/meta/browser'
import { getAbandonedCartSessionId, saveAbandonedCart } from '@/lib/abandoned-cart/browser'

export function OrderForm({ storeId, marketId, currency, shipping, price, stock, variantId, productId, productName, apiBase, accent, config }: { storeId: string; marketId: string; currency: string; shipping: number; price: number; stock: number | null; variantId: string; productId: string; productName: string; apiBase?: string; accent: string; config?: { mode?: 'inline' | 'popup'; fields?: { id: string; label: string; required: boolean; visible: boolean }[]; bundle?: { enabled?: boolean; offers?: { label: string; price: string }[] }; styles?: { accent?: string; buttonText?: string } } | null }) {
  const [mode, setMode] = useState<'inline' | 'popup'>(config?.mode ?? 'inline')
  const [offer, setOffer] = useState(1)
  const maxQuantity = stock === null ? 99 : Math.max(0, stock)
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [confirmedName, setConfirmedName] = useState('')
  const draftTimer = useRef<number | null>(null)
  const total = price * offer + shipping
  function scheduleAbandonedCartSave(form: HTMLFormElement) {
    if (draftTimer.current !== null) window.clearTimeout(draftTimer.current)
    draftTimer.current = window.setTimeout(() => {
      const fd = new FormData(form)
      void saveAbandonedCart({
        storeId,
        productId,
        variantId,
        marketId,
        sessionId: getAbandonedCartSessionId(storeId, productId),
        name: String(fd.get('name') || ''),
        phone: String(fd.get('phone') || ''),
        email: String(fd.get('email') || ''),
        city: String(fd.get('city') || ''),
        quantity: offer,
      }, apiBase || '')
    }, 900)
  }
  function submit(form: HTMLFormElement) {
    const fd = new FormData(form)
    const metaConsent = hasMetaTrackingConsent(storeId)
    const customerName = String(fd.get('name') || '')
    const customerPhone = String(fd.get('phone') || '')
    const abandonedSessionId = customerName.trim().length >= 2 && customerPhone.trim().length >= 6
      ? getAbandonedCartSessionId(storeId, productId)
      : null
    const browserContext = metaConsent ? getMetaBrowserContext() : {}
    startTransition(async () => {
      if (abandonedSessionId) {
        await saveAbandonedCart({
          storeId,
          productId,
          variantId,
          marketId,
          sessionId: abandonedSessionId,
          name: customerName,
          phone: customerPhone,
          email: String(fd.get('email') || ''),
          city: String(fd.get('city') || ''),
          quantity: offer,
        }, apiBase || '')
      }
      const response = await createPublicOrder({
        storeId,
        marketId,
        name: customerName,
        phone: customerPhone,
        city: String(fd.get('city')),
        address: String(fd.get('address')),
        note: String(fd.get('note') ?? ''),
        lines: [{ variant_id: variantId, quantity: offer, price }],
        subtotal: price * offer,
        shipping,
        total,
        currency,
        productId,
        productName,
        quantity: offer,
        marketingConsent: metaConsent,
        abandonedSessionId,
        email: String(fd.get('email') || ''),
        ...browserContext,
      })
      if (response.error) {
        setResult(response.error)
        return
      }
      setResult('')
      setConfirmedName(customerName)
      setOrderNumber(response.number || response.orderId || 'Reçue')
      if (!response.error && metaConsent) {
        trackMetaBrowserEvent('Purchase', {
          value: total,
          currency,
          content_type: 'product',
          content_ids: [productId],
          contents: [{ id: productId, quantity: offer }],
          num_items: offer,
          order_id: response.orderId || response.number || '',
        }, response.eventId)
      }
    })
  }
  if (orderNumber && typeof document !== 'undefined') {
    return createPortal(
      <div className="fixed inset-0 z-[2147483000] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" style={{ minHeight: '100dvh' }} onClick={() => setOrderNumber('')}>
        <section role="dialog" aria-modal="true" aria-labelledby="product-order-success" className="flex max-h-[100dvh] w-full flex-col rounded-t-[28px] bg-white shadow-2xl sm:max-h-[calc(100dvh-32px)] sm:max-w-[460px] sm:rounded-[28px]" onClick={e => e.stopPropagation()}>
          <div className="flex-1 overflow-y-auto overscroll-contain p-5 pb-4">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700" aria-hidden="true">✓</div>
            <h2 id="product-order-success" className="text-center text-xl font-black text-zinc-900">Commande reçue ! 🎉</h2>
            <p className="mt-1.5 text-center text-sm leading-5 text-zinc-600">Merci {confirmedName.trim().split(/\s+/)[0]}. Ta commande est enregistrée. Garde ton téléphone disponible, notre équipe va t&apos;appeler pour confirmer la livraison.</p>
            <div className="mt-4 rounded-xl bg-zinc-50 p-3.5 text-sm">
              <p className="font-bold text-zinc-800">{productName}</p>
              <p className="mt-1 text-zinc-600">{offer} × {price.toLocaleString('fr-FR')} {currency} · livraison {shipping.toLocaleString('fr-FR')} {currency}</p>
              <p className="mt-2 font-black text-violet-800">Total : {total.toLocaleString('fr-FR')} {currency}</p>
              <p className="mt-2 break-all text-xs text-zinc-500">Référence : {orderNumber}</p>
            </div>
          </div>
          <div className="flex-shrink-0 px-5 pb-5">
            <button type="button" onClick={() => setOrderNumber('')} className="w-full rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white hover:bg-violet-800">
              Terminé
            </button>
          </div>
        </section>
      </div>,
      document.body,
    )
  }
  const fields = <form onChange={event => scheduleAbandonedCartSave(event.currentTarget)} onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget) }} className="space-y-3">
    <p className="text-center text-sm font-semibold text-red-600">Veuillez remplir le formulaire pour passer commande</p>
    {config?.bundle?.enabled !== false && <div className="rounded-xl border border-violet-200 bg-violet-50 p-3"><p className="mb-2 text-xs font-semibold text-violet-700">Choisissez votre offre</p><div className="grid grid-cols-2 gap-2">{(config?.bundle?.offers?.length ? config.bundle.offers.map((o, i) => ({ n: i + 1, label: o.label, price: Number(o.price.replace(/\D/g, '')) || price * (i + 1) })) : [1, 2].map((n) => ({ n, label: `${n} produit${n > 1 ? 's' : ''}`, price: price * n }))).filter((o) => o.n <= maxQuantity).map((o) => <button type="button" key={o.n} onClick={() => setOffer(o.n)} className={`rounded-lg bg-white px-2 py-2 text-xs ring-1 ${offer === o.n ? 'ring-violet-500' : 'ring-zinc-200'}`}>{o.label}<b className="block">{o.price.toLocaleString()} {currency}</b></button>)}</div>{stock !== null && <p className="mt-2 text-xs text-zinc-600">{stock > 0 ? `${stock} disponible${stock > 1 ? 's' : ''}` : 'Rupture de stock'}</p>}</div>}
    {(config?.fields?.length ? config.fields.filter((f) => f.visible && f.id !== 'intro') : [{ id: 'name', label: 'Nom', required: true, visible: true }, { id: 'phone', label: 'Téléphone', required: true, visible: true }, { id: 'city', label: 'Ville', required: false, visible: true }, { id: 'address', label: 'Adresse', required: true, visible: true }]).map((field) => <label key={field.id} className="block text-xs font-medium">{field.label}{field.required && ' *'}<input name={field.id} required={field.required} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>)}
    <div className="flex justify-between text-xs text-zinc-500"><span>Livraison</span><span>{shipping.toLocaleString()} {currency}</span></div>
    <div className="flex justify-between font-semibold"><span>Total</span><span>{total.toLocaleString()} {currency}</span></div>
    <button disabled={pending || maxQuantity < 1} className="w-full rounded-xl px-3 py-3 text-xs font-bold text-white disabled:opacity-50" style={{ background: config?.styles?.accent || accent }}>{maxQuantity < 1 ? 'RUPTURE DE STOCK' : pending ? 'Envoi…' : config?.styles?.buttonText || 'JE VALIDE MA COMMANDE'}<span className="block text-[10px] font-normal">{total.toLocaleString()} {currency}</span></button>
    {result && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{result}</p>}
  </form>
  return <div className="mt-8">{mode === 'popup' ? <><button onClick={() => setMode('inline')} className="w-full rounded-xl px-3 py-3 text-xs font-bold text-white" style={{ background: accent }}>COMMANDER MAINTENANT</button></> : fields}<button type="button" onClick={() => setMode(mode === 'inline' ? 'popup' : 'inline')} className="mt-3 w-full text-xs text-zinc-400">{mode === 'inline' ? 'Tester le mode pop-up' : 'Afficher le formulaire intégré'}</button></div>
}
