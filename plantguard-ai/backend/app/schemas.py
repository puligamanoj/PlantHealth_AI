from datetime import datetime
from pydantic import BaseModel, Field

class DiagnosisOut(BaseModel):
    id: int
    filename: str
    predicted_class: str
    confidence: float = Field(ge=0, le=1)
    model_version: str
    created_at: datetime
    advice_note: str
    class Config:
        from_attributes = True

class CropOut(BaseModel):
    name: str
    summary: str
    guidance: list[str]
