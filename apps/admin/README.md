# Console d'administration Fahazavana

Application web React + Vite + TypeScript pour le **Church Admin** et le **Super Admin**.
Elle implémente les maquettes « Maquettes Fahazavana » (séries 1a, 2a, 3a) et les prototypes
cliquables Church Admin et Super Admin, branchés sur l'API NestJS (`apps/api`).

Les prédicateurs et les membres utilisent l'application mobile Flutter. Un prédicateur qui se connecte
ici voit un message qui le renvoie vers l'app.

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173 ; /api est relayé vers http://localhost:3000
npm test           # tests unitaires (vitest)
npm run build      # vérification TypeScript + build dans dist/
```

Variables (fichier `.env.local`, voir `.env.example`) :

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `VITE_API_URL` | URL de l'API vue par le navigateur | `/api/v1` |
| `VITE_API_PROXY` | Cible du proxy en développement | `http://localhost:3000` |
| `VITE_SUPPORT_EMAIL` | Adresse du bouton « Contacter l'équipe » (page Abonnement) | vide = bouton masqué |

En production, la build statique est servie par Caddy (`infra/caddy/Caddyfile`, bloc `admin.example.mg`).

## Écrans

| Route | Écran | Maquette | API |
| --- | --- | --- | --- |
| `/connexion` | Connexion | — | `POST /auth/login` |
| `/inscription` | Création de l'espace d'une église (compte, église + plan, confirmation) | 01 | `POST /auth/register`, `GET /plans`, `POST /churches` |
| `/eglise` | Tableau de bord : direct en cours, quotas, dernières prédications | 2a-05 | `GET /churches/:id/lives/active`, `/usage`, `/sermons` |
| `/eglise/predications` | Prédications avec l'état de transcription et de chaque traduction, dépublication | 3a-05 | `GET /churches/:id/sermons`, `DELETE …/sermons/:id` |
| `/eglise/directs` | Directs en cours, arrêt | — | `GET …/lives/active`, `POST …/lives/:id/stop` |
| `/eglise/predicateurs` | Prédicateurs : création (mot de passe provisoire), suspension / réactivation | 02 | `GET/POST/PATCH /churches/:id/staff…` |
| `/eglise/membres` | Membres et recherche | 2a-06 | `GET /churches/:id/members` |
| `/eglise/abonnement` | Plan, quotas, alerte à 90 %, plans disponibles | 2a-07 | `GET …/usage`, `GET /plans` |
| `/super/eglises` | Églises, consommation, statut ; panneau : abonnement + paiement, suspension | 11 | `GET /admin/churches`, `GET /churches/:id/usage`, `POST /admin/churches/:id/subscriptions`, `PATCH /admin/churches/:id` |
| `/super/plans` | Plans modifiables en ligne, nouveau plan, totaux | 2a-08 | `GET /plans`, `POST /admin/plans`, `PATCH /admin/plans/:id` |
| `/super/consommation` | Consommation IA / direct par église | — | `GET /churches/:id/usage` |
| `/super/journal` | Journal des actions sensibles, filtre par église | 3a-06 | `GET /admin/audit-logs` |

Unités : l'API compte les quotas en minutes et en octets ; la console affiche des heures et des Go
(`src/lib/format.ts`). Une barre passe au rouge à 90 % du quota.

## Écarts avec les maquettes

L'écran suit les maquettes, mais certaines données n'existent pas encore dans l'API.
Elles sont donc retirées plutôt qu'inventées :

- **Nombre de spectateurs et répartition des langues du direct** : non suivis par l'API.
- **Nombre d'écoutes, langue préférée des membres** : non stockés.
- **Blocage d'un membre** : le modèle `Membership` n'a que `ACTIVE` / `LEFT`. Il faudrait un statut `BLOCKED` et une route.
- **Relancer une traduction échouée** : aucune route ne remet un job en file. L'échec est affiché, sans bouton de relance.
- **Importer une prédication, photo du prédicateur, logo de l'église** : pas de route d'upload côté web.
- **Historique des paiements côté Church Admin** : pas de route. Le Super Admin saisit le paiement en attribuant l'abonnement.
- **Invitation par email** : l'API crée le compte avec un mot de passe provisoire. La console l'affiche pour le transmettre au prédicateur.
- **Journal : colonne « Résultat » (Refusé / Bloqué)** : seules les actions réussies sont journalisées (`AuditInterceptor`).
- **Pages Super Admin « Abonnements » et « Paiements »** : regroupées dans le panneau latéral de chaque église, comme dans le prototype cliquable.

## Organisation

```
src/
  api/          client HTTP (JWT + rotation du refresh token, erreurs RFC 7807), routes typées
  auth/         session, redirection selon le rôle
  components/   mises en page Church Admin / Super Admin, modale, panneau, toast, barres de quota
  lib/          formatage (h, Go, dates FR), chargement asynchrone, vue d'ensemble Super Admin
  pages/        écrans (church/, super/, connexion, inscription)
  styles.css    jetons de la maquette (crème, ocre, Newsreader / Figtree)
```

Les jetons sont gardés dans `localStorage` (MVP). Pour une V2, le refresh token pourrait passer en cookie httpOnly.
