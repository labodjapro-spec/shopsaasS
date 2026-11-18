'use client'

import { useState } from 'react'
import ConfirmationModal from '@/components/ConfirmationModal'
import toast from 'react-hot-toast'

export function RemoveMemberButton({
  action,
  email,
}: {
  action: (...args: any[]) => any
  email: string
}) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    setBusy(true)
    try {
      const fd = new FormData()
      await action(fd)
      toast.success(`${email} a été retiré de l'équipe.`)
    } catch (e: any) {
      toast.error(e.message || 'Une erreur est survenue.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => setShowConfirm(true)}
        className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        {busy ? '…' : 'Retirer'}
      </button>
      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        title="Retirer ce membre ?"
        message={`Voulez-vous vraiment retirer ${email} de l'équipe ?`}
        confirmLabel="Oui, retirer"
        cancelLabel="Annuler"
        variant="danger"
      />
    </>
  )
}
