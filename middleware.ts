import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const ROOT = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000').trim().toLowerCase()
const APP_SUBDOMAINS = new Set(['app', 'www'])

/** maboutique.notresaas.com -> "maboutique" ; app.notresaas.com / notresaas.com / *.vercel.app -> null */
function storeSubdomain(host: string): string | null {
  const h = host.split(':')[0]
  const root = ROOT.split(':')[0]
  if (h === root || !h.endsWith('.' + root)) return null
  const sub = h.slice(0, -(root.length + 1))
  if (!sub || sub.includes('.') || APP_SUBDOMAINS.has(sub)) return null
  return sub
}

export async function middleware(request: NextRequest) {
  const host = (request.headers.get('host') || '').toLowerCase()
  const sub = storeSubdomain(host)

  // Vitrine : maboutique.notresaas.com/p/mon-produit -> /s/maboutique/p/mon-produit
  if (sub && !request.nextUrl.pathname.startsWith('/api/')) {
    const { pathname, search } = request.nextUrl
    const target = new URL(`/s/${sub}${pathname === '/' ? '' : pathname}${search}`, request.url)
    const headers = new Headers(request.headers)
    headers.set('x-storefront-host', '1')
    return NextResponse.rewrite(target, { request: { headers } })
  }

  // Dashboard : rafraîchit la session Supabase et protège les pages privées
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw\\.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
