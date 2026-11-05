import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'

const SUPER_ADMIN_ID = '359b695b-681b-423c-83e3-882fcaebc402'

export async function requireSuperAdmin() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) throw new Error(`Auth error: ${error.message}`)
    if (!user) throw new Error('Not logged in')
    if (user.id !== SUPER_ADMIN_ID) throw new Error(`Wrong user: ${user.id}`)

    return { user, adminClient: createAdminClient() }
  } catch (err: any) {
    // En dev, afficher l'erreur. En prod, 404.
    if (process.env.NODE_ENV === 'development') throw err
    notFound()
  }
}
