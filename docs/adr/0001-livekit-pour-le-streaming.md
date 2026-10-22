# ADR 0001 — LiveKit pour le streaming live

Statut : accepté

## Contexte
Le CDC demande la diffusion audio/vidéo depuis le téléphone du prédicateur vers les membres,
avec enregistrement. Un serveur WebRTC maison est hors de portée d'un stage de 8 semaines.

## Décision
LiveKit Server (SFU WebRTC open source, auto-hébergé) + LiveKit Egress pour l'enregistrement.
SDK Flutter officiel (`livekit_client`). L'API est la seule à émettre des jetons d'accès.

## Conséquences
- Ingestion, diffusion, reconnexion et enregistrement fournis.
- Ports UDP 50000-50100 et TCP 7881 à ouvrir sur le serveur.
- Les webhooks LiveKit font foi pour les statuts de live.
- V2 : sortie HLS ou RTMP (Facebook Live) via Egress.
