# ShopSaaS — Contexte complet pour audit Meta Pixel

> **But de ce document** : permettre à une IA ou un développeur externe de comprendre
> l'architecture du projet, diagnostiquer le problème "Pixel inactif" dans Meta Ads Manager,
> et vérifier que le multi-boutiques multi-pixels fonctionne correctement.

---

## 1. Description du projet

**ShopSaaS** est une plateforme e-commerce multi-tenant construite avec :

- **Next.js 15** (App Router, TypeScript)
- **Supabase** (base de données PostgreSQL + Auth + Storage)
- **Tailwind CSS v4**
- Hébergé sur **Vercel** à l'URL : `https://shopsaas-s-one.vercel.app`

### Architecture multi-tenant

```
1 compte utilisateur
  └── N boutiques indépendantes (ex: Boutique Togo, Boutique Côte d'Ivoire, Boutique Mali)
        └── Chaque boutique a :
              - Son propre marché (pays + devise)
              - Ses propres produits
              - Ses propres pages produits (vitrine publique)
              - Son propre Pixel ID Meta + token CAPI
              - Ses propres commandes
```

### URLs des vitrines publiques

- Format : `https://shopsaas-s-one.vercel.app/s/[slug-boutique]`
- Exemple : `https://shopsaas-s-one.vercel.app/s/boutique-togo`

---

## 2. Problèmes à résoudre

### Problème 1 — "Pixel inactif" dans Meta Ads Manager

Quand on crée une publicité dans Meta Ads Manager et qu'on sélectionne un pixel,
il affiche **"Pixel inactif"** ou **"Votre ensemble de données n'est pas associé à votre site Web"**.

**Pourtant** :
- Dans le Gestionnaire d'événements Meta, les événements `Purchase` arrivent bien après une commande
- La vérification de domaine fonctionne (balise meta présente)
- Le CAPI envoie des événements avec succès (confirmé par les logs)

**Question** : Pourquoi Meta Ads Manager dit "inactif" alors que les événements arrivent ?

### Problème 2 — Multi-boutiques, multi-pixels

Un utilisateur peut avoir 3 boutiques (Togo, Côte d'Ivoire, Mali).
Chaque boutique doit avoir son propre Pixel ID et token CAPI **indépendant**.

**Question** : Est-ce que l'architecture actuelle supporte correctement ça ?
Y a-t-il un risque de confusion entre les pixels des différentes boutiques ?

---

## 3. Architecture du tracking Meta Pixel

### Flux complet d'un événement

```
Visiteur sur la vitrine
    │
    ▼
MetaPixelTracker (client)
    - Charge fbevents.js
    - Appelle fbq('init', pixelId) — pixelId = ID de la boutique
    - Envoie PageView + ViewContent (côté navigateur)
    │
    ▼
Client passe une commande
    │
    ├── Côté navigateur : trackMetaBrowserEvent('Purchase', data, eventId)
    │       → fbq('trackSingle', pixelId, 'Purchase', data, { eventID })
    │
    └── Côté serveur (CAPI) : sendMetaPurchase(admin, purchase)
            → Récupère pixel_id et access_token depuis store_meta_integrations
            → Envoie POST à https://graph.facebook.com/v25.0/{pixel_id}/events
            → event_id = "purchase_{orderId}" (déduplication browser + CAPI)
```

### Table Supabase : `store_meta_integrations`

```sql
-- Chaque boutique a sa propre ligne
store_id          uuid    -- FK vers stores.id
pixel_id          text    -- ex: "1641160880983896"
access_token_secret_id  text  -- référence vers le token CAPI stocké séparément
test_event_code   text    -- ex: "TEST93340" (vide en production)
test_mode         boolean -- false en production
```

### Fonction RPC Supabase : `read_store_meta_access_token`

Le token CAPI n'est **jamais** lu directement depuis la table.
Il est récupéré via une fonction RPC sécurisée :
```sql
-- Appelée côté serveur uniquement (service role)
SELECT read_store_meta_access_token(p_store_id := 'uuid-de-la-boutique');
-- Retourne le token déchiffré ou null
```

---

## 4. Fichiers de code clés

---

### 4.1 `lib/meta/conversions-api.ts` — CAPI côté serveur

```typescript
import 'server-only'
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const META_GRAPH_VERSION = 'v25.0'

// Récupère la config pixel de la boutique depuis store_meta_integrations
async function getConfig(admin: SupabaseClient, storeId: string) {
  const { data, error } = await admin
    .from('store_meta_integrations')
    .select('pixel_id, access_token_secret_id')
    .eq('store_id', storeId)
    .maybeSingle()
  if (error) throw error
  return data as { pixel_id: string; access_token_secret_id: string | null } | null
}

// Récupère le token CAPI via RPC sécurisée
async function getAccessToken(admin: SupabaseClient, storeId: string) {
  const { data, error } = await admin.rpc('read_store_meta_access_token', { p_store_id: storeId })
  if (error) throw error
  return typeof data === 'string' ? data : null
}

// Envoie un événement à l'API CAPI Meta
async function sendEvent(admin, config, storeId, storeSlug, event) {
  if (!config.pixel_id || !config.access_token_secret_id) {
    return { sent: false, reason: 'missing_config' }
  }
  const accessToken = await getAccessToken(admin, storeId)
  if (!accessToken) return { sent: false, reason: 'missing_token' }

  const url = new URL(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${config.pixel_id}/events`
  )
  url.searchParams.set('access_token', accessToken)

  // TEST MODE — commenté en production (META_TEST_EVENT_CODE non défini)
  const testEventCode = process.env.META_TEST_EVENT_CODE
  const payload = {
    data: [event],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  })

  const result = await response.json().catch(() => ({}))
  return response.ok
    ? { sent: true, eventsReceived: result?.events_received || 0 }
    : { sent: false, reason: 'meta_rejected', status: response.status }
}

