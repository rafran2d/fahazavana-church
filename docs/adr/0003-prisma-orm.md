# ADR 0003 — Prisma comme ORM

Statut : accepté

## Décision
Prisma pour le schéma, les migrations et le client typé côté NestJS.

## Raisons
Schéma unique et lisible (`prisma/schema.prisma`), migrations versionnées, types générés,
prise en main rapide pour les stagiaires.

## Conséquences
Requêtes complexes éventuelles via `$queryRaw`. Pas de Row Level Security PostgreSQL au MVP :
l'isolation par église est assurée par `ChurchScopeGuard` + filtrage systématique par `churchId`.
