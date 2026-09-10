import json
from pathlib import Path

from shared.schemas.interview import (
    InterviewAnalysisRequest,
)

from ai.agents.knowledge_extractor import (
    KnowledgeExtractor,
)
from ai.agents.semantic_aligner import (
    SemanticAligner,
)
from ai.agents.gap_analyzer import (
    GapAnalyzer,
)
from ai.agents.conflict_detector import (
    ConflictDetector,
)
from ai.agents.question_planner import (
    QuestionPlanner,
)

from ai.services.langgraph_orchestrator import (
    LangGraphAIOrchestrator,
)

from ai.tests.test_orchestrator import (
    StubLLMGateway,
)


def test_langgraph_ai_orchestrator():

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

    orchestrator = LangGraphAIOrchestrator(
        knowledge_extractor=(
            KnowledgeExtractor(gateway)
        ),
        semantic_aligner=(
            SemanticAligner(gateway)
        ),
        gap_analyzer=(
            GapAnalyzer(gateway)
        ),
        conflict_detector=(
            ConflictDetector(gateway)
        ),
        question_planner=(
            QuestionPlanner(gateway)
        ),
    )

    result = orchestrator.analyze(
        request
    )

    assert len(
        result.knowledge_candidates
    ) == 1

    assert len(result.gaps) == 2

    assert len(result.conflicts) == 1

    assert (
        result.conflicts[0]
        .conflict_type.value
        == "CONDITIONAL_CONFLICT"
    )

    assert result.next_question is not None

    assert (
        result.next_question
        .question_type.value
        == "CONFLICT_RESOLUTION"
    )

    assert (
        "ADR-021"
        in result.next_question.question
    )