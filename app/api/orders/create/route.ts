import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendCapiPurchase } from '@/lib/meta-capi'
import { dispatchOrderPush } from '@/lib/push/dispatch-order-push'
import { sendMetaPurchase } from '@/lib/meta/conversions-api'
import { markAbandonedCartConverted } from '@/lib/abandoned-cart/server'

const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000').trim()

function corsHeaders(req: NextRequest) {
  const origin = req.headers.get('origin') ?? ''
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000').trim()
  const isLocal = rootDomain.startsWith('localhost')

  const allowed =
    // Même domaine stable
    origin === `https://${rootDomain}` ||
    origin === `http://${rootDomain}` ||
    // Toutes les URLs de preview Vercel du même projet (*.vercel.app)
    origin.endsWith('.vercel.app') ||
    // Local
    (isLocal && (origin.startsWith('http://localhost:') || origin.startsWith(`http://${rootDomain}`)))

  return {
    'Access-Control-Allow-Origin': allowed ? origin : `https://${rootDomain}`,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

// Preflight CORS
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function dispatchMetaPurchase(req: NextRequest, admin: ReturnType<typeof createSupabaseClient>, body: any, storeId: string, orderId: string, orderNumber: string) {
  try {
    const result = await sendMetaPurchase(admin, {
      storeId,
      orderId,
      orderNumber,
      value: Number(body.total ?? body.price ?? 0),
      currency: String(body.currency || 'XOF'),
      productId: typeof body.product_id === 'string' ? body.product_id : null,
      productName: typeof body.product === 'string' ? body.product : null,
      quantity: Number(body.quantity) || 1,
      consent: body.marketing_consent === true,
      eventSourceUrl: req.headers.get('referer'),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent'),
      email: typeof body.email === 'string' ? body.email : null,
      phone: typeof body.phone === 'string' ? body.phone : null,
      fbp: typeof body.fbp === 'string' ? body.fbp : null,
      fbc: typeof body.fbc === 'string' ? body.fbc : null,
    })
    if (!result.sent && result.reason !== 'not_configured') {
      console.warn('[orders/create] Meta Purchase was not sent:', result.reason)
    }
  } catch (error) {
    console.error('[orders/create] Meta Purchase failed:', error instanceof Error ? error.message : 'unknown error')
  }
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)

  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400, headers })
    }

    const { customer_name, phone, city, email, product, price, total, quantity, variant_id, market_id, store_id } = body

    if (!customer_name || !phone || !store_id) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants (nom, téléphone, store_id).' },
        { status: 400, headers },
      )
    }

    const supabase = getAdminClient()

    // ── Résoudre le marché ────────────────────────────────────────────────
    let resolvedMarketId: string | null = market_id ?? null

    if (!resolvedMarketId) {
      // 1. Marché par défaut de la boutique
      const { data: m1 } = await supabase
        .from('markets').select('id').eq('store_id', store_id).eq('is_default', true).maybeSingle()
      resolvedMarketId = m1?.id ?? null
    }
    if (!resolvedMarketId) {
      // 2. N'importe quel marché actif
      const { data: m2 } = await supabase
        .from('markets').select('id').eq('store_id', store_id).eq('active', true).limit(1).maybeSingle()
      resolvedMarketId = m2?.id ?? null
    }
    if (!resolvedMarketId) {
      // 3. Dernier recours : premier marché sans filtre
      const { data: m3 } = await supabase
        .from('markets').select('id').eq('store_id', store_id).eq('active', true).limit(1).maybeSingle()
      resolvedMarketId = m3?.id ?? null
    }

    if (!resolvedMarketId) {
      return NextResponse.json(
        { error: 'Aucun marché configuré pour cette boutique. Va dans Dashboard → Marchés pour en créer un.' },
        { status: 400, headers },
      )
    }

    // The order endpoint is public, so never trust a client-supplied store,
    // market, product, or variant relationship.
    const { data: marketCheck } = await supabase
      .from('markets')
      .select('id, store_id, active')
      .eq('id', resolvedMarketId)
      .eq('store_id', store_id)
      .eq('active', true)
      .maybeSingle()
    if (!marketCheck) {
      return NextResponse.json({ error: 'Le marché choisi ne correspond pas à cette boutique.' }, { status: 400, headers })
    }
    if (typeof body.product_id === 'string') {
      const { data: productCheck } = await supabase
        .from('products')
        .select('id')
        .eq('id', body.product_id)
        .eq('store_id', store_id)
        .eq('status', 'active')
        .maybeSingle()
      if (!productCheck) {
        return NextResponse.json({ error: 'Le produit ne correspond pas à cette boutique.' }, { status: 400, headers })
      }
    }
    const qty = Number(quantity) > 0 ? Number(quantity) : 1
    const unitPrice = Number(price) || 0
    const shippingFee = Math.max(0, Number(body.shipping_fee) || 0)
    const orderTotal = Number(total ?? unitPrice * qty) || 0
    const titleLine = [{ title: product ?? 'Produit', quantity: qty, price: unitPrice }]
    const variantLine = variant_id ? [{ variant_id, quantity: qty, price: unitPrice }] : null
    const customerAddress = String(body.address || city || 'À confirmer').trim() || 'À confirmer'
    const customerPhone = String(phone).replace(/[^\d+]/g, '')

    async function createViaRpc(lines: unknown[]) {
      return supabase.rpc('create_public_order', {
        p_store_id: store_id,
        p_market_id: resolvedMarketId,
        p_name: customer_name,
        p_phone: customerPhone,
        p_city: city ?? '',
        p_address: customerAddress,
        p_note: email ? `Email: ${email}` : '',
        p_lines: lines,
        p_subtotal: Math.max(0, orderTotal - shippingFee),
        p_shipping: shippingFee,
        p_total: orderTotal,
      })
    }

    async function finishOrder(orderId: string) {
      const { data: createdOrder } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('id', orderId)
        .eq('store_id', store_id)
        .maybeSingle()
      const orderNumber = createdOrder?.order_number || orderId
      await Promise.all([
        dispatchOrderPush(String(store_id), orderId),
        dispatchMetaPurchase(req, supabase as any, body, String(store_id), orderId, orderNumber),
        markAbandonedCartConverted(supabase, {
          storeId: String(store_id),
          productId: typeof body.product_id === 'string' ? body.product_id : null,
          sessionId: typeof body.abandoned_session_id === 'string' ? body.abandoned_session_id : null,
          orderId,
        }),
      ])
      return NextResponse.json({
        ok: true,
        number: orderNumber,
        order_id: orderId,
        event_id: `purchase_${orderId}`,
      }, { headers })
    }

    if (resolvedMarketId) {
      let { data: rpcResult, error: rpcError } = await createViaRpc(variantLine ?? titleLine)
      const retryable = ['invalid_variant', 'invalid_variant_price', 'invalid_order_total', 'invalid_order_lines']
      if (rpcError && variantLine && retryable.some(key => rpcError!.message.includes(key))) {
        console.warn('[orders/create] retrying without variant:', rpcError.message)
        const retry = await createViaRpc(titleLine)
        rpcResult = retry.data
        rpcError = retry.error
      }
      if (!rpcError) {
        return finishOrder(String(rpcResult))
      }
      console.warn('[orders/create] RPC rejected the order:', rpcError.message)
      const knownErrors: Record<string, string> = {
        duplicate_order: 'Une commande récente existe déjà avec ce numéro.',
        out_of_stock: 'Cette variante n’est plus disponible en quantité suffisante.',
        invalid_market: 'Le marché ne correspond pas à cette boutique.',
        invalid_variant: 'La variante choisie n’existe plus.',
        invalid_variant_price: 'Cette variante n’a pas de prix pour ce marché.',
        invalid_customer: 'Vérifie le nom, le téléphone et la ville. Un numéro à 8 chiffres ou plus suffit, avec ou sans +224.',
        invalid_order_lines: 'Le panier est invalide.',
        invalid_order_total: 'Le total du panier ne correspond pas aux prix de la boutique.',
      }
      const known = Object.entries(knownErrors).find(([key]) => rpcError.message.includes(key))
      return NextResponse.json(
        { error: known?.[1] || 'Impossible de valider cette commande pour le moment.' },
        { status: known ? 400 : 500, headers },
      )
    }

  } catch (err: any) {
    console.error('[orders/create] Crash:', err?.message)
    return NextResponse.json(
      { error: 'Erreur serveur.', detail: String(err?.message ?? err) },
      { status: 500, headers },
    )
  }
}
