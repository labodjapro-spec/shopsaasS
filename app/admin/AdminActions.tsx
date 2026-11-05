'use client'

import { useState } from 'react'
import { banUser, unbanUser, deleteUser } from './actions'

export function BanButton({ userId, banned }: { userId: string; banned: boolean }) {
  const [busy, setBusy] = useState(false)

  async function handle() {
    if (!confirm(banned ? 'Débloquer ce compte ?' : 'Bloquer ce compte ?')) return
    setBusy(true)
    try {
      if (banned) await unbanUser(userId)
      else await banUser(userId)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={handle}
      disabled={busy}
      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
        banned
          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
          : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
      }`}
    >
      {busy ? '…' : banned ? 'Débloquer' : 'Bloquer'}
    </button>
  )
}

export function DeleteButton({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false)

  async function handle() {
    if (!confirm('Supprimer définitivement ce compte ? Cette action est irréversible.')) return
    setBusy(true)
    try {
      await deleteUser(userId)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={handle}
      disabled={busy}
      className="rounded-lg px-3 py-1.5 text-xs font-bold bg-red-100 text-red-700 hover:bg-red-200 transition disabled:opacity-50"
    >
      {busy ? '…' : 'Supprimer'}
    </button>
  )
}
