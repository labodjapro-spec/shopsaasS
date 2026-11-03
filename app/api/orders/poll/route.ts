import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const storeIds = (searchParams.get('store_ids') || searchParams.get('store_id') || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
    const since = searchParams.get('since')

    if (!storeIds.length || !since) {
      return NextResponse.json({ orders: [] })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ orders: [] }, { status: 401 })

    const { data: members } = await supabase
      .from('store_members')
      .select('store_id')
      .eq('user_id', user.id)
      .in('store_id', storeIds)

    const allowed = new Set((members ?? []).map((row: { store_id: string }) => row.store_id))
    const scoped = storeIds.filter((id) => allowed.has(id))
    if (!scoped.length) return NextResponse.json({ orders: [] }, { status: 403 })

    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, total, created_at, markets(currency)')
      .in('store_id', scoped)
      .gt('created_at', since)
      .order('created_at', { ascending: true })
      .limit(50)

    const mapped = (orders ?? []).map((o: any) => ({
      id: o.id,
      order_number: o.order_number,
      customer_name: o.customer_name,
      total: o.total,
      currency: o.markets?.currency ?? 'XOF',
      created_at: o.created_at,
    }))

    return NextResponse.json({ orders: mapped })
  } catch (err: any) {
    console.error('[orders/poll]', err.message)
    return NextResponse.json({ orders: [] })
  }
}
