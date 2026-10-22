"""Appels du worker vers les routes internes de l'API (en-tête X-Internal-Token)."""

import logging

import httpx

from .config import get_settings

log = logging.getLogger(__name__)


class ApiClient:
    def __init__(self) -> None:
        s = get_settings()
        self._client = httpx.AsyncClient(
            base_url=s.api_internal_url,
            headers={"X-Internal-Token": s.internal_api_token},
            timeout=30.0,
        )

    async def push_segments(
        self, sermon_id: str, pass_: str, segments: list[dict], replace: bool = False
    ) -> None:
        # Envoi par paquets pour rester sous la limite de taille de requête
        for i in range(0, len(segments), 500):
            r = await self._client.post(
                f"/internal/sermons/{sermon_id}/segments",
                json={"pass": pass_, "replace": replace and i == 0, "segments": segments[i : i + 500]},
            )
            r.raise_for_status()

    async def set_status(self, sermon_id: str, status: str, error: str | None = None) -> None:
        body: dict = {"status": status}
        if error:
            body["error"] = error[:500]
        r = await self._client.post(f"/internal/sermons/{sermon_id}/processing", json=body)
        r.raise_for_status()

    async def report_ai_minutes(
        self, church_id: str, minutes: int, source_type: str, source_id: str
    ) -> None:
        if minutes <= 0:
            return
        r = await self._client.post(
            "/internal/usage",
            json={
                "churchId": church_id,
                "metric": "AI_MINUTES",
                "quantity": minutes,
                "sourceType": source_type,
                "sourceId": source_id,
            },
        )
        r.raise_for_status()

    async def aclose(self) -> None:
        await self._client.aclose()
