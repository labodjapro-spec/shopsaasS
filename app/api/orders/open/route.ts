import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { STORE_COOKIE } from '@/lib/context'

/**
 * GET /api/orders/open?order_id=xxx&store_id=xxx
 * Switche la boutique active si nécessaire puis redirige vers la commande.
 * Utilisé par les notifications push pour ouvrir la bonne commande même si
 * l'utilisateur est connecté sur une autre boutique.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orderId = searchParams.get('order_id') ?? ''
  const storeId = searchParams.get('store_id') ?? ''

  if (!orderId) {
    return NextResponse.redirect(new URL('/dashboard/orders', req.url))
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // Non connecté → login puis retour
      return NextResponse.redirect(new URL(`/login?next=/api/orders/open?order_id=${orderId}&store_id=${storeId}`, req.url))
    }

    // Si un store_id est fourni, vérifier que l'utilisateur en est membre
    if (storeId) {
      const { data: member } = await supabase
        .from('store_members')
        .select('store_id')
        .eq('user_id', user.id)
        .eq('store_id', storeId)
        .maybeSingle()

      if (member) {
        // Switcher la boutique active
        const jar = await cookies()
        jar.set(STORE_COOKIE, storeId, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 365,
        })
      }
    }

    return NextResponse.redirect(new URL(`/dashboard/orders/${orderId}`, req.url))
  } catch {
    return NextResponse.redirect(new URL('/dashboard/orders', req.url))
  }
}
