'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Bell, CheckCircle2, Download, Smartphone } from 'lucide-react'
import InstallAppButton from '@/app/InstallAppButton'
import { isIosDevice, isStandaloneDisplay, subscribeInstallPrompt } from '@/lib/pwa/install'
import { isPushFlagEnabled, removePushSubscription, savePushSubscription } from '@/lib/push/browser'

export default function AppSetup() {
  const [installed, setInstalled] = useState(false)
  const [ios, setIos] = useState(false)
  const [canPrompt, setCanPrompt] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')

  useEffect(() => {
    setInstalled(isStandaloneDisplay())
    setIos(isIosDevice())
    setPushEnabled(isPushFlagEnabled())
    setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
    return subscribeInstallPrompt((event) => setCanPrompt(Boolean(event)))
  }, [])

  async function enablePush() {
    if (ios && !installed) {
      toast('Installe d’abord l’app sur l’écran d’accueil, puis rouvre-la depuis l’icône.', { duration: 7000 })
      return
    }
    setPushBusy(true)
    try {
      await savePushSubscription()
      setPushEnabled(true)
      setPermission('granted')
      toast.success('Alertes commandes activées, même si l’app est fermée.')
    } catch (error: any) {
      toast.error(error?.message || 'Impossible d’activer les notifications.')
    } finally {
      setPushBusy(false)
    }
  }

  async function disablePush() {
    setPushBusy(true)
    try {
      await removePushSubscription()
      setPushEnabled(false)
      toast.success('Alertes désactivées sur cet appareil.')
    } catch {
      toast.error('Impossible de désactiver les alertes.')
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-700 text-white">
            <Smartphone className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-zinc-950">Installer ShopSaaS</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Installe l’app sur le téléphone ou le PC de l’équipe. Ensuite, les commandes arrivent comme sur WhatsApp, même si l’écran est verrouillé.
            </p>
            {installed ? (
              <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="size-4" /> Application installée sur cet appareil
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <InstallAppButton
                  label={canPrompt ? 'Installer maintenant' : 'Comment installer'}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800"
                />
                <ul className="space-y-1.5 text-sm text-zinc-600">
                  {ios ? (
                    <>
                      <li>1. Ouvre ShopSaaS dans <strong>Safari</strong>.</li>
                      <li>2. Touche <strong>Partager</strong>, puis <strong>Sur l’écran d’accueil</strong>.</li>
                      <li>3. Ouvre l’icône ShopSaaS, puis active les alertes ci-dessous.</li>
                    </>
                  ) : (
                    <>
                      <li>1. Ouvre ShopSaaS dans <strong>Chrome</strong> (Android ou Windows).</li>
                      <li>2. Menu ⋮ → <strong>Installer l’application</strong>, ou le bouton ci-dessus.</li>
                      <li>3. Active les alertes commandes une seule fois.</li>
                    </>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <Bell className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-zinc-950">Notifications de commandes</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Un seul appareil = une alerte. Les anciennes inscriptions en double sont nettoyées automatiquement.
            </p>
            <p className="mt-2 text-xs font-medium text-zinc-500">
              Permission navigateur : {permission === 'granted' ? 'autorisée' : permission === 'denied' ? 'bloquée' : permission}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {pushEnabled ? (
                <button
                  type="button"
                  onClick={disablePush}
                  disabled={pushBusy}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                >
                  Désactiver sur cet appareil
                </button>
              ) : (
                <button
                  type="button"
                  onClick={enablePush}
                  disabled={pushBusy}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {pushBusy ? 'Activation…' : 'Activer les alertes'}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-950">
          <Download className="size-4" /> Pour l’équipe
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>Envoie le lien du dashboard à chaque membre.</li>
          <li>Chacun installe l’app sur <strong>son</strong> téléphone (pas un raccourci de page boutique).</li>
          <li>Chacun appuie sur « Activer les alertes » une fois connecté.</li>
        </ol>
      </section>
    </div>
  )
}
