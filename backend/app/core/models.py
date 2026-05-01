from typing import Optional
from pydantic import BaseModel

class User(BaseModel):
    uid: str
    email: Optional[str] = None
