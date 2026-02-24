from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://oeeforge:oeeforge_secret@postgres:5432/oeeforge"
    INFLUXDB_URL: str = "http://influxdb:8181"
    INFLUXDB_DATABASE: str = "oeeforge"
    INFLUXDB_TOKEN: str = ""
    OEE_CALC_INTERVAL_SECONDS: int = 300


settings = Settings()