// Point d'entrée principal : envoie un événement Purchase
export async function sendMetaPurchase(admin: SupabaseClient, purchase: MetaPurchase) {
  const [{ data: store }, { data: order }, config] = await Promise.all([
    admin.from('stores').select('slug').eq('id', purchase.storeId).maybeSingle(),
    admin.from('orders')
      .select('id, store_id, order_number, total, markets(currency)')
      .eq('id', purchase.orderId).eq('store_id', purchase.storeId).maybeSingle(),
    getConfig(admin, purchase.storeId),
  ])

  if (!store || !order || !config) return { sent: false, reason: 'not_configured' }

  const event = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: `purchase_${purchase.orderId}`, // déduplication
    action_source: 'website',
    event_source_url: `https://shopsaas-s-one.vercel.app/s/${store.slug}`,
    user_data: {
      // données hashées SHA256
      em: sha256(purchase.email),
      ph: sha256(purchase.phone),
      fbp: purchase.fbp,
      fbc: purchase.fbc,
      client_ip_address: purchase.ipAddress,
      client_user_agent: purchase.userAgent,
    },
    custom_data: {
      currency: order.markets?.currency || 'XOF',
      value: Number(order.total) || 0,
      order_id: order.order_number,
      content_type: 'product',
      content_ids: [purchase.productId],
      num_items: purchase.quantity || 1,
    },
  }

  return sendEvent(admin, config, purchase.storeId, store.slug, event)
}
```

---

### 4.2 `app/s/[store]/p/[slug]/MetaPixelTracker.tsx` — Pixel navigateur

```typescript
'use client'
// Composant React qui charge fbevents.js et initialise le pixel
// Utilise trackSingle() pour supporter plusieurs pixels simultanément

function initializePixel(pixelId: string) {
  if (!window.fbq) {
    // Crée la file d'attente fbq
    const fbq = function (...args) {
      if (fbq.callMethod) fbq.callMethod.apply(fbq, args)
      else (fbq.queue ||= []).push(args)
    }
    fbq.queue = []; fbq.loaded = true; fbq.version = '2.0'
    window.fbq = fbq; window._fbq = fbq

    // Charge fbevents.js une seule fois
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(script)
  }

  // Initialise ce pixel spécifique (évite les doublons)
  const initialized = window.__shopSaaSInitializedPixels ?? new Set()
  window.__shopSaaSInitializedPixels = initialized
  if (!initialized.has(pixelId)) {
    window.fbq('init', pixelId) // ← Enregistre le pixel
    initialized.add(pixelId)
  }
}

