from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from .routers import auth, account, vault

app = FastAPI(title="Лист Героя 5e API")
@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException):
    body = exc.detail if isinstance(exc.detail, dict) else {"error": exc.detail}
    return JSONResponse(body, status_code=exc.status_code, headers=exc.headers)
app.include_router(auth.router)
app.include_router(account.router)
app.include_router(vault.router)
@app.get("/healthz")
def healthz(): return {"ok": True}
