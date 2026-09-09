-- ============================================================
-- K-DNA Core Schema
-- Validation / Knowledge Unit / Evidence / Relation
-- ============================================================


-- ------------------------------------------------------------
-- Interview Analysis에 AI 입력 Context도 보존
-- ------------------------------------------------------------
ALTER TABLE interview_analysis
ADD COLUMN IF NOT EXISTS request_context JSONB
NOT NULL DEFAULT '{}'::jsonb;


-- ------------------------------------------------------------
-- Knowledge Unit
-- 검증을 통과한 최종 Atomic Knowledge
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_unit (
    knowledge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    mission_id UUID NOT NULL
        REFERENCES mission(mission_id)
        ON DELETE CASCADE,

    source_candidate_id UUID
        REFERENCES knowledge_candidate(candidate_id)
        ON DELETE SET NULL,

    knowledge_type VARCHAR(50) NOT NULL,

    statement TEXT NOT NULL,

    context JSONB NOT NULL DEFAULT '{}'::jsonb,

    decision_rule JSONB,

    rationale TEXT,

    exception TEXT,

    status VARCHAR(40) NOT NULL DEFAULT 'VERIFIED',

    confidence_score NUMERIC(5,4),

    version INT NOT NULL DEFAULT 1,

    root_knowledge_id UUID
        REFERENCES knowledge_unit(knowledge_id)
        ON DELETE SET NULL,

    supersedes_id UUID
        REFERENCES knowledge_unit(knowledge_id)
        ON DELETE SET NULL,

    change_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_knowledge_unit_source_candidate
        UNIQUE (source_candidate_id),

    CONSTRAINT chk_knowledge_unit_status CHECK (
        status IN (
            'VERIFIED',
            'EXPERT_OPINION',
            'SUPERSEDED',
            'RETIRED'
        )
    ),

    CONSTRAINT chk_knowledge_unit_confidence CHECK (
        confidence_score IS NULL
        OR (
            confidence_score >= 0
            AND confidence_score <= 1
        )
    )
);


-- ------------------------------------------------------------
-- Validation
-- Candidate가 왜 승인/거절됐는지 기록
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS validation (
    validation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    candidate_id UUID NOT NULL
        REFERENCES knowledge_candidate(candidate_id)
        ON DELETE CASCADE,

    knowledge_id UUID
        REFERENCES knowledge_unit(knowledge_id)
        ON DELETE SET NULL,

    validation_type VARCHAR(50) NOT NULL,

    status VARCHAR(40) NOT NULL,

    reason TEXT,

    validated_by VARCHAR(200),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_validation_status CHECK (
        status IN (
            'VERIFIED',
            'CONFLICTED',
            'INSUFFICIENT_EVIDENCE',
            'EXPERT_OPINION',
            'REJECTED'
        )
    )
);


-- ------------------------------------------------------------
-- Evidence
-- Knowledge Unit의 근거
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evidence (
    evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    knowledge_id UUID NOT NULL
        REFERENCES knowledge_unit(knowledge_id)
        ON DELETE CASCADE,

    source_type VARCHAR(50) NOT NULL,

    source_id TEXT NOT NULL,

    source_text TEXT,

    confidence_score NUMERIC(5,4),

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_evidence_confidence CHECK (
        confidence_score IS NULL
        OR (
            confidence_score >= 0
            AND confidence_score <= 1
        )
    )
);


-- ------------------------------------------------------------
-- Knowledge Relation
-- K-DNA Graph Edge
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_relation (
    relation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    mission_id UUID NOT NULL
        REFERENCES mission(mission_id)
        ON DELETE CASCADE,

    from_knowledge_id UUID NOT NULL
        REFERENCES knowledge_unit(knowledge_id)
        ON DELETE CASCADE,

    to_knowledge_id UUID NOT NULL
        REFERENCES knowledge_unit(knowledge_id)
        ON DELETE CASCADE,

    relation_type VARCHAR(50) NOT NULL,

    confidence_score NUMERIC(5,4),

    source_analysis_id UUID
        REFERENCES interview_analysis(analysis_id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_knowledge_relation UNIQUE (
        from_knowledge_id,
        to_knowledge_id,
        relation_type
    ),

    CONSTRAINT chk_relation_type CHECK (
        relation_type IN (
            'SUPPORTS',
            'REFINES',
            'HAS_EXCEPTION',
            'CONTRADICTS',
            'CONTEXT_DIFFERS',
            'SUPERSEDES',
            'UNRELATED'
        )
    ),

    CONSTRAINT chk_relation_confidence CHECK (
        confidence_score IS NULL
        OR (
            confidence_score >= 0
            AND confidence_score <= 1
        )
    )
);


CREATE INDEX IF NOT EXISTS idx_knowledge_unit_mission
ON knowledge_unit(mission_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_unit_status
ON knowledge_unit(status);

CREATE INDEX IF NOT EXISTS idx_validation_candidate
ON validation(candidate_id);

CREATE INDEX IF NOT EXISTS idx_validation_knowledge
ON validation(knowledge_id);

CREATE INDEX IF NOT EXISTS idx_evidence_knowledge
ON evidence(knowledge_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_relation_mission
ON knowledge_relation(mission_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_relation_from
ON knowledge_relation(from_knowledge_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_relation_to
ON knowledge_relation(to_knowledge_id);