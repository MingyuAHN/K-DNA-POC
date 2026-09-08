from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.v1.documents import router as document_router
from app.api.v1.missions import router as mission_router
from app.db.session import get_db


app = FastAPI(
    title="K-DNA PoC Backend",
    version="0.1.0",
)

# 로컬 Frontend에서 Backend API 호출 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mission_router)
app.include_router(document_router)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "k-dna-backend",
    }


@app.get("/health/db")
def database_health(
    db: Session = Depends(get_db),
):
    db.execute(text("SELECT 1"))

    return {
        "status": "ok",
        "database": "connected",
    }