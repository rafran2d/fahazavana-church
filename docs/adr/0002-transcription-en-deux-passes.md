# ADR 0002 — Transcription en deux passes

Statut : accepté

## Contexte
Les sous-titres traduits doivent apparaître pendant le live, mais une transcription segment par
segment avec un petit modèle est moins précise.

## Décision
- Passe live : VAD + petit modèle Whisper, segments de 15 s max, publiés sur le canal de données.
- Passe finale : transcription complète de l'enregistrement avec un modèle plus lourd ; ses segments
  remplacent ceux du live dans la bibliothèque.

## Conséquences
- Démo fiable même si la passe live est imparfaite.
- Deux consommations du quota IA par prédication (minutes live + minutes finales).
