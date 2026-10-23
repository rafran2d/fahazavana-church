import asyncio

import numpy as np
from livekit.rtc.participant import PublishDataError

from worker import live_agent
from worker.live_agent import LiveSubtitlesAgent
from worker.segmenter import Segment


class FakeStt:
    def transcribe_array(self, audio, language):
        return "salama"


class FakeTranslator:
    def translate(self, texts, src, lang):
        return [f"[{lang}] {t}" for t in texts]


class FakeApi:
    def __init__(self):
        self.pushed = []

    async def push_segments(self, sermon_id, pass_, rows, replace=False):
        self.pushed.append(rows)


class FakeParticipant:
    def __init__(self, error: bool):
        self.error = error
        self.published = 0

    async def publish_data(self, payload, reliable, topic):
        if self.error:
            raise PublishDataError("engine: connection error: engine is closed")
        self.published += 1


class FakeRoom:
    def __init__(self, error: bool):
        self.local_participant = FakeParticipant(error)


def make_agent(monkeypatch, *, publish_error=False, room_closed=False):
    monkeypatch.setattr(live_agent, "live_stt", lambda: FakeStt())
    monkeypatch.setattr(live_agent, "translator", lambda: FakeTranslator())
    # Pas de __init__ : il lit la configuration et crée une vraie room LiveKit
    agent = LiveSubtitlesAgent.__new__(LiveSubtitlesAgent)
    agent.job = {"sourceLanguage": "mg", "targetLanguages": ["fr", "en"], "sermonId": "s1"}
    agent.api = FakeApi()
    agent.room = FakeRoom(publish_error)
    agent.seq = 0
    agent.processed_ms = 0
    agent._done = asyncio.Event()
    if room_closed:
        agent._done.set()
    agent._queue = asyncio.Queue()
    return agent


async def process_one(agent):
    await agent._queue.put(Segment(start_ms=0, end_ms=1000, audio=np.zeros(16_000, dtype=np.float32)))
    await agent._queue.put(None)
    await agent._process_segments()


async def test_diffuse_et_enregistre(monkeypatch):
    agent = make_agent(monkeypatch)
    await process_one(agent)
    assert agent.room.local_participant.published == 3
    assert [r["language"] for r in agent.api.pushed[0]] == ["mg", "fr", "en"]


async def test_enregistre_meme_si_la_diffusion_echoue(monkeypatch):
    agent = make_agent(monkeypatch, publish_error=True)
    await process_one(agent)
    assert len(agent.api.pushed) == 1


async def test_ne_diffuse_plus_apres_l_arret_du_live(monkeypatch):
    agent = make_agent(monkeypatch, room_closed=True)
    await process_one(agent)
    assert agent.room.local_participant.published == 0
    assert len(agent.api.pushed) == 1
