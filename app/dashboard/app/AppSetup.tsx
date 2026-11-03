'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Bell, CheckCircle2, Download, Smartphone, Stethoscope, XCircle } from 'lucide-react'
import InstallAppButton from '@/app/InstallAppButton'
import { isIosDevice, isStandaloneDisplay, subscribeInstallPrompt } from '@/lib/pwa/install'
import { isPushFlagEnabled, removePushSubscription, runPushDiagnostic, savePushSubscription, setPushFlag, type PushCheck } from '@/lib/push/browser'

export default function AppSetup() {
  const [installed, setInstalled] = useState(false)
  const [ios, setIos] = useState(false)
  const [canPrompt, setCanPrompt] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [testing, setTesting] = useState(false)
  const [diagnostic, setDiagnostic] = useState<{ ok: boolean; checks: PushCheck[] } | null>(null)

  async function testPush() {
    setTesting(true)
    setDiagnostic(null)
    try {
      const result = await runPushDiagnostic()
      setDiagnostic(result)
      if (result.ok) {
        setPushEnabled(true)
        toast.success('Notification test envoyée. Elle doit apparaître dans quelques secondes.')
      } else {
        toast.error('Un réglage bloque les notifications. Regarde la liste.')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Le test a échoué.')
    } finally {
      setTesting(false)
    }
  }

  useEffect(() => {
    let active = true
    setInstalled(isStandaloneDisplay())
    setIos(isIosDevice())
    setPushEnabled(isPushFlagEnabled())
    setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
    const unsub = subscribeInstallPrompt((event) => setCanPrompt(Boolean(event)))

    if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
      void (async () => {
        try {
          const registration = await navigator.serviceWorker.ready
          const sub = await registration.pushManager.getSubscription()
          if (!active) return
          if (Notification.permission === 'granted' && (sub || isPushFlagEnabled())) {
            await savePushSubscription()
            if (active) setPushEnabled(true)
          } else if (!sub) {
            setPushFlag(false)
            if (active) setPushEnabled(false)
          }
        } catch {
          setPushFlag(false)
          if (active) setPushEnabled(false)
        }
      })()
    }

    return () => {
      active = false
      unsub()
    }
  }, [])

  async function enablePush() {
    if (ios && !installed) {
      toast('Installe d’abord l’app sur l’ecran d’accueil, puis rouvre-la depuis l’icone.', { duration: 7000 })
      return
    }
    setPushBusy(true)
    try {
      await savePushSubscription()
      setPushEnabled(true)
      setPermission('granted')
      toast.success('Alertes commandes activees, meme si l’ecran est verrouille.')
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
      toast.success('Alertes desactivees sur cet appareil.')
    } catch {
      toast.error('Impossible de desactiver les alertes.')
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
              Installe l’app, puis active les alertes. Les commandes arrivent meme ecran verrouille.
            </p>
            {installed ? (
              <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="size-4" /> Application installee sur cet appareil
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <InstallAppButton
                  label={canPrompt ? 'Installer maintenant' : 'Installer l’application'}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800"
                />
                <ul className="space-y-1.5 text-sm text-zinc-600">
                  {ios ? (
                    <>
                      <li>1. Ouvre ShopSaaS dans Safari.</li>
                      <li>2. Touche Partager, puis Sur l’ecran d’accueil.</li>
                      <li>3. Ouvre l’icone ShopSaaS, puis active les alertes ci-dessous.</li>
                    </>
                  ) : (
                    <>
                      <li>Sur Android, dans Chrome, choisis <strong>Installer l’application</strong>. Pas « Creer un raccourci » : le raccourci reste dans Chrome.</li>
                      <li>Si Chrome dit « Impossible d’installer », ouvre le dossier <strong>android-app</strong> dans Android Studio, genere l’APK, et installe-le sur le telephone.</li>
                      <li>Ensuite, ouvre ShopSaaS et appuie sur « Activer les alertes ».</li>
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
              Un seul appareil = une alerte. Sur PC, laisse Chrome ouvert en arriere-plan (icone dans la barre des taches), sinon Windows coupe le push.
            </p>
            <p className="mt-2 text-xs font-medium text-zinc-500">
              Permission navigateur : {permission === 'granted' ? 'autorisee' : permission === 'denied' ? 'bloquee' : permission}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {pushEnabled ? (
                <button
                  type="button"
                  onClick={disablePush}
                  disabled={pushBusy}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                >
                  Desactiver sur cet appareil
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
              <button
                type="button"
                onClick={testPush}
                disabled={testing}
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-60"
              >
                <Stethoscope className="size-4" />
                {testing ? 'Test en cours…' : 'Tester les notifications'}
              </button>
            </div>
            {diagnostic && (
              <ul className="mt-4 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                {diagnostic.checks.map((check: PushCheck) => (
                  <li key={check.id} className="flex items-start gap-2 text-sm">
                    {check.ok
                      ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      : <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" />}
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-900">{check.label}</p>
                      {check.detail && <p className="text-xs text-zinc-600 break-words">{check.detail}</p>}
                      {!check.ok && check.fix && <p className="mt-0.5 text-xs font-medium text-red-700">→ {check.fix}</p>}
                    </div>
                  </li>
                ))}
                {diagnostic.ok && (
                  <li className="rounded-lg bg-emerald-50 p-2 text-xs font-medium text-emerald-800">
                    Tout est bon côté serveur. Si la notification test n’apparaît pas, le blocage vient du téléphone :
                    notifications de l’app / de Chrome désactivées, mode Ne pas déranger, ou économie de batterie.
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-950">
          <Download className="size-4" /> Application telephone (APK)
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>Sur PC, ouvre le dossier <strong>android-app</strong> avec Android Studio (voir GUIDE-APP-ANDROID.md).</li>
          <li>Build → Build APK(s), puis envoie le fichier aux telephones.</li>
          <li>Installe l’APK, connecte-toi, active les alertes, puis appuie sur « Tester les notifications ».</li>
        </ol>
      </section>
    </div>
  )
}
