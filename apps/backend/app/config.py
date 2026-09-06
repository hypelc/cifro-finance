from functools import lru_cache

from pydantic import SecretStr
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: SecretStr
    supabase_url: str
    supabase_anon_key: SecretStr
    cors_origins: str = "http://localhost:3000"
    db_pool_enabled: bool = False
    db_pool_min_size: int = Field(default=0, ge=0, le=20)
    db_pool_max_size: int = Field(default=2, ge=1, le=20)
    db_pool_timeout_seconds: float = Field(default=3.0, gt=0, le=60)
    db_pool_max_waiting: int = Field(default=8, ge=1, le=100)
    db_connect_timeout_seconds: float = Field(default=5.0, gt=0, le=60)
    db_statement_timeout_ms: int = Field(default=5000, gt=0, le=120000)
    db_lock_timeout_ms: int = Field(default=1000, gt=0, le=30000)
    perf_log_enabled: bool = False
    perf_log_sample_rate: float = Field(default=1.0, ge=0, le=1)
    auth_http_timeout_seconds: float = Field(default=5.0, gt=0, le=60)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("db_pool_max_size")
    @classmethod
    def validate_pool_size(cls, value: int, info):
        min_size = info.data.get("db_pool_min_size", 0)
        if value < min_size:
            raise ValueError("DB_POOL_MAX_SIZE must be greater than or equal to DB_POOL_MIN_SIZE")
        return value

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
