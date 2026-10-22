# Worker IA

Consomme la file BullMQ `ai` alimentée par l'API :

| Job | Rôle |
| --- | --- |
| `live.attach` | Rejoint la room LiveKit, segmente l'audio (VAD), transcrit, traduit et publie les sous-titres sur le topic `subtitles`. Les segments sont aussi envoyés à l'API. |
| `sermon.transcribe` | Passe finale sur l'enregistrement complet : transcription + traduction horodatées, envoyées à l'API qui exporte le JSON pour l'offline. |

Fournisseurs interchangeables (`STT_PROVIDER`, `TRANSLATION_PROVIDER`) :

- STT : `faster_whisper` (local, CPU ou GPU).
- Traduction : `dummy` (dev, préfixe la langue), `nllb` (NLLB-200 via CTranslate2, extra `[nllb]`).

Pour ajouter une API hébergée, créer une classe qui respecte `SttProvider` ou
`TranslationProvider` (voir `worker/providers/base.py`) et l'enregistrer dans `worker/providers/__init__.py`.

## Développement local

```bash
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
pytest
python -m worker.main
```

## Message de sous-titre (canal de données LiveKit, topic `subtitles`)

```json
{ "seq": 12, "startMs": 81200, "endMs": 86900, "lang": "en", "text": "...", "final": true }
```
Un message par segment et par langue (source + cibles). L'application filtre sur `lang`.
