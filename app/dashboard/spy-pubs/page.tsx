"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Search, Globe, Play, ExternalLink, Loader2,
  AlertCircle, ChevronDown, Eye, Clock, RefreshCw,
  X, Image as ImageIcon, Film, LayoutGrid,
  Zap, Download, CheckCircle2, ArrowRight, Heart,
  Flame, Sparkles, TrendingUp, Telescope,
} from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
interface AdItem {
  id: string;
  body: string | null;
  linkTitle: string | null;
  linkDescription: string | null;
  linkCaption: string | null;
  ctaText: string | null;
  mediaType: string;
  snapshotUrl: string | null;
  allImageUrls: string[];
  allVideoUrls: string[];
  pageName: string;
  pageUrl: string | null;
  profileImage: string | null;
  siteUrl: string | null;
  targetedCountries: string[];
  startDate: string | null;
  daysRunning: number | null;
  impressions: { lower_bound: string; upper_bound: string } | null;
  originalUrl: string | null;
}

/* ─────────────────────────────────────────────
   NICHES
───────────────────────────────────────────── */
const NICHES = [
  { key: "all",          label: "🔥 Trending",      keywords: "livraison gratuite" },
  { key: "sante",        label: "💊 Santé",          keywords: "santé bien-être supplement vitamines" },
  { key: "capillaire",   label: "💇 Capillaire",     keywords: "cheveux capillaire croissance sérum" },
  { key: "beaute",       label: "💄 Beauté",         keywords: "beauté cosmétique maquillage soin" },
  { key: "mode",         label: "👗 Mode Femme",     keywords: "mode femme robe tendance vêtement" },
  { key: "luxe",         label: "👑 Luxe",           keywords: "luxe bijoux montre premium accessoire" },
  { key: "maison",       label: "🏠 Maison",         keywords: "maison décoration cuisine intérieur" },
  { key: "bebe",         label: "👶 Bébé",           keywords: "bébé enfant jouet puériculture" },
  { key: "sport",        label: "💪 Sport",          keywords: "sport fitness musculation entraînement" },
  { key: "tech",         label: "📱 Tech",           keywords: "technologie gadget innovation" },
  { key: "electronique", label: "🔌 Électronique",   keywords: "électronique appareil électroménager" },
  { key: "alimentation", label: "🍽️ Alimentation",  keywords: "alimentation nourriture healthy food" },
];

/* ─────────────────────────────────────────────
   SUGGESTIONS DE MOTS-CLÉS
───────────────────────────────────────────── */
const KEYWORD_SUGGESTIONS = [
  { label: "Livraison gratuite",      value: "livraison gratuite" },
  { label: "Paiement à la livraison", value: "paiement à la livraison" },
  { label: "50% OFF",                 value: "50% off" },
  { label: "Offre limitée",           value: "offre limitée" },
  { label: "Commandez maintenant",    value: "commandez maintenant" },
  { label: "Produit tendance",        value: "produit tendance" },
  { label: "Beauté",                  value: "beauté" },
  { label: "Mode femme",              value: "mode femme" },
];

/* ─────────────────────────────────────────────
   FILTRE MÉDIA
───────────────────────────────────────────── */
const MEDIA_FILTERS = [
  { key: "ALL",         label: "Tous",       icon: LayoutGrid },
  { key: "IMAGE",       label: "Images",     icon: ImageIcon  },
  { key: "VIDEO",       label: "Vidéos",     icon: Film       },
  { key: "MULTI_MEDIA", label: "Carrousels", icon: LayoutGrid },
];

