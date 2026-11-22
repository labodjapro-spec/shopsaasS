'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { Plus, Pencil, Trash2, Phone, Users, Truck, MessageCircle, X, Check } from 'lucide-react'
import { saveWhatsappContact, deleteWhatsappContact } from './actions'
import { ConfirmDialog } from '@/components/ConfirmDialog'

type Contact = {
  id: string
  name: string
  phone: string
  role: 'closer' | 'livreur' | 'groupe'
  template: string | null
}

const ROLE_CONFIG = {
  closer: { label: 'Closer', icon: Phone, color: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  livreur: { label: 'Livreur', icon: Truck, color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  groupe: { label: 'Groupe WA', icon: Users, color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
}

function ContactForm({
  contact,
  onClose,
}: {
  contact?: Contact
  onClose: () => void
}) {
  const [state, formAction, pending] = useActionState(saveWhatsappContact, undefined)

  return (
    <form action={formAction} className="space-y-4">
      {contact?.id && <input type="hidden" name="id" value={contact.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase tracking-wide">Nom *</label>
          <input
            name="name"
            defaultValue={contact?.name}
            required
            placeholder="Ex: Kofi Livreur, Groupe Confirmations"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase tracking-wide">Numéro WhatsApp *</label>
          <input
            name="phone"
            defaultValue={contact?.phone}
            required
            placeholder="+22890000000"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase tracking-wide">Rôle *</label>
        <select
          name="role"
          defaultValue={contact?.role ?? 'closer'}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 bg-white"
        >
          <option value="closer">Closer (agent de confirmation)</option>
          <option value="livreur">Livreur</option>
          <option value="groupe">Groupe WhatsApp</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-zinc-700 mb-1 uppercase tracking-wide">
          Message personnalisé <span className="text-zinc-400 font-normal normal-case">(optionnel — laisse vide pour le message par défaut)</span>
        </label>
        <textarea
          name="template"
          defaultValue={contact?.template ?? ''}
          rows={3}
          placeholder="Variables disponibles : {nom}, {tel}, {produit}, {adresse}, {montant}, {ref}, {statut}"
          className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none"
        />
        <p className="text-[11px] text-zinc-400 mt-1">
          Exemple livreur : &ldquo;Livraison pour {'{nom}'} · {'{adresse}'} · {'{montant}'} · Réf: {'{ref}'}&rdquo;
        </p>
      </div>

      {state?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 transition disabled:opacity-60"
        >
          {pending ? 'Enregistrement…' : contact ? 'Mettre à jour' : 'Ajouter le contact'}
        </button>
      </div>
    </form>
  )
}

export default function WhatsappContactsManager({ contacts }: { contacts: Contact[] }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [deleting, setDeleting] = useState<Contact | null>(null)

  function handleEdit(c: Contact) {
    setEditing(c)
    setShowForm(true)
  }

  function handleClose() {
    setShowForm(false)
    setEditing(null)
  }

  async function handleDelete() {
    if (!deleting) return
    await deleteWhatsappContact(deleting.id)
    setDeleting(null)
  }

  return (
    <div className="space-y-4">
      {/* Liste des contacts */}
      {contacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 py-10 text-center">
          <MessageCircle className="mx-auto size-10 text-zinc-300 mb-3" />
          <p className="text-sm font-semibold text-zinc-500">Aucun contact WhatsApp</p>
          <p className="text-xs text-zinc-400 mt-1">Ajoute des closers, livreurs ou groupes pour partager les commandes rapidement.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => {
            const cfg = ROLE_CONFIG[c.role]
            const Icon = cfg.icon
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-3.5 shadow-sm">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${cfg.color}`}>
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-zinc-900 truncate">{c.name}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cfg.color}`}>
                      <span className={`size-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{c.phone}</p>
                  {c.template && (
                    <p className="text-[11px] text-zinc-400 mt-0.5 truncate">📝 {c.template}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleEdit(c)}
                    className="flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
                    title="Modifier"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => setDeleting(c)}
                    className="flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 transition"
                    title="Supprimer"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bouton ajouter */}
      {!showForm && (
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-300 py-3 text-sm font-semibold text-violet-600 hover:bg-violet-50 transition"
        >
          <Plus className="size-4" />
          Ajouter un contact WhatsApp
        </button>
      )}

      {/* Formulaire inline */}
      {showForm && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-zinc-900">{editing ? 'Modifier le contact' : 'Nouveau contact'}</h3>
            <button onClick={handleClose} className="flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100">
              <X className="size-4" />
            </button>
          </div>
          <ContactForm contact={editing ?? undefined} onClose={handleClose} />
        </div>
      )}

      {/* Dialog suppression */}
      <ConfirmDialog
        open={!!deleting}
        title="Supprimer ce contact ?"
        message={`"${deleting?.name}" sera retiré de ta liste WhatsApp. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
