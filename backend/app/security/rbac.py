from __future__ import annotations

from collections.abc import Iterable

from fastapi import Depends, HTTPException

from .auth import User, get_current_user


ROLE_DESCRIPTIONS = {
    "ai_user": "Can use AI assistant and AI decision-support endpoints.",
    "reviewer": "Can view and resolve AI review queue items.",
    "supplier_operator": "Can upload supplier evidence and update supplier workflow data.",
    "compliance_manager": "Can apply audit, onboarding, and traceability decisions.",
    "model_admin": "Can administer AI/provider configuration.",
}


def require_role(role: str):
    return require_any_role((role,))


def require_any_role(roles: Iterable[str]):
    allowed_roles = tuple(roles)

    async def _dependency(user: User = Depends(get_current_user)) -> User:
        if not any(user.has_role(role) for role in allowed_roles):
            raise HTTPException(
                status_code=403,
                detail=f"One of these roles is required: {', '.join(allowed_roles)}",
            )
        return user

    return _dependency
