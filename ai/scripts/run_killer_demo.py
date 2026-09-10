import json
from pathlib import Path

from shared.schemas.interview import InterviewAnalysisRequest

from ai.agents.knowledge_extractor import KnowledgeExtractor
from ai.agents.semantic_aligner import SemanticAligner
from ai.agents.gap_analyzer import GapAnalyzer
from ai.agents.conflict_detector import ConflictDetector
from ai.agents.question_planner import QuestionPlanner

from ai.services.openai_gateway import OpenAIGateway
from ai.services.orchestrator import AIOrchestrator


def main():
    fixture_path = (
        Path(__file__).resolve().parents[1]
        / "fixtures"
        / "killer_demo_request.json"
    )

    data = json.loads(
        fixture_path.read_text(encoding="utf-8")
    )

    request = InterviewAnalysisRequest.model_validate(data)

    gateway = OpenAIGateway()

    orchestrator = AIOrchestrator(
        knowledge_extractor=KnowledgeExtractor(gateway),
        semantic_aligner=SemanticAligner(gateway),
        gap_analyzer=GapAnalyzer(gateway),
        conflict_detector=ConflictDetector(gateway),
        question_planner=QuestionPlanner(gateway),
    )

    result = orchestrator.analyze(request)

    print("\n===== K-DNA REAL LLM RESULT =====\n")
    print(result.model_dump_json(indent=2))


if __name__ == "__main__":
    main()