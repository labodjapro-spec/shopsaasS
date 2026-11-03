'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requirePerm } from '@/lib/context'
import { encodeScheduleNote } from '@/lib/orders/scheduled'

const STATUS_LABELS_FR: Record<string, string> = {
  new: 'Nouvelle',
  confirmed: 'Confirmée',
  unreachable: 'Injoignable',
  scheduled: 'Programmée',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  returned: 'Retournée',
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  note = '',
  scheduledAtIso?: string | null,
) {
  const { supabase, store, user } = await requirePerm(
    status === 'shipped' || status === 'delivered' || status === 'returned' ? 'orders.ship' : 'orders.write',
  )
  const allowed = ['new', 'confirmed', 'unreachable', 'scheduled', 'shipped', 'delivered', 'cancelled', 'returned']
  if (!allowed.includes(status)) return { error: 'Statut invalide.' }

  const nowIso = new Date().toISOString()
  const validScheduledIso =
    status === 'scheduled' && scheduledAtIso && !Number.isNaN(new Date(scheduledAtIso).getTime())
      ? new Date(scheduledAtIso).toISOString()
      : null

  // Try updating with scheduled_at / reminder_sent_at columns first; fallback cleanly if migration 0022 is not run yet
  let { error } = await supabase
    .from('orders')
    .update({
      status,
      scheduled_at: validScheduledIso,
      reminder_sent_at: null,
      updated_at: nowIso,
    } as Record<string, unknown>)
    .eq('id', orderId)
    .eq('store_id', store.id)

  if (error) {
    const fallback = await supabase
      .from('orders')
      .update({ status, updated_at: nowIso })
      .eq('id', orderId)
      .eq('store_id', store.id)
    error = fallback.error
  }

  if (error) return { error: 'Mise à jour impossible.' }

  // Enregistrer en français dans l'historique (avec le tag [SCHEDULED:ISO] si programmée)
  const label = STATUS_LABELS_FR[status] ?? status
  const eventNote =
    status === 'scheduled' && validScheduledIso
      ? encodeScheduleNote(validScheduledIso, note)
      : note?.trim() || null

  await supabase.from('order_events').insert({
    order_id: orderId,
    store_id: store.id,
    user_id: user.id,
    event_type: `Statut : ${label}`,
    note: eventNote,
  })

  revalidatePath(`/dashboard/orders/${orderId}`)
  revalidatePath('/dashboard/orders')
  redirect('/dashboard/orders')
}

export async function saveOrderNote(orderId: string, note: string) {
  const { supabase, store, user } = await requirePerm('orders.write')

  // Sauvegarder la note dans la commande
  const { error } = await supabase
    .from('orders')
    .update({ note: note.trim() })
    .eq('id', orderId)
    .eq('store_id', store.id)

  if (error) return { error: 'Impossible de sauvegarder la note.' }

  // Ajouter dans l'historique si note non vide
  if (note.trim()) {
    await supabase.from('order_events').insert({
      order_id: orderId,
      store_id: store.id,
      user_id: user.id,
      event_type: 'Note ajoutée',
      note: note.trim(),
    })
  }

  revalidatePath(`/dashboard/orders/${orderId}`)
  return { ok: true }
}