/* ─────────────────────────────────────────────
   PAYS
───────────────────────────────────────────── */
const ALL_COUNTRIES = [
  { code: "ALL", label: "🌍 Monde entier" },
  { code: "FR",  label: "🇫🇷 France" },
  { code: "MA",  label: "🇲🇦 Maroc" },
  { code: "DZ",  label: "🇩🇿 Algérie" },
  { code: "TN",  label: "🇹🇳 Tunisie" },
  { code: "SN",  label: "🇸🇳 Sénégal" },
  { code: "CI",  label: "🇨🇮 Côte d'Ivoire" },
  { code: "CM",  label: "🇨🇲 Cameroun" },
  { code: "ML",  label: "🇲🇱 Mali" },
  { code: "BJ",  label: "🇧🇯 Bénin" },
  { code: "BF",  label: "🇧🇫 Burkina Faso" },
  { code: "TG",  label: "🇹🇬 Togo" },
  { code: "NE",  label: "🇳🇪 Niger" },
  { code: "GA",  label: "🇬🇦 Gabon" },
  { code: "CD",  label: "🇨🇩 RD Congo" },
  { code: "CG",  label: "🇨🇬 Congo" },
  { code: "RW",  label: "🇷🇼 Rwanda" },
  { code: "BE",  label: "🇧🇪 Belgique" },
  { code: "CH",  label: "🇨🇭 Suisse" },
  { code: "LU",  label: "🇱🇺 Luxembourg" },
  { code: "US",  label: "🇺🇸 États-Unis" },
  { code: "CA",  label: "🇨🇦 Canada" },
  { code: "GB",  label: "🇬🇧 Royaume-Uni" },
  { code: "DE",  label: "🇩🇪 Allemagne" },
  { code: "ES",  label: "🇪🇸 Espagne" },
  { code: "IT",  label: "🇮🇹 Italie" },
  { code: "PT",  label: "🇵🇹 Portugal" },
  { code: "NL",  label: "🇳🇱 Pays-Bas" },
  { code: "SA",  label: "🇸🇦 Arabie Saoudite" },
  { code: "AE",  label: "🇦🇪 Émirats" },
  { code: "EG",  label: "🇪🇬 Égypte" },
  { code: "NG",  label: "🇳🇬 Nigeria" },
  { code: "ZA",  label: "🇿🇦 Afrique du Sud" },
  { code: "KE",  label: "🇰🇪 Kenya" },
  { code: "GH",  label: "🇬🇭 Ghana" },
  { code: "IN",  label: "🇮🇳 Inde" },
  { code: "BR",  label: "🇧🇷 Brésil" },
  { code: "MX",  label: "🇲🇽 Mexique" },
  { code: "AU",  label: "🇦🇺 Australie" },
  { code: "JP",  label: "🇯🇵 Japon" },
  { code: "CN",  label: "🇨🇳 Chine" },
  { code: "SG",  label: "🇸🇬 Singapour" },
  { code: "HK",  label: "🇭🇰 Hong Kong" },
  { code: "TR",  label: "🇹🇷 Turquie" },
  { code: "MU",  label: "🇲🇺 Maurice" },
  { code: "MG",  label: "🇲🇬 Madagascar" },
  { code: "AO",  label: "🇦🇴 Angola" },
];

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function daysLabel(days: number | null): string {
  if (days === null) return "";
  if (days < 1) return "Aujourd'hui";
  if (days === 1) return "1 jour";
  return `${days} jours`;
}

function mediaIcon(type: string) {
  if (type === "VIDEO") return <Film className="w-3 h-3" />;
  if (type === "MULTI_MEDIA") return <LayoutGrid className="w-3 h-3" />;
  return <ImageIcon className="w-3 h-3" />;
}

function mediaLabel(type: string) {
  if (type === "VIDEO") return "Vidéo";
  if (type === "MULTI_MEDIA") return "Carrousel";
  return "Image";
}

