from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://oeeforge:oeeforge_secret@postgres:5432/oeeforge"

    # InfluxDB 3
    INFLUXDB_URL: str = "http://influxdb:8181"
    INFLUXDB_DATABASE: str = "oeeforge"
    INFLUXDB_TOKEN: str = ""

    # Auth / JWT
    SECRET_KEY: str = "changeme_in_production_32chars!!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Seed admin
    FIRST_ADMIN_EMAIL: str = "admin@oeeforge.local"
    FIRST_ADMIN_PASSWORD: str = "admin"

    # OEE service (used when imported from oee-service)
    OEE_CALC_INTERVAL_SECONDS: int = 300


settings = Settings()
