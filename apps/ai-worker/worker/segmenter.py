"""Découpage du flux audio en segments de parole.

Version MVP : détection d'énergie (RMS) sans dépendance lourde, testable unitairement.
Évolution prévue : remplacer `_is_speech` par Silero VAD pour de meilleures coupures.
"""

from dataclasses import dataclass, field

import numpy as np


@dataclass
class Segment:
    audio: np.ndarray  # float32 mono, sample_rate Hz
    start_ms: int
    end_ms: int


@dataclass
class EnergySegmenter:
    sample_rate: int = 16_000
    frame_ms: int = 30
    max_seconds: float = 15.0
    min_seconds: float = 1.0
    silence_ms_to_cut: int = 600
    rms_threshold: float = 0.012

    _buffer: list[np.ndarray] = field(default_factory=list, init=False)
    _buffered_samples: int = field(default=0, init=False)
    _silence_ms: int = field(default=0, init=False)
    _has_speech: bool = field(default=False, init=False)
    _position_samples: int = field(default=0, init=False)
    _segment_start: int = field(default=0, init=False)
    _pending: np.ndarray = field(default_factory=lambda: np.zeros(0, dtype=np.float32), init=False)

    def push(self, pcm: np.ndarray) -> list[Segment]:
        """Ajoute de l'audio float32 et renvoie les segments terminés."""
        frame = int(self.sample_rate * self.frame_ms / 1000)
        data = np.concatenate([self._pending, pcm.astype(np.float32)])
        out: list[Segment] = []
        n_frames = len(data) // frame
        for i in range(n_frames):
            chunk = data[i * frame : (i + 1) * frame]
            seg = self._push_frame(chunk)
            if seg is not None:
                out.append(seg)
        self._pending = data[n_frames * frame :]
        return out

    def flush(self) -> Segment | None:
        """À appeler à la fin du live pour récupérer le dernier segment."""
        return self._cut() if self._has_speech else None

    def _is_speech(self, chunk: np.ndarray) -> bool:
        return float(np.sqrt(np.mean(chunk**2))) >= self.rms_threshold

    def _push_frame(self, chunk: np.ndarray) -> Segment | None:
        if not self._buffer:
            self._segment_start = self._position_samples
        self._buffer.append(chunk)
        self._buffered_samples += len(chunk)
        self._position_samples += len(chunk)

        if self._is_speech(chunk):
            self._has_speech = True
            self._silence_ms = 0
        else:
            self._silence_ms += self.frame_ms

        duration = self._buffered_samples / self.sample_rate
        if not self._has_speech and self._silence_ms >= self.silence_ms_to_cut:
            self._reset()  # que du silence : on jette
            return None
        if duration >= self.max_seconds or (
            self._has_speech
            and duration >= self.min_seconds
            and self._silence_ms >= self.silence_ms_to_cut
        ):
            return self._cut()
        return None

    def _cut(self) -> Segment:
        audio = np.concatenate(self._buffer)
        start_ms = int(self._segment_start * 1000 / self.sample_rate)
        seg = Segment(audio=audio, start_ms=start_ms, end_ms=start_ms + int(len(audio) * 1000 / self.sample_rate))
        self._reset()
        return seg

    def _reset(self) -> None:
        self._buffer = []
        self._buffered_samples = 0
        self._silence_ms = 0
        self._has_speech = False
