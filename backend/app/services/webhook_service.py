import time
import json
import hmac
import hashlib
import logging
import httpx
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.webhook import Webhook, WebhookDelivery

logger = logging.getLogger(__name__)

def compute_hmac_signature(secret: str, payload_bytes: bytes) -> str:
    """Computes HMAC-SHA256 signature for webhook payload validation."""
    signature = hmac.new(
        key=secret.encode("utf-8"),
        msg=payload_bytes,
        digestmod=hashlib.sha256
    ).hexdigest()
    return f"sha256={signature}"

async def _deliver_to_webhook(
    webhook_id: str,
    url: str,
    secret: str,
    event_name: str,
    payload_str: str
):
    """Asynchronously dispatches a webhook HTTP POST and records delivery."""
    payload_bytes = payload_str.encode("utf-8")
    signature = compute_hmac_signature(secret, payload_bytes)
    
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "TechKraft-Webhooks/1.0",
        "X-Webhook-Event": event_name,
        "X-Hub-Signature-256": signature,
    }

    start_time = time.time()
    status_code: Optional[int] = None
    response_text: Optional[str] = None
    success = False

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(url, content=payload_bytes, headers=headers)
            status_code = response.status_code
            response_text = response.text[:1000] if response.text else None
            success = 200 <= status_code < 300
    except Exception as exc:
        response_text = f"Connection error: {str(exc)}"[:1000]
        success = False

    duration_ms = int((time.time() - start_time) * 1000)

    # Record delivery log in a separate DB session
    db = SessionLocal()
    try:
        delivery = WebhookDelivery(
            webhook_id=webhook_id,
            event_name=event_name,
            payload=payload_str,
            response_status_code=status_code,
            response_body=response_text,
            duration_ms=duration_ms,
            success=success
        )
        db.add(delivery)

        webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
        if webhook:
            webhook.last_triggered_at = datetime.now(timezone.utc)

        db.commit()
    except Exception as db_err:
        logger.error(f"Failed to record webhook delivery log: {db_err}")
        db.rollback()
    finally:
        db.close()

async def dispatch_webhook_event(db: Session, event_name: str, payload: Dict[str, Any]):
    """Finds all active webhooks subscribed to event_name and delivers payloads asynchronously."""
    webhooks = db.query(Webhook).filter(Webhook.is_active.is_(True)).all()
    if not webhooks:
        return

    payload_with_meta = {
        "event": event_name,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": payload
    }
    payload_str = json.dumps(payload_with_meta)

    for wh in webhooks:
        subscribed = [e.strip() for e in wh.events.split(",") if e.strip()]
        if "*" in subscribed or event_name in subscribed:
            await _deliver_to_webhook(
                webhook_id=wh.id,
                url=wh.url,
                secret=wh.secret,
                event_name=event_name,
                payload_str=payload_str
            )

async def send_test_webhook_ping(db: Session, webhook_id: str) -> dict:
    """Sends a sample test ping to verify a webhook URL and records the result."""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise ValueError("Webhook not found")

    test_payload = {
        "event": "test.ping",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": {
            "message": "TechKraft Webhook Test Ping",
            "webhook_id": webhook.id,
            "url": webhook.url,
            "status": "active" if webhook.is_active else "inactive"
        }
    }
    payload_str = json.dumps(test_payload)
    payload_bytes = payload_str.encode("utf-8")
    signature = compute_hmac_signature(webhook.secret, payload_bytes)

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "TechKraft-Webhooks/1.0",
        "X-Webhook-Event": "test.ping",
        "X-Hub-Signature-256": signature,
    }

    start_time = time.time()
    status_code: Optional[int] = None
    response_text: Optional[str] = None
    success = False

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(webhook.url, content=payload_bytes, headers=headers)
            status_code = response.status_code
            response_text = response.text[:1000] if response.text else None
            success = 200 <= status_code < 300
    except Exception as exc:
        response_text = f"Connection error: {str(exc)}"[:1000]
        success = False

    duration_ms = int((time.time() - start_time) * 1000)

    delivery = WebhookDelivery(
        webhook_id=webhook.id,
        event_name="test.ping",
        payload=payload_str,
        response_status_code=status_code,
        response_body=response_text,
        duration_ms=duration_ms,
        success=success
    )
    db.add(delivery)
    webhook.last_triggered_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(delivery)

    return {
        "success": success,
        "status_code": status_code,
        "response_body": response_text,
        "duration_ms": duration_ms,
        "delivery_id": delivery.id
    }
