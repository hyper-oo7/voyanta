"""
Configuration settings for Voyanta backend services and RAG engine.
Resilient settings loader supporting dataclasses and os.environ.
"""
import os
from dataclasses import dataclass

@dataclass
class Settings:
    GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "")
    GEMINI_EMBEDDING_MODEL: str = os.environ.get("GEMINI_EMBEDDING_MODEL", "models/text-embedding-004")
    VECTOR_DIMENSION: int = int(os.environ.get("VECTOR_DIMENSION", "768"))
    CHUNK_SIZE: int = int(os.environ.get("CHUNK_SIZE", "2000"))
    CHUNK_OVERLAP: int = int(os.environ.get("CHUNK_OVERLAP", "200"))
    TOP_K_RETRIEVAL: int = int(os.environ.get("TOP_K_RETRIEVAL", "12"))
    SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

_settings = None

def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
