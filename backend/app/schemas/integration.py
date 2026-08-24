from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

class APIKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, json_schema_extra={"example": "CI / ATS Integration Key"})
    scopes: List[str] = Field(
        default=["candidates:read", "scores:read"],
        json_schema_extra={"example": ["candidates:read", "candidates:write", "scores:read", "scores:write", "summary:read"]}
    )
    expires_in_days: Optional[int] = Field(None, ge=1, le=365)

class APIKeyRead(BaseModel):
    id: str
    name: str
    prefix: str
    scopes: List[str]
    created_at: datetime
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)

class APIKeyCreatedResponse(APIKeyRead):
    raw_key: str = Field(..., description="Plain-text API key. Displayed ONLY once upon creation.")

class WebhookCreate(BaseModel):
    url: str = Field(..., min_length=5, max_length=500, json_schema_extra={"example": "https://api.mycompany.com/webhooks/tk"})
    secret: Optional[str] = Field(None, min_length=8, max_length=128)
    events: List[str] = Field(
        default=["candidate.created", "candidate.status_changed", "score.submitted", "summary.generated"],
        json_schema_extra={"example": ["candidate.created", "score.submitted"]}
    )
    description: Optional[str] = Field(None, max_length=255)

class WebhookUpdate(BaseModel):
    url: Optional[str] = Field(None, min_length=5, max_length=500)
    secret: Optional[str] = Field(None, min_length=8, max_length=128)
    events: Optional[List[str]] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class WebhookRead(BaseModel):
    id: str
    url: str
    events: List[str]
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    last_triggered_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class WebhookDeliveryRead(BaseModel):
    id: str
    webhook_id: str
    event_name: str
    payload: str
    response_status_code: Optional[int] = None
    response_body: Optional[str] = None
    duration_ms: Optional[int] = None
    success: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class WebhookTestResponse(BaseModel):
    success: bool
    status_code: Optional[int] = None
    response_body: Optional[str] = None
    duration_ms: Optional[int] = None
    delivery_id: Optional[str] = None
