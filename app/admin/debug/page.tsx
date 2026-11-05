import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Page de diagnostic temporaire — à supprimer après
export default async function AdminDebugPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  return (
    <div style={{ padding: 32, fontFamily: 'monospace', fontSize: 14 }}>
      <h1 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>Admin Debug</h1>
      <p><strong>Auth error:</strong> {error?.message ?? 'none'}</p>
      <p><strong>User:</strong> {user ? 'connecté' : 'NON connecté'}</p>
      <p><strong>User ID:</strong> {user?.id ?? '—'}</p>
      <p><strong>Email:</strong> {user?.email ?? '—'}</p>
      <p><strong>Expected ID:</strong> 359b695b-681b-423c-83e3-882fcaebc402</p>
      <p><strong>Match:</strong> {user?.id === '359b695b-681b-423c-83e3-882fcaebc402' ? '✅ OUI' : '❌ NON'}</p>
      <p><strong>SERVICE_ROLE_KEY present:</strong> {process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ OUI' : '❌ NON'}</p>
    </div>
  )
}
