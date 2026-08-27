from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = 'sqlite:///./test.db'
    secret_key: str = 'supersecret'
    algorithm: str = 'HS256'
    access_token_expire_minutes: int = 30

    model_config = SettingsConfigDict(env_file='.env')

settings = Settings()
