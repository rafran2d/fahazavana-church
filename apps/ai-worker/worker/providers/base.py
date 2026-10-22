from dataclasses import dataclass
from typing import Protocol

import numpy as np


@dataclass(frozen=True)
class SttSegment:
    start_ms: int
    end_ms: int
    text: str


class SttProvider(Protocol):
    """Speech-to-Text. Implémentations : faster-whisper local, API hébergée…"""

    def transcribe_array(self, audio: np.ndarray, language: str) -> str:
        """Audio mono float32 16 kHz (segment court, passe live) → texte."""
        ...

    def transcribe_file(self, path: str, language: str) -> list[SttSegment]:
        """Fichier complet (passe finale) → segments horodatés."""
        ...


class TranslationProvider(Protocol):
    """Traduction texte → texte. Codes de langue ISO 639-1 (fr, en, mg…)."""

    def translate(self, texts: list[str], source: str, target: str) -> list[str]:
        ...
