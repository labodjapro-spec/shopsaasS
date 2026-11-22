'use client'

import { useState } from 'react'
import { MessageCircle, Send, X, Phone, Truck, Users, ChevronDown, ChevronUp } from 'lucide-react'

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
  closer: { label: 'Closers', icon: Phone, color: 'text-violet-600' },
  livreur: { label: 'Livreurs', icon: Truck, color: 'text-amber-600' },
  groupe: { label: 'Groupes', icon: Users, color: 'text-emerald-600' },
}

const DEFAULT_TEMPLATES: Record<string, string> = {
  closer: `Commande à closer :\n👤 Client : {nom}\n📞 Tél : {tel}\n📦 Produit : {produit}\n🏙️ Ville : {adresse}\n💰 Montant : {montant}\n🔖 Réf : {ref}\n📋 Statut : {statut}`,
  livreur: `🚚 Nouvelle livraison :\n👤 {nom}\n📞 {tel}\n📍 {adresse}\n📦 {produit}\n💰 {montant}\n🔖 Réf : {ref}`,
  groupe: `✅ Commande confirmée\n👤 {nom} · {tel}\n📍 {adresse}\n📦 {produit}\n💰 {montant}\n🔖 {ref}`,
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

function waLink(phone: string, message: string): string {
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
  const [expandedRole, setExpandedRole] = useState<string | null>('closer')

  if (contacts.length === 0) return null

  const byRole = {
    closer: contacts.filter(c => c.role === 'closer'),
    livreur: contacts.filter(c => c.role === 'livreur'),
    groupe: contacts.filter(c => c.role === 'groupe'),
  }

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
          style={{ background: 'rgba(10,15,40,0.55)', backdropFilter: 'blur(6px)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl max-h-[90dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white px-5 py-4 border-b border-zinc-100">
              <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-zinc-200 sm:hidden" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-[#25D366]/10">
                    <MessageCircle className="size-5 text-[#25D366]" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-zinc-900">Envoyer via WhatsApp</h2>
                    <p className="text-xs text-zinc-500">{order.orderNumber} · {order.customerName}</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="flex size-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200">
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Contacts par rôle */}
            <div className="p-4 space-y-3">
              {(Object.entries(byRole) as [string, Contact[]][])
                .filter(([, list]) => list.length > 0)
                .map(([role, list]) => {
                  const cfg = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG]
                  const Icon = cfg.icon
                  const isExpanded = expandedRole === role
                  return (
                    <div key={role} className="rounded-2xl border border-zinc-100 overflow-hidden">
                      {/* En-tête du groupe */}
                      <button
                        onClick={() => setExpandedRole(isExpanded ? null : role)}
                        className="flex w-full items-center justify-between px-4 py-3 bg-zinc-50 hover:bg-zinc-100 transition"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`size-4 ${cfg.color}`} />
                          <span className="text-sm font-bold text-zinc-700">{cfg.label}</span>
                          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-600">
                            {list.length}
                          </span>
                        </div>
                        {isExpanded ? <ChevronUp className="size-4 text-zinc-400" /> : <ChevronDown className="size-4 text-zinc-400" />}
                      </button>

                      {/* Liste des contacts */}
                      {isExpanded && (
                        <div className="divide-y divide-zinc-50">
                          {list.map((c) => {
                            const tpl = c.template || DEFAULT_TEMPLATES[c.role] || DEFAULT_TEMPLATES.closer
                            const msg = buildMessage(tpl, order)
                            const link = waLink(c.phone, msg)
                            return (
                              <div key={c.id} className="px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-zinc-800 truncate">{c.name}</p>
                                    <p className="text-xs text-zinc-400">{c.phone}</p>
                                  </div>
                                  <a
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-bold text-white hover:bg-[#1ebe5d] transition active:scale-95"
                                  >
                                    <Send className="size-3" />
                                    Envoyer
                                  </a>
                                </div>
                                {/* Aperçu du message */}
                                <details className="mt-2">
                                  <summary className="text-[11px] text-zinc-400 cursor-pointer hover:text-zinc-600 select-none">
                                    Voir le message →
                                  </summary>
                                  <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-[11px] text-zinc-600 font-sans leading-relaxed border border-zinc-100">
                                    {msg}
                                  </pre>
                                </details>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>

            <div className="px-4 pb-6">
              <p className="text-center text-xs text-zinc-400">
                WhatsApp s&apos;ouvrira avec le message pré-rempli. Tu pourras le modifier avant d&apos;envoyer.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
