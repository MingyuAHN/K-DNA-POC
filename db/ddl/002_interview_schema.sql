CREATE TABLE IF NOT EXISTS expert (
    expert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(200) NOT NULL,
    organization VARCHAR(300),
    role VARCHAR(200),

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS interview (
    interview_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    mission_id UUID NOT NULL
        REFERENCES mission(mission_id)
        ON DELETE CASCADE,

    expert_id UUID NOT NULL
        REFERENCES expert(expert_id)
        ON DELETE RESTRICT,

    title VARCHAR(300),

    status VARCHAR(30) NOT NULL DEFAULT 'CREATED',

    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_interview_status CHECK (
        status IN (
            'CREATED',
            'IN_PROGRESS',
            'COMPLETED',
            'CANCELLED'
        )
    )
);


CREATE TABLE IF NOT EXISTS interview_message (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    interview_id UUID NOT NULL
        REFERENCES interview(interview_id)
        ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL,

    content TEXT NOT NULL,

    sequence INT NOT NULL,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_interview_message_role CHECK (
        role IN (
            'USER',
            'ASSISTANT',
            'SYSTEM'
        )
    ),

    CONSTRAINT uq_interview_message_sequence
        UNIQUE (interview_id, sequence)
);


CREATE INDEX IF NOT EXISTS idx_interview_mission
ON interview(mission_id);

CREATE INDEX IF NOT EXISTS idx_interview_expert
ON interview(expert_id);

CREATE INDEX IF NOT EXISTS idx_interview_message_interview
ON interview_message(interview_id);

CREATE INDEX IF NOT EXISTS idx_interview_message_sequence
ON interview_message(interview_id, sequence);