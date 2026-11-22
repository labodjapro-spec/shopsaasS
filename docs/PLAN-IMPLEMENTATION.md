# Plan d'implémentation ShopSaaS (COD Afrique)

Contexte : usage interne (pas de vente du SaaS), tout en offres gratuites
(Vercel Hobby, Supabase Free, Firebase). Priorité : vitesse de la boutique
publique, puis outils pour l'équipe (closeuses, livreurs).

Ordre conseillé : Phase 0 → 1 → 2 → 3, puis 4 et 5 selon le besoin de l'équipe.
Chaque phase se livre seule (un déploiement Vercel par phase).

---

## Phase 0 : Sécurité urgente (½ journée)

| # | Tâche | Fichiers |
|---|---|---|
| 0.1 | Révoquer le token GitHub `ghp_…` visible dans `.git/config`, en créer un nouveau, refaire le remote sans token dans l'URL (utiliser Git Credential Manager) | `.git/config` |
| 0.2 | Exiger un utilisateur connecté sur la recherche Spy Pubs | `app/api/facebook/ad-library/route.ts` |
| 0.3 | Supprimer la route non utilisée `scrape-product` | `app/api/scrape-product/` |
| 0.4 | Supprimer la page de debug | `app/admin/debug/` |
| 0.5 | Anti-spam commandes : champ caché « pot de miel » + limite par téléphone/IP (table `order_rate_limits` ou vérif. « max 3 commandes / 10 min / numéro » dans `create_public_order`) + retirer l'autorisation de toute origine `*.vercel.app` | `app/api/orders/create/route.ts`, nouvelle migration |
| 0.6 | Ne plus renvoyer `detail` (message d'erreur interne) au client | `app/api/orders/create/route.ts` |
| 0.7 | ID super-admin en variable d'environnement `SUPER_ADMIN_IDS` | `lib/admin/require-super-admin.ts` |

**Terminé quand** : appeler ces routes sans être connecté renvoie 401, et 20 commandes envoyées d'affilée avec le même numéro sont refusées après la 3ᵉ.

---

## Phase 1 : Vitesse (1 à 2 jours) — PRIORITÉ

Causes trouvées dans le code :

1. **Serveur Vercel loin de la base.** Sur Hobby, les fonctions tournent par défaut à
   Washington (`iad1`) alors que Supabase est en Europe. Chaque requête SQL traverse
   l'Atlantique (≈ 80-100 ms × 5 à 8 requêtes par page).
2. **Boutique publique jamais mise en cache.** `app/s/[store]/page.tsx` et `layout.tsx`
   utilisent le client Supabase « avec cookies », ce qui force Next.js à reconstruire la page
   à chaque visite (l'en-tête `s-maxage=60` de `next.config.ts` est alors ignoré).
   La boutique est aussi cherchée deux fois (layout + page).
3. **Tout le constructeur envoyé au visiteur.** `TemplateLayoutRenderer` est un composant
   client qui importe les 35 sections d'un coup (`renderBlock.tsx`) : le téléphone du client
   télécharge et exécute tout, même les sections absentes de la page.
4. **Images lourdes.** 35 `<img>` sans `loading="lazy"` ni dimensions ; photos importées
   en taille originale (souvent 2-5 Mo).
5. **Dashboard « figé » au clic.** Aucun `loading.tsx` : rien ne s'affiche tant que le serveur
   n'a pas fini. Le middleware vérifie aussi la session (appel réseau à Supabase) sur toutes
   les pages, y compris `/s/...` et les API publiques.

| # | Tâche | Gain attendu |
|---|---|---|
| 1.1 | Vercel → Settings → Functions → **Function Region** = même zone que Supabase (Paris `cdg1`, Francfort `fra1`, Londres `lhr1` ou Dublin `dub1` ; vérifier la région dans Supabase → Project Settings → General) | Le plus gros gain, 0 ligne de code |
| 1.2 | Boutique publique : client Supabase **sans cookies** (clé anon) + `unstable_cache` avec tag `store:<id>` ; `revalidateTag` lors de l'enregistrement d'une page, d'un produit ou d'un prix. Fusionner les requêtes layout/page | Page servie depuis le cache en < 200 ms |
| 1.3 | Exclure `/s/`, `/api/orders/create`, `/api/abandoned-carts` du middleware de session | –1 appel réseau par visite |
| 1.4 | Sections de la boutique : rendre côté serveur les sections statiques (texte, FAQ, garanties, avis…) ; garder en client seulement formulaire, compte à rebours, galerie, popup ; `next/dynamic` pour les sections rares (parallax, hotspots, reels) | JS ÷ 2 à 3 sur mobile |
| 1.5 | Images : compression à l'envoi (navigateur → WebP, max 1200 px, ~150 Ko) dans `ImageUploader` / `ImageUploadField` ; `loading="lazy"` + `width/height` partout sauf la 1ʳᵉ image (`fetchPriority="high"`) | Page 3 à 10× plus légère en 3G/4G |
| 1.6 | Ajouter `loading.tsx` (squelettes) dans `app/dashboard`, `orders`, `orders/[id]`, `products` | Réaction immédiate au clic |
| 1.7 | Dashboard accueil : remplacer les boucles « charger toutes les commandes » par une fonction SQL `dashboard_stats(store_id, from, to)` | Accueil rapide même avec 10 000 commandes |
| 1.8 | Liste des commandes : sélectionner seulement les colonnes utiles + pagination (50 par page) | Liste rapide |
| 1.9 | Session : utiliser `supabase.auth.getClaims()` (vérification locale du jeton) au lieu de `getUser()` dans le middleware | –1 appel réseau par clic |

**Mesure avant/après** : PageSpeed Insights (mobile) sur une page produit + chronomètre
sur 5 clics dans le dashboard. Objectif : boutique < 2 s en 4G, clic dashboard < 500 ms
avant affichage.

---

## Phase 2 : Nettoyage (1 journée)

Fait avant les nouveautés pour ne pas modifier deux copies du même fichier.

| # | Tâche |
|---|---|
| 2.1 | Supprimer `bo/` (ancienne copie, 113 fichiers) et `out/` |
| 2.2 | Une seule source pour le constructeur : garder `lib/store-builder/*`, supprimer les 9 doublons de `components/store-builder/` (4 ont divergé : vérifier la bonne version avant) |
| 2.3 | Garder un seul projet Android (`android/`, celui de Capacitor) et supprimer l'autre |
| 2.4 | Supprimer `lib/meta-capi.ts` (import mort), garder `lib/meta/` |
| 2.5 | Découper `app/dashboard/spy-pubs/page.tsx` (1 235 lignes) en composants |
| 2.6 | Recréer les migrations 0011-0013 manquantes (ou un fichier `0000_schema_complet.sql` exporté depuis Supabase) et corriger le README |
| 2.7 | Déplacer les guides `.md`/`.txt` de la racine vers `docs/` |
| 2.8 | Centraliser statuts et libellés (`STATUS_LABELS` existe en 3 copies) dans `lib/orders/status.ts` |

**Terminé quand** : `npm run build` et `npm run typecheck` passent.

---

## Phase 3 : Finir ce qui est commencé (2 à 3 jours)

| # | Tâche | Détail |
|---|---|---|
| 3.1 | **Variante choisie enregistrée** | Le formulaire envoie toujours `variants[0]` ; trouver la vraie variante selon taille/couleur, enregistrer `variant`, `image`, `title` dans `lines`. Afficher sur la fiche commande |
| 3.2 | **Paniers abandonnés** | Page `/dashboard/relances` : liste (nom, tél, produit, montant, il y a X h), bouton WhatsApp pré-rempli, statuts « relancé / converti / perdu ». Badge dans le menu |
| 3.3 | **Masquer les numéros** | Si `mask_phones` : afficher `+228 90 •• •• 12`, boutons « Appeler » / « WhatsApp » qui passent par une route serveur qui journalise l'action |
| 3.4 | **Assignation des commandes** | Colonne `assigned_to` (déjà en base) : assigner manuellement ou en tourniquet automatique entre les agents connectés ; `only_assigned` appliqué dans la requête **et** en RLS |
| 3.5 | **Newsletter** | Enregistrer réellement les inscrits (table `subscribers`) + liste exportable |
| 3.6 | **Export CSV** | Bouton sur la liste des commandes (filtres respectés), permission `export.read` |
| 3.7 | **Google Sheets** (gratuit) | Webhook vers un script Google Apps Script fourni par toi → chaque nouvelle commande ajoute une ligne |

---

## Phase 4 : Application équipe — agents de confirmation (3 à 4 jours)

L'APK et la PWA existent déjà ; il s'agit d'une **interface dédiée selon le rôle**.
Un agent qui ouvre l'app arrive directement sur son écran, sans menu inutile.

**Écran « File d'appel »** (`/dashboard/agent`)
- Une commande à la fois, la plus ancienne non traitée assignée à l'agent.
- Gros boutons : 📞 Appeler, 💬 WhatsApp (message type pré-rempli), ✅ Confirmé,
  📅 Programmer, 🔁 Injoignable, ❌ Annulé (motif obligatoire : « pas commandé »,
  « trop cher », « numéro faux »…).
- **Compteur de tentatives** : injoignable 1/3, 2/3, 3/3 → annulation auto au 3ᵉ échec ;
  rappel automatique 2 h après un « injoignable ».
- Modifier quantité, adresse, ville, ajouter un 2ᵉ produit (upsell au téléphone).
- **Scripts d'appel** et modèles WhatsApp par boutique (réglables).

**Suivi**
- Stats par agent : appels, taux de confirmation, taux de livraison réel.
- Commission optionnelle par commande livrée.

---

## Phase 5 : Livreurs et encaissement (4 à 5 jours)

**Nouveau rôle « Livreur »** (rôle prêt à l'emploi) : voit uniquement les commandes
qui lui sont confiées, avec les numéros (nécessaire pour livrer).

**Écran livreur** (`/dashboard/livraisons`, pensé pour téléphone)
- Tournée du jour, triée par quartier.
- Pour chaque colis : appeler, WhatsApp « je suis en route », ouvrir Google Maps
  (adresse ou position GPS envoyée par le client).
- Boutons : **Livré** (montant encaissé), **Refusé** (motif), **Reporté** (nouvelle date),
  **Client absent**.
- Fonctionne avec un réseau faible : actions mises en file et renvoyées au retour du réseau.

**Côté gérant**
- Attribuer les commandes confirmées à un livreur (une par une ou en lot).
- **Caisse / versements** : par livreur, total encaissé vs total versé, « reste à verser » ;
  bouton « Versement reçu ». C'est souvent là que l'argent se perd en COD.
- **Bon de livraison** imprimable / PDF (nom, tél, adresse, produits, montant à encaisser).
- Option : sociétés de livraison externes = livreur avec un compte partagé.

**Nouveaux statuts** : `assigned` (attribuée au livreur), `out_for_delivery` (en cours),
`postponed` (reportée) — en plus des statuts actuels.

---

## Phase 6 : Spécifique COD Afrique (3 à 4 jours)

| # | Fonction | Pourquoi |
|---|---|---|
| 6.1 | **Frais de livraison par ville/zone** (table `delivery_zones`) + liste déroulante des villes dans le formulaire | Fini les fautes d'orthographe de ville, prix juste |
| 6.2 | **Détection des doublons** : même numéro dans les 48 h → badge « Doublon » | Évite d'envoyer deux colis |
| 6.3 | **Score client** par numéro : nb commandes, livrées, refusées → badge 🟢/🟠/🔴 | Ne pas expédier aux « refuseurs » habituels |
| 6.4 | **Liste noire** de numéros (commande acceptée mais marquée, ou bloquée) | Anti-fraude / anti-concurrent |
| 6.5 | **Validation du numéro par pays** (longueur, préfixes opérateurs) et normalisation `+228…` | Moins d'injoignables |
| 6.6 | **Bouton « Ma position »** dans le formulaire (GPS → lien Google Maps) | Adresses imprécises fréquentes |
| 6.7 | **Message WhatsApp de confirmation** au client (lien `wa.me` gratuit, envoyé par l'agent) | Réduit les refus à la livraison |
| 6.8 | **Stock** : alerte stock bas + stock retourné réintégré quand statut = Retournée | Stock juste |

---

## Phase 7 : Chiffres, pub et partage (2 à 3 jours)

| # | Fonction |
|---|---|
| 7.1 | Page **Statistiques** : CA livré (le vrai CA en COD), taux confirmation / livraison / retour, graphique par jour, top produits, top villes |
| 7.2 | **Bénéfice** : coût d'achat par produit + coût pub du jour saisi → marge nette, coût par commande livrée |
| 7.3 | **Pixel TikTok** (événements navigateur + API événements), comme Meta |
| 7.4 | **Aperçu des liens** (`generateMetadata`) : titre, description, image produit pour WhatsApp/Facebook |
| 7.5 | **Paramètres UTM** enregistrés sur la commande → savoir quelle pub/quelle vidéo vend |

---

## Plus tard (si le SaaS est vendu un jour)

- Domaine personnalisé par boutique (API Vercel Domains).
- Abonnements, quotas, facturation (Mobile Money : CinetPay, FedaPay, PayDunya).
- Passage Vercel Pro (le plan Hobby interdit l'usage commercial) et Supabase Pro
  (sauvegardes quotidiennes, pas de mise en pause).

---

## Limites des offres gratuites à garder en tête

| Service | Limite | Impact |
|---|---|---|
| Vercel Hobby | Tâches planifiées (cron) : 1 fois/jour max | Rappels « injoignable » / « programmée » → utiliser `pg_cron` de Supabase (gratuit) qui appelle `/api/orders/reminders` |
| Vercel Hobby | 1 région de fonctions | Choisir celle de Supabase (Phase 1.1) |
| Supabase Free | 500 Mo base, 1 Go fichiers | Compression des images (Phase 1.5) indispensable |
| Supabase Free | Projet mis en pause après 7 jours sans activité | Pas un problème tant que des commandes arrivent |
| Supabase Free | Pas de sauvegarde téléchargeable | Export CSV hebdomadaire (Phase 3.6) en guise de sauvegarde |

---

## Calendrier indicatif

| Semaine | Contenu |
|---|---|
| 1 | Phase 0 + Phase 1 (sécurité + vitesse) |
| 2 | Phase 2 + Phase 3 (nettoyage + finitions) |
| 3 | Phase 4 (app agents) |
| 4 | Phase 5 (livreurs + caisse) |
| 5 | Phase 6 + Phase 7 (COD + chiffres) |
