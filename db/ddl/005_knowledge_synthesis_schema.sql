-- ============================================================
-- Knowledge Synthesis
-- ============================================================


CREATE TABLE IF NOT EXISTS knowledge_synthesis (
    synthesis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    mission_id UUID NOT NULL
        REFERENCES mission(mission_id)
        ON DELETE CASCADE,

    candidate_id UUID NOT NULL
        REFERENCES knowledge_candidate(candidate_id)
        ON DELETE CASCADE,

    operation VARCHAR(50) NOT NULL,

    target_knowledge_ids JSONB
        NOT NULL DEFAULT '[]'::jsonb,

    reason TEXT,

    request_payload JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    raw_response JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT now(),

    CONSTRAINT chk_synthesis_operation CHECK (
        operation IN (
            'ENRICH',
            'ADD_EXCEPTION',
            'SPLIT_BY_CONTEXT',
            'MERGE',
            'SUPERSEDE',
            'KEEP_CONFLICT'
        )
    )
);


CREATE TABLE IF NOT EXISTS knowledge_synthesis_unit (
    synthesis_unit_id UUID
        PRIMARY KEY DEFAULT gen_random_uuid(),

    synthesis_id UUID NOT NULL
        REFERENCES knowledge_synthesis(synthesis_id)
        ON DELETE CASCADE,

    synthesized_index INTEGER NOT NULL,

    statement TEXT NOT NULL,

    knowledge_type VARCHAR(50) NOT NULL,

    context JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    decision_rule JSONB,

    rationale TEXT,

    exception TEXT,

    novelty_score NUMERIC(5,4),

    confidence_score NUMERIC(5,4),

    validation_status VARCHAR(40)
        NOT NULL DEFAULT 'CANDIDATE',

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT now(),

    CONSTRAINT uq_synthesis_unit_index UNIQUE (
        synthesis_id,
        synthesized_index
    ),

    CONSTRAINT chk_synthesis_unit_novelty CHECK (
        novelty_score IS NULL
        OR (
            novelty_score >= 0
            AND novelty_score <= 1
        )
    ),

    CONSTRAINT chk_synthesis_unit_confidence CHECK (
        confidence_score IS NULL
        OR (
            confidence_score >= 0
            AND confidence_score <= 1
        )
    )
);


CREATE TABLE IF NOT EXISTS knowledge_synthesis_relation (
    synthesis_relation_id UUID
        PRIMARY KEY DEFAULT gen_random_uuid(),

    synthesis_id UUID NOT NULL
        REFERENCES knowledge_synthesis(synthesis_id)
        ON DELETE CASCADE,

    synthesized_index INTEGER NOT NULL,

    target_knowledge_id UUID NOT NULL
        REFERENCES knowledge_unit(knowledge_id)
        ON DELETE CASCADE,

    relation_type VARCHAR(50) NOT NULL,

    reason TEXT,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT now(),

    CONSTRAINT chk_synthesis_relation_type CHECK (
        relation_type IN (
            'SUPPORTS',
            'REFINES',
            'HAS_EXCEPTION',
            'CONTRADICTS',
            'CONTEXT_DIFFERS',
            'SUPERSEDES',
            'UNRELATED'
        )
    )
);


CREATE INDEX IF NOT EXISTS idx_knowledge_synthesis_mission
ON knowledge_synthesis(mission_id);


CREATE INDEX IF NOT EXISTS idx_knowledge_synthesis_candidate
ON knowledge_synthesis(candidate_id);


CREATE INDEX IF NOT EXISTS idx_knowledge_synthesis_unit
ON knowledge_synthesis_unit(synthesis_id);


CREATE INDEX IF NOT EXISTS idx_knowledge_synthesis_relation
ON knowledge_synthesis_relation(synthesis_id);