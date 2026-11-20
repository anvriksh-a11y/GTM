"""
Configuration management for the GTM Lead Discovery Backend.
Loads environment variables and provides typed access to all config values.
"""

import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # API Keys
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    SERPAPI_KEY: str = os.getenv("SERPAPI_KEY", "")
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "")
    APOLLO_API_KEY: str = os.getenv("APOLLO_API_KEY", "")
    MONGODB_URI: str = os.getenv("MONGODB_URI", "")
    LINKEDIN_CLIENT_ID: str = os.getenv("LINKEDIN_CLIENT_ID", "YOUR_CLIENT_ID")
    LINKEDIN_CLIENT_SECRET: str = os.getenv("LINKEDIN_CLIENT_SECRET", "YOUR_CLIENT_SECRET")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    BACKEND_URL: str = os.getenv("BACKEND_URL", "")
    HF_TOKEN: str = os.getenv("HF_TOKEN", "")

    # VAPI Voice AI Config (Legacy)
    VAPI_API_KEY: str = os.getenv("VAPI_API_KEY", "")
    VAPI_ASSISTANT_ID: str = os.getenv("VAPI_ASSISTANT_ID", "")
    VAPI_WEBHOOK_URL: str = os.getenv("VAPI_WEBHOOK_URL", "")

    # LiveKit & Outbound AI Voice Agent Config
    LIVEKIT_URL: str = os.getenv("LIVEKIT_URL", "wss://anvriksh-oikutvux.livekit.cloud")
    LIVEKIT_API_KEY: str = os.getenv("LIVEKIT_API_KEY", "")
    LIVEKIT_API_SECRET: str = os.getenv("LIVEKIT_API_SECRET", "")

    # Deepgram (STT & TTS)
    DEEPGRAM_API_KEY: str = os.getenv("DEEPGRAM_API_KEY", "")

    # Groq (LLM)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "groq")

    # Sarvam AI (Indian TTS & STT)
    SARVAM_API_KEY: str = os.getenv("SARVAM_API_KEY", "")

    # Vobiz / SIP Trunking Configuration
    VOBIZ_SIP_TRUNK_ID: str = os.getenv("VOBIZ_SIP_TRUNK_ID", "ST_z4V2wYPm5ar3")
    OUTBOUND_TRUNK_ID: str = os.getenv("OUTBOUND_TRUNK_ID", "ST_z4V2wYPm5ar3")
    VOBIZ_SIP_DOMAIN: str = os.getenv("VOBIZ_SIP_DOMAIN", "d54a0be6.sip.vobiz.ai")
    VOBIZ_USERNAME: str = os.getenv("VOBIZ_USERNAME", "ammar")
    VOBIZ_PASSWORD: str = os.getenv("VOBIZ_PASSWORD", "Ammar@324765")
    VOBIZ_OUTBOUND_NUMBER: str = os.getenv("VOBIZ_OUTBOUND_NUMBER", "+917965853227")
    DEFAULT_TRANSFER_NUMBER: str = os.getenv("DEFAULT_TRANSFER_NUMBER", "+917965853227")

    # TTS Config (Cartesia / Deepgram / Sarvam)
    TTS_PROVIDER: str = os.getenv("TTS_PROVIDER", "cartesia")
    CARTESIA_API_KEY: str = os.getenv("CARTESIA_API_KEY", "")


    # Email Verification (Reacher - self-hosted via Docker)
    REACHER_API_URL: str = os.getenv("REACHER_API_URL", "https://reacher.livelysmoke-eb748d53.centralindia.azurecontainerapps.io")
    
    # WhatsApp (Evolution API) Config
    EVOLUTION_API_URL: str = os.getenv("EVOLUTION_API_URL", "https://evolution-api.livelysmoke-eb748d53.centralindia.azurecontainerapps.io")
    EVOLUTION_API_KEY: str = os.getenv("EVOLUTION_API_KEY", "gtm_super_secret_global_key")
    
    # Server Config
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"

    # Auth Config
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "gtm_super_secret_key_for_local_dev_12345")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    RESET_TOKEN_EXPIRE_HOURS: int = int(os.getenv("RESET_TOKEN_EXPIRE_HOURS", "1"))
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")

    # Payment Gateway Config
    CASHFREE_APP_ID: str = os.getenv("CASHFREE_APP_ID", "")
    CASHFREE_SECRET_KEY: str = os.getenv("CASHFREE_SECRET_KEY", "")
    CASHFREE_ENVIRONMENT: str = os.getenv("CASHFREE_ENVIRONMENT", "SANDBOX")

    # Scraping Config
    MAX_CONCURRENT_REQUESTS: int = 10
    REQUEST_TIMEOUT: int = 15
    MAX_RETRIES: int = 3
    SCRAPE_DELAY_MIN: float = 0.5
    SCRAPE_DELAY_MAX: float = 2.0

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
