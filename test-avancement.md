# Avancement — Restauration du projet au 12/10

## Contexte
- Objectif : remettre le projet `fahazavana` dans son état du **12/10/2026**.
- Le projet n'est pas sous git : la seule source d'historique est le **Local History de PhpStorm**
  (`~/.cache/JetBrains/PhpStorm2026.2/LocalHistory/`, ~167 Mo).
- Problème : PhpStorm se bloque à l'ouverture de l'historique du projet entier (mémoire limitée à 2 Go).
- Le log PhpStorm montre une tentative de restauration le 22/10 à 13:45, peut-être appliquée en partie.

## Déjà fait
- [x] Sauvegarde complète de l'état actuel : `/var/www/html/fahazavana.bak-2210` (copie vérifiée identique)
- [x] Mémoire PhpStorm passée à 4 Go (`-Xmx4096m` dans
      `~/.config/JetBrains/PhpStorm2026.2/phpstorm64.vmoptions`, ancien fichier gardé en `.bak`)
- [x] Sauvegarde du Local History (PhpStorm fermé) :
      `~/.cache/JetBrains/PhpStorm2026.2/LocalHistory.bak-2210` (copie vérifiée identique)

## Reste à faire
- [ ] Redémarrer PhpStorm (*File → Exit* puis rouvrir) pour activer les 4 Go
- [ ] Vérifier dans *Help → Change Memory Settings* que la valeur est bien 4096 Mo
- [ ] Vérifier l'état actuel des fichiers (tentative partielle de 13:45)
- [ ] Restaurer **dossier par dossier** (clic droit → *Local History → Show History* → révision du 12/10 → *Revert*) :
  - [ ] `apps/api`
  - [ ] `apps/admin`
  - [ ] `apps/mobile`
  - [ ] `apps/ai-worker`
  - [ ] `models/`, `docs/`, `infra/`
  - [ ] Fichiers racine (`.env`, `AVANCEMENT.md`, `README.md`…)
  - Plus léger, si besoin : *Local History → Recent Changes* (Alt+Shift+C)
- [ ] Contrôler que le projet fonctionne après restauration
- [ ] `git init` + premier commit pour ne plus dépendre du Local History

## En cas de problème
- Revenir à l'état d'avant : recopier `/var/www/html/fahazavana.bak-2210`.
- Si le 12/10 n'apparaît pas dans l'historique : il a été purgé (réglage `localHistory.daysToKeep`)
  et ne pourra pas être récupéré par PhpStorm.
