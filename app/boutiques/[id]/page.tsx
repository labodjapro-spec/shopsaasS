import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { buildStorePage, getBoutiqueTheme, buildThemeSettings } from '@/lib/store-builder/boutique-themes';
import EditorClient from './EditorClient';

export default async function StoreBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('*, store_settings(*)')
    .eq('id', id)
    .single();

  if (storeError || !store) {
    redirect('/boutiques');
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (store.owner_id !== user.id) {
    const { data: membership } = await supabase
      .from('store_members')
      .select('roles(permissions)')
      .eq('store_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    const role = Array.isArray((membership as any)?.roles) ? (membership as any).roles[0] : (membership as any)?.roles
    const permissions = Array.isArray(role?.permissions) ? role.permissions : []
    if (!permissions.includes('*') && !permissions.includes('pages.write')) redirect('/dashboard?refus=1')
  }

  const { data: storePage } = await supabase
    .from('store_pages')
    .select('*')
    .eq('store_id', id)
    .eq('slug', 'home')
    .maybeSingle();

  // Chaque boutique a son propre catalogue : ne jamais charger les produits des boutiques sœurs.
  const productsQuery = supabase
    .from('products')
    .select('id, title, images, description, status, variants(id, variant_prices(market_id, price, compare_at_price))')
    .eq('store_id', id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const { data: products } = await productsQuery

  // Charger le marché par défaut pour avoir le prix dans l'éditeur
  const { data: defaultMarketEditor } = await supabase
    .from('markets')
    .select('id, currency')
    .eq('store_id', id)
    .eq('is_default', true)
    .maybeSingle()

  const { data: anyMarketEditor } = !defaultMarketEditor ? await supabase
    .from('markets').select('id, currency').eq('store_id', id).limit(1).maybeSingle()
    : { data: null }

  const editorMarket = defaultMarketEditor ?? anyMarketEditor

  const productsWithPrice = (products ?? []).map((p: any) => {
    const allPrices = (p.variants ?? []).flatMap((v: any) => v.variant_prices ?? [])
    const marketPrice = editorMarket
      ? allPrices.find((vp: any) => vp.market_id === editorMarket.id) ?? allPrices[0]
      : allPrices[0]
    return {
      ...p,
      price: marketPrice?.price ?? null,
      compare_at_price: marketPrice?.compare_at_price ?? null,
      currency: editorMarket?.currency ?? 'XOF',
    }
  })

  let builderJson = storePage?.builder_json;

  // ── Migrate old format { sections: [...] } → { header, template, footer } ──
  if (builderJson && Array.isArray(builderJson.sections) && !builderJson.template) {
    const migrated = {
      header: [],
      template: builderJson.sections.map((sec: any) => ({
        id: sec.id || `${sec.type}-${Date.now()}`,
        type: sec.type,
        title: sec.type,
        hidden: sec.visible === false,
        settings: sec.props || sec.settings || {},
      })),
      footer: [],
    }
    builderJson = migrated
    if (storePage) {
      await supabase.from('store_pages').update({ builder_json: migrated }).eq('id', storePage.id)
    }
  }

  // ── Migration silencieuse : injecter un id pour chaque bloc qui en manque ──
  if (builderJson) {
    for (const section of ['header', 'template', 'footer'] as const) {
      if (Array.isArray(builderJson[section])) {
        builderJson[section] = (builderJson[section] as any[]).map((b: any, i: number) => ({
          ...b,
          id: b.id || `${b.type || 'block'}-${Date.now()}-${i}`,
        }))
      }
    }
  }

  // ── NE PAS régénérer si le builderJson a déjà du contenu (header/template/footer) ──
  // Le buildStorePage avec productId=null perdrait le produit cloné
  const hasContent = builderJson && (
    (builderJson.template && builderJson.template.length > 0) ||
    (builderJson.header && builderJson.header.length > 0) ||
    (builderJson.footer && builderJson.footer.length > 0)
  );

  if (!hasContent) {
    // Utiliser le système de thèmes boutique pour générer un builder_json complet avec layout
    const themeId = store.store_settings?.theme_id || 'nature-vert';
    const storeName = store.name || 'Ma Boutique';
    // Préserver selectedProductId s'il existe dans l'ancien builderJson
    const existingProductId = builderJson?.selectedProductId || null;
    builderJson = buildStorePage(themeId, storeName, existingProductId);

    if (storePage) {
      await supabase.from('store_pages').update({ builder_json: builderJson }).eq('id', storePage.id);
    } else {
      await supabase.from('store_pages').insert({
        store_id: id,
        title: 'Accueil',
        slug: 'home',
        builder_json: builderJson
      });
    }
  }

  // ── Migration silencieuse : injecter themeSettings.layout si absent ──
  // Les boutiques créées avant le commit a2fa66c n'ont pas ce champ.
  // Sans lui, resolveLayout() retourne 'single-column' et le layout multi-colonnes ne s'active pas.
  if (builderJson && builderJson.themeSettings && !builderJson.themeSettings.layout) {
    const storeSettings = Array.isArray(store.store_settings)
      ? store.store_settings[0]
      : store.store_settings;
    const themeId = storeSettings?.theme_id || 'nature-vert';
    const theme = getBoutiqueTheme(themeId);
    const canonical = buildThemeSettings(theme);

    builderJson = {
      ...builderJson,
      themeSettings: {
        ...canonical,          // valeurs de base du thème (layout inclus)
        ...builderJson.themeSettings, // préserver les perso utilisateur (couleurs, logo…)
        layout: builderJson.themeSettings.layout || canonical.layout, // forcer le layout
      },
    };
    // Persister silencieusement
    if (storePage?.id) {
      await supabase.from('store_pages').update({ builder_json: builderJson }).eq('id', storePage.id);
    }
  }

  // ── api_base : vide en production (même domaine), localhost en dev ────────
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'
  const isLocal = rootDomain.startsWith('localhost')
  const apiBase = isLocal ? `http://${rootDomain}` : ''

  builderJson = {
    ...builderJson,
    themeSettings: {
      ...(builderJson?.themeSettings ?? {}),
      // Ces champs sont TOUJOURS injectés dynamiquement — jamais sauvegardés en dur
      market_id: editorMarket?.id ?? null,
      currency: editorMarket?.currency ?? 'XOF',
      store_id: id,
      api_base: apiBase,
    },
  }

  return (
    <EditorClient
      storeId={id}
      storeName={store.name}
      storeSlug={store.slug}
      storeStatus={store.status}
      initialData={builderJson}
      products={productsWithPrice || []}
      apiBase={apiBase}
    />
  );
}
