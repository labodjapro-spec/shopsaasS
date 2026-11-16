import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET — charger les favoris de l'utilisateur connecté
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data, error } = await supabase
      .from('spy_pub_favorites')
      .select('ad_id, ad_data, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ favorites: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — ajouter un favori
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { ad_data } = await req.json()
    if (!ad_data?.id) return NextResponse.json({ error: 'ad_data.id requis' }, { status: 400 })

    const { error } = await supabase
      .from('spy_pub_favorites')
      .upsert({ user_id: user.id, ad_id: ad_data.id, ad_data }, { onConflict: 'user_id,ad_id' })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — supprimer un favori
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { ad_id } = await req.json()
    if (!ad_id) return NextResponse.json({ error: 'ad_id requis' }, { status: 400 })

    const { error } = await supabase
      .from('spy_pub_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('ad_id', ad_id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
