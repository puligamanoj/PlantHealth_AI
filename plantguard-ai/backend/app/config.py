import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "sqlite:///./plantguard.db"
    model_path: str = "models/plantguard_mobilenetv2.pt"
    cors_origins: str = "http://localhost:5173"
    max_upload_mb: int = 5
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
