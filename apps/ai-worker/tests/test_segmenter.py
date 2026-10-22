import numpy as np

from worker.segmenter import EnergySegmenter

SR = 16_000


def tone(seconds: float, amplitude: float = 0.2) -> np.ndarray:
    t = np.arange(int(SR * seconds)) / SR
    return (amplitude * np.sin(2 * np.pi * 220 * t)).astype(np.float32)


def silence(seconds: float) -> np.ndarray:
    return np.zeros(int(SR * seconds), dtype=np.float32)


def test_coupe_sur_une_pause():
    seg = EnergySegmenter(sample_rate=SR)
    out = seg.push(np.concatenate([tone(2.0), silence(1.0)]))
    assert len(out) == 1
    assert 2000 <= out[0].end_ms - out[0].start_ms <= 3000


def test_ignore_le_silence_pur():
    seg = EnergySegmenter(sample_rate=SR)
    assert seg.push(silence(5.0)) == []
    assert seg.flush() is None


def test_borne_la_duree_maximale():
    seg = EnergySegmenter(sample_rate=SR, max_seconds=5.0)
    out = seg.push(tone(12.0))
    assert len(out) == 2
    # tolérance d'une trame (30 ms) : la coupe se fait en fin de trame
    assert all(o.end_ms - o.start_ms <= 5030 for o in out)


def test_horodatage_continu():
    seg = EnergySegmenter(sample_rate=SR)
    out = seg.push(np.concatenate([tone(2.0), silence(1.0), tone(2.0), silence(1.0)]))
    assert len(out) == 2
    assert out[1].start_ms >= out[0].end_ms


def test_flush_renvoie_le_dernier_segment():
    seg = EnergySegmenter(sample_rate=SR)
    seg.push(tone(1.5))
    last = seg.flush()
    assert last is not None and last.end_ms > last.start_ms


def test_audio_par_petits_morceaux():
    seg = EnergySegmenter(sample_rate=SR)
    audio = np.concatenate([tone(2.0), silence(1.0)])
    out = []
    for i in range(0, len(audio), 480):  # trames de 30 ms, comme LiveKit
        out += seg.push(audio[i : i + 480])
    assert len(out) == 1
