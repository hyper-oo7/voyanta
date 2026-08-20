"""
Embedding service using Google Generative AI / OpenAI with resilient fallback.
Generates vector embeddings for travel document chunks and RAG search queries.
"""
import os
import logging
from typing import List, Optional
from src.core.config import get_settings

logger = logging.getLogger(__name__)

class Embedder:
    def __init__(self):
        settings = get_settings()
        self.model = settings.GEMINI_EMBEDDING_MODEL
        self.dimension = settings.VECTOR_DIMENSION
    
    def embed_text(self, text: str) -> List[float]:
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                result = genai.embed_content(
                    model=self.model,
                    content=text,
                    task_type="retrieval_document",
                )
                embedding = result.get("embedding", [])
                if embedding and len(embedding) == self.dimension:
                    return embedding
                elif embedding:
                    # Resize or pad if dimension differs
                    logger.warning(f"[Embedder] Dimension mismatch: expected {self.dimension}, got {len(embedding)}")
                    return embedding[:self.dimension] + [0.0] * max(0, self.dimension - len(embedding))
            except Exception as e:
                logger.warning(f"[Embedder] Gemini embedding failed: {e}. Falling back to OpenAI/deterministic.")
        
        # Fallback to OpenAI if configured
        openai_key = os.environ.get("OPENAI_API_KEY")
        if openai_key:
            try:
                import httpx
                resp = httpx.post(
                    "https://api.openai.com/v1/embeddings",
                    headers={"Authorization": f"Bearer {openai_key}"},
                    json={"input": text, "model": "text-embedding-3-small", "dimensions": self.dimension},
                    timeout=15.0
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data["data"][0]["embedding"]
            except Exception as e:
                logger.warning(f"[Embedder] OpenAI embedding failed: {e}")

        # Deterministic fallback embedding for testing / offline execution
        import hashlib
        logger.info("[Embedder] Generating deterministic fallback embedding vector.")
        hash_seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest(), 16)
        import random
        rng = random.Random(hash_seed)
        vec = [rng.uniform(-1.0, 1.0) for _ in range(self.dimension)]
        norm = sum(x*x for x in vec) ** 0.5
        return [x / norm for x in vec] if norm > 0 else vec

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        
        # 1. Batch Gemini embedding
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key and len(texts) > 1:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                result = genai.embed_content(
                    model=self.model,
                    content=texts,
                    task_type="retrieval_document",
                )
                embeddings = result.get("embedding", [])
                if embeddings and len(embeddings) == len(texts):
                    processed = []
                    for emb in embeddings:
                        if len(emb) == self.dimension:
                            processed.append(emb)
                        else:
                            processed.append(emb[:self.dimension] + [0.0] * max(0, self.dimension - len(emb)))
                    logger.info(f"[Embedder] Batch embedded {len(processed)} texts via Gemini.")
                    return processed
            except Exception as e:
                logger.warning(f"[Embedder] Gemini batch embedding failed ({e}); falling back.")

        # 2. Batch OpenAI embedding
        openai_key = os.environ.get("OPENAI_API_KEY")
        if openai_key and len(texts) > 1:
            try:
                import httpx
                resp = httpx.post(
                    "https://api.openai.com/v1/embeddings",
                    headers={"Authorization": f"Bearer {openai_key}"},
                    json={"input": texts, "model": "text-embedding-3-small", "dimensions": self.dimension},
                    timeout=20.0
                )
                if resp.status_code == 200:
                    data = resp.json()
                    embs = [item["embedding"] for item in data.get("data", [])]
                    if len(embs) == len(texts):
                        logger.info(f"[Embedder] Batch embedded {len(embs)} texts via OpenAI.")
                        return embs
            except Exception as e:
                logger.warning(f"[Embedder] OpenAI batch embedding failed ({e}); falling back.")

        # 3. Serial fallback loop
        return [self.embed_text(t) for t in texts]

    def embed_query(self, query: str) -> List[float]:
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                result = genai.embed_content(
                    model=self.model,
                    content=query,
                    task_type="retrieval_query",
                )
                embedding = result.get("embedding", [])
                if embedding:
                    return embedding[:self.dimension] + [0.0] * max(0, self.dimension - len(embedding))
            except Exception as e:
                logger.warning(f"[Embedder] Gemini query embedding failed: {e}")

        return self.embed_text(query)

embedder = Embedder()
