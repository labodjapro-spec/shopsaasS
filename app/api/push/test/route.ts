import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Push diagnostic. Checks every link of the chain, then sends a real test
 * notification to the signed-in user's devices:
 *   Vercel env vars → Supabase table → Edge Function + secrets → push service.
 * Also works if the Supabase Edge Function is still on v1 (before redeploying v2).
 */

type Check = { id: string; label: string; ok: boolean; detail?: string; fix?: string }

async function sendTestViaLegacyFunction(
  admin: ReturnType<typeof createAdminClient>,
  projectUrl: string,
  hookSecret: string,
  userId: string,
) {
  // Find a store + market where this user is a member or owner so v1 can send a test push
  const { data: member } = await admin
    .from('store_members')
    .select('store_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  let storeId = member?.store_id as string | undefined
  if (!storeId) {
    const { data: owned } = await admin.from('stores').select('id').eq('owner_id', userId).limit(1).maybeSingle()
    storeId = owned?.id
  }
  if (!storeId) return { ok: false, reason: 'Aucune boutique trouvée pour ce compte.' }

  const { data: market } = await admin
    .from('markets')
    .select('id')
    .eq('store_id', storeId)
    .limit(1)
    .maybeSingle()
  if (!market?.id) return { ok: false, reason: 'Aucun marché trouvé pour cette boutique.' }

  // Insert a temporary order row, call push-order v1, then delete the temporary row immediately
  const { data: tempOrder, error: insertError } = await admin
    .from('orders')
    .insert({
      store_id: storeId,
      market_id: market.id,
      order_number: 'TEST-PUSH',
      customer_name: 'Test Notification ✅',
      customer_phone: '+00000000',
      customer_city: 'Test',
      customer_address: 'Test',
      subtotal: 0,
      shipping_fee: 0,
      total: 0,
    })
    .select('id')
    .single()

  if (insertError || !tempOrder?.id) {
    return { ok: false, reason: insertError?.message || 'Impossible de préparer le test v1.' }
  }

  try {
    const res = await fetch(`${projectUrl}/functions/v1/push-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-push-hook-secret': hookSecret },
      body: JSON.stringify({ storeId, orderId: tempOrder.id }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    })
    const data = await res.json().catch(() => ({} as any))
    return { ok: res.ok, status: res.status, sent: Number(data?.sent) || 0, expired: Number(data?.expired) || 0, error: data?.error }
  } finally {
    await admin.from('order_push_dispatches').delete().eq('order_id', tempOrder.id)
    await admin.from('orders').delete().eq('id', tempOrder.id)
  }
}

export async function POST(request: NextRequest) {
  const checks: Check[] = []
  const add = (check: Check) => { checks.push(check); return check.ok }
  const done = (extra: Record<string, unknown> = {}) =>
    NextResponse.json({ ok: checks.every(c => c.ok), checks, ...extra })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const browserEndpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : ''
  const browserKey = typeof body?.applicationServerKey === 'string' ? body.applicationServerKey.trim() : ''

  // 1. Vercel environment variables
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '')
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  const hookSecret = process.env.PUSH_HOOK_SECRET?.trim()
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
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

  if (response.status === 401 || result?.code === 'bad_hook_secret' || result?.code === 'missing_hook_secret') {
    add({ id: 'secret', label: 'Secret partagé Vercel ↔ Supabase', ok: false,
      detail: result?.code === 'missing_hook_secret' ? 'PUSH_HOOK_SECRET absent des secrets Supabase' : 'PUSH_HOOK_SECRET différent entre Vercel et Supabase',
      fix: 'Mets exactement la même valeur PUSH_HOOK_SECRET dans Vercel et dans Supabase → Edge Functions → Secrets.' })
    return done()
  }

  if (result?.code === 'missing_vapid_secrets' || result?.code === 'invalid_vapid_json' || result?.error === 'Push function secrets are not configured.') {
    add({ id: 'vapid', label: 'Clés VAPID dans Supabase', ok: false,
      detail: result?.code === 'invalid_vapid_json' ? 'VAPID_KEYS_JSON mal copié' : 'VAPID_KEYS_JSON ou VAPID_SUBJECT manquant dans Supabase',
      fix: 'Supabase → Edge Functions → Secrets : recopie VAPID_KEYS_JSON et VAPID_SUBJECT depuis PUSH-VALUES.txt.' })
    return done()
  }

  // Fallback for push-order v1 (before the user updates the function code in Supabase)
  if (!result?.version && response.status === 400 && result?.error === 'storeId and orderId are required.') {
    add({ id: 'function', label: 'Fonction Supabase push-order', ok: true, detail: 'Déployée (v1 active — pense à mettre v2 quand tu seras sur PC)' })
    add({ id: 'secret', label: 'Secret partagé Vercel ↔ Supabase', ok: true, detail: 'Identique' })
    const legacy = await sendTestViaLegacyFunction(admin, projectUrl!, hookSecret!, user.id)
    add({
      id: 'send',
      label: 'Envoi de la notification test',
      ok: Boolean(legacy.ok && (legacy.sent ?? 0) > 0),
      detail: legacy.ok
        ? ((legacy.sent ?? 0) > 0
            ? `${legacy.sent} appareil(s) notifié(s) avec succès`
            : `0 appareil notifié (${legacy.expired ? 'abonnement expiré ou clé VAPID différente' : 'aucun appareil accepté'})`)
        : (legacy.reason || legacy.error || 'Échec du test'),
      fix: 'Désactive puis réactive les alertes sur cet appareil, et vérifie que VAPID_KEYS_JSON dans Supabase correspond à NEXT_PUBLIC_VAPID_PUBLIC_KEY sur Vercel.',
    })
    return done()
  }

  if (!result?.version) {
    add({ id: 'function', label: 'Fonction Supabase push-order', ok: false,
      detail: `Réponse inattendue (${response.status}) : ${result?.error || 'inconnue'}`,
      fix: 'Recopie supabase/functions/push-order/index.ts dans l’éditeur Supabase et redéploie.' })
    return done()
  }

  add({ id: 'function', label: 'Fonction Supabase push-order', ok: true, detail: `Déployée (${result.version})` })
  add({ id: 'secret', label: 'Secret partagé Vercel ↔ Supabase', ok: true, detail: 'Identique' })

  if (!response.ok) {
    add({ id: 'vapid', label: 'Fonction Supabase', ok: false, detail: result?.error || `Erreur ${response.status}`, fix: 'Ouvre Supabase → Edge Functions → push-order → Logs.' })
    return done()
  }

  const keysMatch = String(result.vapidPublicKey || '').trim() === publicKey
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
