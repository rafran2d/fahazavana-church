"""Agent de sous-titres en direct.

Rejoint la room LiveKit comme participant caché, écoute l'audio du prédicateur,
transcrit et traduit chaque segment, puis publie les sous-titres sur le canal de données.
"""

import asyncio
import json
import logging
import math

import numpy as np
from livekit import rtc

from .api_client import ApiClient
from .config import get_settings
from .providers import live_stt, translator
from .segmenter import EnergySegmenter, Segment

log = logging.getLogger(__name__)

SUBTITLES_TOPIC = "subtitles"


class LiveSubtitlesAgent:
    def __init__(self, job: dict, api: ApiClient) -> None:
        self.job = job
        self.api = api
        self.settings = get_settings()
        self.room = rtc.Room()
        self.seq = 0
        self.processed_ms = 0
        self._audio_task: asyncio.Task | None = None
        self._done = asyncio.Event()
        # Les segments sont traités dans l'ordre, un à la fois (le STT est le goulot)
        self._queue: asyncio.Queue[Segment | None] = asyncio.Queue(maxsize=8)

    async def run(self) -> None:
        @self.room.on("track_subscribed")
        def _on_track(track: rtc.Track, _pub: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
            if track.kind == rtc.TrackKind.KIND_AUDIO and self._audio_task is None:
                log.info("Live %s : écoute de %s", self.job["liveId"], participant.identity)
                self._audio_task = asyncio.create_task(self._read_audio(track))

        @self.room.on("disconnected")
        def _on_disconnected(*_args):
            self._done.set()

        await self.room.connect(self.job["wsUrl"], self.job["agentToken"])
        log.info("Agent connecté à %s", self.job["roomName"])
        worker = asyncio.create_task(self._process_segments())
        try:
            await self._done.wait()
        finally:
            await self._queue.put(None)
            await worker
            await self.api.report_ai_minutes(
                self.job["churchId"],
                math.ceil(self.processed_ms / 60_000),
                "live_subtitles",
                self.job["liveId"],
            )
            log.info("Agent du live %s terminé", self.job["liveId"])

    async def _read_audio(self, track: rtc.Track) -> None:
        segmenter = EnergySegmenter(
            sample_rate=self.settings.sample_rate, max_seconds=self.settings.segment_max_seconds
        )
        stream = rtc.AudioStream(track, sample_rate=self.settings.sample_rate, num_channels=1)
        async for event in stream:
            pcm16 = np.frombuffer(event.frame.data, dtype=np.int16)
            for seg in segmenter.push(pcm16.astype(np.float32) / 32768.0):
                await self._enqueue(seg)
        last = segmenter.flush()
        if last:
            await self._enqueue(last)

    async def _enqueue(self, seg: Segment) -> None:
        if self._queue.full():
            # Retard trop important : on sacrifie un segment plutôt que d'accumuler de la latence
            log.warning("File de segments pleine, segment ignoré (%d ms)", seg.start_ms)
            return
        await self._queue.put(seg)

    async def _process_segments(self) -> None:
        src = self.job["sourceLanguage"]
        targets: list[str] = self.job["targetLanguages"]
        while (seg := await self._queue.get()) is not None:
            try:
                # Les modèles sont synchrones : exécution hors de la boucle asyncio
                text = await asyncio.to_thread(live_stt().transcribe_array, seg.audio, src)
                self.processed_ms += seg.end_ms - seg.start_ms
                if not text:
                    continue
                seq = self.seq
                self.seq += 1
                rows = [self._row(seq, seg, src, text, True)]
                await self._publish(rows[0])
                for lang in targets:
                    [translated] = await asyncio.to_thread(translator().translate, [text], src, lang)
                    row = self._row(seq, seg, lang, translated, False)
                    rows.append(row)
                    await self._publish(row)
                await self.api.push_segments(self.job["sermonId"], "LIVE", rows)
            except Exception:  # un segment raté ne doit pas couper les sous-titres
                log.exception("Échec du traitement d'un segment")

    @staticmethod
    def _row(seq: int, seg: Segment, lang: str, text: str, is_source: bool) -> dict:
        return {
            "seq": seq,
            "startMs": seg.start_ms,
            "endMs": seg.end_ms,
            "language": lang,
            "text": text,
            "isSource": is_source,
        }

    async def _publish(self, row: dict) -> None:
        message = {
            "seq": row["seq"],
            "startMs": row["startMs"],
            "endMs": row["endMs"],
            "lang": row["language"],
            "text": row["text"],
            "final": True,
        }
        await self.room.local_participant.publish_data(
            json.dumps(message, ensure_ascii=False).encode("utf-8"),
            reliable=True,
            topic=SUBTITLES_TOPIC,
        )