export default function MetaPixelTracker({ pixelId, productId, productName, value, currency }) {
  useEffect(() => {
    if (!pixelId) return
    initializePixel(pixelId)

    // PageView + ViewContent (une seule fois par page)
    window.fbq('trackSingle', pixelId, 'PageView')
    if (productId) {
      window.fbq('trackSingle', pixelId, 'ViewContent', {
        content_type: 'product',
        content_ids: [productId],
        content_name: productName,
        value,
        currency,
      })
    }

    // Expose une fonction globale pour l'événement Purchase
    window.shopSaaSMetaTrack = (eventName, data, eventId) => {
      if (eventId) window.fbq('trackSingle', pixelId, eventName, data, { eventID: eventId })
      else window.fbq('trackSingle', pixelId, eventName, data)
    }
  }, [pixelId, productId])

  return null
}
```

---

### 4.3 `app/s/[store]/page.tsx` — Chargement du pixel par boutique

```typescript
// Charge le Pixel ID depuis store_meta_integrations pour la boutique courante
const loadMetaPixelId = unstable_cache(
  async (storeId: string) => {
    const admin = createAdminClient()
    const { data } = await admin
      .from('store_meta_integrations')
      .select('pixel_id')
      .eq('store_id', storeId)        // ← filtré par boutique
      .maybeSingle()
    return data?.pixel_id || ''
  },
  ['meta-pixel-id'],
  { revalidate: 60, tags: ['meta-pixel'] }
)

// Dans le composant page :
const pixelId = await loadMetaPixelId(store.id)  // ID de la boutique courante

return (
  <>
    {pixelId && (
      <MetaPixelTracker
        pixelId={pixelId}       // ← pixel spécifique à cette boutique
        productId={selectedProduct?.id}
        // ...
      />
    )}
    <PublicPageRenderer data={builderJson} products={products} storeId={store.id} />
  </>
)
```

---

### 4.4 `app/api/integrations/meta/route.ts` — Sauvegarde des credentials

```typescript
// POST — Enregistre pixel_id + token CAPI pour une boutique
export async function POST(request: NextRequest) {
  const body = await request.json()
  const storeId = body.storeId   // la boutique ciblée

  // Validation
  if (!PIXEL_ID_PATTERN.test(pixelId)) {
    return NextResponse.json({ error: 'Pixel ID invalide' }, { status: 400 })
  }

  // Sauvegarde via RPC sécurisée (token CAPI chiffré côté serveur)
  await admin.rpc('save_store_meta_integration', {
    p_store_id: storeId,
    p_pixel_id: pixelId,
    p_access_token: accessToken || null,
    p_test_event_code: null,   // jamais en production
    p_test_mode: false,
  })
}
```

---

### 4.5 `app/api/orders/create/route.ts` — Déclenchement CAPI à la commande

```typescript
async function finishOrder(orderId: string) {
  const { data: createdOrder } = await supabase
    .from('orders').select('id, order_number')
    .eq('id', orderId).eq('store_id', store_id).maybeSingle()

  await Promise.all([
    dispatchOrderPush(String(store_id), orderId),    // notification push
    dispatchMetaPurchase(req, supabase, body, String(store_id), orderId, orderNumber), // ← CAPI
  ])

  return NextResponse.json({ ok: true, number: orderNumber, order_id: orderId })
}
```

---

## 5. Variables d'environnement utilisées

```bash
# Côté client (public)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Côté serveur uniquement (privé)
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Meta — commenté en production (ne pas décommenter)
# META_TEST_EVENT_CODE=TEST93340
```

> ⚠️ `META_TEST_EVENT_CODE` est **commenté** en production. S'il est défini,
> tous les événements CAPI sont envoyés en mode test, ce qui explique pourquoi
> ils apparaissent dans le Gestionnaire d'événements mais pas dans les vraies stats.

---

## 6. Flux d'une commande avec tracking complet

```
1. Visiteur arrive sur /s/boutique-togo
   → MetaPixelTracker charge fbevents.js
   → fbq('init', '1641160880983896')   ← pixel de la boutique Togo
   → fbq('trackSingle', pixelId, 'PageView')
   → fbq('trackSingle', pixelId, 'ViewContent', { content_ids: [productId] })

