import Link from 'next/link'
import { ArrowUpRight, Package, ShoppingBag, Users, TrendingUp, Globe2, BarChart3, MessageCircle } from 'lucide-react'
import { requireStore } from '@/lib/context'
import { can } from '@/lib/permissions'
import { formatMoney } from '@/lib/utils'
import { Card, PageHeader, buttonClass } from '@/components/ui'
import { getDateBounds } from '@/lib/date-range'

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{ refus?: string }>
}) {
  const { refus } = await searchParams
  const { supabase, store, permissions, user } = await requireStore()
  const firstName = ((user.user_metadata?.full_name as string | undefined) ?? '').split(' ')[0]
  const isManager = can(permissions, 'products.write') || can(permissions, 'team.write')

  if (isManager) {
    const { start: todayStart, end: todayEnd } = getDateBounds('today')
    const { start: weekStart, end: weekEnd } = getDateBounds('7d')

    const [markets, products, members, todayOrders, weekOrders, pendingOrders] = await Promise.all([
      supabase.from('markets').select('id, currency').eq('store_id', store.id).eq('active', true).limit(1),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('store_id', store.id).eq('status', 'active'),
      supabase.from('store_members').select('user_id', { count: 'exact', head: true }).eq('store_id', store.id),
      supabase.from('orders').select('id, total, status').eq('store_id', store.id)
        .gte('created_at', todayStart.toISOString()).lte('created_at', todayEnd.toISOString()),
      supabase.from('orders').select('id, total, status').eq('store_id', store.id)
        .gte('created_at', weekStart.toISOString()).lte('created_at', weekEnd.toISOString()),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('store_id', store.id).eq('status', 'new'),
    ])

    const currency = String(markets.data?.[0]?.currency ?? 'XOF').trim()
    const todayRows = todayOrders.data ?? []
    const weekRows = weekOrders.data ?? []

    const todayRevenue = todayRows.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0)
    const todayCount = todayRows.length
    const weekRevenue = weekRows
      .filter((o: any) => ['confirmed', 'scheduled', 'shipped', 'delivered'].includes(o.status))
      .reduce((s: number, o: any) => s + (Number(o.total) || 0), 0)
    const weekCount = weekRows.length
    const newOrdersCount = pendingOrders.count ?? 0

    const kpis = [
      {
        label: 'Commandes du jour',
        value: formatMoney(todayRevenue, currency),
        note: `${todayCount} commande${todayCount !== 1 ? 's' : ''} · tous statuts`,
        icon: Globe2,
        gradient: 'from-rose-500 to-rose-700',
        iconBg: 'bg-rose-100 text-rose-700',
        accent: 'text-rose-700',
        border: 'border-rose-100',
        small: true,
        href: '/dashboard/orders?range=today',
      },
      {
        label: 'CA actif cette semaine',
        value: formatMoney(weekRevenue, currency),
        note: `${weekCount} commandes reçues en 7 jours`,
        icon: TrendingUp,
        gradient: 'from-emerald-500 to-emerald-700',
        iconBg: 'bg-emerald-100 text-emerald-700',
        accent: 'text-emerald-700',
        border: 'border-emerald-100',
        small: true,
        href: '/dashboard/orders?range=7d',
      },
      {
        label: 'Nouvelles commandes',
        value: String(newOrdersCount),
        note: 'En attente de confirmation',
        icon: ShoppingBag,
        gradient: 'from-violet-500 to-violet-700',
        iconBg: 'bg-violet-100 text-violet-700',
        accent: 'text-violet-700',
        border: newOrdersCount > 0 ? 'border-violet-300' : 'border-violet-100',
        small: false,
        href: '/dashboard/orders?status=new',
      },
      {
        label: 'Produits actifs',
        value: String(products.count ?? 0),
        note: 'Disponibles à la vente',
        icon: Package,
        gradient: 'from-amber-500 to-orange-600',
        iconBg: 'bg-amber-100 text-amber-700',
        accent: 'text-amber-700',
        border: 'border-amber-100',
        small: false,
        href: '/dashboard/products',
      },
      {
        label: 'Membres équipe',
        value: String(members.count ?? 0),
        note: 'Accès à cette boutique',
        icon: Users,
        gradient: 'from-sky-500 to-blue-600',
        iconBg: 'bg-sky-100 text-sky-700',
        accent: 'text-sky-700',
        border: 'border-sky-100',
        small: false,
        hideOnMobile: true,
        href: '/dashboard/team',
      },
    ]

    // Raccourcis rapides
    const shortcuts = [
      { label: 'Toutes les commandes', href: '/dashboard/orders', icon: ShoppingBag, color: 'text-violet-600 bg-violet-50' },
      { label: 'Comptabilité & graphes', href: '/dashboard/comptabilite', icon: BarChart3, color: 'text-emerald-600 bg-emerald-50' },
      { label: 'Spy Pubs 🔥', href: '/dashboard/spy-pubs', icon: Globe2, color: 'text-rose-600 bg-rose-50' },
    ]

    return (
      <>
        {refus && (
          <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 border border-amber-200">
            Tu n&apos;as pas accès à cette page avec ton rôle actuel.
          </p>
        )}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">
            {firstName ? `${firstName}` : 'Bonjour'} 👋
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Vue d&apos;ensemble rapide de <span className="font-semibold text-zinc-700">{store.name}</span></p>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 mb-6">
          {kpis.map((kpi, i) => {
            const Icon = kpi.icon
            return (
              <Link
                key={kpi.label}
                href={kpi.href}
                className={`metric-card dash-fade-up dash-card-${i + 1} relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${kpi.border} ${(kpi as any).hideOnMobile ? 'hidden sm:block' : ''}`}
              >
                <div className={`absolute -right-4 -top-4 size-20 rounded-full bg-gradient-to-br opacity-10 ${kpi.gradient}`} />
                <div className={`mb-4 inline-flex size-11 items-center justify-center rounded-xl ${kpi.iconBg}`}>
                  <Icon className="size-5" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{kpi.label}</p>
                <p className={`dash-count mt-1 font-bold tracking-tight ${kpi.accent} ${kpi.small ? 'text-2xl' : 'text-4xl'}`}>
                  {kpi.value}
                </p>
                <p className="mt-2 text-xs text-zinc-400">{kpi.note}</p>
              </Link>
            )
          })}
        </div>

        {/* Raccourcis */}
        <div className="grid gap-3 sm:grid-cols-3 mb-6">
          {shortcuts.map(s => {
            const Icon = s.icon
            return (
              <Link
                key={s.href}
                href={s.href}
                className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm hover:border-zinc-200 hover:shadow-md transition-all group"
              >
                <div className={`flex size-10 items-center justify-center rounded-xl ${s.color}`}>
                  <Icon className="size-5" />
                </div>
                <span className="text-sm font-semibold text-zinc-700 group-hover:text-zinc-900">{s.label}</span>
                <ArrowUpRight className="ml-auto size-4 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
              </Link>
            )
          })}
        </div>

        {/* Lien vers comptabilité pour les détails par statut */}
        {can(permissions, 'analytics.read') && (
          <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-zinc-900">Analyse détaillée</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Graphes d&apos;évolution, répartition par statut, meilleurs jours — tout est dans la comptabilité.
                </p>
              </div>
              <Link
                href="/dashboard/comptabilite"
                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 transition"
              >
                <BarChart3 className="size-4" />
                Voir les graphes
              </Link>
            </div>
          </div>
        )}
      </>
    )
  }

  /* ── Vue équipe ── */
  return (
    <>
      {refus && (
        <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 border border-amber-200">
          Tu n&apos;as pas accès à cette page avec ton rôle actuel.
        </p>
      )}
      <PageHeader title={`Bonjour${firstName ? `, ${firstName}` : ''}`} subtitle={store.name} />
      <Card>
        <h2 className="font-semibold">Bienvenue dans l&apos;équipe</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Tu retrouves dans le menu les pages auxquelles ton rôle te donne accès.
        </p>
        {can(permissions, 'orders.read') && (
          <Link href="/dashboard/orders" className={buttonClass('primary', 'mt-4')}>
            Ouvrir les commandes
          </Link>
        )}
      </Card>
    </>
  )
}
