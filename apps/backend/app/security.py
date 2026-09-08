import base64
import binascii
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings


bearer_scheme = HTTPBearer(auto_error=False)


def _jwt_assurance_level(token: str) -> str | None:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid JWT structure")
        encoded_payload = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(encoded_payload).decode("utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("Invalid JWT payload")
        assurance_level = payload.get("aal")
        return assurance_level if isinstance(assurance_level, str) else None
    except (UnicodeDecodeError, binascii.Error, json.JSONDecodeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error


def _requires_mfa(user: dict) -> bool:
    factors = user.get("factors", [])
    if not isinstance(factors, list):
        return False
    return any(
        isinstance(factor, dict) and factor.get("status") == "verified"
        for factor in factors
    )


def current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UUID:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        request = Request(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={
                "apikey": settings.supabase_anon_key.get_secret_value(),
                "Authorization": f"Bearer {credentials.credentials}",
            },
        )
        with urlopen(request, timeout=settings.auth_http_timeout_seconds) as response:
            user = json.load(response)
        if _requires_mfa(user) and _jwt_assurance_level(credentials.credentials) != "aal2":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="MFA verification required",
            )
        return UUID(user["id"])
    except HTTPException:
        raise
    except HTTPError as error:
        if error.code in {401, 403}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session",
                headers={"WWW-Authenticate": "Bearer"},
            ) from error
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        ) from error
    except (URLError, TimeoutError) as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        ) from error
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error