2. Visiteur remplit le formulaire et clique "Commander"
   → fetch('/api/orders/create', { body: { store_id, product_id, ... } })

3. Côté navigateur (immédiat) :
   → window.shopSaaSMetaTrack('Purchase', { value, currency }, 'purchase_uuid')
   → fbq('trackSingle', pixelId, 'Purchase', data, { eventID: 'purchase_uuid' })

4. Côté serveur (via CAPI) :
   → sendMetaPurchase(admin, { storeId: 'uuid-togo', orderId, ... })
   → getConfig() → pixel_id = '1641160880983896'
   → getAccessToken() → token CAPI déchiffré
   → POST https://graph.facebook.com/v25.0/1641160880983896/events
   → event_id = 'purchase_uuid' (même que côté navigateur → déduplication)

5. Meta reçoit l'événement Purchase avec event_id identique
   → Déduplique : comptabilise 1 seul Purchase
```

---

## 7. Hypothèses sur le problème "Pixel inactif"

### Hypothèse A — Le pixel n'a jamais reçu de PageView récent
Meta marque un pixel comme "inactif" s'il n'a pas reçu d'événement navigateur
(PageView) depuis plus de 7 jours. Les événements CAPI seuls ne suffisent pas
à le marquer comme "actif" dans Meta Ads Manager.

**Vérification** : Dans Meta Events Manager → ton pixel → onglet "Test Events" →
ouvre la vitrine publique dans un onglet → est-ce que PageView apparaît ?

### Hypothèse B — Le pixel est actif mais non vérifié sur le domaine
Meta Ads Manager affiche "inactif" si le pixel est actif mais que le domaine
`shopsaas-s-one.vercel.app` n'est pas vérifié dans le Business Manager.

**Vérification** : Business Manager → Paramètres → Sécurité de la marque → Domaines.

### Hypothèse C — Plusieurs pixels pour 1 domaine
Si l'utilisateur a 3 boutiques avec 3 pixels différents, tous sur le même domaine
`shopsaas-s-one.vercel.app`, Meta peut avoir du mal à associer chaque pixel
au bon domaine car il n'y a qu'un seul domaine pour toutes les boutiques.

---

## 8. Questions pour l'IA / développeur

1. Le code du `MetaPixelTracker` utilise `fbq('trackSingle', pixelId, ...)` au lieu
   de `fbq('track', ...)` — est-ce la bonne approche pour le multi-pixel ?

2. Le CAPI envoie `event_source_url` avec l'URL de la vitrine. Est-ce que cette URL
   doit correspondre exactement au domaine vérifié dans Meta Business Manager ?

3. Est-ce qu'un pixel qui reçoit uniquement des événements CAPI (sans PageView navigateur)
   peut être marqué comme "actif" dans Meta Ads Manager ?

4. Comment gérer correctement plusieurs pixels sur le même domaine Vercel ?
   Faut-il des sous-domaines par boutique pour que Meta associe correctement chaque pixel ?

5. Y a-t-il un problème dans le code qui empêcherait le pixel d'être détecté comme actif ?

---

## 9. Comment convertir ce fichier en PDF

1. Ouvre VS Code → clic droit sur ce fichier → "Open Preview"
2. Dans l'aperçu, appuie sur `Ctrl+P` → "Imprimer" → "Enregistrer en PDF"

**Ou** : Va sur https://md2pdf.netlify.app → colle le contenu → télécharge le PDF.

---

*Généré automatiquement depuis le projet ShopSaaS — github.com/labodjapro-spec/shopsaasS*
