from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


MessageRole = Literal["user", "assistant"]


class AdvisorMessage(BaseModel):
    role: MessageRole
    content: str
    createdAt: datetime

    model_config = ConfigDict(from_attributes=True)


class AdvisorSessionResponse(BaseModel):
    sessionId: str
    createdAt: datetime
    messages: list[AdvisorMessage]

    model_config = ConfigDict(from_attributes=True)


class AdvisorMessageRequest(BaseModel):
    message: str = Field(min_length=1)


class AdvisorMessageResponse(BaseModel):
    sessionId: str
    reply: AdvisorMessage

    model_config = ConfigDict(from_attributes=True)
