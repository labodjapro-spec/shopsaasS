import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'

const SUPER_ADMIN_ID = '359b695b-681b-423c-83e3-882fcaebc402'

export async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Pas connecté ou pas le bon compte → 404 (comme si la page n'existait pas)
  if (!user || user.id !== SUPER_ADMIN_ID) notFound()

  return { user, adminClient: createAdminClient() }
}
