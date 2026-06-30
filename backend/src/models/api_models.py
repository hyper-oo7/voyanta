from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
import uuid
from datetime import datetime, timezone

class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class ParseItineraryInput(BaseModel):
    text: str

class PDFGenerateRequest(BaseModel):
    proposal_id: str

class PPTGenerateRequest(BaseModel):
    proposal: dict = Field(default_factory=dict)
    items: list = Field(default_factory=list)
