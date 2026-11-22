'use server'

import { revalidatePath } from 'next/cache'
import { requirePerm } from '@/lib/context'
import type { FormState } from '@/lib/form'

export async function saveWhatsappContact(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, store } = await requirePerm('settings.write')

  const id = String(fd.get('id') ?? '').trim() || null
  const name = String(fd.get('name') ?? '').trim()
  const phone = String(fd.get('phone') ?? '').replace(/[^\d+]/g, '')
  const role = String(fd.get('role') ?? 'closer')
  const template = String(fd.get('template') ?? '').trim() || null

  if (name.length < 2) return { error: 'Nom trop court (minimum 2 caractères).' }
  if (phone.length < 7) return { error: 'Numéro invalide (minimum 7 chiffres).' }
  if (!['closer', 'livreur', 'groupe'].includes(role)) return { error: 'Rôle invalide.' }

  if (id) {
    const { error } = await supabase
      .from('whatsapp_contacts')
      .update({ name, phone, role, template })
      .eq('id', id)
      .eq('store_id', store.id)
    if (error) return { error: 'Mise à jour impossible.' }
  } else {
    const { error } = await supabase
      .from('whatsapp_contacts')
      .insert({ store_id: store.id, name, phone, role, template })
    if (error) return { error: 'Ajout impossible.' }
  }

  revalidatePath('/dashboard/settings')
  return { message: id ? 'Contact mis à jour.' : 'Contact ajouté.' }
}

export async function deleteWhatsappContact(contactId: string): Promise<void> {
  const { supabase, store } = await requirePerm('settings.write')
  await supabase
    .from('whatsapp_contacts')
    .delete()
    .eq('id', contactId)
    .eq('store_id', store.id)
  revalidatePath('/dashboard/settings')
}
