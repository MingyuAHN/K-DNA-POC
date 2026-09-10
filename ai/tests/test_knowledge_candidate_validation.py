from shared.schemas.common import ContextTags
from shared.schemas.enums import (
    KnowledgeType,
    ValidationStatus,
)
from shared.schemas.interview import KnowledgeCandidate


def test_invalid_decision_rule_is_normalized_to_null():
    candidate = KnowledgeCandidate(
        statement="서비스별 DB를 분리해야 한다.",
        type=KnowledgeType.PRINCIPLE,
        context=ContextTags(
            domain="Data Ownership",
        ),
        decision_rule={
            "if_conditions": [],
            "then": None,
            "unless": [],
        },
        rationale=None,
        exception=None,
        novelty_score=0.8,
        confidence_score=0.9,
        validation_status=ValidationStatus.CANDIDATE,
    )

    assert candidate.decision_rule is None