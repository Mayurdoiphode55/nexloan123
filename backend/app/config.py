"""
NexLoan Configuration — Pydantic Settings
All environment variables are loaded here. Never hardcode secrets.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    APP_NAME: str = "NexLoan"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"

    # Database — PostgreSQL via asyncpg
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/nexloan"

    # Redis — for OTP storage and chat sessions
    REDIS_URL: str = "redis://localhost:6379"

    # Groq AI
    GROQ_API_KEY: str = ""
    GROQ_TEXT_MODEL: str = "llama-3.1-8b-instant"
    GROQ_VISION_MODEL: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    # Hugging Face
    HF_API_KEY: str = ""
    HF_DOCUMENT_QA_MODEL: str = "impira/layoutlm-document-qa"

    # Cloudflare R2 (S3-compatible)
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "nexloan-kyc-docs"
    R2_PUBLIC_URL: str = ""

    # Email — Generic SMTP (Default Gmail)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "mayurdoiphode55@gmail.com"
    
    # Brevo API — For reliable delivery on Render (Port 443)
    # Reuses SMTP_PASSWORD if BREVO_API_KEY is not set
    BREVO_API_KEY: str = ""

    # Twilio (optional — SMS OTP)
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None

    # JWT
    JWT_SECRET: str = "change-me-jwt-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440  # 24 hours

    # OTP
    OTP_EXPIRE_SECONDS: int = 300  # 5 minutes

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


# Singleton settings instance
settings = Settings()
