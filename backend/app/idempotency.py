import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import Callable, Optional
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.concurrency import iterate_in_threadpool

from app.database import SessionLocal, get_db
from app.models.idempotency_key import IdempotencyKey
from app.metrics import IDEMPOTENCY_OPERATIONS_TOTAL

def get_db_context(request: Request):
    """Obtains a DB session, honoring test dependency overrides if configured."""
    if hasattr(request, "app") and hasattr(request.app, "dependency_overrides") and get_db in request.app.dependency_overrides:
        override = request.app.dependency_overrides[get_db]
        gen = override()
        try:
            return next(gen)
        except Exception:
            pass
    return SessionLocal()

def get_request_user_identifier(request: Request) -> str:
    """Extracts a stable user/client identifier from cookies, headers, or client IP."""
    # Check for authorization bearer token or cookie
    token = request.cookies.get("access_token")
    if token:
        return f"token:{hashlib.sha256(token.encode()).hexdigest()[:16]}"
    
    auth_header = request.headers.get("authorization")
    if auth_header:
        return f"auth:{hashlib.sha256(auth_header.encode()).hexdigest()[:16]}"
        
    api_key = request.headers.get("x-api-key")
    if api_key:
        return f"apikey:{hashlib.sha256(api_key.encode()).hexdigest()[:16]}"
        
    client_ip = request.client.host if request.client else "anonymous"
    return f"ip:{client_ip}"

