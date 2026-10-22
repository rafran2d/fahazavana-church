# Fahazavana — plateforme de diffusion, transcription et traduction de prédications

Monorepo du MVP : application mobile Flutter, console web d'administration React, API NestJS,
worker IA Python, infrastructure Docker.

```
apps/
  admin/        Console web Church Admin + Super Admin (React + Vite)
  api/          API NestJS + Prisma (PostgreSQL)
  ai-worker/    Worker Python : sous-titres live (LiveKit) + transcription/traduction post-live
  mobile/       Application Flutter (prédicateur, membre)
infra/          docker-compose, LiveKit, Egress, Caddy
docs/adr/       Décisions d'architecture
```

## Prérequis

- Docker + Docker Compose v2
- Node.js 20 LTS (développement API hors conteneur)
- Python 3.11+ (développement worker hors conteneur)
- Flutter 3.22+ (application mobile)

## Démarrage rapide

```bash
cp .env.example .env
# Renseigner LIVEKIT_NODE_IP avec l'IP LAN de la machine (ex. 192.168.1.20)
# pour que les téléphones du réseau local puissent joindre LiveKit.

docker compose -f infra/docker-compose.yml --env-file .env up -d --build

# Première fois uniquement : créer la migration initiale depuis la machine hôte
# (les fichiers de migration doivent être commités dans apps/api/prisma/migrations)
cd apps/api && npm install
DATABASE_URL=postgresql://app:app@localhost:5432/fahazavana npx prisma migrate dev --name init
DATABASE_URL=postgresql://app:app@localhost:5432/fahazavana npm run seed
cd ../..

# L'API applique ensuite les migrations à chaque démarrage (prisma migrate deploy)
docker compose -f infra/docker-compose.yml --env-file .env restart api
```

Tester rapidement l'API :

```bash
curl -s localhost:3000/api/v1/health
curl -s -X POST localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"predicateur@eglise-demo.test","password":"Password123!"}'
```

Services exposés en local :

| Service | URL |
| --- | --- |
| Console d'administration (`npm run dev` dans apps/admin) | http://localhost:5173 |
| API | http://localhost:3000/api/v1 |
| Documentation OpenAPI | http://localhost:3000/docs |
| Console MinIO | http://localhost:9001 (minio / minio-secret) |
| LiveKit | ws://localhost:7880 |

## Comptes de démo (seed)

Mot de passe commun : `Password123!`

| Rôle | Email |
| --- | --- |
| Super Admin | superadmin@fahazavana.test |
| Church Admin | admin@eglise-demo.test |
| Prédicateur | predicateur@eglise-demo.test |
| Membres | membre1@… membre2@… membre3@eglise-demo.test |

## Console d'administration (web)

```bash
cd apps/admin
npm install
npm run dev   # http://localhost:5173 — /api est relayé vers localhost:3000
```

Se connecter avec `admin@eglise-demo.test` (Church Admin) ou `superadmin@fahazavana.test` (Super Admin).
Une nouvelle église peut aussi être créée depuis « Créer l'espace de votre église ». Voir `apps/admin/README.md`.

## Application mobile

Les dossiers natifs (android/, ios/) ne sont pas versionnés dans le socle :

```bash
cd apps/mobile
flutter create . --org mg.fahazavana --platforms=android,ios
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run --dart-define=API_URL=http://<IP_LAN>:3000/api/v1
```

Permissions à ajouter après `flutter create` : micro (et caméra si vidéo), Internet,
notifications. Voir `apps/mobile/README.md`.

## Ce qui est en place / à faire

| Brique | État du socle |
| --- | --- |
| Auth JWT + refresh rotatif, rôles, isolation par église | En place, guard testé |
| Églises, staff, membres, abonnements, quotas | En place (paiement saisi par le Super Admin) |
| Live : room LiveKit, jetons, webhooks, enregistrement Egress | En place, à valider sur téléphone réel |
| Sous-titres live (worker) | En place, VAD par énergie (Silero prévu) |
| Passe finale + export JSON offline | En place |
| Notifications FCM | Côté API en place ; côté mobile à brancher (S7) |
| Console Church Admin (inscription, tableau de bord, prédications, directs, prédicateurs, membres, abonnement) | En place (`apps/admin`) |
| Console Super Admin (églises, abonnements, plans, consommation, journal) | En place (`apps/admin`) |
| Lecture en arrière-plan (audio_service) | À faire |

## Conventions

- Branches : `main` protégée, une branche par fonctionnalité, PR relue par l'autre stagiaire.
- Commits : Conventional Commits (`feat(lives): ...`, `fix(auth): ...`).
- Chaque décision structurante : une ADR courte dans `docs/adr/`.
- Versions d'images Docker et de dépendances figées avant la démo.

## Flux du live (résumé)

1. Le prédicateur appelle `POST /churches/:churchId/lives` → l'API vérifie rôle, église, quota,
   crée la room LiveKit et renvoie un jeton émetteur.
2. Le webhook LiveKit `track_published` passe le live en `LIVE`, lance l'enregistrement (Egress → S3),
   met en file le job `live.attach` (worker IA) et notifie les membres (FCM).
3. Le worker rejoint la room, transcrit/traduit par segments et publie les sous-titres
   sur le canal de données (topic `subtitles`).
4. À la fin (`egress_ended`), l'API crée la prédication et met en file `sermon.transcribe`
   (passe finale), dont les segments remplacent ceux du live.
