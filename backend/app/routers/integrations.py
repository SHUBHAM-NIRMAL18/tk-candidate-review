import secrets
from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.api_key import APIKey
from app.models.webhook import Webhook, WebhookDelivery
from app.auth import require_role, generate_api_key_pair
from app.schemas.integration import (
    APIKeyCreate,
    APIKeyRead,
    APIKeyCreatedResponse,
    WebhookCreate,
    WebhookUpdate,
    WebhookRead,
    WebhookDeliveryRead,
    WebhookTestResponse
)
from app.services.webhook_service import send_test_webhook_ping

router = APIRouter(prefix="/api/v1/integrations", tags=["Integrations"])

# ----------------- API Key Endpoints -----------------

@router.get("/api-keys", response_model=List[APIKeyRead])
def list_api_keys(
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    keys = db.query(APIKey).order_by(APIKey.created_at.desc()).all()
    results = []
    for k in keys:
        scopes_list = [s.strip() for s in k.scopes.split(",") if s.strip()]
        results.append(APIKeyRead(
            id=k.id,
            name=k.name,
            prefix=k.prefix,
            scopes=scopes_list,
            created_at=k.created_at,
            expires_at=k.expires_at,
            last_used_at=k.last_used_at,
            is_active=k.is_active
        ))
    return results

@router.post("/api-keys", response_model=APIKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
def create_api_key(
    key_in: APIKeyCreate,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    raw_key, prefix, key_hash = generate_api_key_pair()
    
    expires_at = None
    if key_in.expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=key_in.expires_in_days)

    scopes_str = ",".join(key_in.scopes)

    api_key_record = APIKey(
        name=key_in.name,
        key_hash=key_hash,
        prefix=prefix,
        scopes=scopes_str,
        created_by_id=current_user.id,
        expires_at=expires_at,
        is_active=True
    )
    db.add(api_key_record)
    db.commit()
    db.refresh(api_key_record)

    return APIKeyCreatedResponse(
        id=api_key_record.id,
        name=api_key_record.name,
        prefix=api_key_record.prefix,
        scopes=key_in.scopes,
        created_at=api_key_record.created_at,
        expires_at=api_key_record.expires_at,
        last_used_at=api_key_record.last_used_at,
        is_active=api_key_record.is_active,
        raw_key=raw_key
    )

@router.delete("/api-keys/{key_id}", status_code=status.HTTP_200_OK)
def revoke_api_key(
    key_id: str,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    api_key_record = db.query(APIKey).filter(APIKey.id == key_id).first()
    if not api_key_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API Key not found")
    
    db.delete(api_key_record)
    db.commit()
    return {"message": "API key revoked successfully"}

# ----------------- Webhook Endpoints -----------------

@router.get("/webhooks", response_model=List[WebhookRead])
def list_webhooks(
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    webhooks = db.query(Webhook).order_by(Webhook.created_at.desc()).all()
    results = []
    for wh in webhooks:
        events_list = [e.strip() for e in wh.events.split(",") if e.strip()]
        results.append(WebhookRead(
            id=wh.id,
            url=wh.url,
            events=events_list,
            description=wh.description,
            is_active=wh.is_active,
            created_at=wh.created_at,
            last_triggered_at=wh.last_triggered_at
        ))
    return results

@router.post("/webhooks", response_model=WebhookRead, status_code=status.HTTP_201_CREATED)
def create_webhook(
    webhook_in: WebhookCreate,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    secret = webhook_in.secret if webhook_in.secret else secrets.token_hex(24)
    events_str = ",".join(webhook_in.events)

    webhook = Webhook(
        url=webhook_in.url,
        secret=secret,
        events=events_str,
        description=webhook_in.description,
        is_active=True
    )
    db.add(webhook)
    db.commit()
    db.refresh(webhook)

    return WebhookRead(
        id=webhook.id,
        url=webhook.url,
        events=webhook_in.events,
        description=webhook.description,
        is_active=webhook.is_active,
        created_at=webhook.created_at,
        last_triggered_at=webhook.last_triggered_at
    )

@router.patch("/webhooks/{webhook_id}", response_model=WebhookRead)
def update_webhook(
    webhook_id: str,
    webhook_in: WebhookUpdate,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")

    if webhook_in.url is not None:
        webhook.url = webhook_in.url
    if webhook_in.secret is not None:
        webhook.secret = webhook_in.secret
    if webhook_in.events is not None:
        webhook.events = ",".join(webhook_in.events)
    if webhook_in.description is not None:
        webhook.description = webhook_in.description
    if webhook_in.is_active is not None:
        webhook.is_active = webhook_in.is_active

    db.commit()
    db.refresh(webhook)

    events_list = [e.strip() for e in webhook.events.split(",") if e.strip()]
    return WebhookRead(
        id=webhook.id,
        url=webhook.url,
        events=events_list,
        description=webhook.description,
        is_active=webhook.is_active,
        created_at=webhook.created_at,
        last_triggered_at=webhook.last_triggered_at
    )

@router.delete("/webhooks/{webhook_id}", status_code=status.HTTP_200_OK)
def delete_webhook(
    webhook_id: str,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    
    db.delete(webhook)
    db.commit()
    return {"message": "Webhook deleted successfully"}

@router.post("/webhooks/{webhook_id}/test", response_model=WebhookTestResponse)
async def test_webhook(
    webhook_id: str,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    try:
        result = await send_test_webhook_ping(db, webhook_id)
        return WebhookTestResponse(**result)
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(val_err))

@router.get("/webhooks/{webhook_id}/deliveries", response_model=List[WebhookDeliveryRead])
def get_webhook_deliveries(
    webhook_id: str,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    deliveries = db.query(WebhookDelivery).filter(
        WebhookDelivery.webhook_id == webhook_id
    ).order_by(WebhookDelivery.created_at.desc()).limit(20).all()

    return deliveries
