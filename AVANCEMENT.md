# Avancement — lancement local du projet

_Dernière mise à jour : 23/10/2026_

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
| Premier build APK debug | OK le 23/10 (`flutter build apk --debug`, ~75 s de Gradle) |
| App mobile sur le téléphone | Installée et lancée le 23/10, connexion prédicateur OK |
| Live de bout en bout | OK le 23/10 (12 s) : publication, enregistrement Egress, passe finale Whisper `small` → `DONE` ; sous-titres live OK le 23/10 (live « live apres », 1 min, en malgache) |

## Suivi

- Tableau Trello **Fahazavana** : https://trello.com/b/XzW3w7CU/fahazavana (colonnes Fait / En cours /
  Review / À faire / Points d'attention).

## Commits (branche `Rafran-dev`, non poussés)

- `eb7d8cc` : migration Prisma `init`.
- `1fea70f` : Android `compileSdk 36`, `minSdk 23`, AGP 8.9.1.
- `9765748` : seed de l'Église Démo en malgache (`mg` → `{fr,en}`).
- `a8c4ae6` : correctif sous-titres live + tests (`live_agent.py`, `tests/test_live_agent.py`).

## Modifications faites

- `.env` : `LIVEKIT_NODE_IP=192.168.1.27` et `LIVEKIT_PUBLIC_WS_URL=ws://192.168.1.27:7880` (IP LAN du PC ;
  si elle change, mettre à jour les deux puis `up -d livekit api`). `localhost` ne marche pas : c'est
  l'URL que reçoit le téléphone.
- `apps/api/prisma/migrations/20261012135551_init/` : migration initiale créée (commitée dans `eb7d8cc`).
- `apps/mobile/android/`, `apps/mobile/ios/` : générés par `flutter create`.
- `apps/mobile/android/app/src/main/AndroidManifest.xml` : permissions `INTERNET`, `RECORD_AUDIO`,
  `MODIFY_AUDIO_SETTINGS`, `BLUETOOTH_CONNECT`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`, `WAKE_LOCK`
  et `android:usesCleartextTraffic="true"` (dev HTTP).
- Flutter configuré avec `flutter config --android-sdk ~/Android/Sdk`.
- `apps/mobile/android/app/build.gradle.kts` : `compileSdk = 36`, `minSdk = 23` ;
  `apps/mobile/android/settings.gradle.kts` : AGP 8.7.3 → 8.9.1 (commit `1fea70f`).

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
- **Réseau du téléphone** : il doit être sur le même Wi-Fi que le PC (`192.168.1.x`). Le 23/10 il
  était sur un autre réseau (`192.168.2.x`), d'où « Une erreur est survenue » à la connexion.
- **Live bloqué « déjà en cours »** : si le prédicateur ne se connecte jamais à LiveKit, le live reste
  `STARTING` jusqu'à la fermeture du salon vide par LiveKit (~2 min, puis `FAILED`). Attendre 2 min.
- **Téléphone Samsung** : Blocage automatique désactivé pour autoriser le débogage USB
  (à réactiver après les tests). Si `adb devices` est vide : désactiver/réactiver *Débogage USB*,
  rebrancher et accepter la fenêtre « empreinte de clé RSA ».
- **Notifications push** : inactives (`FIREBASE_SERVICE_ACCOUNT_JSON` vide côté API, pas de
  `google-services.json` côté mobile).
- **Traduction** : fournisseur `dummy` dans le worker IA (NLLB à configurer pour le malgache).
- **NDK** : les plugins (flutter_webrtc, firebase, audio_service…) demandent le NDK 27.0.12077973,
  le projet utilise le 26.3. Le build passe malgré l'avertissement ; si besoin, installer le NDK 27
  et mettre `ndkVersion = "27.0.12077973"` dans `app/build.gradle.kts`.
- **Langue source** : Église Démo passée le 23/10 à `mg` → `{fr,en}`, en base et dans le seed (pas d'écran
  ni d'API pour la modifier ; le seed ne modifie pas une église existante).
- **Agent IA en retard** : au 1er live, il a rejoint après l'arrêt (chargement du modèle) et recréé
  un salon vide (fermé au bout de 2 min). Il ne devrait pas rejoindre un live terminé.
- **Sous-titres perdus à l'arrêt** : corrigé le 23/10 dans `live_agent.py` (diffusion au mieux, les segments
  en retard sont enregistrés même après l'arrêt), tests dans `tests/test_live_agent.py`. Le code est
  copié dans l'image : `up -d --build ai-worker` pour l'appliquer.
- **Console admin** : `npm run dev` lancé en arrière-plan, s'arrête au redémarrage de la machine.

## Prochaines étapes

1. Tester la connexion d'un membre dans l'app mobile.
2. Suivre un direct depuis un compte membre (affichage des sous-titres côté app).
3. Améliorer la transcription malgache : Whisper est fondamentalement faible en `mg`. `large-v3`
   testé le 23/10 sur le live « live apres » (57 s) → texte toujours inintelligible et 83 s de calcul
   sur CPU (trop lent). Piste : modèle STT affiné pour le malgache, pas un Whisper plus gros.
4. Reconstruire les images Docker : `api` (pour inclure la migration `init`) et `ai-worker`
   (pour le correctif sous-titres) : `up -d --build api ai-worker`.
