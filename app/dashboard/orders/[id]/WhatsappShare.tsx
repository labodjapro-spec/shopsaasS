'use client'

import { useState } from 'react'
import { MessageCircle, X, Phone, Truck, Users, RotateCcw, Send, ChevronRight } from 'lucide-react'

type Contact = {
  id: string
  name: string
  phone: string
  role: 'closer' | 'livreur' | 'groupe'
  template: string | null
}

type OrderInfo = {
  orderNumber: string
  customerName: string
  customerPhone: string
  customerCity: string
  customerAddress: string
  total: string
  currency: string
  status: string
  productLines: string
  note?: string | null
}

const ROLE_CONFIG = {
  closer: { label: 'Closer', icon: Phone, bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
  livreur: { label: 'Livreur', icon: Truck, bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  groupe: { label: 'Groupe WA', icon: Users, bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
}

// Templates avec emojis et format structuré
const DEFAULT_TEMPLATES: Record<string, string> = {
  closer: `*NOUVELLE COMMANDE* 📋\n\n👤 *Nom :* {nom}\n📞 *Téléphone :* {tel}\n📍 *Adresse :* {adresse}\n\n📦 *Produit :* {produit}\n💰 *À encaisser :* {montant}\n\n🔖 *Réf :* {ref}\n📋 *Statut :* {statut}`,
  livreur: `*LIVRAISON À EFFECTUER* 🚚\n\n👤 *Nom :* {nom}\n📞 *Téléphone :* {tel}\n📍 *Adresse :* {adresse}\n\n📦 *Produit :* {produit}\n💵 *À encaisser :* {montant}\n\n🔖 *Réf :* {ref}`,
  groupe: `*COMMANDE CONFIRMÉE* ✅\n\n👤 *Nom :* {nom}\n📞 *Téléphone :* {tel}\n📍 *Adresse :* {adresse}\n\n📦 *Produit :* {produit}\n💰 *Montant :* {montant}\n\n🔖 *Réf :* {ref}\n📋 *Statut :* {statut}`,
}

function buildMessage(template: string, order: OrderInfo): string {
  return template
    .replace(/\{nom\}/g, order.customerName)
    .replace(/\{tel\}/g, order.customerPhone)
    .replace(/\{produit\}/g, order.productLines)
    .replace(/\{adresse\}/g, [order.customerCity, order.customerAddress].filter(Boolean).join(', ') || '—')
    .replace(/\{montant\}/g, `${order.total} ${order.currency}`)
    .replace(/\{ref\}/g, order.orderNumber)
    .replace(/\{statut\}/g, order.status)
}

function waLink(phone: string | null, message: string): string {
  if (!phone) {
    // Groupe : ouvre WhatsApp sans destinataire, l'utilisateur choisit
    return `https://wa.me/?text=${encodeURIComponent(message)}`
  }
  const digits = phone.replace(/[^\d+]/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export default function WhatsappShare({
  contacts,
  order,
}: {
  contacts: Contact[]
  order: OrderInfo
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Contact | null>(null)
  const [msg, setMsg] = useState('')

  if (contacts.length === 0) return null

  function selectContact(c: Contact) {
    const tpl = c.template || DEFAULT_TEMPLATES[c.role] || DEFAULT_TEMPLATES.closer
    setMsg(buildMessage(tpl, order))
    setSelected(c)
  }

  function resetSelection() {
    setSelected(null)
    setMsg('')
  }

  function handleClose() {
    setOpen(false)
    setSelected(null)
    setMsg('')
  }

  // Trier : closers → livreurs → groupes
  const sorted = [
    ...contacts.filter(c => c.role === 'closer'),
    ...contacts.filter(c => c.role === 'livreur'),
    ...contacts.filter(c => c.role === 'groupe'),
  ]

  return (
    <>
      {/* Bouton déclencheur */}
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#1ebe5d] active:scale-[0.98] transition-all"
      >
        <MessageCircle className="size-4" />
        Envoyer via WhatsApp
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(10,15,40,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={handleClose}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl max-h-[90dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white px-5 pt-4 pb-3 border-b border-zinc-100">
              <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-zinc-200 sm:hidden" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-[#25D366]/15">
                    <MessageCircle className="size-5 text-[#25D366]" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-zinc-900">Envoyer via WhatsApp</h2>
                    <p className="text-xs text-zinc-400">{order.orderNumber} · {order.customerName}</p>
                  </div>
                </div>
                <button onClick={handleClose} className="flex size-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200">
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">

              {/* ÉTAPE 1 — Sélection du contact */}
              {!selected ? (
                <>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
                    À qui envoyer cette commande ?
                  </p>
                  <div className="space-y-2">
                    {sorted.map((c) => {
                      const cfg = ROLE_CONFIG[c.role]
                      const Icon = cfg.icon
                      return (
                        <button
                          key={c.id}
                          onClick={() => selectContact(c)}
                          className="flex w-full items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-3.5 text-left shadow-sm hover:border-zinc-300 hover:shadow-md transition-all active:scale-[0.98]"
                        >
                          <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${cfg.bg}`}>
                            <Icon className={`size-5 ${cfg.text}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-zinc-900 truncate">{c.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`size-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                              <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
                              {c.role !== 'groupe' && (
                                <span className="text-xs text-zinc-400">· {c.phone}</span>
                              )}
                              {c.role === 'groupe' && (
                                <span className="text-xs text-zinc-400">· Tu choisiras le groupe</span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="size-4 text-zinc-300 shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                /* ÉTAPE 2 — Édition du message */
                <>
                  {/* Destinataire sélectionné */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={resetSelection}
                      className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 transition text-lg"
                      title="Changer de destinataire"
                    >
                      ←
                    </button>
                    <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${ROLE_CONFIG[selected.role].bg}`}>
                      {(() => { const Icon = ROLE_CONFIG[selected.role].icon; return <Icon className={`size-4 ${ROLE_CONFIG[selected.role].text}`} /> })()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-zinc-900 truncate">{selected.name}</p>
                      <p className="text-xs text-zinc-400">
                        {selected.role === 'groupe' ? 'Tu choisiras le groupe dans WhatsApp' : selected.phone}
                      </p>
                    </div>
                  </div>

                  {/* Zone de message éditable */}
                  <div className="rounded-2xl border border-zinc-200 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 border-b border-zinc-200">
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">Message à envoyer</span>
                      <button
                        type="button"
                        onClick={() => {
                          const tpl = selected.template || DEFAULT_TEMPLATES[selected.role] || DEFAULT_TEMPLATES.closer
                          setMsg(buildMessage(tpl, order))
                        }}
                        className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-violet-600 transition"
                      >
                        <RotateCcw className="size-3" />
                        Réinitialiser
                      </button>
                    </div>
                    <textarea
                      value={msg}
                      onChange={e => setMsg(e.target.value)}
                      rows={10}
                      className="w-full bg-white px-3 py-3 text-sm text-zinc-700 leading-relaxed resize-none outline-none"
                    />
                  </div>

                  {/* Bouton envoyer */}
                  <a
                    href={waLink(selected.role !== 'groupe' ? selected.phone : null, msg)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 text-sm font-black text-white hover:bg-[#1ebe5d] transition active:scale-[0.98] shadow-md shadow-green-200"
                  >
                    <Send className="size-4" />
                    {selected.role === 'groupe' ? 'Ouvrir WhatsApp et choisir le groupe' : `Envoyer à ${selected.name}`}
                  </a>

                  <p className="text-center text-[11px] text-zinc-400">
                    {selected.role === 'groupe'
                      ? 'WhatsApp s\'ouvrira. Tu sélectionneras le groupe toi-même.'
                      : 'WhatsApp s\'ouvrira avec le message pré-rempli.'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
