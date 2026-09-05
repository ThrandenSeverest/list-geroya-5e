from pydantic import BaseModel
from typing import Any

class Credentials(BaseModel):
    email: str = ""
    password: str = ""
class TokenPassword(BaseModel):
    token: str = ""
    password: str = ""
class VaultRequest(BaseModel):
    vault: Any = None
