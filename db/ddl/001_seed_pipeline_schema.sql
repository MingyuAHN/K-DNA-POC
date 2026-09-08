-- =========================================================
-- K-DNA PoC
-- Seed Data Parsing - Initial Schema
--
-- Mission
--   └─ Document
--        └─ Document Chunk
--             └─ Baseline Claim
-- =========================================================


-- =========================================================
-- 0. Extensions
-- =========================================================

CREATE EXTENSION IF NOT EXISTS vector;


-- =========================================================
-- 1. mission
-- 하나의 K-DNA 작업공간(Mission)
-- 하나의 Mission에는 여러 Document / Interview가 연결될 수 있음
-- =========================================================

CREATE TABLE IF NOT EXISTS mission (
    mission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title VARCHAR(300) NOT NULL,
    domain VARCHAR(100) NOT NULL,
    objective TEXT,

    status VARCHAR(30) NOT NULL DEFAULT 'CREATED',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =========================================================
-- 2. document
-- Mission에 업로드된 Seed 원본 문서
--
-- Mission 1 : N Document
-- =========================================================

CREATE TABLE IF NOT EXISTS document (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    mission_id UUID NOT NULL
        REFERENCES mission(mission_id)
        ON DELETE CASCADE,

    file_name VARCHAR(500) NOT NULL,

    -- PDF / DOCX / TXT / MD 등
    document_type VARCHAR(50),

    -- Supabase Storage 등의 실제 파일 위치
    content_uri TEXT,

    -- Parsing 후 전체 원문 저장이 필요한 경우 사용
    raw_text TEXT,

    version VARCHAR(50),

    -- Seed 처리 Pipeline 상태
    processing_status VARCHAR(30)
        NOT NULL
        DEFAULT 'UPLOADED',

    -- Parsing/Chunking 등의 에러 발생 시 저장
    processing_error TEXT,

    -- 추가 문서 정보
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_document_processing_status
        CHECK (
            processing_status IN (
                'UPLOADED',
                'PARSING',
                'PARSED',
                'CHUNKING',
                'CLAIM_EXTRACTING',
                'EMBEDDING',
                'COMPLETED',
                'FAILED'
            )
        )
);


-- =========================================================
-- 3. document_chunk
-- 파싱된 문서를 Retrieval 단위로 분리한 Chunk
--
-- Document 1 : N Document Chunk
-- =========================================================

CREATE TABLE IF NOT EXISTS document_chunk (
    chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    document_id UUID NOT NULL
        REFERENCES document(document_id)
        ON DELETE CASCADE,

    -- 원본 문서 내 Chunk 순서
    seq INT NOT NULL,

    -- 실제 Chunk 내용
    content TEXT NOT NULL,

    -- 원문 위치 추적용
    page_number INT,
    section VARCHAR(500),

    -- paragraph / table / 좌표 등 추가 위치정보
    source_location JSONB,

    token_count INT,

    -- MVP 개발 패키지 기존 DDL 기준
    -- 실제 Embedding 모델 dimension 확정 후 변경 가능
    embedding vector(1536),

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- 동일 Document 내 Chunk 순서 중복 방지
    CONSTRAINT uq_document_chunk_seq
        UNIQUE (document_id, seq)
);


-- =========================================================
-- 4. baseline_claim
-- Document Chunk에서 AI가 추출한 비교용 Baseline Knowledge
--
-- Document Chunk 1 : N Baseline Claim
-- =========================================================

CREATE TABLE IF NOT EXISTS baseline_claim (
    claim_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Mission 단위 Claim 검색을 위해 직접 보관
    mission_id UUID NOT NULL
        REFERENCES mission(mission_id)
        ON DELETE CASCADE,

    -- Claim이 어느 원본 Chunk에서 생성됐는지 추적
    source_chunk_id UUID NOT NULL
        REFERENCES document_chunk(chunk_id)
        ON DELETE CASCADE,

    claim_type VARCHAR(30) NOT NULL,

    -- 구조화된 Claim 내용
    statement TEXT NOT NULL,

    -- domain / project / phase / system / constraints 등
    context JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Claim 추출의 직접 근거가 된 원문
    source_text TEXT,

    -- AI Claim Extraction confidence
    confidence_score NUMERIC(5,4),

    -- Claim 자체 Knowledge Retrieval용 Vector
    embedding vector(1536),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_baseline_claim_type
        CHECK (
            claim_type IN (
                'PRINCIPLE',
                'DECISION',
                'EXCEPTION',
                'OUTCOME'
            )
        ),

    CONSTRAINT chk_baseline_claim_confidence
        CHECK (
            confidence_score IS NULL
            OR (
                confidence_score >= 0
                AND confidence_score <= 1
            )
        )
);


-- =========================================================
-- 5. Index
-- =========================================================

-- Mission별 Document 조회
CREATE INDEX IF NOT EXISTS idx_document_mission
    ON document(mission_id);

-- 처리상태별 Document 조회
CREATE INDEX IF NOT EXISTS idx_document_processing_status
    ON document(processing_status);

-- Document별 Chunk 조회
CREATE INDEX IF NOT EXISTS idx_document_chunk_document
    ON document_chunk(document_id);

-- Mission별 Baseline Claim 조회
CREATE INDEX IF NOT EXISTS idx_baseline_claim_mission
    ON baseline_claim(mission_id);

-- 원본 Chunk 기준 Claim 추적
CREATE INDEX IF NOT EXISTS idx_baseline_claim_source_chunk
    ON baseline_claim(source_chunk_id);

-- Claim Type별 조회
CREATE INDEX IF NOT EXISTS idx_baseline_claim_type
    ON baseline_claim(claim_type);