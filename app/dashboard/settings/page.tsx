import { requirePerm } from '@/lib/context'
import { storeUrl } from '@/lib/utils'
import { ActionForm, SubmitButton } from '@/components/form'
import { Card, Field, Input, PageHeader } from '@/components/ui'
import { saveSettings, deleteStore } from './actions'
import { LogoField } from './LogoField'

export default async function SettingsPage() {
  const { store } = await requirePerm('settings.write')
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Réglages" subtitle={storeUrl(store.slug)} />

      {/* Infos générales */}
      <Card>
        <h2 className="font-semibold text-zinc-900 mb-4">Informations de la boutique</h2>
        <ActionForm action={saveSettings} className="space-y-5">
          <Field label="Nom de la boutique">
            <Input name="name" defaultValue={store.name} required />
          </Field>
          <Field label="Logo">
            <LogoField storeId={store.id} initial={store.logo_url} />
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

      {/* Zone dangereuse */}
      <Card className="border-red-200 bg-red-50/30">
        <h2 className="font-semibold text-red-900 mb-1">Zone dangereuse</h2>
        <p className="text-sm text-red-700 mb-4">
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
    </div>
  )
}
