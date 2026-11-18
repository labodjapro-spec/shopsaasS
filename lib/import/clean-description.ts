// Nettoyage HTML basique sans dépendances externes (pas de sanitize-html dans package.json)
// Le RichTextEditor utilise contentEditable et accepte du HTML brut avec styles inline

export function cleanDescription(html: string, base: string): string {
  if (!html.trim()) return ''

  // Résoudre les URLs sans protocole
  let cleaned = html.replace(
    /src=["'](\/\/[^"']+)["']/gi,
    (_, path) => `src="https:${path}"`,
  )

  // Résoudre les URLs relatives
  cleaned = cleaned.replace(
    /src=["'](?!https?:\/\/)(?!data:)([^"']+)["']/gi,
    (_, path) => {
      try {
        return `src="${new URL(path, base).href}"`
      } catch {
        return ''
      }
    },
  )

  // Supprimer les balises dangereuses et leurs contenus
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '')
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '')
  cleaned = cleaned.replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
  cleaned = cleaned.replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
  cleaned = cleaned.replace(/<form[\s\S]*?<\/form>/gi, '')
  cleaned = cleaned.replace(/<button[\s\S]*?<\/button>/gi, '')
  cleaned = cleaned.replace(/<input[^>]*>/gi, '')
  cleaned = cleaned.replace(/<select[\s\S]*?<\/select>/gi, '')
  cleaned = cleaned.replace(/<svg[\s\S]*?<\/svg>/gi, '')

  // Supprimer attributs dangereux
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '')

  // Résoudre data-src / data-lazy-src dans les images
  cleaned = cleaned.replace(/<img([^>]*?)>/gi, (tag) => {
    const dataSrc =
      tag.match(/data-(?:lazy-)?src=["']([^"']+)["']/i)?.[1] ??
      tag.match(/data-original=["']([^"']+)["']/i)?.[1]
    if (dataSrc && !tag.includes('src="http')) {
      tag = tag.replace(/<img/, `<img src="${dataSrc}"`)
    }
    // Nettoyer les attributs non-src
    tag = tag.replace(/\s+data-[a-z-]+=["'][^"']*["']/gi, '')
    tag = tag.replace(/\s+class=["'][^"']*["']/gi, '')
    tag = tag.replace(/\s+style=["'][^"']*["']/gi, '')
    return tag
  })

  // Supprimer les paragraphes vides
  cleaned = cleaned.replace(/<p[^>]*>\s*(<br\s*\/?>)?\s*<\/p>/gi, '')

  // Supprimer les img sans src valide
  cleaned = cleaned.replace(/<img(?![^>]*src=["']https?:)[^>]*>/gi, '')

  return cleaned.trim()
}

export function applyPricingRules(price: number, currency: string | null) {
  const MARKUP = 5000
  const STOCK = 1000
  const roundedPrice = Math.round(price)

  const knownCurrencies = ['XOF', 'XAF']
  const cur = (currency ?? 'XOF').toUpperCase()
  const needsPriceCheck = !knownCurrencies.includes(cur)

  return {
    price: roundedPrice,
    compareAtPrice: roundedPrice + MARKUP,
    stock: STOCK,
    status: 'draft' as const,
    needsPriceCheck,
  }
}
