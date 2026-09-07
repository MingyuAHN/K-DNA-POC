from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List


class ContextTags(BaseModel):
    model_config = ConfigDict(extra="allow")

    project: Optional[str] = None
    phase: Optional[str] = None
    domain: Optional[str] = None
    system: Optional[str] = None
    scope: Optional[str] = None
    time: Optional[str] = None
    constraints: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)