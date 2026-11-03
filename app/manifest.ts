import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'ShopSaaS',
    short_name: 'ShopSaaS',
    description: 'Gère tes boutiques et reçois les commandes, même l’app fermée.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f8fafc',
    theme_color: '#6d28d9',
    categories: ['business', 'shopping'],
    icons: [
      { src: '/icons/app-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Commandes',
        short_name: 'Commandes',
        url: '/dashboard/orders',
        icons: [{ src: '/icons/app-192.png', sizes: '192x192' }],
      },
    ],
  }
}
