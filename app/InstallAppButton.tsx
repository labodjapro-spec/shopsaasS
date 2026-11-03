'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Download } from 'lucide-react'
import {
  getInstallPrompt,
  isIosDevice,
  isStandaloneDisplay,
  subscribeInstallPrompt,
  type InstallPromptEvent,
} from '@/lib/pwa/install'

export default function InstallAppButton({
  className,
  label = 'Installer l’app',
}: {
  className?: string
  label?: string
}) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [isIos, setIsIos] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    setIsIos(isIosDevice())
    setIsInstalled(isStandaloneDisplay())
    setInstallPrompt(getInstallPrompt())
    return subscribeInstallPrompt(setInstallPrompt)
  }, [])

  if (isInstalled) return null

  async function install() {
    if (installPrompt) {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      if (choice.outcome === 'accepted') toast.success('ShopSaaS est en cours d’installation.')
      setInstallPrompt(null)
      return
    }
    if (isIos) {
      toast('Sur iPhone : touche Partager, puis Sur l’ecran d’accueil. Ouvre ensuite l’icone ShopSaaS.', { duration: 8000 })
      return
    }
    window.location.href = '/dashboard/settings#application'
  }

  return (
    <button
      type="button"
      onClick={install}
      className={className ?? 'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100'}
      aria-label="Installer l’application ShopSaaS"
    >
      <Download className="size-4" />
      <span>{label}</span>
    </button>
  )
}
