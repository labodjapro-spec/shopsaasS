'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { logActivity, requirePerm, STORE_COOKIE } from '@/lib/context'
import type { FormState } from '@/lib/form'

export async function saveSettings(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, store } = await requirePerm('settings.write')
  const name = String(fd.get('name') ?? '').trim()
  const primary_color = String(fd.get('primary_color') ?? '#7c3aed')
  const whatsapp = String(fd.get('whatsapp') ?? '').replace(/[^\d+]/g, '') || null
  const logo_url = String(fd.get('logo_url') ?? '') || null

  if (name.length < 2) return { error: 'Nom trop court.' }
  if (!/^#[0-9a-fA-F]{6}$/.test(primary_color)) return { error: 'Couleur invalide.' }

  const { error } = await supabase.from('stores').update({ name, primary_color, whatsapp, logo_url }).eq('id', store.id)
  if (error) return { error: 'Enregistrement impossible.' }
  await logActivity(store.id, 'settings.updated')
  revalidatePath('/dashboard', 'layout')
  return { message: 'Réglages enregistrés.' }
}

export async function deleteStore(_: FormState): Promise<FormState> {
  const { supabase, store, user } = await requirePerm('settings.write')

  // Seul le propriétaire peut supprimer
  if (store.owner_id !== user.id) return { error: 'Seul le propriétaire peut supprimer la boutique.' }

  // Supprimer dans l'ordre (FK constraints)
  await supabase.from('store_pages').delete().eq('store_id', store.id)
  await supabase.from('store_members').delete().eq('store_id', store.id)
  await supabase.from('markets').delete().eq('store_id', store.id)
  await supabase.from('orders').delete().eq('store_id', store.id)
  await supabase.from('products').delete().eq('store_id', store.id)
  await supabase.from('roles').delete().eq('store_id', store.id)
  await supabase.from('store_settings').delete().eq('store_id', store.id)
  const { error } = await supabase.from('stores').delete().eq('id', store.id).eq('owner_id', user.id)

  if (error) return { error: 'Suppression impossible : ' + error.message }

  // Effacer le cookie de boutique courante
  const jar = await cookies()
  jar.delete(STORE_COOKIE)

  redirect('/onboarding')
}
