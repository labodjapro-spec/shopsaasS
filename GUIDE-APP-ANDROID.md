# Guide App Android : générer l’APK avec Android Studio

L’app ShopSaaS est une **Trusted Web Activity (TWA)** : une vraie appli Android qui affiche ton dashboard en plein écran grâce à Chrome. Les notifications arrivent avec le nom et l’icône **ShopSaaS** (pas Chrome).

> [!IMPORTANT]
> Avant de faire l’app, termine le **GUIDE-PUSH.md** et vérifie que le bouton « Tester les notifications » est tout ✅ dans Chrome sur le téléphone. L’app utilise exactement le même push : s’il ne marche pas dans Chrome, il ne marchera pas dans l’app.

**Il faut sur le téléphone** : Android 8 ou plus, et **Google Chrome installé et à jour**.

---

## Étape 1 : vérifier l’adresse du site

Ouvre `android-app/app/src/main/res/values/strings.xml`. L’adresse actuelle est :

```
shopsaas-s-one.vercel.app
```

Si ton site de production a une autre adresse (ex. `app.tondomaine.com`), remplace-la **aux 3 endroits** du fichier. Utilise l’adresse de **production**, jamais une adresse de preview Vercel (celles avec des lettres au hasard).

## Étape 2 : ouvrir le projet

1. Ouvre **Android Studio**.
2. **File → Open** → choisis le dossier **`android-app`** (pas le dossier ShopSaaS en entier).
3. Attends la fin de la **Gradle Sync** (barre en bas). La première fois, ça télécharge des choses : quelques minutes.
4. Si Android Studio propose de mettre à jour Gradle ou le plugin Android (« AGP Upgrade »), choisis **Don’t ask again / Remind me later**. Pas besoin.
5. S’il demande un JDK : choisis le **JDK intégré** (« Embedded JDK / jbr-17 » ou plus récent).

## Étape 3 : générer l’APK

**Build → Build App Bundle(s) / APK(s) → Build APK(s)**.

À la fin, clique **locate** dans la petite fenêtre en bas à droite. Le fichier est ici :

```
android-app/app/build/outputs/apk/debug/app-debug.apk
```

## Étape 4 : récupérer l’empreinte SHA-256 (pour enlever la barre d’adresse)

Sans cette étape, l’app s’ouvre avec une **barre d’adresse Chrome en haut**, et les notifications peuvent arriver sous le nom « Chrome » au lieu de « ShopSaaS ».

1. Dans Android Studio, ouvre l’onglet **Terminal** (en bas).
2. Colle cette commande puis Entrée :

```powershell
& "$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe" -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

3. Copie la ligne **`SHA256:`**. Elle ressemble à `AB:12:CD:...` (32 paires de caractères).

> Autre méthode : panneau **Gradle** (à droite) → `ShopSaaS → app → Tasks → android → signingReport` (double-clic), puis lis `SHA-256` dans la fenêtre Run.

## Étape 5 : mettre l’empreinte sur le site

1. Ouvre `public/.well-known/assetlinks.json` (dans le dossier du site, pas dans `android-app`).
2. Remplace `REPLACE_WITH_SIGNING_CERT_SHA256` par ton empreinte. Résultat :

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.shopsaas.merchant",
      "sha256_cert_fingerprints": [
        "AB:12:CD:...:EF"
      ]
    }
  }
]
```

3. Pousse sur GitHub et attends que Vercel affiche **Ready**.
4. Vérifie en ouvrant dans un navigateur : `https://shopsaas-s-one.vercel.app/.well-known/assetlinks.json`. Tu dois voir **ton** empreinte, pas `REPLACE_...`.

> [!NOTE]
> L’empreinte « debug » est **différente sur chaque PC**. Si tu génères l’APK sur un autre ordinateur, ajoute aussi son empreinte dans la liste (séparée par une virgule). Plus tard, pour une version Play Store / « release », ajoute aussi l’empreinte de la clé de release.

## Étape 6 : installer sur le téléphone

1. Envoie `app-debug.apk` sur le téléphone (WhatsApp, câble USB, Google Drive…).
2. Ouvre-le. Android demande d’autoriser l’installation d’applis inconnues : autorise pour cette source.
3. Si une ancienne version de ShopSaaS est installée, **désinstalle-la d’abord**.

## Étape 7 : activer et tester les notifications dans l’app

1. Ouvre l’app ShopSaaS et connecte-toi.
2. **Réglages → Application → Activer les alertes**.
3. Sur Android 13 et plus, une fenêtre **« Autoriser ShopSaaS à vous envoyer des notifications ? »** s’ouvre : **Autoriser**.
4. Appuie sur **« Tester les notifications »** : tout doit être ✅ et la notification test doit apparaître.
5. Ensuite le vrai test : ferme l’app, verrouille l’écran, passe une commande depuis le PC.

Puis fais les réglages batterie (section « Tout est ✅ mais rien n’arrive » du GUIDE-PUSH.md), surtout sur Tecno / Infinix / itel / Xiaomi.

---

## Vérifications rapides

| Ce que tu vois | Ce que ça veut dire | Solution |
|---|---|---|
| Barre d’adresse en haut de l’app | Le site ne reconnaît pas l’app | Étapes 4 et 5. Vérifie l’URL assetlinks, puis désinstalle et réinstalle l’app |
| Aucune fenêtre de permission (Android 13+) | Ancien APK sans le correctif | Regénère l’APK avec ce projet à jour (étape 3) |
| Permission refusée par erreur | Android ne redemande plus | Réglages → Applications → ShopSaaS → Notifications → Autoriser |
| L’app s’ouvre dans Chrome normal | Chrome trop vieux ou absent | Mets Chrome à jour depuis le Play Store |
| Gradle Sync échoue | Téléchargement interrompu ou JDK manquant | **File → Sync Project with Gradle Files**. Vérifie le JDK dans Settings → Build Tools → Gradle → Gradle JDK |

## Ce qui a été corrigé dans le projet Android

- Ajout de `NotificationPermissionRequestActivity` : **sans elle, sur Android 13+, l’app ne pouvait jamais obtenir la permission de notifier**, donc aucun push.
- Ajout d’une **petite icône blanche** pour la barre de notification (`res/drawable/ic_notification.xml`). Avant, Android affichait un carré.
- Ajout de `gradle-wrapper.properties` (Gradle 8.9) pour qu’Android Studio sache quelle version utiliser.
- `strings.xml` nettoyé (accents cassés).

