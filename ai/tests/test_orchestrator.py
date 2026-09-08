import json
from pathlib import Path

from shared.schemas.interview import (
    InterviewAnalysisRequest,
)

from ai.agents.knowledge_extractor import KnowledgeExtractor
from ai.agents.semantic_aligner import SemanticAligner
from ai.agents.gap_analyzer import GapAnalyzer
from ai.agents.conflict_detector import ConflictDetector
from ai.agents.question_planner import QuestionPlanner

from ai.services.orchestrator import AIOrchestrator


class StubLLMGateway:
    """
    response_model에 따라 각 AI 단계의 Mock 결과를 반환한다.
    """

    def generate_structured(
        self,
        system_prompt,
        user_prompt,
        response_model,
    ):
        model_name = response_model.__name__

        if model_name == "KnowledgeExtractionResponse":
            data = {
                "knowledge_candidates": [
                    {
                        "statement": (
                            "서비스별 데이터베이스 분리를 "
                            "원칙으로 한다."
                        ),
                        "type": "PRINCIPLE",
                        "context": {
                            "domain": "Data Ownership"
                        },
                        "decision_rule": None,
                        "rationale": None,
                        "exception": None,
                        "novelty_score": 0.5,
                        "confidence_score": 0.9,
                        "validation_status": "CANDIDATE"
                    }
                ]
            }

        elif model_name == "SemanticAlignmentResponse":
            data = {
                "relations": [
                    {
                        "target_type": "EVIDENCE",
                        "target_id": "chunk-adr021-001",
                        "relation": "CONTEXT_DIFFERS",
                        "reason": (
                            "Candidate는 일반적인 DB 분리 원칙이고 "
                            "Evidence는 Migration Phase 1 사례이다."
                        ),
                        "context_difference": (
                            "General Principle vs Migration Phase 1"
                        )
                    }
                ]
            }

        elif model_name == "GapAnalysisResponse":
            data = {
                "gaps": [
                    {
                        "topic": "Data Ownership",
                        "dimension": "EXCEPTION",
                        "gap_type": "MISSING_EXCEPTION",
                        "gap_score": 1.0,
                        "reason": (
                            "DB 분리 원칙을 적용하지 않는 "
                            "예외 조건이 확인되지 않았다."
                        )
                    },
                    {
                        "topic": "Data Ownership",
                        "dimension": "WHEN",
                        "gap_type": "MISSING_CONTEXT",
                        "gap_score": 0.9,
                        "reason": (
                            "DB 분리 원칙이 적용되는 "
                            "Migration Phase가 명확하지 않다."
                        )
                    }
                ]
            }

        elif model_name == "ConflictAnalysisResponse":
            data = {
                "conflicts": [
                    {
                        "conflict_type": "CONDITIONAL_CONFLICT",
                        "severity": "HIGH",
                        "description": (
                            "Database per Service 원칙과 "
                            "Migration Phase 1 Shared DB 사례 사이에 "
                            "조건부 차이가 존재한다."
                        ),
                        "sources": [
                            {
                                "source_type": "EVIDENCE",
                                "source_id": "chunk-adr021-001",
                                "content": (
                                    "Migration Phase 1에서는 "
                                    "Shared Physical Database를 사용한다."
                                )
                            }
                        ],
                        "context_difference": (
                            "Target Principle vs Migration Phase 1"
                        ),
                        "unknown_condition": (
                            "Shared DB 허용 조건이 확인되지 않았다."
                        ),
                        "recommended_question": (
                            "어떤 조건에서는 DB를 "
                            "즉시 분리하지 않았습니까?"
                        )
                    }
                ]
            }

        elif model_name == "QuestionPlanningResponse":
            data = {
                "question_candidates": [
                    {
                        "question": (
                            "왜 서비스별 데이터베이스를 "
                            "분리해야 합니까?"
                        ),
                        "question_type": "DEPTH",
                        "target_gap": "WHY",
                        "gap_reduction_score": 0.6,
                        "novelty_score": 0.4,
                        "business_impact_score": 0.5,
                        "conflict_resolution_score": 0.2,
                        "redundancy_score": 0.2,
                        "value_score": 0.0
                    },
                    {
                        "question": (
                            "ADR-021에서는 Migration 초기 Shared DB를 "
                            "사용했습니다. 어떤 조건 때문에 "
                            "Database per Service 원칙을 "
                            "즉시 적용하지 않았습니까?"
                        ),
                        "question_type": "CONFLICT_RESOLUTION",
                        "target_gap": "EXCEPTION",
                        "gap_reduction_score": 0.95,
                        "novelty_score": 0.9,
                        "business_impact_score": 0.85,
                        "conflict_resolution_score": 1.0,
                        "redundancy_score": 0.05,
                        "value_score": 0.0
                    }
                ],
                "next_question": None
            }

        else:
            raise ValueError(
                f"Unsupported response model: {model_name}"
            )

        return response_model.model_validate(data)


def test_ai_orchestrator():

    fixture_path = (
        Path(__file__).resolve().parents[1]
        / "fixtures"
        / "killer_demo_request.json"
    )

    data = json.loads(
        fixture_path.read_text(
            encoding="utf-8"
        )
    )

    request = InterviewAnalysisRequest.model_validate(
        data
    )

    gateway = StubLLMGateway()

    orchestrator = AIOrchestrator(
        knowledge_extractor=KnowledgeExtractor(gateway),
        semantic_aligner=SemanticAligner(gateway),
        gap_analyzer=GapAnalyzer(gateway),
        conflict_detector=ConflictDetector(gateway),
        question_planner=QuestionPlanner(gateway),
    )

    result = orchestrator.analyze(request)

    # Knowledge Candidate
    assert len(result.knowledge_candidates) == 1

    assert (
        result.knowledge_candidates[0].type.value
        == "PRINCIPLE"
    )

    # Gap
    assert len(result.gaps) == 2

    gap_dimensions = [
        gap.dimension.value
        for gap in result.gaps
    ]

    assert "EXCEPTION" in gap_dimensions
    assert "WHEN" in gap_dimensions

    # Conflict
    assert len(result.conflicts) == 1

    assert (
        result.conflicts[0].conflict_type.value
        == "CONDITIONAL_CONFLICT"
    )

    # Question
    assert len(result.question_candidates) == 2

    assert result.next_question is not None

    assert (
        result.next_question.question_type.value
        == "CONFLICT_RESOLUTION"
    )

    assert (
        "ADR-021"
        in result.next_question.question
    )