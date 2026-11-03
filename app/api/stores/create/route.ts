import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminSupabase } from '@supabase/supabase-js'
import { buildStorePage } from '@/lib/store-builder/boutique-themes'
import { findCountry } from '@/lib/countries'

function getAdminClient() {
  return createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth via Bearer token OU cookie session
    const authHeader = req.headers.get('Authorization')
    let user = null
    if (authHeader?.startsWith('Bearer ')) {
      const { data } = await supabase.auth.getUser(authHeader.slice(7))
      user = data.user
    }
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await req.json()
    const {
      name, slug,
      theme_id = 'nature-vert',
      country_code,
    } = body

    if (!name?.trim()) return NextResponse.json({ error: 'Le nom est requis.' }, { status: 400 })
    if (!slug?.trim()) return NextResponse.json({ error: 'Le slug est requis.' }, { status: 400 })
    const country = findCountry(String(country_code ?? ''))
    if (!country) return NextResponse.json({ error: 'Choisis le pays et le marché de cette boutique.' }, { status: 400 })

    // Unicité du slug
    const { data: existing } = await supabase
      .from('stores').select('id').eq('slug', slug.trim()).maybeSingle()
    if (existing) {
      const variant = `${slug.trim()}-${Math.floor(10 + Math.random() * 90)}`
      return NextResponse.json({ error: `Ce slug est déjà utilisé. Essaie : ${variant}` }, { status: 400 })
    }

    const marketPayload = {
      name: country.name,
      country_code: country.code,
      currency: country.currency,
      phone_prefix: country.prefix,
      shipping_fee: 0,
      cities: country.cities,
      is_default: true,
      active: true,
    }

    const admin = getAdminClient()

    const { data: rpcId, error: rpcError } = await supabase.rpc('create_store', {
      p_name: name.trim(),
      p_slug: slug.trim(),
      p_market: marketPayload,
    })

    if (rpcError || !rpcId) {
      console.error('[stores/create] create_store:', rpcError?.message)
      return NextResponse.json(
        { error: rpcError?.message?.includes('slug_reserved') ? 'Cette adresse est réservée.' : 'Impossible de créer la boutique et son marché.' },
        { status: 400 },
      )
    }
    const storeId = String(rpcId)

    // ── Store settings + page builder ──────────────────────────────────────
    const { error: settingsError } = await admin.from('store_settings').upsert(
      { store_id: storeId, theme_id },
      { onConflict: 'store_id' }
    )
    if (settingsError) console.error('[stores/create] settings:', settingsError.message)

    const builderJson = buildStorePage(theme_id, name.trim(), null)
    const { error: pageError } = await admin.from('store_pages').upsert(
      { store_id: storeId, title: 'Accueil', slug: 'home', is_published: false, builder_json: builderJson },
      { onConflict: 'store_id,slug' }
    )
    if (pageError) console.error('[stores/create] home page:', pageError.message)

    return NextResponse.json({ data: { id: storeId, name: name.trim(), slug: slug.trim() } })

  } catch (err: any) {
    console.error('[API /stores/create] Unexpected error:', err)
    return NextResponse.json({ error: err.message || 'Erreur interne' }, { status: 500 })
  }
}
