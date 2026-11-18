import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requirePerm } from '@/lib/context'
import { can } from '@/lib/permissions'
import { SubmitButton } from '@/components/form'
import { deleteProduct } from '../actions'
import { ProductEditor } from './ProductEditor'
import BackButton from './BackButton'

type VariantRow = { id: string; stock: number | null; variant_prices: { market_id: string; price: number; compare_at_price: number | null }[] }

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, store, permissions } = await requirePerm('products.read')
  const canEdit = can(permissions, 'products.write')

  const [{ data: product }, { data: variant }, { data: market }] = await Promise.all([
    supabase.from('products').select('id, title, description, status, images').eq('id', id).eq('store_id', store.id).maybeSingle(),
    supabase.from('variants').select('id, stock, variant_prices(market_id, price, compare_at_price)').eq('product_id', id).order('position').limit(1).maybeSingle(),
    supabase.from('markets').select('id, currency').eq('store_id', store.id).eq('active', true).eq('is_default', true).maybeSingle(),
  ])
  if (!product) notFound()

  const v = variant as unknown as VariantRow | null
  const priceRow = v?.variant_prices.find((x) => x.market_id === market?.id)
  const isFreshDraft = product.title === 'Nouveau produit' && !product.description

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <BackButton />
          <h1 className="truncate text-xl font-semibold tracking-tight">{isFreshDraft ? 'Ajouter un produit' : product.title}</h1>
        </div>
        {canEdit && (
          <form action={deleteProduct.bind(null, product.id as string)}>
            <SubmitButton variant="ghost" confirm="Supprimer définitivement ce produit ?" pendingLabel="Suppression…" className="text-red-600 hover:bg-red-50">
              Supprimer
            </SubmitButton>
          </form>
        )}
      </div>

      <ProductEditor
        storeId={store.id}
        productId={product.id as string}
        initial={{
          title: isFreshDraft ? '' : (product.title as string),
          description: (product.description as string) ?? '',
          status: product.status === 'active' ? 'active' : 'draft',
          images: (product.images as string[]) ?? [],
          price: priceRow ? String(priceRow.price) : '',
          compareAt: priceRow?.compare_at_price != null ? String(priceRow.compare_at_price) : '',
          stock: v?.stock != null ? String(v.stock) : '0',
        }}
        currency={(market?.currency as string) ?? 'XOF'}
        hasMarket={Boolean(market)}
        canEdit={canEdit}
      />
    </div>
  )
}
