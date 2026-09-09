-- ============================================================
-- Knowledge Synthesis Apply / Validation
-- ============================================================

ALTER TABLE knowledge_synthesis
ADD COLUMN IF NOT EXISTS status VARCHAR(30)
NOT NULL DEFAULT 'PENDING';

ALTER TABLE knowledge_synthesis
ADD COLUMN IF NOT EXISTS validated_by VARCHAR(200);

ALTER TABLE knowledge_synthesis
ADD COLUMN IF NOT EXISTS validation_reason TEXT;

ALTER TABLE knowledge_synthesis
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

ALTER TABLE knowledge_synthesis
ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;

ALTER TABLE knowledge_synthesis
ADD COLUMN IF NOT EXISTS resulting_knowledge_ids JSONB
NOT NULL DEFAULT '[]'::jsonb;


ALTER TABLE knowledge_synthesis_unit
ADD COLUMN IF NOT EXISTS applied_knowledge_id UUID
REFERENCES knowledge_unit(knowledge_id)
ON DELETE SET NULL;


ALTER TABLE knowledge_unit
ADD COLUMN IF NOT EXISTS source_synthesis_id UUID
REFERENCES knowledge_synthesis(synthesis_id)
ON DELETE SET NULL;

ALTER TABLE knowledge_unit
ADD COLUMN IF NOT EXISTS source_synthesis_unit_id UUID
REFERENCES knowledge_synthesis_unit(synthesis_unit_id)
ON DELETE SET NULL;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'chk_knowledge_synthesis_status'
    ) THEN
        ALTER TABLE knowledge_synthesis
        ADD CONSTRAINT
            chk_knowledge_synthesis_status
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED',
                'APPLIED'
            )
        );
    END IF;
END $$;


CREATE INDEX IF NOT EXISTS
idx_knowledge_synthesis_status
ON knowledge_synthesis(status);

CREATE INDEX IF NOT EXISTS
idx_knowledge_unit_source_synthesis
ON knowledge_unit(source_synthesis_id);