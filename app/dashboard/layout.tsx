import { requireStore } from '@/lib/context'
import { can } from '@/lib/permissions'
import { storeUrl } from '@/lib/utils'
import { logout } from '@/app/(auth)/actions'
import { Sidebar, type NavItem } from './Sidebar'
import { StoreSwitcher } from './StoreSwitcher'
import OrderNotification from '@/components/dashboard/OrderNotification'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, memberships, current, store, permissions } = await requireStore()

  // Récupérer les marchés pour filtrer les vraies boutiques (celles avec marché = créées via onboarding)
  const storeIds = memberships.map(m => m.store_id)
  const { data: marketsData } = await (await (await import('@/lib/supabase/server')).createClient())
    .from('markets')
    .select('store_id')
    .in('store_id', storeIds)

  const storesWithMarket = new Set((marketsData ?? []).map((m: any) => m.store_id))

  // N'afficher dans le switcher que les boutiques qui ont un marché configuré
  const switcherStores = memberships
    .filter(m => storesWithMarket.has(m.store_id))
    .map(m => ({ id: m.store_id, name: m.stores.name }))

  const items: NavItem[] = [{ href: '/dashboard', label: 'Accueil', icon: 'home' }]
  if (can(permissions, 'orders.read')) {
    items.push({ href: '/dashboard/orders', label: 'Commandes', icon: 'orders' })
  }
  if (can(permissions, 'products.read')) items.push({ href: '/dashboard/products', label: 'Produits', icon: 'products' })
  if (can(permissions, 'pages.write')) items.push({ href: `/boutiques?parent=${store.id}`, label: 'Pages produits', icon: 'products' })
  if (can(permissions, 'team.write')) items.push({ href: '/dashboard/team', label: 'Équipe', icon: 'team', mobileHide: true })
  if (can(permissions, 'settings.write')) items.push({ href: '/dashboard/settings', label: 'Réglages', icon: 'settings' })

  const userLabel = (user.user_metadata?.full_name as string | undefined) || user.email || 'Moi'

  return (
    <div className="min-h-screen">
      <Sidebar
        items={items}
        storeLink={storeUrl(store.slug)}
        userLabel={userLabel}
        roleLabel={current.roles.name}
        logoutAction={logout}
        storeSwitcher={
          <StoreSwitcher
            stores={switcherStores}
            currentId={store.id}
          />
        }
      />
      <main className="dashboard-main pb-24 transition-[padding] duration-200 md:pb-0 md:pl-64">
        <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-10">{children}</div>
      </main>
      {/* Notification son + toast pour les nouvelles commandes */}
      {can(permissions, 'orders.read') && <OrderNotification storeId={store.id} />}
    </div>
  )
}
