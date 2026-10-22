# Application mobile Flutter

Une seule application pour les quatre rôles ; l'interface s'adapte au rôle connecté
(`staff.role` renvoyé à la connexion).

## Initialisation

```bash
flutter create . --org mg.fahazavana --platforms=android,ios   # génère android/ et ios/
flutter pub get
dart run build_runner build --delete-conflicting-outputs       # génère app_database.g.dart
flutter run --dart-define=API_URL=http://<IP_LAN>:3000/api/v1
```

## Permissions à ajouter après `flutter create`

Android (`android/app/src/main/AndroidManifest.xml`) :
`INTERNET`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `BLUETOOTH_CONNECT`, `POST_NOTIFICATIONS`,
`FOREGROUND_SERVICE`, `WAKE_LOCK` (+ `CAMERA` si vidéo). En dev HTTP : `android:usesCleartextTraffic="true"`.

iOS (`ios/Runner/Info.plist`) : `NSMicrophoneUsageDescription`, `UIBackgroundModes` → `audio`.

Firebase : ajouter `google-services.json` / `GoogleService-Info.plist` (via `flutterfire configure`).
Sans configuration Firebase, l'application fonctionne sans notifications push.

## Structure

```
lib/
  core/         config, client HTTP + JWT, stockage sécurisé, routeur
  data/local/   base Drift (prédications téléchargées)
  features/
    auth/       connexion, inscription, session
    churches/   recherche, suivre une église
    live/       écran prédicateur (publication) et spectateur (sous-titres)
    library/    bibliothèque d'une église
    downloads/  téléchargement et lecture offline
    home/       accueil selon le rôle
```
