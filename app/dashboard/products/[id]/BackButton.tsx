'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function BackButton() {
  const [href, setHref] = useState('/dashboard/products')
  const [label, setLabel] = useState('Retour aux produits')

  useEffect(() => {
    const returnTo = sessionStorage.getItem('spy-pubs-returnTo')
    if (returnTo) {
      setHref(returnTo)
      setLabel('← Retour aux publicités')
    }
  }, [])

  return (
    <Link
      href={href}
      className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900"
      aria-label={label}
    >
      <ArrowLeft className="size-5" />
    </Link>
  )
}
