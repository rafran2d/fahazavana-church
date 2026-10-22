"""Passe finale : transcription + traduction de l'enregistrement complet."""

import asyncio
import logging
import math
import os
import tempfile

import boto3
from botocore.config import Config

from .api_client import ApiClient
from .config import get_settings
from .providers import final_stt, translator

log = logging.getLogger(__name__)

TRANSLATION_BATCH = 16


def _download(key: str, dest: str) -> None:
    s = get_settings()
    client = boto3.client(
        "s3",
        endpoint_url=s.s3_endpoint,
        region_name=s.s3_region,
        aws_access_key_id=s.s3_access_key,
        aws_secret_access_key=s.s3_secret_key,
        config=Config(s3={"addressing_style": "path"}),
    )
    client.download_file(s.s3_bucket, key, dest)


async def run_final_pass(job: dict, api: ApiClient) -> None:
    sermon_id = job["sermonId"]
    src = job["sourceLanguage"]
    await api.set_status(sermon_id, "PROCESSING")
    try:
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, os.path.basename(job["audioKey"]))
            await asyncio.to_thread(_download, job["audioKey"], path)
            segments = await asyncio.to_thread(final_stt().transcribe_file, path, src)

        source_rows = [
            {"seq": i, "startMs": s.start_ms, "endMs": s.end_ms, "language": src,
             "text": s.text, "isSource": True}
            for i, s in enumerate(segments)
        ]
        await api.push_segments(sermon_id, "FINAL", source_rows, replace=True)

        for lang in job["targetLanguages"]:
            translated: list[str] = []
            texts = [s.text for s in segments]
            # Traduction par lots : un peu plus de contexte qu'en live, et plus rapide
            for i in range(0, len(texts), TRANSLATION_BATCH):
                translated += await asyncio.to_thread(
                    translator().translate, texts[i : i + TRANSLATION_BATCH], src, lang
                )
            rows = [
                {"seq": i, "startMs": s.start_ms, "endMs": s.end_ms, "language": lang,
                 "text": t, "isSource": False}
                for i, (s, t) in enumerate(zip(segments, translated))
            ]
            await api.push_segments(sermon_id, "FINAL", rows, replace=True)

        audio_minutes = math.ceil((segments[-1].end_ms if segments else 0) / 60_000)
        await api.report_ai_minutes(job["churchId"], audio_minutes, "sermon_final", sermon_id)
        await api.set_status(sermon_id, "DONE")
        log.info("Passe finale terminée pour %s (%d segments)", sermon_id, len(segments))
    except Exception as exc:
        log.exception("Passe finale en échec pour %s", sermon_id)
        await api.set_status(sermon_id, "FAILED", str(exc))
        raise  # BullMQ réessaie (attempts: 3)
