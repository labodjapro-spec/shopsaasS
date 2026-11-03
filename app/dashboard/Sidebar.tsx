'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Home, LogOut, Package, Settings, ShoppingBag, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboardAppearance } from '@/components/dashboard/AppearanceSettings'

const ICONS = { home: Home, orders: ShoppingBag, products: Package, team: Users, settings: Settings }
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; desktopOnly?: boolean }

export function Sidebar({
  items,
  storeSwitcher,
  userLabel,
  roleLabel,
  logoutAction,
}: {
  items: NavItem[]
  storeSwitcher: React.ReactNode
  storeLink?: string
  userLabel: string
  roleLabel: string
  logoutAction: () => Promise<void>
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  useDashboardAppearance()
  const activeHref = items
    .filter(item => item.href === '/dashboard'
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
  const isActive = (href: string) => activeHref === href

  useEffect(() => {
    const saved = window.localStorage.getItem('shopsaas-dashboard-sidebar-collapsed') === 'true'
    setCollapsed(saved)
    document.documentElement.classList.toggle('dashboard-sidebar-collapsed', saved)
    return () => {
      document.documentElement.classList.remove('dashboard-sidebar-collapsed')
      document.body.classList.remove('dashboard-dark')
      document.body.style.removeProperty('--dashboard-accent')
      document.body.style.removeProperty('--dashboard-accent-foreground')
      document.body.style.removeProperty('--dashboard-sidebar-background')
      document.body.style.removeProperty('--dashboard-sidebar-foreground')
    }
  }, [])

  function toggleSidebar() {
    setCollapsed(current => {
      const next = !current
      window.localStorage.setItem('shopsaas-dashboard-sidebar-collapsed', String(next))
      document.documentElement.classList.toggle('dashboard-sidebar-collapsed', next)
      return next
    })
  }

  return (
    <>
      <aside className={`dashboard-sidebar fixed inset-y-0 left-0 z-30 hidden flex-col border-r shadow-[1px_0_0_0_#f4f4f5] transition-[width] duration-200 md:flex ${collapsed ? 'w-[4.5rem]' : 'w-64'}`}>
        <div className={`flex items-center gap-2.5 py-5 ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
          <span className="dashboard-brand-mark inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-base font-extrabold shadow-md">
            S
          </span>
          {!collapsed && <span className="truncate text-lg font-extrabold tracking-tight dashboard-strong">ShopSaaS</span>}
          <button
            type="button"
            onClick={toggleSidebar}
            title={collapsed ? 'Ouvrir la barre' : 'Réduire la barre'}
            aria-label={collapsed ? 'Ouvrir la barre' : 'Réduire la barre'}
            className={`dashboard-sidebar-control absolute top-5 flex size-8 items-center justify-center rounded-lg border shadow-sm transition ${collapsed ? '-right-3' : 'right-3'}`}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {!collapsed && <div className="dashboard-store-switcher px-3">{storeSwitcher}</div>}

        <nav className={`mt-4 flex-1 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          {items.map((item) => {
            const Icon = ICONS[item.icon]
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
                className={cn(
                  'dashboard-nav-link group flex min-h-11 items-center rounded-xl py-2.5 text-base font-semibold transition-all duration-150',
                  collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                  active ? 'dashboard-nav-active shadow-sm' : 'dashboard-nav-inactive',
                )}
                style={active ? { backgroundColor: 'var(--dashboard-accent)', color: 'var(--dashboard-accent-foreground)' } : undefined}
              >
                <Icon className={cn('size-4 transition-transform duration-150', active ? '' : 'group-hover:scale-110')} />
                {!collapsed && <span>{item.label}</span>}
                {active && !collapsed && <span className="ml-auto size-1.5 rounded-full bg-white/60" />}
              </Link>
            )
          })}
        </nav>

        <div className={`dashboard-sidebar-footer mt-auto border-t ${collapsed ? 'p-2' : 'p-3'}`}>
          {!collapsed && (
            <div className="mb-2 flex min-w-0 items-center gap-3 rounded-xl px-3 py-3">
              <span className="dashboard-avatar flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                {(userLabel.trim()[0] || 'S').toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold dashboard-strong">{userLabel}</p>
                <p className="truncate text-sm dashboard-muted">{roleLabel}</p>
              </div>
            </div>
          )}
          <form action={logoutAction}>
            <button
              aria-label="Se déconnecter"
              className="dashboard-sidebar-control flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition"
              title="Se déconnecter"
            >
              <LogOut className="size-5" />
              {!collapsed && <span>Déconnexion</span>}
            </button>
          </form>
        </div>
      </aside>

      <div className="dashboard-sidebar sticky top-0 z-30 border-b md:hidden">
        <header className="flex items-center gap-2 px-3 py-2.5">
          <div className="dashboard-store-switcher min-w-0 flex-1">{storeSwitcher}</div>
          <form action={logoutAction}>
            <button aria-label="Se déconnecter" className="dashboard-sidebar-control flex size-10 items-center justify-center rounded-xl border" title="Se déconnecter">
              <LogOut className="size-5" />
            </button>
          </form>
        </header>
      </div>
      <nav
        aria-label="Navigation principale"
        className="dashboard-sidebar fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t px-1 pt-2 shadow-[0_-8px_24px_rgba(24,24,27,0.08)] backdrop-blur md:hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
      >
        {items.filter(item => !item.desktopOnly).map((item) => {
          const Icon = ICONS[item.icon]
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'dashboard-nav-link flex min-w-[68px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-xs font-semibold leading-tight transition-colors',
                active ? 'dashboard-nav-active' : 'dashboard-nav-inactive',
              )}
              style={active ? { color: 'var(--dashboard-accent)' } : undefined}
            >
              <span className={cn('flex size-9 items-center justify-center rounded-xl', active ? 'dashboard-mobile-active-icon' : '')} style={active ? { backgroundColor: 'color-mix(in srgb, var(--dashboard-accent) 14%, transparent)', color: 'var(--dashboard-accent)' } : undefined}>
                <Icon className="size-5" />
              </span>
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
