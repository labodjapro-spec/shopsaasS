# Guide Push : recevoir les commandes même quand le dashboard est fermé

Ce guide remplace l’ancien `PUSH-SETUP.md`. Suis les étapes **dans l’ordre**. Chaque étape ne se fait qu’une fois.

À la fin, un bouton **« Tester les notifications »** te dit exactement ce qui marche et ce qui bloque. Plus besoin de deviner.

---

## Comment ça marche (en 10 secondes)

```
Client passe commande
   → Vercel (ton site) appelle la fonction Supabase « push-order »
      → Supabase envoie le message à Google (Android/Chrome) ou Apple
         → Google réveille le téléphone et affiche la notification
```

Si **un seul maillon** est mal réglé, rien n’arrive, et aucune erreur ne s’affiche. Il faut donc que les 6 étapes ci-dessous soient faites.

> Le **son** et le **petit popup** dans le dashboard ne passent pas par le push : ils marchent seulement quand le dashboard est ouvert. Voir ces alertes ne prouve donc **pas** que le push marche.

---

## Étape 1 : les clés (une seule fois, à garder pour toujours)

1. Dans le dossier du projet, double-clique `CREER-CLES-PUSH.cmd`.
2. Ouvre le fichier `PUSH-VALUES.txt` qui vient d’être créé.
3. Sur la ligne `VAPID_SUBJECT`, remplace `YOUR-EMAIL@example.com` par ton email (garde `mailto:` devant).

> [!IMPORTANT]
> **Un seul fichier `PUSH-VALUES.txt` pour tout.** Les valeurs de Vercel et de Supabase doivent venir du **même** fichier.
> Si tu as déjà créé des clés avant, **garde l’ancien fichier** et ne le recrée pas. Si tu l’as perdu : supprime-le, recrée-le, et refais les étapes 3, 5 et 6 en entier, puis réactive les alertes sur chaque téléphone.

## Étape 2 : les tables dans Supabase

Supabase → **SQL Editor** → **New query**. Colle puis exécute (**Run**), un fichier à la fois :

1. `supabase/migrations/0014_web_push_subscriptions.sql`
2. `supabase/migrations/0020_push_one_device.sql`

Les deux sont indispensables. Si Supabase répond « already exists », c’est déjà fait : passe à la suite.

## Étape 3 : les secrets dans Supabase

Supabase → **Edge Functions** → **Secrets**. Ajoute ces 3 lignes depuis `PUSH-VALUES.txt` (ce qui est avant `=` va dans **Name**, ce qui est après va dans **Value**) :

| Name | Value |
|---|---|
| `PUSH_HOOK_SECRET` | la valeur de ton fichier |
| `VAPID_KEYS_JSON` | **toute** la ligne après `=` (elle commence par `{` et finit par `}`) |
| `VAPID_SUBJECT` | `mailto:ton@email.com` |

## Étape 4 : la fonction `push-order` (À REFAIRE avec la nouvelle version)

La fonction a été mise à jour (version **v2**, avec le mode test). Même si tu l’avais déjà installée, recopie-la :

1. Supabase → **Edge Functions** → ouvre `push-order` (ou **Deploy a new function → Via Editor** avec le nom exact `push-order`).
2. Remplace tout le code par le contenu de `supabase/functions/push-order/index.ts`.
3. Clique **Deploy**.
4. Dans **Details** (ou Settings) de la fonction : **désactive « Verify JWT »** (ou « Enforce JWT Verification »), puis enregistre.

## Étape 5 : les variables dans Vercel

Vercel → ton projet → **Settings → Environment Variables**. Vérifie que ces variables existent (cocher **Production** et **Preview**) :

| Variable | D’où elle vient |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `PUSH-VALUES.txt` |
| `PUSH_HOOK_SECRET` | `PUSH-VALUES.txt` (**exactement** la même que dans Supabase) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | déjà là normalement |

Puis **Deployments → dernier déploiement → ⋯ → Redeploy**.

> [!WARNING]
> Une variable ajoutée ou modifiée sur Vercel ne marche **qu’après un Redeploy**. C’est l’oubli le plus fréquent.

## Étape 6 : mettre le nouveau code en ligne

