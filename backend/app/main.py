from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.v1.baseline_claims import (
    router as baseline_claim_router,
)
from app.api.v1.documents import (
    router as document_router,
)
from app.api.v1.embeddings import (
    router as embedding_router,
)
from app.api.v1.experts import (
    router as expert_router,
)
from app.api.v1.interview_analyses import (
    router as interview_analysis_router,
)
from app.api.v1.interviews import (
    router as interview_router,
)
from app.api.v1.knowledge import (
    router as knowledge_router,
)
from app.api.v1.knowledge_graph import (
    router as knowledge_graph_router,
)
from app.api.v1.knowledge_synthesis import (
    router as knowledge_synthesis_router,
)
from app.api.v1.knowledge_synthesis_validation import (
    router as knowledge_synthesis_validation_router,
)
from app.api.v1.knowledge_versions import (
    router as knowledge_version_router,
)
from app.api.v1.missions import (
    router as mission_router,
)
from app.api.v1.retrieval import (
    router as retrieval_router,
)
from app.db.session import get_db


app = FastAPI(
    title="K-DNA PoC Backend",
    version="0.1.0",
)


# ============================================================
# CORS
# ============================================================

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://k-dna-poc.vercel.app",
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Routers
# ============================================================

app.include_router(mission_router)
app.include_router(document_router)
app.include_router(baseline_claim_router)
app.include_router(embedding_router)
app.include_router(expert_router)
app.include_router(interview_router)
app.include_router(interview_analysis_router)
app.include_router(retrieval_router)
app.include_router(knowledge_router)
app.include_router(knowledge_graph_router)
app.include_router(knowledge_version_router)
app.include_router(knowledge_synthesis_router)
app.include_router(
    knowledge_synthesis_validation_router
)


# ============================================================
# Health
# ============================================================

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
    db.execute(
        text("SELECT 1")
    )

    return {
        "status": "ok",
        "database": "connected",
    }