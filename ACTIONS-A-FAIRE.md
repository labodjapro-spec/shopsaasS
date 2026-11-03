# ✅ ACTIONS À FAIRE QUAND TU SERAS SUR TON PC

Tout le code a déjà été corrigé et poussé sur GitHub (donc **Vercel** est déjà à jour).
Il ne te reste que ces **3 actions** à faire quand tu auras accès à **Supabase** et **Android Studio**.

---

## ACTION 1 : Mettre à jour la fonction `push-order` dans Supabase (2 minutes)

Pourquoi : la fonction qui envoie les notifications Push a été mise à jour (version `v2`) pour supporter le nouveau bouton **« Tester les notifications »** et nettoyer automatiquement les anciens appareils expirés.

1. Ouvre ton projet sur **https://supabase.com**
2. Dans le menu à gauche, clique sur **Edge Functions**
3. Clique sur la fonction **`push-order`** (ou sur **Deploy a new function → Via Editor** et nomme-la exactement `push-order` si elle n'existe pas encore)
4. Ouvre le fichier `supabase/functions/push-order/index.ts` de ce projet, **copie tout son contenu**, remplace tout le code dans l'éditeur Supabase, puis clique sur **Deploy**
5. Toujours dans `push-order` → onglet **Details** (ou **Settings**) : vérifie que **Verify JWT** (ou *Enforce JWT Verification*) est bien **DÉSACTIVÉ**, puis enregistre.

### Vérification rapide dans Supabase (si tu ne l'avais pas encore fait) :
- Dans **SQL Editor**, vérifie que tu as bien exécuté :
  1. `supabase/migrations/0014_web_push_subscriptions.sql`
  2. `supabase/migrations/0020_push_one_device.sql`
- Dans **Edge Functions → Secrets**, vérifie que ces 3 secrets existent bien (avec les valeurs de ton fichier `PUSH-VALUES.txt`) :
  - `PUSH_HOOK_SECRET` (doit être **exactement le même** que dans Vercel → Settings → Environment Variables)
  - `VAPID_KEYS_JSON`
  - `VAPID_SUBJECT` (ex: `mailto:ton@email.com`)

---

## ACTION 2 : Tester les notifications en 1 clic depuis ton téléphone (1 minute)

1. Sur ton téléphone, ouvre `https://shopsaas-s-one.vercel.app/dashboard/settings#application` et connecte-toi
2. Clique sur **« Activer les alertes »** (et autorise les notifications si le téléphone le demande)
3. Clique sur le nouveau bouton **« Tester les notifications »** :
   - Une liste s'affiche avec des ✅ ou des ❌
   - S'il manque un réglage dans Vercel ou Supabase, la ligne en ❌ te dira **exactement lequel** et comment le corriger
   - Quand tout est ✅, tu reçois immédiatement la notification **« Test ShopSaaS ✅ »** sur ton téléphone
4. Ferme complètement ShopSaaS / verrouille l'écran de ton téléphone et passe une commande test depuis ton PC : la notification arrivera même écran verrouillé (avec la nouvelle pastille propre en blanc sur fond transparent).

---

## ACTION 3 : Générer l'application Android (APK) avec Android Studio (5 minutes)

Le projet Android (`android-app`) a été corrigé :
- Ajout de `NotificationPermissionRequestActivity` (obligatoire sur Android 13, 14 et 15 pour que l'application puisse demander la permission de notifier)
- Ajout de la pastille de notification monochrome (`res/drawable/ic_notification.xml`) pour ne plus avoir un carré blanc moche dans la barre du haut
- Ajout de `gradle-wrapper.properties` pour Android Studio

### Étapes dans Android Studio :
1. Ouvre **Android Studio** → **File → Open** → sélectionne le dossier **`android-app`**
2. Attends que la synchronisation Gradle en bas se termine
3. Dans le menu du haut : **Build → Build App Bundle(s) / APK(s) → Build APK(s)**
4. Récupère le fichier APK généré ici :
   `android-app/app/build/outputs/apk/debug/app-debug.apk`
5. *(Optionnel mais recommandé pour enlever la barre d'adresse Chrome en haut de l'app)* :
   - Ouvre l'onglet **Terminal** en bas d'Android Studio et lance :
     ```powershell
     & "$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe" -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
     ```
   - Copie la valeur de la ligne `SHA256:` (ex: `AB:12:CD:...`)
   - Colle-la à la place de `REPLACE_WITH_SIGNING_CERT_SHA256` dans le fichier `public/.well-known/assetlinks.json`, puis pousse sur GitHub.
6. Envoie `app-debug.apk` sur ton téléphone, désinstalle l'ancienne version si tu en avais une, installe le nouvel APK, connecte-toi et clique sur **« Activer les alertes »** puis **« Tester les notifications »**.

---

## 📁 Résumé des fichiers modifiés / créés

- `ACTIONS-A-FAIRE.md` : ce récapitulatif
- `GUIDE-PUSH.md` : guide détaillé pas-à-pas pour le Push
- `GUIDE-APP-ANDROID.md` : guide détaillé pas-à-pas pour Android Studio & l'APK
- `supabase/functions/push-order/index.ts` (+ `supabase/functions/env.d.ts`) : fonction Supabase v2 avec mode test et 0 erreur TypeScript
- `app/api/push/test/route.ts` : route de diagnostic complet du Push
- `app/dashboard/app/AppSetup.tsx` : bouton « Tester les notifications » et checklist visuelle
- `lib/push/browser.ts` & `lib/push/dispatch-order-push.ts` : renouvellement automatique si la clé VAPID a changé + logs détaillés
- `public/sw.js` : Service Worker v7 (affiche systématiquement la notification système sur 100 % des push + renouvellement auto `pushsubscriptionchange`)
- `public/icons/app-badge.png` : pastille de notification convertie en blanc sur fond transparent
- `android-app/...` : permission Android 13+ (`NotificationPermissionRequestActivity`) + pastille `ic_notification.xml` + configuration Gradle
- Nettoyage automatique (`.trim()`) de toutes les variables d'environnement Vercel/Supabase qui contenaient un retour à la ligne (`\n`) caché

