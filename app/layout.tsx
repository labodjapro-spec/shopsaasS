import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import PWARegister from './PWARegister'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'ShopSaaS',
  description: 'Crée ta boutique, reçois tes commandes.',
  applicationName: 'ShopSaaS',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'ShopSaaS',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icons/app-192.png',
    apple: '/icons/app-apple.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#6d28d9',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="font-sans">
        {children}
        <PWARegister />
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
