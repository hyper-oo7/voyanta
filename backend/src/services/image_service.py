"""
Image fetching service using Unsplash and Pexels with graceful fallback.
"""
import os
import httpx
import logging
from typing import List, Optional
from src.core.config import get_settings

logger = logging.getLogger(__name__)

class ImageService:
    def __init__(self):
        settings = get_settings()
        DEFAULT_UNSPLASH_KEY = "siZY4H_ZJXFAfmG6oUbzazfIkZZ-aV0S6LgkWB3Z9GE"
        self.unsplash_key = getattr(settings, "UNSPLASH_ACCESS_KEY", None) or os.environ.get("UNSPLASH_ACCESS_KEY") or DEFAULT_UNSPLASH_KEY
        self.pexels_key = getattr(settings, "PEXELS_API_KEY", None) or os.environ.get("PEXELS_API_KEY", "")

    async def search_images(
        self,
        query: str,
        per_page: int = 6,
        orientation: str = "landscape",
    ) -> List[str]:
        images = []
        if self.unsplash_key:
            try:
                unsplash = await self._search_unsplash(query, per_page, orientation)
                images.extend(unsplash)
            except Exception as e:
                logger.warning(f"[ImageService] Unsplash search failed: {e}")
        
        if len(images) < per_page and self.pexels_key:
            try:
                pexels = await self._search_pexels(query, per_page - len(images), orientation)
                images.extend(pexels)
            except Exception as e:
                logger.warning(f"[ImageService] Pexels search failed: {e}")

        # Fallback high quality Unsplash travel placeholders if no API keys configured
        if not images:
            destination = query.split()[0].lower() if query else "travel"
            images = [
                f"https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80",
                f"https://images.unsplash.com/photo-1511884642898-4c92249e20b6?w=800&auto=format&fit=crop&q=80",
                f"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80",
                f"https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&auto=format&fit=crop&q=80",
            ]

        return images[:per_page]
    
    async def _search_unsplash(
        self,
        query: str,
        per_page: int,
        orientation: str,
    ) -> List[str]:
        url = "https://api.unsplash.com/search/photos"
        headers = {"Authorization": f"Client-ID {self.unsplash_key}"}
        params = {
            "query": query,
            "per_page": per_page,
            "orientation": orientation,
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()
        return [img["urls"]["regular"] for img in data.get("results", [])]
    
    async def _search_pexels(
        self,
        query: str,
        per_page: int,
        orientation: str,
    ) -> List[str]:
        url = "https://api.pexels.com/v1/search"
        headers = {"Authorization": self.pexels_key}
        params = {
            "query": query,
            "per_page": per_page,
            "orientation": orientation,
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()
        return [photo["src"]["large"] for photo in data.get("photos", [])]
    
    async def get_destination_images(
        self,
        destination: str,
        activities: Optional[List[str]] = None,
    ) -> List[str]:
        queries = [f"{destination} India travel"]
        if activities:
            for activity in activities[:3]:
                queries.append(f"{destination} {activity}")
        all_images = []
        for q in queries:
            imgs = await self.search_images(q, per_page=2)
            all_images.extend(imgs)
        return all_images[:8]

image_service = ImageService()
