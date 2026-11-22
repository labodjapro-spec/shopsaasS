import 'server-only'
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const META_GRAPH_VERSION = 'v25.0'

type MetaConfig = {
  pixel_id: string
  access_token_secret_id: string | null
  test_event_code?: string | null
  test_mode?: boolean | null
}

export type MetaRequestContext = {
  eventSourceUrl?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  email?: string | null
  phone?: string | null
  fbp?: string | null
  fbc?: string | null
}

export type MetaPurchase = MetaRequestContext & {
  storeId: string
  orderId: string
  orderNumber: string
  value: number
  currency: string
  productId?: string | null
  productName?: string | null
  quantity?: number
  consent: boolean
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function sourceUrl(value: string | null | undefined, storeSlug: string) {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'
  const defaultProtocol = rootDomain.startsWith('localhost') ? 'http' : 'https'
  const fallback = `${defaultProtocol}://${rootDomain}/s/${encodeURIComponent(storeSlug)}`
  if (!value) return fallback

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback
    const host = url.hostname.toLowerCase()
    const domain = rootDomain.split(':')[0].toLowerCase()
    const allowed = host === domain || host.endsWith(`.${domain}`) || host === 'localhost' || host.endsWith('.vercel.app')
    return allowed ? `${url.origin}${url.pathname}` : fallback
  } catch {
    return fallback
  }
}

async function getConfig(admin: SupabaseClient, storeId: string) {
  const { data, error } = await admin
    .from('store_meta_integrations')
    .select('pixel_id, access_token_secret_id, test_event_code, test_mode')
    .eq('store_id', storeId)
    .maybeSingle()
  if (error) throw error
  return data as MetaConfig | null
}

async function getAccessToken(admin: SupabaseClient, storeId: string) {
  const { data, error } = await admin.rpc('read_store_meta_access_token', { p_store_id: storeId })
  if (error) throw error
  return typeof data === 'string' ? data : null
}

async function sendEvent(
  admin: SupabaseClient,
  config: MetaConfig,
  storeId: string,
  storeSlug: string,
  event: Record<string, unknown>,
) {
  if (!config.pixel_id || !config.access_token_secret_id) {
    return { sent: false as const, reason: 'missing_config' as const }
  }
  const accessToken = await getAccessToken(admin, storeId)
  if (!accessToken) return { sent: false as const, reason: 'missing_token' as const }

  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(config.pixel_id)}/events`)
  url.searchParams.set('access_token', accessToken)

  // TEST MODE — priorité : config boutique > variable d'env globale
  // La variable d'env globale est un fallback de dev uniquement, jamais en production
  const testEventCode = config.test_mode && config.test_event_code
    ? config.test_event_code
    : (process.env.NODE_ENV !== 'production' ? (process.env.META_TEST_EVENT_CODE || null) : null)

  const payload: Record<string, unknown> = {
    data: [event],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
  } catch (error) {
    console.error('[meta/capi] request failed:', error instanceof Error ? error.name : 'network error')
    return { sent: false as const, reason: 'network_error' as const }
  }

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const metaError = result?.error
    console.error('[meta/capi] Meta rejected event:', response.status, {
      code: metaError?.code,
      subcode: metaError?.error_subcode,
      message: typeof metaError?.message === 'string' ? metaError.message.slice(0, 300) : undefined,
    })
    return {
      sent: false as const,
      reason: 'meta_rejected' as const,
      status: response.status,
      message: typeof metaError?.message === 'string' ? metaError.message.slice(0, 300) : 'Meta a refusé l’événement.',
    }
  }

  return {
    sent: true as const,
    eventsReceived: Number(result?.events_received) || 0,
    eventSourceUrl: sourceUrl(event.event_source_url as string | undefined, storeSlug),
  }
}

function userData(context: MetaRequestContext) {
  const data: Record<string, string> = {}
  if (context.ipAddress) data.client_ip_address = context.ipAddress
  if (context.userAgent) data.client_user_agent = context.userAgent.slice(0, 1000)
  if (context.email) data.em = sha256(context.email.trim().toLowerCase())

  // Normaliser le numéro de téléphone — accepter avec ou sans préfixe +
  // Les numéros africains n'ont pas toujours le + mais sont valides
  if (context.phone) {
    const digits = context.phone.replace(/\D/g, '')
    // Longueur valide pour un numéro international (8 à 15 chiffres)
    if (digits.length >= 8 && digits.length <= 15) {
      data.ph = sha256(digits)
    }
  }

  if (context.fbp && context.fbp.length <= 200) data.fbp = context.fbp
  if (context.fbc && context.fbc.length <= 500) data.fbc = context.fbc
  return data
}

export async function sendMetaPurchase(admin: SupabaseClient, purchase: MetaPurchase) {
  const [{ data: store, error: storeError }, { data: order, error: orderError }, config] = await Promise.all([
    admin.from('stores').select('slug').eq('id', purchase.storeId).maybeSingle(),
    admin.from('orders')
      .select('id, store_id, order_number, total, markets(currency)')
      .eq('id', purchase.orderId)
      .eq('store_id', purchase.storeId)
      .maybeSingle(),
    getConfig(admin, purchase.storeId),
  ])
  if (storeError) throw storeError
  if (orderError) throw orderError
  if (!store || !order || !config) return { sent: false as const, reason: 'not_configured' as const }

  const contents = purchase.productId
    ? [{ id: purchase.productId, quantity: Math.max(1, Number(purchase.quantity) || 1) }]
    : undefined
  const eventId = `purchase_${purchase.orderId}`
  const event: Record<string, unknown> = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    event_source_url: sourceUrl(purchase.eventSourceUrl, store.slug),
    user_data: userData(purchase),
    custom_data: {
      currency: String((order.markets as any)?.currency || purchase.currency || 'XOF').toUpperCase(),
      value: Number(order.total) || 0,
      order_id: order.order_number || purchase.orderId,
      content_type: 'product',
      ...(purchase.productId ? { content_ids: [purchase.productId], contents } : {}),
      ...(purchase.productName ? { content_name: purchase.productName.slice(0, 1000) } : {}),
      num_items: Math.max(1, Number(purchase.quantity) || 1),
    },
  }
  return sendEvent(admin, config, purchase.storeId, store.slug, event)
}

