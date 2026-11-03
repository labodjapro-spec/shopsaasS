import { requireStore } from '@/lib/context'
import { PageHeader } from '@/components/ui'
import AppSetup from './AppSetup'

export default async function MerchantAppPage() {
  await requireStore()
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Application"
        subtitle="Installe ShopSaaS sur tes appareils et reçois les commandes même quand tu n’es pas sur le site."
      />
      <AppSetup />
    </div>
  )
}
