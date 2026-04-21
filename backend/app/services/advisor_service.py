from __future__ import annotations

import threading
from datetime import datetime, UTC
from uuid import uuid4

import pandas as pd

from ..core.exceptions import AppError
from ..core.logging import get_logger
from .dataset_service import DatasetService

logger = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(UTC)


class AdvisorService:
    def __init__(self) -> None:
        self.dataset_service = DatasetService()
        self._sessions: dict[str, dict] = {}
        self._lock = threading.Lock()

    def create_session(self) -> dict:
        session_id = f"chat_{uuid4().hex[:12]}"
        session = {
            "sessionId": session_id,
            "createdAt": _utcnow(),
            "messages": [],
        }

        with self._lock:
            self._sessions[session_id] = session

        logger.info("Created advisor session %s", session_id)
        return session

    def get_session(self, session_id: str) -> dict:
        with self._lock:
            session = self._sessions.get(session_id)

        if not session:
            raise AppError("Advisor session not found", status_code=404)

        return session

    def send_message(self, session_id: str, message: str) -> dict:
        user_message = {
            "role": "user",
            "content": message,
            "createdAt": _utcnow(),
        }

        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                raise AppError("Advisor session not found", status_code=404)
            session["messages"].append(user_message)

        reply_text = self._generate_reply(message)
        assistant_message = {
            "role": "assistant",
            "content": reply_text,
            "createdAt": _utcnow(),
        }

        with self._lock:
            self._sessions[session_id]["messages"].append(assistant_message)

        logger.info("Generated advisor response for session %s", session_id)
        return {
            "sessionId": session_id,
            "reply": assistant_message,
        }

    def _generate_reply(self, question: str) -> str:
        performance = self._load_performance_frame()

        try:
            try:
                from backend.ai_agent import ask_supplier_ai
            except ImportError:
                from ai_agent import ask_supplier_ai

            response = ask_supplier_ai(question, performance)
        except Exception as exc:
            logger.exception("Advisor AI generation failed", exc_info=exc)
            raise AppError("Unable to generate advisor response", status_code=500) from exc

        return str(response)

    def _load_performance_frame(self) -> pd.DataFrame:
        performance = pd.DataFrame(self.dataset_service.get_supplier_performance())
        suppliers = pd.DataFrame(self.dataset_service.get_suppliers())

        if performance.empty:
            return performance

        supplier_columns = [
            column
            for column in ["supplier_id", "supplier_name", "country", "category"]
            if column in suppliers.columns
        ]
        if supplier_columns:
            performance = performance.merge(
                suppliers[supplier_columns],
                on="supplier_id",
                how="left",
            )

        return performance


advisor_service = AdvisorService()