/* ─────────────────────────────────────────────
   AD CARD
───────────────────────────────────────────── */
function AdCard({
  ad, onClick, onImport, isFavorite, onToggleFavorite,
}: {
  ad: AdItem;
  onClick: () => void;
  onImport: (ad: AdItem) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (ad: AdItem, e: React.MouseEvent) => void;
}) {
  const isVideo = ad.mediaType === "VIDEO";

  return (
    <div
      className="bg-white border border-zinc-200 rounded-2xl overflow-hidden flex flex-col hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          {ad.profileImage ? (
            <img src={ad.profileImage} alt={ad.pageName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-xs font-black uppercase">{ad.pageName.charAt(0)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-xs text-zinc-800 truncate">{ad.pageName}</div>
          <div className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest">Sponsorisé</div>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 rounded-full border border-emerald-200 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wide">Actif</span>
        </div>
        {onToggleFavorite && (
          <button
            onClick={(e) => onToggleFavorite(ad, e)}
            className="flex-shrink-0 ml-1 p-1.5 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <Heart className={`w-4 h-4 transition-colors ${isFavorite ? "fill-red-500 text-red-500" : "text-zinc-300"}`} />
          </button>
        )}
      </div>

      {/* Body text */}
      {ad.body && (
        <div className="px-4 pb-3">
          <p className="text-xs text-zinc-600 leading-relaxed line-clamp-4">{ad.body}</p>
        </div>
      )}

      {/* Snapshot */}
      <div className="relative bg-zinc-100 overflow-hidden flex items-center justify-center" style={{ minHeight: 200, height: 300 }}>
        {ad.snapshotUrl ? (
          isVideo ? (
            <video
              src={ad.snapshotUrl}
              className="w-full h-full object-cover"
              controls={false}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img
              src={ad.snapshotUrl}
              alt={`Pub ${ad.pageName}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-zinc-300">
            {isVideo ? <Play className="w-10 h-10" /> : <Eye className="w-10 h-10" />}
            <span className="text-[10px] font-bold uppercase tracking-widest">{mediaLabel(ad.mediaType)}</span>
          </div>
        )}

        {ad.snapshotUrl && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900/20 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/90 rounded-full shadow-lg text-[10px] font-black text-zinc-700 uppercase tracking-widest">
              {isVideo ? <Play className="w-3.5 h-3.5 text-indigo-500" /> : <Eye className="w-3.5 h-3.5 text-indigo-500" />}
              Voir la publicité
            </div>
          </div>
        )}

        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-black/60 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm">
          {mediaIcon(ad.mediaType)}
          {mediaLabel(ad.mediaType)}
        </div>
      </div>

      {/* Link card */}
      {(ad.linkTitle || ad.linkCaption) && (
        <div className="border-t border-zinc-100 px-4 py-3 bg-zinc-50">
          {ad.linkCaption && (
            <div className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest mb-1">{ad.linkCaption}</div>
          )}
          {ad.linkTitle && (
            <div className="text-xs font-bold text-zinc-800 line-clamp-2 mb-0.5">{ad.linkTitle}</div>
          )}
          {ad.linkDescription && (
            <div className="text-[10px] text-zinc-500 line-clamp-1">{ad.linkDescription}</div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2 mt-auto">
        <div className="flex flex-wrap items-center gap-2">
          {ad.daysRunning !== null && (
            <div className="flex items-center gap-1 text-[9px] font-semibold text-indigo-600">
              <Clock className="w-3 h-3" />
              {daysLabel(ad.daysRunning)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); onImport(ad); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-bold uppercase tracking-widest transition-all shadow-sm active:scale-95"
          >
            <Download className="w-2.5 h-2.5" />
            Importer
          </button>
          {ad.siteUrl && (
            <a
              href={ad.siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-50 hover:bg-indigo-50 hover:text-indigo-600 text-zinc-500 border border-zinc-200 text-[9px] font-bold uppercase tracking-widest transition-colors"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              Site
            </a>
          )}
          {ad.originalUrl && (
            <a
              href={ad.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-50 hover:bg-blue-50 hover:text-blue-600 text-zinc-400 border border-zinc-200 text-[9px] font-bold uppercase tracking-widest transition-colors"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              Meta
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   IMPORT MODAL
───────────────────────────────────────────── */
function ImportModal({
  ad, onClose, router,
}: {
  ad: AdItem;
  onClose: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [step, setStep] = useState<"choose" | "url_input" | "scraping" | "done">("choose");
  const [productId, setProductId] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<{ images: number; platform: string; needsPriceCheck: boolean }>({ images: 0, platform: "", needsPriceCheck: false });
  const [customUrl, setCustomUrl] = useState(ad.siteUrl ?? "");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const title = ad.linkTitle || ad.pageName || "Produit importé";
  const adBody = ad.body || "";
  const imageUrl = ad.snapshotUrl || ad.allImageUrls?.[0] || null;
  const allImages = ad.allImageUrls?.length > 0 ? ad.allImageUrls : (imageUrl ? [imageUrl] : []);
  const hasSiteUrl = !!ad.siteUrl;

  /** Vrai si l'URL ressemble à une page produit (Shopify /products/ ou YouCan /products/) */
  function isProductUrl(url: string | null): boolean {
    if (!url) return false;
    try {
      const u = new URL(url);
      return u.pathname.includes('/products/') || u.pathname.includes('/product/');
    } catch { return false; }
  }

  const siteIsProductUrl = isProductUrl(ad.siteUrl);

  async function getStoreId(): Promise<string | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: memberships } = await supabase
      .from("store_members")
      .select("store_id")
      .eq("user_id", user.id)
      .limit(1);
    return memberships?.[0]?.store_id || null;
  }

  // Mode 1 : importer via la nouvelle route API (produit complet)
  async function doImportProduct(productUrl: string) {
    if (!productUrl) { toast.error("Saisissez l'URL de la page produit."); return; }
    setStep("scraping");
    try {
      const storeId = await getStoreId();
      if (!storeId) { toast.error("Aucun magasin actif trouvé."); setStep("choose"); return; }

      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: productUrl, storeId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Erreur d'import");

      setImportStats({ images: data.images, platform: data.platform, needsPriceCheck: data.needsPriceCheck });
      setProductId(data.productId);
      setStep("done");
      toast.success(`Produit importé ! ${data.images} image(s) récupérée(s).`);
    } catch (err: any) {
      toast.error("Erreur import : " + (err.message || "Erreur inconnue"));
      setStep("choose");
    }
  }

  // Mode 2 : depuis la pub uniquement (images de la pub, texte de l'annonce)
  async function doImportFromAd() {
    setStep("scraping");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      const { data: memberships } = await supabase.from("store_members").select("store_id").eq("user_id", user.id).limit(1);
      const storeId = memberships?.[0]?.store_id;
      if (!storeId) throw new Error("Aucun magasin actif");

      const slug = `produit-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      const desc = [
        adBody ? `<p>${adBody.replace(/\n/g, "<br/>")}</p>` : "",
        ad.linkDescription ? `<p>${ad.linkDescription}</p>` : "",
        ad.ctaText ? `<p><strong>👉 ${ad.ctaText}</strong></p>` : "",
      ].filter(Boolean).join("\n") || `<p>${title}</p>`;

      const { data: newProduct, error } = await supabase
        .from("products")
        .insert({
          store_id: storeId,
          title: title.substring(0, 200),
          slug,
          description: desc,
          images: allImages.slice(0, 20),
          status: "draft",
        })
        .select("id")
        .single();

      if (error) throw error;

      // Variante avec stock 1000
      await supabase.from("variants").insert({
        product_id: newProduct.id,
        store_id: storeId,
        title: "Défaut",
        position: 0,
        stock: 1000,
      });

      setImportStats({ images: allImages.length, platform: "pub", needsPriceCheck: true });
      setProductId(newProduct.id);
      setStep("done");
      toast.success(`Produit créé depuis la pub ! ${allImages.length} image(s).`);
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || "Erreur inconnue"));
      setStep("choose");
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-zinc-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: "88vh", overflowY: "auto" }}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Download className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800">Importer ce produit</h3>
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Vers Mes Produits</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Preview */}
        <div className="p-6 border-b border-zinc-100">
          {allImages.length > 0 && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {allImages.slice(0, 5).map((url, i) => (
                <img key={i} src={url} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-zinc-200" />
              ))}
            </div>
          )}
          <p className="text-sm font-bold text-zinc-800 line-clamp-2 mb-1">{title}</p>
          {adBody && <p className="text-[11px] text-zinc-500 line-clamp-3 leading-relaxed">{adBody}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-[9px] font-semibold px-2 py-1 bg-zinc-100 text-zinc-500 rounded-full">{ad.pageName}</span>
            {hasSiteUrl && <span className="text-[9px] font-semibold px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full">🌐 Site disponible</span>}
            {ad.daysRunning !== null && <span className="text-[9px] font-semibold px-2 py-1 bg-amber-50 text-amber-600 rounded-full">{daysLabel(ad.daysRunning)} actif</span>}
          </div>
        </div>

        {/* Contenu par étape */}
        <div className="p-6">
          {step === "choose" && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-4">Choisissez votre mode d&apos;importation</p>

              {/* Option 1 : Importer depuis une URL produit */}
              <button
                onClick={() => siteIsProductUrl ? doImportProduct(ad.siteUrl!) : setStep("url_input")}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-zinc-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                  <Globe className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-800 mb-0.5">
                    Cloner la fiche produit
                    <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-bold ml-2">RECOMMANDÉ</span>
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {siteIsProductUrl ? "Récupère le titre, la description, les images et le prix du site." : "Collez l'URL de la page produit (ex: boutique.com/products/mon-produit)."}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
              </button>

              {/* Option 2 : Depuis la pub */}
              <button
                onClick={doImportFromAd}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                  <Download className="w-6 h-6 text-zinc-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-800 mb-0.5">Depuis la publicité uniquement</p>
                  <p className="text-[11px] text-zinc-400">Copie le texte et les images de la pub. Rapide mais limité.</p>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 group-hover:translate-x-1 transition-all" />
              </button>
            </div>
          )}

          {step === "url_input" && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-zinc-700">Collez l&apos;URL de la page produit :</p>
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://boutique.com/products/mon-produit"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
              <div className="flex gap-2">
                <button onClick={() => setStep("choose")} className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-500 hover:bg-zinc-50">
                  Retour
                </button>
                <button
                  onClick={() => doImportProduct(customUrl)}
                  disabled={!customUrl}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Importer →
                </button>
              </div>
            </div>
          )}

          {step === "scraping" && (
            <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
                  <Globe className="w-8 h-8 text-indigo-600 animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-indigo-400 animate-spin" style={{ borderTopColor: "transparent" }} />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-800">Clonage de la fiche produit…</p>
                <p className="text-[11px] text-zinc-400 mt-1">Extraction du titre, description, images et prix</p>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-6 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" />
              </div>
              <div>
                <p className="text-base font-bold text-zinc-800 mb-1">Produit importé ! ✅</p>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {importStats.images > 0 && <span className="text-[9px] font-bold px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full">{importStats.images} image(s)</span>}
                  {importStats.platform && <span className="text-[9px] font-bold px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full">🌐 {importStats.platform}</span>}
                  {importStats.needsPriceCheck && <span className="text-[9px] font-bold px-2 py-1 bg-amber-50 text-amber-600 rounded-full">⚠️ Vérifier le prix</span>}
                </div>
                <p className="text-[11px] text-zinc-400 mt-2">Le produit est en brouillon dans votre catalogue.</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-200 text-[11px] font-bold uppercase tracking-widest text-zinc-500 hover:bg-zinc-50 transition-colors">
                  Fermer
                </button>
                <button
                  onClick={() => { onClose(); router.push(`/dashboard/products/${productId}`); }}
                  className="flex-1 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest text-white shadow-sm hover:-translate-y-0.5 transition-all active:scale-95"
                  style={{ background: "var(--dashboard-accent)" }}
                >
                  Modifier le produit →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SNAPSHOT MODAL
───────────────────────────────────────────── */
function SnapshotModal({ ad, onClose }: { ad: AdItem; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-zinc-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              {ad.profileImage ? (
                <img src={ad.profileImage} alt={ad.pageName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-sm font-black uppercase">{ad.pageName.charAt(0)}</span>
              )}
            </div>
            <div>
              <div className="font-bold text-sm text-zinc-800">{ad.pageName}</div>
              <div className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest">
                Actif · {daysLabel(ad.daysRunning)} · {mediaLabel(ad.mediaType)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {ad.siteUrl && (
              <a href={ad.siteUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest transition-colors"
                style={{ background: "var(--dashboard-accent)" }}>
                <ExternalLink className="w-3 h-3" /> Voir le site
              </a>
            )}
            {ad.originalUrl && (
              <a href={ad.originalUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-blue-600 transition-colors">
                <ExternalLink className="w-3 h-3" /> Voir dans Meta
              </a>
            )}
            <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-xl transition-colors">
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Media */}
        <div className="flex-1 overflow-auto bg-zinc-100 flex items-center justify-center p-4 min-h-[400px]">
          {ad.snapshotUrl ? (
            ad.mediaType === "VIDEO" ? (
              <video
                src={ad.snapshotUrl}
                className="max-h-[560px] max-w-full rounded-xl bg-black object-contain shadow-md"
                controls
                autoPlay
                playsInline
              />
            ) : (
              <img
                src={ad.snapshotUrl}
                alt={`Pub ${ad.pageName}`}
                className="max-h-[560px] max-w-full rounded-xl object-contain shadow-md"
                loading="lazy"
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-400 gap-3">
              <Eye className="w-10 h-10 opacity-30" />
              <p className="text-xs font-semibold">Aperçu non disponible</p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50 flex flex-wrap gap-4 flex-shrink-0">
          {ad.body && (
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Texte</div>
              <p className="text-xs text-zinc-700 line-clamp-3">{ad.body}</p>
            </div>
          )}
          {ad.daysRunning !== null && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Durée</div>
              <div className="text-xs font-bold text-indigo-600">{daysLabel(ad.daysRunning)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   AD SKELETON
───────────────────────────────────────────── */
function AdSkeleton() {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden animate-pulse">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-9 h-9 rounded-full bg-zinc-200" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-zinc-200 rounded-full w-28" />
          <div className="h-2 bg-zinc-100 rounded-full w-16" />
        </div>
        <div className="w-12 h-5 bg-zinc-100 rounded-full" />
      </div>
      <div className="px-4 pb-3 space-y-2">
        <div className="h-2.5 bg-zinc-200 rounded-full" />
        <div className="h-2.5 bg-zinc-200 rounded-full w-5/6" />
        <div className="h-2.5 bg-zinc-100 rounded-full w-4/6" />
      </div>
      <div className="h-48 bg-zinc-100" />
      <div className="px-4 py-3 border-t border-zinc-100 flex justify-between items-center">
        <div className="flex gap-2">
          <div className="h-4 w-14 bg-zinc-200 rounded-full" />
        </div>
        <div className="flex gap-1.5">
          <div className="h-6 w-16 bg-zinc-200 rounded-lg" />
          <div className="h-6 w-10 bg-zinc-100 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE PRINCIPALE
───────────────────────────────────────────── */
export default function SpyPubsPage() {
  const router = useRouter();
  const DEFAULT_KEYWORD = "livraison gratuite";

  const [activeNiche, setActiveNiche] = useState("all");
  const [searchTerm, setSearchTerm] = useState(DEFAULT_KEYWORD);
  const [selectedCountry, setSelectedCountry] = useState("ALL");
  const [mediaFilter, setMediaFilter] = useState("ALL");
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [ads, setAds] = useState<AdItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalFound, setTotalFound] = useState(0);
  const [totalInCountry, setTotalInCountry] = useState<number | null>(null);
  const [activeTerm, setActiveTerm] = useState(DEFAULT_KEYWORD);
  const [selectedAd, setSelectedAd] = useState<AdItem | null>(null);
  const [importAd, setImportAd] = useState<AdItem | null>(null);

  // Favoris (Supabase)
  const [favorites, setFavorites] = useState<AdItem[]>([]);
  const [viewMode, setViewMode] = useState<"search" | "favorites">("search");
  const [favLoading, setFavLoading] = useState(false);

  // Fermer dropdown au clic dehors
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCountryDropdown(false);
        setCountrySearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Charger les favoris depuis Supabase
  useEffect(() => {
    setFavLoading(true);
    fetch("/api/spy-pubs/favoris")
      .then(r => r.json())
      .then(data => {
        if (data.favorites) {
          setFavorites(data.favorites.map((f: any) => f.ad_data as AdItem));
        }
      })
      .catch(() => {})
      .finally(() => setFavLoading(false));
  }, []);

  // Recherche principale
  const doSearch = useCallback(async (opts: { term?: string; country?: string; media?: string; }) => {
    const term = opts.term ?? searchTerm;
    const country = opts.country ?? selectedCountry;
    const media = opts.media ?? mediaFilter;

    setAds([]);
    setTotalFound(0);
    setTotalInCountry(null);
    setActiveTerm(term);
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("search_terms", term.trim() || DEFAULT_KEYWORD);
      params.set("countries", country);
      if (media && media !== "ALL") params.set("media_type", media);

      const res = await fetch(`/api/facebook/ad-library?${params.toString()}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const newAds: AdItem[] = data.ads || [];
      setAds(newAds);
      setTotalFound(newAds.length);
      setTotalInCountry(data.totalInCountry ?? null);
    } catch (err: any) {
      setError(err.message);
      toast.error("Erreur lors de la recherche");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCountry, mediaFilter]);

  // Toggle favori
  const toggleFavorite = async (ad: AdItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const isFav = favorites.some(f => f.id === ad.id);
    // Optimistic update
    setFavorites(prev => isFav ? prev.filter(f => f.id !== ad.id) : [ad, ...prev]);
    toast.success(isFav ? "Retiré des favoris" : "Ajouté aux favoris ❤️");

    try {
      if (isFav) {
        await fetch("/api/spy-pubs/favoris", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ad_id: ad.id }),
        });
      } else {
        await fetch("/api/spy-pubs/favoris", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ad_data: ad }),
        });
      }
    } catch {
      // Rollback
      setFavorites(prev => isFav ? [ad, ...prev] : prev.filter(f => f.id !== ad.id));
      toast.error("Erreur lors de la mise à jour des favoris");
    }
  };

  const handleNicheClick = (niche: typeof NICHES[0]) => {
    setActiveNiche(niche.key);
    setSearchTerm(niche.keywords);
    doSearch({ term: niche.keywords });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveNiche("all");
    doSearch({});
  };

  const countryLabel = ALL_COUNTRIES.find(c => c.code === selectedCountry)?.label || "🌍 Monde entier";
  const filteredCountries = ALL_COUNTRIES.filter(c =>
    c.label.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  /* ─── RENDER ─── */
  return (
    <div className="max-w-7xl mx-auto pb-20 px-2 md:px-4 animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-indigo-50 rounded-xl">
            <Telescope className="w-5 h-5 text-indigo-600" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400">
            Bibliothèque Publicitaire Meta
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-zinc-900">Spy Pubs 🔥</h1>
        <p className="text-zinc-400 text-xs font-semibold mt-1 flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-orange-500" />
          Publicités actives depuis{" "}
          <span className="text-indigo-600 font-bold">au moins 7 jours</span>
          {" "}— source officielle Meta
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-4 mb-6 border-b border-zinc-200 pb-0">
        <button
          onClick={() => setViewMode("search")}
          className={`flex items-center gap-2 px-3 py-2.5 text-sm font-bold uppercase tracking-widest transition-colors border-b-2 ${
            viewMode === "search"
              ? "border-indigo-600 text-indigo-600 -mb-px"
              : "border-transparent text-zinc-400 hover:text-zinc-600"
          }`}
        >
          <Search className="w-4 h-4" /> Recherche
        </button>
        <button
          onClick={() => setViewMode("favorites")}
          className={`flex items-center gap-2 px-3 py-2.5 text-sm font-bold uppercase tracking-widest transition-colors border-b-2 ${
            viewMode === "favorites"
              ? "border-red-500 text-red-500 -mb-px"
              : "border-transparent text-zinc-400 hover:text-zinc-600"
          }`}
        >
          <Heart className="w-4 h-4" /> Mes Favoris ({favorites.length})
        </button>
      </div>

      {/* ── Contenu mode Recherche ── */}
      {viewMode === "search" && (
        <>
          {/* Niches */}
          <div className="mb-5">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Niches</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {NICHES.map(niche => (
                <button
                  key={niche.key}
                  onClick={() => handleNicheClick(niche)}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                    activeNiche === niche.key
                      ? "text-white border-indigo-600 shadow-sm"
                      : "bg-white border-zinc-200 text-zinc-600 hover:border-indigo-300 hover:text-indigo-600"
                  }`}
                  style={activeNiche === niche.key ? { background: "var(--dashboard-accent)" } : {}}
                >
                  {niche.label}
                </button>
              ))}
            </div>
          </div>

          {/* Barre de recherche */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 md:p-5 mb-5 shadow-sm">
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col md:flex-row gap-3">
                {/* Keyword */}
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder='Ex : "beauté", "livraison gratuite", "50% off"…'
                    className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>

                {/* Pays */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowCountryDropdown(v => !v)}
                    className="flex items-center gap-2 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 hover:border-indigo-400 transition-colors whitespace-nowrap w-full md:w-52"
                  >
                    <Globe className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                    <span className="flex-1 truncate text-left">{countryLabel}</span>
                    <ChevronDown className={`w-4 h-4 text-zinc-400 flex-shrink-0 transition-transform ${showCountryDropdown ? "rotate-180" : ""}`} />
                  </button>

                  {showCountryDropdown && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="p-2 border-b border-zinc-100">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                          <input
                            type="text"
                            value={countrySearch}
                            onChange={e => setCountrySearch(e.target.value)}
                            placeholder="Rechercher un pays…"
                            autoFocus
                            className="w-full pl-8 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700 placeholder-zinc-400 focus:outline-none focus:border-indigo-400 transition-colors"
                          />
                        </div>
                      </div>
                      <div className="overflow-y-auto max-h-60 py-1">
                        {filteredCountries.map(c => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => { setSelectedCountry(c.code); setShowCountryDropdown(false); setCountrySearch(""); }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors flex items-center gap-2 ${
                              selectedCountry === c.code
                                ? "bg-indigo-50 text-indigo-700"
                                : "text-zinc-600 hover:bg-zinc-50"
                            }`}
                          >
                            <span className="flex-1">{c.label}</span>
                            {selectedCountry === c.code && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bouton recherche */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm disabled:opacity-60"
                  style={{ background: "var(--dashboard-accent)" }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Rechercher
                </button>
              </div>
            </form>

            {/* Suggestions */}
            <div className="mt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3 h-3 text-zinc-400" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Suggestions</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {KEYWORD_SUGGESTIONS.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => { setSearchTerm(s.value); setActiveNiche("all"); doSearch({ term: s.value }); }}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all border ${
                      activeTerm === s.value
                        ? "text-white border-indigo-600"
                        : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                    style={activeTerm === s.value ? { background: "var(--dashboard-accent)" } : {}}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtres médias + Badges */}
            <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex flex-wrap gap-2 flex-1">
                {MEDIA_FILTERS.map(f => {
                  const Icon = f.icon;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setMediaFilter(f.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all border ${
                        mediaFilter === f.key
                          ? "text-white border-indigo-600"
                          : "bg-white border-zinc-200 text-zinc-600 hover:border-indigo-300 hover:text-indigo-600"
                      }`}
                      style={mediaFilter === f.key ? { background: "var(--dashboard-accent)" } : {}}
                    >
                      <Icon className="w-3 h-3" />
                      {f.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 text-[9px] font-bold uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Actives uniquement
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200 text-[9px] font-bold uppercase tracking-wide">
                  <Clock className="w-3 h-3" />
                  Min. 7 jours
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 text-zinc-500 rounded-full border border-zinc-200 text-[9px] font-bold uppercase tracking-wide">
                  <TrendingUp className="w-3 h-3" />
                  Source Meta
                </div>
              </div>
            </div>
          </div>

          {/* Chargement */}
          {loading && (
            <div>
              <div className="flex items-center gap-2 mb-5">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  Recherche de publicités en cours…
                </span>
              </div>
              <div style={{ columns: "320px", columnGap: "1rem" }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="mb-4"><AdSkeleton /></div>
                ))}
              </div>
            </div>
          )}

          {/* Erreur */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="p-4 bg-red-50 rounded-2xl">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-700 mb-2">Erreur de connexion à la bibliothèque Meta</p>
                <p className="text-xs font-semibold text-red-500 max-w-md">{error}</p>
              </div>
              <button
                onClick={() => doSearch({})}
                className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                style={{ background: "var(--dashboard-accent)" }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Réessayer
              </button>
            </div>
          )}

          {/* Aucun résultat */}
          {!loading && !error && ads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="p-4 bg-zinc-50 rounded-2xl">
                <Telescope className="w-10 h-10 text-zinc-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-700 mb-1">Aucune publicité trouvée</p>
                <p className="text-xs text-zinc-400 max-w-sm">
                  Sélectionnez une niche ou saisissez un mot-clé, puis cliquez sur &quot;Rechercher&quot;.
                </p>
              </div>
            </div>
          )}

          {/* Résultats */}
          {!loading && !error && ads.length > 0 && (
            <div>
              {/* Header résultats */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                      {totalFound} pub{totalFound > 1 ? "s" : ""} trouvée{totalFound > 1 ? "s" : ""}
                    </span>
                  </div>
                  {totalInCountry !== null && (
                    <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-full flex items-center gap-1.5">
                      <Flame className="w-3 h-3 text-indigo-500" />
                      <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest">
                        {totalInCountry > 50000 ? "+50k au total" : `${totalInCountry} au total`}
                      </span>
                    </div>
                  )}
                  <span className="text-[10px] font-semibold text-zinc-400 hidden md:inline ml-1">
                    pour &quot;{activeTerm}&quot; · {countryLabel}
                    {mediaFilter !== "ALL" && <> · {MEDIA_FILTERS.find(f => f.key === mediaFilter)?.label}</>}
                  </span>
                </div>
                <button
                  onClick={() => doSearch({})}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-zinc-200 rounded-xl text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:border-indigo-300 hover:text-indigo-600 transition-all"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                  Actualiser
                </button>
              </div>

              {/* Masonry grid */}
              <div style={{ columns: "320px", columnGap: "1rem" }}>
                {ads.map(ad => (
                  <div key={ad.id} className="mb-4" style={{ breakInside: "avoid" }}>
                    <AdCard
                      ad={ad}
                      onClick={() => setSelectedAd(ad)}
                      onImport={ad => setImportAd(ad)}
                      isFavorite={favorites.some(f => f.id === ad.id)}
                      onToggleFavorite={toggleFavorite}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Mode Favoris ── */}
      {viewMode === "favorites" && (
        <div>
          {favLoading ? (
            <div className="flex items-center gap-2 py-8">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              <span className="text-sm text-zinc-400">Chargement des favoris…</span>
            </div>
          ) : favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="p-4 bg-zinc-50 rounded-2xl">
                <Heart className="w-10 h-10 text-zinc-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-700 mb-1">Aucun favori pour le moment</p>
                <p className="text-xs text-zinc-400 max-w-sm">
                  Cliquez sur le ❤️ d&apos;une publicité pour la retrouver ici plus tard.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-zinc-500 mb-5">
                {favorites.length} pub{favorites.length > 1 ? "s" : ""} en favori
              </p>
              <div style={{ columns: "320px", columnGap: "1rem" }}>
                {favorites.map(ad => (
                  <div key={ad.id} className="mb-4" style={{ breakInside: "avoid" }}>
                    <AdCard
                      ad={ad}
                      onClick={() => setSelectedAd(ad)}
                      onImport={ad => setImportAd(ad)}
                      isFavorite={true}
                      onToggleFavorite={toggleFavorite}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal snapshot */}
      {selectedAd && <SnapshotModal ad={selectedAd} onClose={() => setSelectedAd(null)} />}

      {/* Modal import */}
      {importAd && (
        <ImportModal
          ad={importAd}
          onClose={() => setImportAd(null)}
          router={router}
        />
      )}
    </div>
  );
}
