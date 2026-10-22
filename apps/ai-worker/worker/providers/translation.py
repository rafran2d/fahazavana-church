import logging

log = logging.getLogger(__name__)

# Codes NLLB-200 pour les langues usuelles du projet
NLLB_CODES = {
    "fr": "fra_Latn",
    "en": "eng_Latn",
    "mg": "plt_Latn",  # malgache (Plateau Malagasy)
    "de": "deu_Latn",
    "es": "spa_Latn",
    "pt": "por_Latn",
    "sw": "swh_Latn",
}


class DummyTranslation:
    """Développement sans modèle : renvoie le texte préfixé par la langue cible."""

    def translate(self, texts: list[str], source: str, target: str) -> list[str]:
        return [f"[{target}] {t}" for t in texts]


class NllbTranslation:
    """NLLB-200 converti pour CTranslate2 (ct2-transformers-converter). Extra pip : [nllb]."""

    def __init__(self, model_dir: str, device: str = "cpu") -> None:
        import ctranslate2
        import transformers

        log.info("Chargement de NLLB depuis %s", model_dir)
        self._translator = ctranslate2.Translator(model_dir, device=device)
        self._tokenizer = transformers.AutoTokenizer.from_pretrained(model_dir)

    def translate(self, texts: list[str], source: str, target: str) -> list[str]:
        if not texts:
            return []
        src, tgt = NLLB_CODES[source], NLLB_CODES[target]
        self._tokenizer.src_lang = src
        batch = [
            self._tokenizer.convert_ids_to_tokens(self._tokenizer.encode(t)) for t in texts
        ]
        results = self._translator.translate_batch(batch, target_prefix=[[tgt]] * len(batch))
        out = []
        for r in results:
            tokens = r.hypotheses[0][1:]  # retire le jeton de langue cible
            out.append(self._tokenizer.decode(self._tokenizer.convert_tokens_to_ids(tokens)))
        return out
