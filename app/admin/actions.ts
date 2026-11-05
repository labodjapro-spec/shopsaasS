'use server'

import { requireSuperAdmin } from '@/lib/admin/require-super-admin'
import { revalidatePath } from 'next/cache'

export async function banUser(userId: string) {
  const { adminClient } = await requireSuperAdmin()
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: '876600h', // ~100 ans = banni définitivement
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin')
}

export async function unbanUser(userId: string) {
  const { adminClient } = await requireSuperAdmin()
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin')
}

export async function deleteUser(userId: string) {
  const { adminClient } = await requireSuperAdmin()
  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin')
}
