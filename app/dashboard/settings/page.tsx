import { requireStore } from '@/lib/context'
import { can } from '@/lib/permissions'
import { storeUrl } from '@/lib/utils'
import { ActionForm, SubmitButton } from '@/components/form'
import { Card, Field, Input, PageHeader } from '@/components/ui'
import { saveSettings, deleteStore } from './actions'
import Link from 'next/link'
import { Users } from 'lucide-react'
import AppSetup from '@/app/dashboard/app/AppSetup'
import AppearanceSettings from '@/components/dashboard/AppearanceSettings'

export default async function SettingsPage() {
  const { store, permissions } = await requireStore()
  const canSettings = can(permissions, 'settings.write')
  const canTeam = can(permissions, 'team.write')

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Réglages" subtitle={storeUrl(store.slug)} />

      <div id="application" className="scroll-mt-20">
        <AppSetup />
      </div>

      <Card>
        <h2 className="mb-1 font-semibold text-zinc-900">Apparence</h2>
        <p className="mb-4 text-sm text-zinc-500">Theme clair ou sombre, et couleur de la barre, sur telephone comme sur PC.</p>
        <AppearanceSettings />
      </Card>

      {canSettings && (
        <Card>
          <h2 className="mb-4 font-semibold text-zinc-900">Informations de la boutique</h2>
          <ActionForm action={saveSettings} className="space-y-5">
            <Field label="Nom de la boutique">
              <Input name="name" defaultValue={store.name} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Couleur principale">
                <Input name="primary_color" type="color" defaultValue={store.primary_color} className="h-10 p-1" />
              </Field>
              <Field label="Numéro WhatsApp" hint="Bouton flottant sur la boutique. Format : +22890000000">
                <Input name="whatsapp" defaultValue={store.whatsapp ?? ''} placeholder="+228…" />
              </Field>
            </div>
            <SubmitButton>Enregistrer</SubmitButton>
          </ActionForm>
        </Card>
      )}

      {canTeam && (
        <Card className="md:hidden">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-zinc-900">Équipe</h2>
              <p className="mt-0.5 text-sm text-zinc-500">Gérer les membres et les rôles</p>
            </div>
            <Link href="/dashboard/team" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
              <Users className="size-4" />
              Gérer
            </Link>
          </div>
        </Card>
      )}

      {canSettings && (
        <Card className="border-red-200 bg-red-50/30">
          <h2 className="mb-1 font-semibold text-red-900">Zone dangereuse</h2>
          <p className="mb-4 text-sm text-red-700">
            La suppression de la boutique est irréversible. Toutes les commandes, produits et pages produits seront définitivement supprimés.
          </p>
          <ActionForm action={deleteStore}>
            <SubmitButton
              variant="danger"
              confirm={`Supprimer définitivement la boutique "${store.name}" ? Cette action est irréversible.`}
              pendingLabel="Suppression…"
            >
              Supprimer cette boutique
            </SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  )
}
