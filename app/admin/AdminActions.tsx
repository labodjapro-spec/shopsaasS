'use client'

import { useState } from 'react'
import { banUser, unbanUser, deleteUser } from './actions'
import ConfirmationModal from '@/components/ConfirmationModal'
import toast from 'react-hot-toast'

export function BanButton({ userId, banned }: { userId: string; banned: boolean }) {
  const [busy, setBusy] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handle() {
    setBusy(true)
    try {
      if (banned) await unbanUser(userId)
      else await banUser(userId)
      toast.success(banned ? 'Compte débloqué.' : 'Compte bloqué.')
    } catch (e: any) {
      toast.error(e.message || 'Une erreur est survenue.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={busy}
        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
          banned
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
        }`}
      >
        {busy ? '…' : banned ? 'Débloquer' : 'Bloquer'}
      </button>
      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handle}
        title={banned ? 'Débloquer ce compte ?' : 'Bloquer ce compte ?'}
        message={
          banned
            ? 'Cet utilisateur pourra à nouveau se connecter.'
            : 'Cet utilisateur ne pourra plus se connecter.'
        }
        confirmLabel={banned ? 'Oui, débloquer' : 'Oui, bloquer'}
        cancelLabel="Annuler"
        variant="default"
      />
    </>
  )
}

export function DeleteButton({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handle() {
    setBusy(true)
    try {
      await deleteUser(userId)
      toast.success('Compte supprimé.')
    } catch (e: any) {
      toast.error(e.message || 'Une erreur est survenue.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={busy}
        className="rounded-lg px-3 py-1.5 text-xs font-bold bg-red-100 text-red-700 hover:bg-red-200 transition disabled:opacity-50"
      >
        {busy ? '…' : 'Supprimer'}
      </button>
      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handle}
        title="Supprimer ce compte ?"
        message="Cette action est irréversible. Le compte sera définitivement supprimé."
        confirmLabel="Oui, supprimer"
        cancelLabel="Annuler"
        variant="danger"
      />
    </>
  )
}
