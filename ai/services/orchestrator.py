from shared.schemas.interview import (
    InterviewAnalysisRequest,
    InterviewAnalysisResponse,
    SemanticAlignmentRequest,
    GapAnalysisRequest,
    ConflictAnalysisRequest,
    QuestionPlanningRequest,
)


class AIOrchestrator:
    """
    전문가 답변 한 건을 처리하는 K-DNA AI Orchestration.

    Knowledge Extraction
        -> Semantic Alignment
        -> Gap Analysis
        -> Conflict Detection
        -> Question Planning
    """

    def __init__(
        self,
        knowledge_extractor,
        semantic_aligner,
        gap_analyzer,
        conflict_detector,
        question_planner,
    ):
        self.knowledge_extractor = knowledge_extractor
        self.semantic_aligner = semantic_aligner
        self.gap_analyzer = gap_analyzer
        self.conflict_detector = conflict_detector
        self.question_planner = question_planner

    def analyze(
        self,
        request: InterviewAnalysisRequest,
    ) -> InterviewAnalysisResponse:

        # 1. 전문가 답변 -> Atomic Knowledge Candidate
        extraction_result = self.knowledge_extractor.extract(
            request
        )

        all_candidates = extraction_result.knowledge_candidates
        all_gaps = []
        all_conflicts = []
        all_questions = []

        # Candidate가 여러 개 나올 수 있으므로 각각 분석
        for candidate in all_candidates:

            # 2. 기존 Knowledge / Evidence와 의미 관계 분석
            alignment_request = SemanticAlignmentRequest(
                candidate=candidate,
                retrieved_knowledge=request.retrieved_knowledge,
                retrieved_evidence=request.retrieved_evidence,
            )

            alignment_result = self.semantic_aligner.align(
                alignment_request
            )

            # 3. Knowledge Gap 분석
            gap_request = GapAnalysisRequest(
                candidate=candidate,
                mission=request.mission,
                conversation_context=request.conversation_context,
                retrieved_knowledge=request.retrieved_knowledge,
                retrieved_evidence=request.retrieved_evidence,
            )

            gap_result = self.gap_analyzer.analyze(
                gap_request
            )

            all_gaps.extend(gap_result.gaps)

            # 4. Conflict 분석
            conflict_request = ConflictAnalysisRequest(
                candidate=candidate,
                mission=request.mission,
                semantic_relations=alignment_result.relations,
                retrieved_knowledge=request.retrieved_knowledge,
                retrieved_evidence=request.retrieved_evidence,
            )

            conflict_result = self.conflict_detector.detect(
                conflict_request
            )

            all_conflicts.extend(
                conflict_result.conflicts
            )

            # 5. Gap + Conflict 기반 후속 질문 생성
            question_request = QuestionPlanningRequest(
                candidate=candidate,
                mission=request.mission,
                gaps=gap_result.gaps,
                conflicts=conflict_result.conflicts,
                conversation_context=request.conversation_context,
            )

            question_result = self.question_planner.plan(
                question_request
            )

            all_questions.extend(
                question_result.question_candidates
            )

        # 6. 모든 Candidate의 질문 중 가장 높은 점수 선택
        next_question = None

        if all_questions:
            next_question = max(
                all_questions,
                key=lambda question: question.value_score,
            )

        return InterviewAnalysisResponse(
            knowledge_candidates=all_candidates,
            gaps=all_gaps,
            conflicts=all_conflicts,
            question_candidates=all_questions,
            next_question=next_question,
        )