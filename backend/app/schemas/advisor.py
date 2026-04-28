from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


MessageRole = Literal["user", "assistant"]
AdvisorLens = Literal[
    "general",
    "executive",
    "analytics",
    "simulator",
    "due_diligence",
    "esg_monitoring",
]


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


class AdvisorSimulatorContext(BaseModel):
    scenarioTitle: str
    scenarioSummary: str
    highRiskDelta: float
    overallRiskDelta: float
    operationalRiskDelta: float
    esgRiskDelta: float
    affectedSupplierCount: int


class AdvisorMessageRequest(BaseModel):
    message: str = Field(min_length=1)
    lens: AdvisorLens = "general"
    simulatorContext: AdvisorSimulatorContext | None = None


class AdvisorMessageResponse(BaseModel):
    sessionId: str
    reply: AdvisorMessage
    lensUsed: AdvisorLens

    model_config = ConfigDict(from_attributes=True)
