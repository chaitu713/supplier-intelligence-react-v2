from pydantic import BaseModel, ConfigDict


class APIMessage(BaseModel):
    message: str

    model_config = ConfigDict(from_attributes=True)
