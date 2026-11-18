import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStorefront } from './data'

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ store: string }>
}) {
  const { store: slug } = await params

  // Cas 1 : boutique principale (stores.slug)
  const data = await getStorefront(slug)

  // Cas 2 : page produit (store_pages.slug) — cherche le store parent
  let whatsapp: string | null = null

  if (data) {
    whatsapp = data.store.whatsapp
  } else {
    const supabase = await createClient()
    const { data: page } = await supabase
      .from('store_pages')
      .select('store_id, stores(id, whatsapp)')
      .eq('slug', slug)
      .maybeSingle()

    if (!page?.stores) notFound()
    whatsapp = (page.stores as any).whatsapp ?? null
  }

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {children}
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg hover:scale-110 transition-transform"
          aria-label="WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="size-7 fill-current" aria-hidden>
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.8 14.03c-.24.68-1.42 1.3-1.95 1.34-.5.05-.97.22-3.27-.68-2.76-1.09-4.5-3.91-4.64-4.09-.13-.18-1.1-1.47-1.1-2.8 0-1.33.7-1.98.94-2.25.25-.27.54-.34.72-.34h.52c.17 0 .4-.06.62.47.24.56.8 1.94.87 2.08.07.14.12.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.29-.12.56.16.27.71 1.17 1.52 1.9 1.05.93 1.93 1.22 2.2 1.36.27.13.43.11.59-.07.16-.18.68-.79.86-1.07.18-.27.36-.23.61-.14.25.09 1.58.75 1.85.88.27.14.45.2.52.32.07.11.07.66-.17 1.33Z" />
          </svg>
        </a>
      )}
    </div>
  )
}
