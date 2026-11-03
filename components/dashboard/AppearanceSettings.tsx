'use client'

import { Moon, Sun } from 'lucide-react'
import { applyDashboardAppearance, readDashboardAppearance, type DashboardMode } from '@/lib/dashboard-appearance'
import { useEffect, useState } from 'react'

const SIDEBAR_PRESETS = [
  { name: 'Violet clair', value: '#eeeaff' },
  { name: 'Bleu', value: '#2442b8' },
  { name: 'Violet', value: '#45208c' },
  { name: 'Vert profond', value: '#145a4b' },
  { name: 'Charbon', value: '#242432' },
  { name: 'Blanc', value: '#ffffff' },
]

export function useDashboardAppearance() {
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('light')
  const [sidebarColor, setSidebarColor] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const appearance = readDashboardAppearance()
    setDashboardMode(appearance.mode)
    setSidebarColor(appearance.sidebarColor)
    applyDashboardAppearance(appearance)
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    applyDashboardAppearance({ mode: dashboardMode, sidebarColor })
  }, [dashboardMode, sidebarColor, ready])

  return { dashboardMode, setDashboardMode, sidebarColor, setSidebarColor }
}

export default function AppearanceSettings() {
  const { dashboardMode, setDashboardMode, sidebarColor, setSidebarColor } = useDashboardAppearance()

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setDashboardMode('light')}
          aria-pressed={dashboardMode === 'light'}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${dashboardMode === 'light' ? 'dashboard-mode-selected border-violet-300 bg-violet-50 text-violet-700' : 'border-zinc-200 text-zinc-700'}`}
        >
          <Sun size={17} /> Clair
        </button>
        <button
          type="button"
          onClick={() => setDashboardMode('dark')}
          aria-pressed={dashboardMode === 'dark'}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${dashboardMode === 'dark' ? 'dashboard-mode-selected border-violet-300 bg-violet-50 text-violet-700' : 'border-zinc-200 text-zinc-700'}`}
        >
          <Moon size={17} /> Sombre
        </button>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-zinc-800">Couleur de la barre</p>
          <button type="button" onClick={() => setSidebarColor('')} className="text-xs font-semibold text-zinc-500 underline underline-offset-2">
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
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700">
            <span>Perso</span>
            <input
              aria-label="Choisir la couleur de la barre"
              type="color"
              value={sidebarColor || (dashboardMode === 'dark' ? '#191a25' : '#ffffff')}
              onChange={event => setSidebarColor(event.target.value)}
              className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
            />
          </label>
        </div>
      </div>
    </div>
  )
}
