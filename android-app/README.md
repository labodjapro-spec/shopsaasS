# Application Android ShopSaaS

Ce dossier ouvre une vraie application Android (Trusted Web Activity).
Elle affiche le dashboard ShopSaaS, avec le nom ShopSaaS dans les notifications, pas Chrome.

## 1. Domaine

Dans `app/src/main/res/values/strings.xml`, remplace `TON_DOMAINE.com` par ton domaine HTTPS
(exemple : `app.shopsaas.com`). Utilise le domaine de production, pas une preview Vercel.

## 2. Android Studio

1. Ouvre Android Studio.
2. File → Open → ce dossier `android-app`.
3. Laisse Gradle se synchroniser.
4. Build → Build Bundle(s) / APK(s) → Build APK(s).
5. Envoie `app-debug.apk` sur le telephone et installe-le.

## 3. Notifications

Ouvre l’app, connecte-toi, va dans Reglages, puis Active les alertes.
Sur Android, les commandes arrivent meme ecran verrouille.

## 4. Optionnel : enlever la barre d’adresse

Pour que l’app s’ouvre sans barre Chrome, ajoute `public/.well-known/assetlinks.json`
avec l’empreinte SHA-256 de ta cle de signature. Android Studio affiche cette empreinte
dans Gradle → signingReport.
