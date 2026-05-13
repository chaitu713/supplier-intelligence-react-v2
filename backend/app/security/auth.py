from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from typing import Any

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..core.config import get_settings

security = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class User:
    id: str
    roles: tuple[str, ...]
    email: str = ""
    name: str = ""
    auth_mode: str = "dev"

    def has_role(self, role: str) -> bool:
        return role in self.roles


def _split_roles(raw_roles: str | None) -> tuple[str, ...]:
    if not raw_roles:
        return ()
    normalized = raw_roles.replace(";", ",")
    return tuple(role.strip() for role in normalized.split(",") if role.strip())


def _decode_unverified_jwt_payload(token: str) -> dict[str, Any]:
    parts = token.split(".")
    if len(parts) < 2:
        raise ValueError("Bearer token is not a JWT")
    payload = parts[1]
    payload += "=" * (-len(payload) % 4)
    decoded = base64.urlsafe_b64decode(payload.encode("utf-8"))
    return json.loads(decoded.decode("utf-8"))


def _claims_to_user(claims: dict[str, Any]) -> User:
    roles = claims.get("roles") or []
    if isinstance(roles, str):
        roles = roles.split()
    scopes = claims.get("scp") or ""
    scope_roles = scopes.split() if isinstance(scopes, str) else []
    combined_roles = tuple(dict.fromkeys([*roles, *scope_roles]))
    return User(
        id=str(claims.get("oid") or claims.get("sub") or claims.get("user_id") or ""),
        email=str(claims.get("preferred_username") or claims.get("email") or ""),
        name=str(claims.get("name") or ""),
        roles=combined_roles,
        auth_mode="bearer_jwt",
    )


def _header_user(request: Request) -> User | None:
    user_id = request.headers.get("X-User-Id")
    roles = _split_roles(request.headers.get("X-User-Roles"))
    if not user_id and not roles:
        return None
    return User(
        id=user_id or "header_user",
        email=request.headers.get("X-User-Email", ""),
        name=request.headers.get("X-User-Name", ""),
        roles=roles,
        auth_mode="headers",
    )


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> User:
    settings = get_settings()
    header_user = _header_user(request)

    if not settings.auth_enabled:
        return header_user or User(
            id=settings.dev_user_id,
            roles=settings.dev_user_roles,
            name=settings.dev_user_id,
            auth_mode="dev",
        )

    if header_user:
        return header_user

    if credentials and credentials.credentials and settings.auth_trust_bearer_jwt:
        try:
            user = _claims_to_user(_decode_unverified_jwt_payload(credentials.credentials))
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise HTTPException(status_code=401, detail="Invalid bearer token") from exc
        if user.id:
            return user

    raise HTTPException(status_code=401, detail="Authentication required")
