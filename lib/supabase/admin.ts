import { createClient } from '@supabase/supabase-js'

/**
 * Client Supabase avec la service_role key.
 * Bypass le Row Level Security — à utiliser UNIQUEMENT côté serveur
 * pour les opérations publiques légitimes (ex: créer une commande depuis la vitrine).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local. ' +
      'Ajoute-le depuis Supabase → Project Settings → API.',
    )
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
