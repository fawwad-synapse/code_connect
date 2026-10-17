from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "RescueRank"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = ""
    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    DEMO_CITY: str = "Karachi, Pakistan"
    ENABLE_SIMULATOR: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://rescuerank@localhost:5433/rescuerank_db"

    # LLM Settings
    LLM_PROVIDER: str = "openrouter"  # openrouter | mistral | groq | openai
    LLM_MODEL: str = "liquid/lfm-2.5-2.6b:free"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "liquid/lfm-2.5-2.6b:free"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    MISTRAL_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Telegram & WhatsApp
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_WEBHOOK_URL: str = ""
    NOTIFY_WHATSAPP_PROVIDER: str = "meta"  # meta | twilio
    WHATSAPP_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    ALERT_WHATSAPP_NUMBERS: str = ""

    # Alerting & Thresholds
    ALERT_RISK_THRESHOLD: float = 0.70
    ALERT_ETA_HOURS: float = 6.0
    ALERT_COOLDOWN_MIN: int = 30
    SCHEDULER_INTERVAL_MIN: int = 15

    # External APIs
    OPEN_METEO_BASE_URL: str = "https://api.open-meteo.com/v1"
    OPEN_METEO_FLOOD_URL: str = "https://flood-api.open-meteo.com/v1"
    USE_FALLBACK_DATA: bool = False
    USE_OSRM: bool = False
    OSRM_ENDPOINT: str = "http://router.project-osrm.org"


settings = Settings()
