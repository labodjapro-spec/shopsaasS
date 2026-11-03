import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Push diagnostic. Checks every link of the chain, then sends a real test
 * notification to the signed-in user's devices:
 *   Vercel env vars → Supabase table → Edge Function + secrets → push service.
 * Never returns secret values, only whether they are present and consistent.
 */

type Check = { id: string; label: string; ok: boolean; detail?: string; fix?: string }

export async function POST(request: NextRequest) {
  const checks: Check[] = []
  const add = (check: Check) => { checks.push(check); return check.ok }
  const done = (extra: Record<string, unknown> = {}) =>
    NextResponse.json({ ok: checks.every(c => c.ok), checks, ...extra })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const browserEndpoint = typeof body?.endpoint === 'string' ? body.endpoint : ''
  const browserKey = typeof body?.applicationServerKey === 'string' ? body.applicationServerKey : ''

  // 1. Vercel environment variables
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const hookSecret = process.env.PUSH_HOOK_SECRET
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  const missingEnv = [
    !publicKey && 'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    !hookSecret && 'PUSH_HOOK_SECRET',
    !serviceRole && 'SUPABASE_SERVICE_ROLE_KEY',
    !projectUrl && 'NEXT_PUBLIC_SUPABASE_URL',
  ].filter(Boolean) as string[]
  if (!add({
    id: 'env',
    label: 'Variables Vercel',
    ok: missingEnv.length === 0,
    detail: missingEnv.length ? `Manquantes : ${missingEnv.join(', ')}` : 'Toutes présentes',
    fix: 'Vercel → Settings → Environment Variables, ajoute les valeurs de PUSH-VALUES.txt, puis Redeploy.',
  })) return done()

  // 2. This browser subscription
  add({
    id: 'browser',
    label: 'Abonnement de cet appareil',
    ok: Boolean(browserEndpoint),
    detail: browserEndpoint ? 'Cet appareil a un abonnement push' : 'Cet appareil n’est pas abonné',
    fix: 'Appuie sur « Activer les alertes » puis accepte la demande de notification.',
  })
  if (browserKey && publicKey) {
    add({
      id: 'browser-key',
      label: 'Clé de l’abonnement de cet appareil',
      ok: browserKey === publicKey,
      detail: browserKey === publicKey ? 'Identique à la clé du site' : 'Abonnement créé avec une ancienne clé',
      fix: 'Désactive puis réactive les alertes sur cet appareil.',
    })
  }

  // 3. Database table + this device saved
  const admin = createAdminClient()
  const { data: rows, error: rowsError } = await admin
    .from('web_push_subscriptions')
    .select('id, endpoint, device_id, updated_at')
    .eq('user_id', user.id)
  if (!add({
    id: 'table',
    label: 'Table Supabase des abonnements',
    ok: !rowsError,
    detail: rowsError ? rowsError.message : `${rows?.length ?? 0} appareil(s) enregistré(s) pour ton compte`,
    fix: 'Supabase → SQL Editor : exécute 0014_web_push_subscriptions.sql puis 0020_push_one_device.sql.',
  })) return done()

  const { error: lockError } = await admin.from('order_push_dispatches').select('order_id').limit(1)
  add({
    id: 'dispatch-table',
    label: 'Table anti-doublon (order_push_dispatches)',
    ok: !lockError,
    detail: lockError ? lockError.message : 'Présente',
    fix: 'Supabase → SQL Editor : exécute 0020_push_one_device.sql.',
  })

  if (browserEndpoint) {
    const saved = (rows ?? []).some((row: { endpoint: string }) => row.endpoint === browserEndpoint)
    add({
      id: 'saved',
      label: 'Cet appareil est enregistré en base',
      ok: saved,
      detail: saved ? 'Oui' : 'Non : le serveur ne connaît pas cet appareil',
      fix: 'Désactive puis réactive les alertes sur cet appareil.',
    })
  }

  // 4. Edge Function + Supabase secrets + real send
  let response: Response
  try {
    response = await fetch(`${projectUrl}/functions/v1/push-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-push-hook-secret': hookSecret! },
      body: JSON.stringify({ mode: 'test', userId: user.id }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    })
  } catch (error) {
    add({
      id: 'function',
      label: 'Fonction Supabase push-order',
      ok: false,
      detail: `Injoignable : ${error instanceof Error ? error.message : 'erreur réseau'}`,
      fix: 'Vérifie que le projet Supabase n’est pas en pause.',
    })
    return done()
  }

  const result = await response.json().catch(() => ({} as any))
  if (response.status === 404) {
    add({ id: 'function', label: 'Fonction Supabase push-order', ok: false,
      detail: 'Fonction introuvable (pas déployée ou mauvais nom)',
      fix: 'Supabase → Edge Functions → déploie la fonction avec le nom exact « push-order ».' })
    return done()
  }
  // Supabase's JWT gate answers before our code runs, without our `error` field.
  if (response.status === 401 && !result?.version && result?.error !== 'Unauthorized') {
    add({ id: 'function', label: 'Fonction Supabase push-order', ok: false,
      detail: 'Supabase demande un JWT : « Verify JWT » est encore activé',
      fix: 'Supabase → Edge Functions → push-order → Details : désactive « Verify JWT », enregistre.' })
    return done()
  }
  if (!result?.version) {
    add({ id: 'function', label: 'Fonction Supabase push-order', ok: false,
      detail: `Ancienne version de la fonction (réponse ${response.status})`,
      fix: 'Recopie supabase/functions/push-order/index.ts dans l’éditeur Supabase et redéploie.' })
    return done()
  }
  add({ id: 'function', label: 'Fonction Supabase push-order', ok: true, detail: `Déployée (${result.version})` })

  if (result?.code === 'bad_hook_secret' || result?.code === 'missing_hook_secret') {
    add({ id: 'secret', label: 'Secret partagé Vercel ↔ Supabase', ok: false,
      detail: result.code === 'missing_hook_secret' ? 'PUSH_HOOK_SECRET absent des secrets Supabase' : 'PUSH_HOOK_SECRET différent entre Vercel et Supabase',
      fix: 'Mets exactement la même valeur PUSH_HOOK_SECRET dans Vercel et dans Supabase → Edge Functions → Secrets.' })
    return done()
  }
  add({ id: 'secret', label: 'Secret partagé Vercel ↔ Supabase', ok: true, detail: 'Identique' })

  if (result?.code === 'missing_vapid_secrets' || result?.code === 'invalid_vapid_json') {
    add({ id: 'vapid', label: 'Clés VAPID dans Supabase', ok: false,
      detail: result.code === 'invalid_vapid_json' ? 'VAPID_KEYS_JSON mal copié' : `Manquant : ${(result.missing ?? []).join(', ')}`,
      fix: 'Supabase → Edge Functions → Secrets : recopie VAPID_KEYS_JSON et VAPID_SUBJECT depuis PUSH-VALUES.txt.' })
    return done()
  }
  if (!response.ok) {
    add({ id: 'vapid', label: 'Fonction Supabase', ok: false, detail: result?.error || `Erreur ${response.status}`, fix: 'Ouvre Supabase → Edge Functions → push-order → Logs.' })
    return done()
  }

  const keysMatch = result.vapidPublicKey === publicKey
  add({
    id: 'vapid',
    label: 'Clés VAPID Vercel = Supabase',
    ok: keysMatch,
    detail: keysMatch ? 'Même paire de clés' : 'La clé publique sur Vercel ne correspond pas à VAPID_KEYS_JSON dans Supabase',
    fix: 'Utilise les valeurs du MÊME fichier PUSH-VALUES.txt partout, redeploie Vercel, puis réactive les alertes sur chaque appareil.',
  })

  const devices = Array.isArray(result.devices) ? result.devices : []
  if (!devices.length) {
    add({ id: 'send', label: 'Envoi de la notification test', ok: false,
      detail: 'Aucun appareil abonné pour ton compte',
      fix: 'Appuie sur « Activer les alertes » sur le téléphone.' })
    return done({ devices })
  }
  const sent = Number(result.sent) || 0
  const refused = devices.find((d: any) => !d.ok)
  add({
    id: 'send',
    label: 'Envoi de la notification test',
    ok: sent > 0,
    detail: `${sent}/${devices.length} appareil(s) accepté(s) par le service push` +
      (refused ? ` · refus ${refused.status ?? ''} ${refused.service}${refused.status === 403 ? ' (clé VAPID différente de celle utilisée à l’abonnement)' : ''}` : ''),
    fix: refused?.status === 403
      ? 'Désactive puis réactive les alertes sur cet appareil.'
      : 'Réactive les alertes sur l’appareil concerné.',
  })

  return done({ devices })
}
