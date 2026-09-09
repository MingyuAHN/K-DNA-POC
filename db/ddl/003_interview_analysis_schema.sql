CREATE TABLE IF NOT EXISTS interview_analysis (
    analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    mission_id UUID NOT NULL
        REFERENCES mission(mission_id)
        ON DELETE CASCADE,

    interview_id UUID NOT NULL
        REFERENCES interview(interview_id)
        ON DELETE CASCADE,

    source_message_id UUID NOT NULL
        REFERENCES interview_message(message_id)
        ON DELETE CASCADE,

    assistant_message_id UUID
        REFERENCES interview_message(message_id)
        ON DELETE SET NULL,

    raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_interview_analysis_source_message
        UNIQUE (source_message_id)
);


CREATE TABLE IF NOT EXISTS knowledge_candidate (
    candidate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    analysis_id UUID NOT NULL
        REFERENCES interview_analysis(analysis_id)
        ON DELETE CASCADE,

    statement TEXT NOT NULL,

    knowledge_type VARCHAR(40) NOT NULL,

    context JSONB NOT NULL DEFAULT '{}'::jsonb,

    decision_rule JSONB,

    rationale TEXT,

    exception TEXT,

    novelty_score NUMERIC(5,4),

    confidence_score NUMERIC(5,4),

    validation_status VARCHAR(40) NOT NULL DEFAULT 'CANDIDATE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_candidate_novelty_score CHECK (
        novelty_score IS NULL
        OR (
            novelty_score >= 0
            AND novelty_score <= 1
        )
    ),

    CONSTRAINT chk_candidate_confidence_score CHECK (
        confidence_score IS NULL
        OR (
            confidence_score >= 0
            AND confidence_score <= 1
        )
    ),

    CONSTRAINT chk_candidate_validation_status CHECK (
        validation_status IN (
            'DISCOVERED',
            'CANDIDATE',
            'VALIDATING',
            'VERIFIED',
            'CONFLICTED',
            'INSUFFICIENT_EVIDENCE',
            'EXPERT_OPINION',
            'REJECTED'
        )
    )
);


CREATE TABLE IF NOT EXISTS knowledge_gap (
    gap_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    analysis_id UUID NOT NULL
        REFERENCES interview_analysis(analysis_id)
        ON DELETE CASCADE,

    topic TEXT NOT NULL,

    dimension VARCHAR(50) NOT NULL,

    gap_type VARCHAR(100) NOT NULL,

    gap_score NUMERIC(5,4),

    reason TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_gap_score CHECK (
        gap_score IS NULL
        OR (
            gap_score >= 0
            AND gap_score <= 1
        )
    )
);


CREATE TABLE IF NOT EXISTS knowledge_conflict (
    conflict_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    analysis_id UUID NOT NULL
        REFERENCES interview_analysis(analysis_id)
        ON DELETE CASCADE,

    conflict_type VARCHAR(50) NOT NULL,

    severity VARCHAR(30) NOT NULL,

    description TEXT NOT NULL,

    context_difference TEXT,

    unknown_condition TEXT,

    recommended_question TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS conflict_source (
    conflict_source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    conflict_id UUID NOT NULL
        REFERENCES knowledge_conflict(conflict_id)
        ON DELETE CASCADE,

    source_type VARCHAR(100) NOT NULL,

    source_id TEXT,

    content TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS question_candidate (
    question_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    analysis_id UUID NOT NULL
        REFERENCES interview_analysis(analysis_id)
        ON DELETE CASCADE,

    assistant_message_id UUID
        REFERENCES interview_message(message_id)
        ON DELETE SET NULL,

    question TEXT NOT NULL,

    question_type VARCHAR(100) NOT NULL,

    target_gap TEXT,

    gap_reduction_score NUMERIC(5,4),

    novelty_score NUMERIC(5,4),

    business_impact_score NUMERIC(5,4),

    conflict_resolution_score NUMERIC(5,4),

    redundancy_score NUMERIC(5,4),

    value_score NUMERIC(5,4),

    is_selected BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS idx_interview_analysis_mission
ON interview_analysis(mission_id);

CREATE INDEX IF NOT EXISTS idx_interview_analysis_interview
ON interview_analysis(interview_id);

CREATE INDEX IF NOT EXISTS idx_interview_analysis_source_message
ON interview_analysis(source_message_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_candidate_analysis
ON knowledge_candidate(analysis_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_gap_analysis
ON knowledge_gap(analysis_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_conflict_analysis
ON knowledge_conflict(analysis_id);

CREATE INDEX IF NOT EXISTS idx_conflict_source_conflict
ON conflict_source(conflict_id);

CREATE INDEX IF NOT EXISTS idx_question_candidate_analysis
ON question_candidate(analysis_id);