import logging

import numpy as np
from faster_whisper import WhisperModel

from .base import SttSegment

log = logging.getLogger(__name__)


class FasterWhisperStt:
    """Whisper via CTranslate2. `small` tient sur CPU ; `large-v3` demande un GPU."""

    def __init__(self, model: str, device: str = "cpu", compute_type: str = "int8") -> None:
        log.info("Chargement du modèle Whisper %s (%s, %s)", model, device, compute_type)
        self._model = WhisperModel(model, device=device, compute_type=compute_type)

    def transcribe_array(self, audio: np.ndarray, language: str) -> str:
        segments, _ = self._model.transcribe(
            audio, language=language, beam_size=1, vad_filter=False, condition_on_previous_text=False
        )
        return " ".join(s.text.strip() for s in segments).strip()

    def transcribe_file(self, path: str, language: str) -> list[SttSegment]:
        segments, info = self._model.transcribe(
            path, language=language, beam_size=5, vad_filter=True
        )
        result = [
            SttSegment(start_ms=int(s.start * 1000), end_ms=int(s.end * 1000), text=s.text.strip())
            for s in segments
            if s.text.strip()
        ]
        log.info("Transcription : %d segments, %.0f s d'audio", len(result), info.duration)
        return result
