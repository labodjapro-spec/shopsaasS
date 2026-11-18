'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Package, Trash2, Check } from 'lucide-react'
import { Badge, buttonClass } from '@/components/ui'
import { formatMoney } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import ConfirmationModal from '@/components/ConfirmationModal'
import toast from 'react-hot-toast'

type Row = {
  id: string
  title: string
  status: 'draft' | 'active' | 'archived'
  images: string[]
  variants: { id: string; stock: number | null; variant_prices: { market_id: string; price: number }[] }[]
}

const STATUS = {
  active: { label: 'Actif', color: 'green' },
  draft: { label: 'Brouillon', color: 'zinc' },
  archived: { label: 'Archivé', color: 'orange' },
} as const

interface ProductsTableProps {
  products: Row[]
  market: { id: string; currency: string } | null
  canEdit: boolean
}

export default function ProductsTable({ products: initialProducts, market, canEdit }: ProductsTableProps) {
  const supabase = createClient()
  const [products, setProducts] = useState<Row[]>(initialProducts)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === products.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(products.map(p => p.id)))
    }
  }

  async function deleteSelected() {
    if (!selected.size) return
    setDeleting(true)
    const ids = Array.from(selected)
    const { error } = await supabase.from('products').delete().in('id', ids)
    if (!error) {
      setProducts(prev => prev.filter(p => !selected.has(p.id)))
      setSelected(new Set())
      toast.success(`${ids.length} produit(s) supprimé(s).`)
    } else {
      toast.error('Erreur lors de la suppression : ' + error.message)
    }
    setDeleting(false)
  }

  if (products.length === 0) return null

  const allSelected = selected.size === products.length && products.length > 0

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
      {/* Modal de confirmation suppression */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={deleteSelected}
        title={`Supprimer ${selected.size} produit(s) ?`}
        message="Cette action est irréversible. Les produits sélectionnés seront définitivement supprimés."
        confirmLabel="Oui, supprimer"
        cancelLabel="Annuler"
        variant="danger"
      />
      {/* Barre d'actions multi-select */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-violet-50 border-b border-violet-100">
          <span className="text-sm font-medium text-violet-800">
            {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            <Trash2 className="size-3.5" />
            {deleting ? 'Suppression...' : 'Supprimer'}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-violet-600 hover:underline ml-auto"
          >
            Annuler
          </button>
        </div>
      )}

      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            {canEdit && (
              <th className="px-4 py-3 w-10">
                <button
                  onClick={toggleAll}
                  className={`size-4 rounded border-2 flex items-center justify-center transition-colors ${
                    allSelected ? 'bg-violet-600 border-violet-600 text-white' : 'border-zinc-300 hover:border-violet-400'
                  }`}
                >
                  {allSelected && <Check className="size-3" />}
                </button>
              </th>
            )}
            <th className="px-4 py-3">Produit</th>
            <th className="px-4 py-3">Statut</th>
            <th className="hidden px-4 py-3 sm:table-cell">Variantes</th>
            <th className="hidden px-4 py-3 sm:table-cell">Stock</th>
            <th className="px-4 py-3 text-right">Prix</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {products.map((p) => {
            const prices = p.variants.flatMap((v) => v.variant_prices).filter((x) => x.market_id === market?.id).map((x) => Number(x.price))
            const minPrice = prices.length ? Math.min(...prices) : null
            const unlimited = p.variants.some((v) => v.stock === null)
            const stock = p.variants.reduce((s, v) => s + (v.stock ?? 0), 0)
            const st = STATUS[p.status] ?? STATUS.draft
            const isSelected = selected.has(p.id)

            return (
              <tr
                key={p.id}
                className={`hover:bg-zinc-50 transition-colors ${isSelected ? 'bg-violet-50/40' : ''}`}
              >
                {canEdit && (
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleSelect(p.id)}
                      className={`size-4 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-violet-600 border-violet-600 text-white' : 'border-zinc-300 hover:border-violet-400'
                      }`}
                    >
                      {isSelected && <Check className="size-3" />}
                    </button>
                  </td>
                )}
                <td className="px-4 py-3">
                  <Link href={`/dashboard/products/${p.id}`} className="flex items-center gap-3">
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt="" className="size-10 rounded-lg object-cover" />
                    ) : (
                      <span className="flex size-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400">
                        <Package className="size-4" />
                      </span>
                    )}
                    <span className="font-medium text-zinc-800">{p.title}</span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge color={st.color}>{st.label}</Badge>
                </td>
                <td className="hidden px-4 py-3 text-zinc-500 sm:table-cell">{p.variants.length}</td>
                <td className="hidden px-4 py-3 text-zinc-500 sm:table-cell">{unlimited ? '∞' : stock}</td>
                <td className="px-4 py-3 text-right font-medium">
                  {minPrice !== null && market ? formatMoney(minPrice, market.currency) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
