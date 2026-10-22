"""Fabrique des fournisseurs IA, choisis par configuration (D4 : fournisseurs interchangeables)."""

from functools import lru_cache

from ..config import get_settings
from .base import SttProvider, SttSegment, TranslationProvider

__all__ = ["SttProvider", "SttSegment", "TranslationProvider", "live_stt", "final_stt", "translator"]


def _make_stt(model: str) -> SttProvider:
    s = get_settings()
    if s.stt_provider == "faster_whisper":
        from .faster_whisper_stt import FasterWhisperStt

        return FasterWhisperStt(model, device=s.stt_device, compute_type=s.stt_compute_type)
    raise ValueError(f"STT_PROVIDER inconnu : {s.stt_provider}")


@lru_cache
def live_stt() -> SttProvider:
    return _make_stt(get_settings().stt_live_model)


@lru_cache
def final_stt() -> SttProvider:
    s = get_settings()
    if s.stt_final_model == s.stt_live_model:
        return live_stt()  # évite de charger deux fois le même modèle
    return _make_stt(s.stt_final_model)


@lru_cache
def translator() -> TranslationProvider:
    s = get_settings()
    if s.translation_provider == "dummy":
        from .translation import DummyTranslation

        return DummyTranslation()
    if s.translation_provider == "nllb":
        from .translation import NllbTranslation

        return NllbTranslation(s.nllb_model_dir, device=s.stt_device)
    raise ValueError(f"TRANSLATION_PROVIDER inconnu : {s.translation_provider}")