Les correctifs (bouton de test, service worker v6, renouvellement automatique de l’abonnement) doivent être sur GitHub pour que Vercel les déploie. Une fois poussés, attends que Vercel affiche **Ready**.

---

## ✅ Tester (le vrai test)

### Test 1 : le bouton de diagnostic

1. Sur le téléphone, ouvre ShopSaaS (l’app ou Chrome) et connecte-toi.
2. **Réglages → Application → Activer les alertes**, puis accepte la demande.
3. Appuie sur **« Tester les notifications »**.

Une liste s’affiche avec ✅ ou ❌. Chaque ❌ indique **quoi faire** en rouge. Corrige, puis reteste.
Si tout est ✅, une notification « Test ShopSaaS ✅ » apparaît sur le téléphone en quelques secondes.

### Test 2 : dashboard fermé (le test qui compte)

1. Sur le téléphone : ferme complètement ShopSaaS (balaye-la des applis récentes).
2. Verrouille l’écran.
3. Depuis un **autre appareil** (PC), passe une commande sur ta boutique.
4. La notification « Nouvelle commande » doit arriver en moins de 10 secondes.

---

## ❌ Ce que veut dire chaque erreur du diagnostic

| Ligne en ❌ | Cause | Correction |
|---|---|---|
| Variables Vercel | Une variable manque sur Vercel | Étape 5 + **Redeploy** |
| Permission notifications : Bloquée | Tu as refusé une fois | Réglages du téléphone → Applis → ShopSaaS (ou Chrome) → Notifications → Autoriser |
| Table Supabase | Migrations pas exécutées | Étape 2 |
| Fonction introuvable | Fonction pas déployée ou mal nommée | Étape 4 (nom exact `push-order`) |
| « Verify JWT est encore activé » | Option pas désactivée | Étape 4, point 4 |
| Ancienne version de la fonction | L’ancien code est encore en ligne | Étape 4 |
| Secret partagé différent | `PUSH_HOOK_SECRET` pas identique | Même valeur dans Vercel ET Supabase, puis Redeploy |
| Clés VAPID Vercel ≠ Supabase | Valeurs venant de 2 fichiers différents | Tout reprendre du **même** `PUSH-VALUES.txt`, Redeploy, puis désactiver/réactiver les alertes |
| Refus 403 | Le téléphone s’est abonné avec une ancienne clé | Désactiver puis réactiver les alertes sur ce téléphone |
| Cet appareil n’est pas enregistré en base | L’abonnement n’a pas été sauvegardé | Désactiver puis réactiver les alertes |

### Tout est ✅ mais rien n’arrive sur le téléphone

Le serveur a fait son travail : Google a accepté le message. Le blocage vient du téléphone :

- **Notifications** : Réglages → Applications → ShopSaaS **et** Chrome → Notifications → tout autoriser (y compris la catégorie du site).
- **Batterie** : Réglages → Applications → ShopSaaS **et** Chrome → Batterie → **Sans restriction** / « Ne pas optimiser ».
- **Tecno, Infinix, itel, Xiaomi, Oppo, Huawei** : ces téléphones tuent les applis en arrière-plan. Active aussi **Démarrage automatique** (Autostart) pour Chrome et ShopSaaS, et **verrouille** l’app dans les applis récentes (cadenas).
- **Ne pas déranger** désactivé.
- **Économiseur de données** : autoriser les données en arrière-plan pour Chrome.

### Sur PC (Windows)

Chrome doit rester lancé en arrière-plan. Chrome → Paramètres → Système → active **« Continuer à exécuter les applications en arrière-plan après la fermeture de Google Chrome »**. Vérifie aussi Windows → Paramètres → Notifications → Chrome activé.

### Voir les logs

- **Supabase** → Edge Functions → `push-order` → **Logs** : chaque envoi et chaque refus de Google.
- **Vercel** → projet → **Logs** : cherche `[push]`. Tu y vois le résultat de chaque commande (`sent: 1` = envoyé).

---

## Règles de sécurité

- Ne partage jamais `PUSH-VALUES.txt`, `VAPID_KEYS_JSON` ni `SUPABASE_SERVICE_ROLE_KEY`.
- Ne mets jamais `VAPID_KEYS_JSON` ni `SUPABASE_SERVICE_ROLE_KEY` dans une variable qui commence par `NEXT_PUBLIC_`.

