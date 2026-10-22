"""Point d'entrée : consomme la file BullMQ `ai` (voir apps/api/src/modules/queue/ai-jobs.ts)."""

import asyncio
import logging
import signal

from bullmq import Job, Worker

from .api_client import ApiClient
from .config import get_settings
from .final_pass import run_final_pass
from .live_agent import LiveSubtitlesAgent

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("worker")

AI_QUEUE = "ai"
api = ApiClient()
live_sessions: dict[str, asyncio.Task] = {}


async def process(job: Job, _token: str):
    if job.name == "live.attach":
        live_id = job.data["liveId"]
        if live_id in live_sessions and not live_sessions[live_id].done():
            return {"status": "already-attached"}
        # Session longue : lancée en tâche de fond pour ne pas bloquer le job (verrou BullMQ)
        task = asyncio.create_task(LiveSubtitlesAgent(job.data, api).run())
        task.add_done_callback(lambda _t: live_sessions.pop(live_id, None))
        live_sessions[live_id] = task
        return {"status": "attached"}

    if job.name == "sermon.transcribe":
        await run_final_pass(job.data, api)
        return {"status": "done"}

    log.warning("Job inconnu : %s", job.name)
    return {"status": "ignored"}


async def main() -> None:
    settings = get_settings()
    # concurrency 2 : une passe finale peut tourner pendant qu'un live s'attache
    worker = Worker(AI_QUEUE, process, {"connection": settings.redis_url, "concurrency": 2})
    log.info("Worker IA prêt (file %s, STT=%s, traduction=%s)",
             AI_QUEUE, settings.stt_provider, settings.translation_provider)

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)
    await stop.wait()

    log.info("Arrêt du worker…")
    await worker.close()
    for task in live_sessions.values():
        task.cancel()
    await api.aclose()


if __name__ == "__main__":
    asyncio.run(main())
