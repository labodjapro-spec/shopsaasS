'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Home, LogOut, Moon, Package, Palette, Settings, ShoppingBag, Sun, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import InstallAppButton from '@/app/InstallAppButton'

const ICONS = { home: Home, orders: ShoppingBag, products: Package, team: Users, settings: Settings }
const SIDEBAR_PRESETS = [
  { name: 'Violet clair', value: '#eeeaff' },
  { name: 'Bleu', value: '#2442b8' },
  { name: 'Violet', value: '#45208c' },
  { name: 'Vert profond', value: '#145a4b' },
  { name: 'Charbon', value: '#242432' },
  { name: 'Blanc', value: '#ffffff' },
]

function readableForeground(hex: string) {
  const raw = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(raw)) return '#ffffff'
  const channels = [0, 2, 4].map(index => {
    const value = parseInt(raw.slice(index, index + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  return luminance > 0.179 ? '#211b38' : '#ffffff'
}

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS }

export function Sidebar({
  items,
  storeSwitcher,
  storeLink,
  userLabel,
  roleLabel,
  logoutAction,
}: {
  items: NavItem[]
  storeSwitcher: React.ReactNode
  storeLink: string
  userLabel: string
  roleLabel: string
  logoutAction: () => Promise<void>
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [dashboardMode, setDashboardMode] = useState<'light' | 'dark'>('light')
  const [sidebarColor, setSidebarColor] = useState('')
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
    try {
      const appearance = JSON.parse(window.localStorage.getItem('shopsaas-dashboard-appearance') || '{}')
      if (appearance.mode === 'dark' || appearance.mode === 'light') setDashboardMode(appearance.mode)
      if (typeof appearance.sidebarColor === 'string' && /^#[0-9a-f]{6}$/i.test(appearance.sidebarColor)) setSidebarColor(appearance.sidebarColor)
    } catch { /* garder les réglages par défaut */ }
    return () => {
      document.documentElement.classList.remove('dashboard-sidebar-collapsed')
      document.body.classList.remove('dashboard-dark')
      document.body.style.removeProperty('--dashboard-accent')
      document.body.style.removeProperty('--dashboard-accent-foreground')
      document.body.style.removeProperty('--dashboard-sidebar-background')
      document.body.style.removeProperty('--dashboard-sidebar-foreground')
    }
  }, [])

  useEffect(() => {
    const effectiveSidebarColor = sidebarColor || (dashboardMode === 'dark' ? '#191a25' : '#ffffff')
    document.body.classList.toggle('dashboard-dark', dashboardMode === 'dark')
    document.body.style.setProperty('--dashboard-sidebar-background', effectiveSidebarColor)
    document.body.style.setProperty('--dashboard-sidebar-foreground', readableForeground(effectiveSidebarColor))
    window.localStorage.setItem('shopsaas-dashboard-appearance', JSON.stringify({
      mode: dashboardMode,
      sidebarColor,
    }))
  }, [dashboardMode, sidebarColor])

  function toggleSidebar() {
    setCollapsed(current => {
      const next = !current
      window.localStorage.setItem('shopsaas-dashboard-sidebar-collapsed', String(next))
      document.documentElement.classList.toggle('dashboard-sidebar-collapsed', next)
      return next
    })
  }

  const appearancePanel = appearanceOpen ? (
    <section
      aria-label="Personnaliser l’apparence"
      className="dashboard-appearance-panel fixed bottom-24 left-3 z-[60] w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border p-4 shadow-2xl md:bottom-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Apparence</h2>
          <p className="mt-1 text-sm dashboard-muted">Change l’ambiance de toute la barre.</p>
        </div>
        <button type="button" onClick={() => setAppearanceOpen(false)} className="rounded-lg px-2 py-1 text-sm dashboard-muted hover:bg-black/5" aria-label="Fermer les réglages">
          ✕
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setDashboardMode('light')}
          aria-pressed={dashboardMode === 'light'}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${dashboardMode === 'light' ? 'dashboard-mode-selected' : ''}`}
        >
          <Sun size={17} /> Clair
        </button>
        <button
          type="button"
          onClick={() => setDashboardMode('dark')}
          aria-pressed={dashboardMode === 'dark'}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${dashboardMode === 'dark' ? 'dashboard-mode-selected' : ''}`}
        >
          <Moon size={17} /> Sombre
        </button>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Couleur de la barre entière</p>
          <button
            type="button"
            onClick={() => setSidebarColor('')}
            className="text-xs font-semibold dashboard-muted underline underline-offset-2 hover:opacity-75"
          >
            Automatique
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SIDEBAR_PRESETS.map(preset => (
            <button
              key={preset.value}
              type="button"
              title={preset.name}
              aria-label={`Couleur ${preset.name}`}
              aria-pressed={sidebarColor.toLowerCase() === preset.value}
              onClick={() => setSidebarColor(preset.value)}
              className={`size-8 rounded-full border-2 transition-transform hover:scale-110 ${sidebarColor.toLowerCase() === preset.value ? 'border-violet-500 ring-2 ring-violet-300 ring-offset-2' : 'border-zinc-300'}`}
              style={{ backgroundColor: preset.value }}
            />
          ))}
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold">
            <span>Personnalisée</span>
            <input
              aria-label="Choisir la couleur de toute la barre latérale"
              type="color"
              value={sidebarColor || (dashboardMode === 'dark' ? '#191a25' : '#ffffff')}
              onChange={event => setSidebarColor(event.target.value)}
              className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
            />
          </label>
        </div>
      </div>
    </section>
  ) : null

  return (
    <>
      {/* Desktop */}
      <aside className={`dashboard-sidebar fixed inset-y-0 left-0 z-30 hidden flex-col border-r shadow-[1px_0_0_0_#f4f4f5] transition-[width] duration-200 md:flex ${collapsed ? 'w-[4.5rem]' : 'w-64'}`}>
        {/* Logo */}
        <div className={`flex items-center gap-2.5 py-5 ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
          <span className="dashboard-brand-mark inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-base font-extrabold shadow-md">
            S
          </span>
          {!collapsed && <span className="truncate text-lg font-extrabold tracking-tight dashboard-strong">ShopSaaS</span>}
          <button
            type="button"
            onClick={toggleSidebar}
            title={collapsed ? 'Ouvrir la barre latérale' : 'Réduire la barre latérale'}
            aria-label={collapsed ? 'Ouvrir la barre latérale' : 'Réduire la barre latérale'}
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
                  active
                    ? 'dashboard-nav-active shadow-sm'
                    : 'dashboard-nav-inactive',
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
          <div className={`flex ${collapsed ? 'flex-col' : 'items-center'} gap-2`}>
            <button
              type="button"
              onClick={() => setAppearanceOpen(open => !open)}
              aria-expanded={appearanceOpen}
              className="dashboard-sidebar-control flex min-h-11 flex-1 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition hover:bg-black/5"
              title="Personnaliser l’apparence"
            >
              <Palette className="size-5 shrink-0" />
              {!collapsed && <span>Apparence</span>}
            </button>
            <form action={logoutAction}>
              <button
                aria-label="Se déconnecter"
                className="dashboard-sidebar-control flex size-11 items-center justify-center rounded-xl transition"
                title="Se déconnecter"
              >
                <LogOut className="size-5" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile */}
      <div className="dashboard-sidebar sticky top-0 z-30 border-b md:hidden">
        <header className="flex items-center justify-between gap-2 px-3 py-2.5">
          <div className="dashboard-store-switcher min-w-0 flex-1">{storeSwitcher}</div>
          <button type="button" onClick={() => setAppearanceOpen(open => !open)} aria-label="Personnaliser l’apparence" aria-expanded={appearanceOpen} className="dashboard-sidebar-control flex size-10 items-center justify-center rounded-xl border">
            <Palette className="size-5" />
          </button>
          <InstallAppButton />
          <form action={logoutAction}>
            <button aria-label="Se déconnecter" className="dashboard-sidebar-control rounded-lg p-2" title="Se déconnecter">
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
          {items.map((item) => {
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
      {appearancePanel}
    </>
  )
}
