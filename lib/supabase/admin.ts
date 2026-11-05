import { createClient } from '@supabase/supabase-js'

/** Client Supabase avec le service_role — accès complet, uniquement côté serveur */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
