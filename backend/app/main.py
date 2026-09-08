from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.v1.documents import router as document_router
from app.api.v1.missions import router as mission_router
from app.db.session import get_db


app = FastAPI(
    title="K-DNA PoC Backend",
    version="0.1.0",
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