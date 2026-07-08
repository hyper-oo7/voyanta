from fastapi import APIRouter, HTTPException
from typing import Any, Dict
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class ProposalActionInput(BaseModel):
    action: str
    signature_data: str = None
    client_notes: str = None

@router.post("/proposals/{token}/action")
async def client_proposal_action(token: str, input: ProposalActionInput):
    """
    Handle client actions (approval, changes) for a public shared proposal token.
    """
    return {"success": True, "message": f"Action {input.action} recorded."}

@router.get("/images/search")
async def search_images(query: str):
    """
    Mocked Unsplash/Pexels endpoint for the ImageSearchPicker.
    """
    import urllib.parse
    q = urllib.parse.quote(query)
    results = [
        {
            "id": f"img_{i}",
            "url": f"https://source.unsplash.com/800x600/?{q}&sig={i}",
            "thumb": f"https://source.unsplash.com/200x200/?{q}&sig={i}",
            "author": "Unsplash Photo"
        }
        for i in range(1, 13)
    ]
    return {"success": True, "results": results}
