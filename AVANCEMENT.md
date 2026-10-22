# Avancement — lancement local du projet

_Dernière mise à jour : 12/10/2026_

## État actuel

| Brique | État |
| --- | --- |
| Stack Docker (`postgres`, `redis`, `minio`, `livekit`, `egress`, `api`, `ai-worker`) | Lancée, API OK (`/api/v1/health`) |
| Base de données | Migration `init` créée et appliquée, seed fait |
| Console d'administration (`apps/admin`) | Lancée hors Docker (`npm run dev`) sur http://localhost:5173 |
| Connexion des comptes de démo | Testée OK (prédicateur, Church Admin, Super Admin) |
| SDK Android | Installé dans `~/Android/Sdk` (platform-tools, plateforme 36, build-tools 36, NDK 26.3) |
| Projet Flutter (`apps/mobile`) | `android/` et `ios/` générés, `pub get` et `build_runner` faits, permissions ajoutées |
| Téléphone de test | Galaxy S21+ (SM-G996U1) reconnu en débogage USB |
| Premier build APK debug | **Arrêté volontairement le 12/10 au soir avant la fin** (dépendances et NDK déjà téléchargés) |
| App mobile sur le téléphone | **Pas encore lancée** |

## Modifications faites

- `.env` : `LIVEKIT_NODE_IP=192.168.1.27` (IP LAN du PC, à mettre à jour si elle change, puis redémarrer `livekit`).
- `apps/api/prisma/migrations/20261012135551_init/` : migration initiale créée — **à commiter**.
- `apps/mobile/android/`, `apps/mobile/ios/` : générés par `flutter create`.
- `apps/mobile/android/app/src/main/AndroidManifest.xml` : permissions `INTERNET`, `RECORD_AUDIO`,
  `MODIFY_AUDIO_SETTINGS`, `BLUETOOTH_CONNECT`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`, `WAKE_LOCK`
  et `android:usesCleartextTraffic="true"` (dev HTTP).
- Flutter configuré avec `flutter config --android-sdk ~/Android/Sdk`.

## Reprendre demain

```bash
cd /var/www/html/fahazavana

# 1. Backend (si la machine a redémarré)
docker compose -f infra/docker-compose.yml --env-file .env up -d
curl -s localhost:3000/api/v1/health

# 2. Console d'administration
cd apps/admin && npm run dev   # http://localhost:5173

# 3. App mobile : brancher le Galaxy S21+, déverrouillé, même Wi-Fi que le PC
~/Android/Sdk/platform-tools/adb devices        # doit lister RFCR1199ZMH  device
cd apps/mobile
flutter run --dart-define=API_URL=http://192.168.1.27:3000/api/v1
```

Le premier `flutter run` relancera la compilation Gradle (le cache de dépendances est déjà
téléchargé, ce sera plus court). Vérifier l'IP LAN avant (`ip -4 route get 1.1.1.1`) ;
si elle a changé, l'adapter dans la commande et dans `.env`.

## Comptes de démo

Mot de passe commun : `Password123!`

| Rôle | Email |
| --- | --- |
| Super Admin | superadmin@fahazavana.test |
| Church Admin | admin@eglise-demo.test |
| Prédicateur | predicateur@eglise-demo.test |

## Points d'attention

- **Image API sans migration** : construite avant la création de la migration `init`. Sans effet tant
  que la base existe, mais reconstruire avant une base vide :
  `docker compose -f infra/docker-compose.yml --env-file .env up -d --build api`.
- **Téléphone Samsung** : Blocage automatique désactivé pour autoriser le débogage USB
  (à réactiver après les tests). Si `adb devices` est vide : désactiver/réactiver *Débogage USB*,
  rebrancher et accepter la fenêtre « empreinte de clé RSA ».
- **Notifications push** : inactives (`FIREBASE_SERVICE_ACCOUNT_JSON` vide côté API, pas de
  `google-services.json` côté mobile).
- **Traduction** : fournisseur `dummy` dans le worker IA (NLLB à configurer pour le malgache).
- **Console admin** : `npm run dev` lancé en arrière-plan, s'arrête au redémarrage de la machine.

## Prochaines étapes

1. Lancer l'app mobile sur le Galaxy S21+ et tester la connexion (prédicateur, membre).
2. Tester un direct de bout en bout : publication du prédicateur, sous-titres, enregistrement Egress,
   passe finale.
3. Commiter la migration Prisma.
4. Reconstruire l'image `api` pour y inclure la migration.
