from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


# ============================================================
# Database URL
# ============================================================

database_url = URL.create(
    drivername="postgresql+psycopg",
    username=settings.db_user,
    password=settings.db_password,
    host=settings.db_host,
    port=settings.db_port,
    database=settings.db_name,
)


# ============================================================
# SQLAlchemy Engine
# ============================================================

engine = create_engine(
    database_url,

    # 기존
    # 끊어진 DB 연결을 사용하기 전에 확인
    pool_pre_ping=True,

    # --------------------------------------------------------
    # 추가: Supabase Session Pooler 연결 수 초과 방지
    #
    # 현재 Supabase Pooler 최대 연결 수가 15개이므로
    # Backend 한 프로세스가 너무 많은 연결을 잡지 않도록 제한
    # --------------------------------------------------------

    # 기본적으로 유지할 연결 수
    pool_size=5,

    # pool_size를 모두 사용 중일 때
    # 추가로 만들 수 있는 임시 연결 수
    max_overflow=0,

    # 연결을 못 구했을 때 최대 대기 시간
    pool_timeout=30,

    # 오래된 연결을 주기적으로 새 연결로 교체
    pool_recycle=300,

    # 기존 SSL 설정
    connect_args={
        "sslmode": "require",
    },
)


# ============================================================
# Session Factory
# ============================================================

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# ============================================================
# FastAPI DB Dependency
# ============================================================

def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        # 요청 종료 후 반드시 Session 반환
        db.close()