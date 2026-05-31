from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# read env vars here
class Settings(BaseSettings):
    db_url: str = Field(default=...)
    model_name: str = Field(default="openai/gpt-oss-120b")
    base_url: str = Field(default=...)
    debug: bool = False
    groq_api_key: str = Field(default=...)
    cors_origins: str = Field(default=...)
    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
