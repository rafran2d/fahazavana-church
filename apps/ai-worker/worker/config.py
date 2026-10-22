from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration lue depuis l'environnement (.env à la racine du monorepo)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    redis_url: str = "redis://localhost:6379"
    api_internal_url: str = "http://localhost:3000/api/v1"
    internal_api_token: str

    s3_endpoint: str = "http://localhost:9000"
    s3_region: str = "us-east-1"
    s3_bucket: str = "fahazavana"
    s3_access_key: str = "minio"
    s3_secret_key: str = "minio-secret"

    stt_provider: str = "faster_whisper"
    stt_live_model: str = "small"
    stt_final_model: str = "small"
    stt_device: str = "cpu"
    stt_compute_type: str = "int8"

    translation_provider: str = "dummy"
    nllb_model_dir: str = "/models/nllb-200-distilled-600M-ct2"

    segment_max_seconds: float = 15.0
    sample_rate: int = 16_000


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
