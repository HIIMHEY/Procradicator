from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# read env vars here
class Settings(BaseSettings):
    db_url: str = Field(default=...)
    secret_key: str = Field(default=...)
    model_name: str = Field(default="llama3.1:8b")
    debug: bool = False
    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