class IdempotencyMiddleware(BaseHTTPMiddleware):
    """
    Production-grade Idempotency Middleware for mutating HTTP requests.
    Supports 'Idempotency-Key' and 'X-Idempotency-Key' headers.
    
    Behaviors:
      - MISS: Executes the request, caches the response, returns X-Cache-Lookup: MISS-IDEMPOTENT.
      - HIT: Replays identical cached status & body, returns X-Cache-Lookup: HIT-IDEMPOTENT.
      - MISMATCH: Returns HTTP 422 if key is reused with different request payload/method.
      - CONFLICT: Returns HTTP 409 if a request with the same key is currently PROCESSING.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Only apply idempotency to mutating HTTP methods
        if request.method not in ("POST", "PUT", "PATCH", "DELETE"):
            return await call_next(request)

        # Look for Idempotency-Key or X-Idempotency-Key header
        idempotency_key = (
            request.headers.get("idempotency-key")
            or request.headers.get("x-idempotency-key")
        )

        if not idempotency_key or not idempotency_key.strip():
            IDEMPOTENCY_OPERATIONS_TOTAL.labels(result="bypass").inc()
            return await call_next(request)

        idempotency_key = idempotency_key.strip()

        # Validate key length (between 1 and 256 chars)
        if len(idempotency_key) > 256:
            return JSONResponse(
                status_code=400,
                content={"detail": "Idempotency-Key exceeds maximum length of 256 characters"}
            )

        # Read and cache request body
        body_bytes = await request.body()
        user_id = get_request_user_identifier(request)

        # Compute SHA-256 fingerprint of canonical request (method + path + body)
        raw_fingerprint = request.method.encode("utf-8") + b":" + request.url.path.encode("utf-8") + b":" + body_bytes
        request_hash = hashlib.sha256(raw_fingerprint).hexdigest()

        db = get_db_context(request)
        try:
            # Check for existing idempotency record
            now_utc = datetime.now(timezone.utc)
            existing_record = (
                db.query(IdempotencyKey)
                .filter(IdempotencyKey.key == idempotency_key, IdempotencyKey.user_id == user_id)
                .first()
            )

            # If found and expired, remove it to allow fresh execution
            if existing_record and existing_record.expires_at:
                expires_at = existing_record.expires_at
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at < now_utc:
                    db.delete(existing_record)
                    db.commit()
                    existing_record = None

            # Case 1: Key exists and is COMPLETED
            if existing_record and existing_record.status == "COMPLETED":
                # Check for payload tampering / mismatched request
                if existing_record.request_hash != request_hash:
                    IDEMPOTENCY_OPERATIONS_TOTAL.labels(result="mismatch").inc()
                    return JSONResponse(
                        status_code=422,
                        content={"detail": "Idempotency key was previously used with a different request payload or method"},
                        headers={
                            "Idempotency-Key": idempotency_key,
                            "X-Cache-Lookup": "MISMATCH-IDEMPOTENT"
                        }
                    )

                # Replay cached response
                IDEMPOTENCY_OPERATIONS_TOTAL.labels(result="hit").inc()
                cached_headers = {}
                if existing_record.response_headers:
                    try:
                        cached_headers = json.loads(existing_record.response_headers)
                    except Exception:
                        cached_headers = {}

                cached_headers["Idempotency-Key"] = idempotency_key
                cached_headers["X-Cache-Lookup"] = "HIT-IDEMPOTENT"
                cached_headers["Idempotency-Replayed"] = "true"

                content_type = cached_headers.get("content-type", "application/json")
                return Response(
                    content=(existing_record.response_body or "").encode("utf-8"),
                    status_code=existing_record.response_code or 200,
                    headers=cached_headers,
                    media_type=content_type
                )

            # Case 2: Key exists and is currently PROCESSING (Concurrent race condition)
            if existing_record and existing_record.status == "PROCESSING":
                IDEMPOTENCY_OPERATIONS_TOTAL.labels(result="conflict").inc()
                return JSONResponse(
                    status_code=409,
                    content={"detail": "A request with this idempotency key is currently processing. Please retry shortly."},
                    headers={
                        "Idempotency-Key": idempotency_key,
                        "Retry-After": "2",
                        "X-Cache-Lookup": "CONFLICT-IDEMPOTENT"
                    }
                )

            # Case 3: Fresh Key (MISS) -> Insert record with status=PROCESSING
            new_record = IdempotencyKey(
                key=idempotency_key,
                user_id=user_id,
                request_method=request.method,
                request_path=request.url.path,
                request_hash=request_hash,
                status="PROCESSING",
                created_at=now_utc,
                expires_at=now_utc + timedelta(hours=24)
            )
            db.add(new_record)
            db.commit()
            db.refresh(new_record)
            record_id = new_record.id

        finally:
            db.close()

        IDEMPOTENCY_OPERATIONS_TOTAL.labels(result="miss").inc()

        # Execute the route handler
        try:
            response = await call_next(request)
        except Exception:
            # On unhandled error, clean up record so future retries can succeed
            cleanup_db = get_db_context(request)
            try:
                rec = cleanup_db.query(IdempotencyKey).filter(IdempotencyKey.id == record_id).first()
                if rec:
                    rec.status = "FAILED"
                    cleanup_db.commit()
            finally:
                cleanup_db.close()
            raise

        # Capture response body
        response_body_bytes = b""
        response_chunks = []
        async for chunk in response.body_iterator:
            if not isinstance(chunk, bytes):
                chunk = chunk.encode("utf-8")
            response_chunks.append(chunk)
            response_body_bytes += chunk

        # Reconstruct response body iterator so client receives full content
        response.body_iterator = iterate_in_threadpool(iter(response_chunks))

        # Save completed response to DB for caching (cache successful/client responses < 500)
        save_db = get_db_context(request)
        try:
            rec = save_db.query(IdempotencyKey).filter(IdempotencyKey.id == record_id).first()
            if rec:
                if response.status_code < 500:
                    rec.status = "COMPLETED"
                    rec.response_code = response.status_code
                    rec.response_body = response_body_bytes.decode("utf-8", errors="replace")
                    rec.response_headers = json.dumps({
                        "content-type": response.headers.get("content-type", "application/json")
                    })
                else:
                    rec.status = "FAILED"
                save_db.commit()
        finally:
            save_db.close()

        # Set idempotency metadata headers
        response.headers["Idempotency-Key"] = idempotency_key
        response.headers["X-Cache-Lookup"] = "MISS-IDEMPOTENT"

        return response
