export type DashboardMode = 'light' | 'dark'

export type DashboardAppearance = {
  mode: DashboardMode
  sidebarColor: string
}

const STORAGE_KEY = 'shopsaas-dashboard-appearance'

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

export function readDashboardAppearance(): DashboardAppearance {
  try {
    const appearance = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      mode: appearance.mode === 'dark' ? 'dark' : 'light',
      sidebarColor: typeof appearance.sidebarColor === 'string' && /^#[0-9a-f]{6}$/i.test(appearance.sidebarColor)
        ? appearance.sidebarColor
        : '',
    }
  } catch {
    return { mode: 'light', sidebarColor: '' }
  }
}

export function applyDashboardAppearance({ mode, sidebarColor }: DashboardAppearance) {
  const effectiveSidebarColor = sidebarColor || (mode === 'dark' ? '#191a25' : '#ffffff')
  document.body.classList.toggle('dashboard-dark', mode === 'dark')
  document.body.style.setProperty('--dashboard-sidebar-background', effectiveSidebarColor)
  document.body.style.setProperty('--dashboard-sidebar-foreground', readableForeground(effectiveSidebarColor))
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, sidebarColor }))
}

export function clearDashboardAppearanceStyles() {
  document.documentElement.classList.remove('dashboard-sidebar-collapsed')
  document.body.classList.remove('dashboard-dark')
  document.body.style.removeProperty('--dashboard-accent')
  document.body.style.removeProperty('--dashboard-accent-foreground')
  document.body.style.removeProperty('--dashboard-sidebar-background')
  document.body.style.removeProperty('--dashboard-sidebar-foreground')
}
