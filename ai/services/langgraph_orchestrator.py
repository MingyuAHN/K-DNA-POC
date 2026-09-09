import time
from typing import TypedDict

from langgraph.graph import StateGraph, START, END

from shared.schemas.interview import (
    InterviewAnalysisRequest,
    InterviewAnalysisResponse,
    KnowledgeCandidate,
    SemanticRelation,
    KnowledgeGap,
    ConflictResult,
    QuestionCandidate,
    SemanticAlignmentRequest,
    GapAnalysisRequest,
    ConflictAnalysisRequest,
    QuestionPlanningRequest,
)

from ai.services.result_postprocessor import (
    select_knowledge_candidates,
    deduplicate_gaps,
    select_conflicts,
    select_questions,
    is_similar_text,
)


# ---------------------------------------------------------
# Interview termination policy
# ---------------------------------------------------------

MIN_NOVELTY_SCORE = 0.20
QUESTION_SIMILARITY_THRESHOLD = 0.82


def _get_question_threshold(
    previous_ai_question_count: int,
) -> float:
    """
    인터뷰가 진행될수록 더 높은 가치의 질문만 허용한다.
    """

    if previous_ai_question_count >= 4:
        return 0.90

    if previous_ai_question_count >= 3:
        return 0.85

    if previous_ai_question_count >= 2:
        return 0.80

    if previous_ai_question_count >= 1:
        return 0.65

    return 0.60


class KDNAState(TypedDict, total=False):
    request: InterviewAnalysisRequest

    knowledge_candidates: list[KnowledgeCandidate]

    semantic_relations_by_candidate: list[
        list[SemanticRelation]
    ]

    gaps_by_candidate: list[
        list[KnowledgeGap]
    ]

    conflicts_by_candidate: list[
        list[ConflictResult]
    ]

    reduced_gaps: list[KnowledgeGap]
    reduced_conflicts: list[ConflictResult]

    question_candidates: list[QuestionCandidate]

    next_question: QuestionCandidate | None

    response: InterviewAnalysisResponse


class LangGraphAIOrchestrator:

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

        self.graph = self._build_graph()

    # ---------------------------------------------------------
    # 1. Knowledge Extraction
    # ---------------------------------------------------------

    def _knowledge_extract(
        self,
        state: KDNAState,
    ):
        request = state["request"]

        start = time.perf_counter()

        result = self.knowledge_extractor.extract(
            request
        )

        elapsed = time.perf_counter() - start

        print(
            f"[PERF] knowledge_extract: "
            f"{elapsed:.2f}s"
        )

        candidates = select_knowledge_candidates(
            result.knowledge_candidates
        )

        print(
            f"[RESULT] knowledge_candidates="
            f"{len(candidates)}"
        )

        return {
            "knowledge_candidates": candidates
        }

    # ---------------------------------------------------------
    # 2. Semantic Alignment
    # ---------------------------------------------------------

    def _semantic_align(
        self,
        state: KDNAState,
    ):
        request = state["request"]

        relations_by_candidate = []

        for index, candidate in enumerate(
            state.get(
                "knowledge_candidates",
                [],
            )
        ):
            alignment_request = SemanticAlignmentRequest(
                candidate=candidate,
                retrieved_knowledge=(
                    request.retrieved_knowledge
                ),
                retrieved_evidence=(
                    request.retrieved_evidence
                ),
            )

            start = time.perf_counter()

            result = self.semantic_aligner.align(
                alignment_request
            )

            elapsed = time.perf_counter() - start

            print(
                f"[PERF] semantic_align "
                f"candidate={index}: "
                f"{elapsed:.2f}s"
            )

            relations_by_candidate.append(
                result.relations
            )

        return {
            "semantic_relations_by_candidate":
                relations_by_candidate
        }

    # ---------------------------------------------------------
    # 3. Gap Analysis
    # ---------------------------------------------------------

    def _gap_analyze(
        self,
        state: KDNAState,
    ):
        request = state["request"]

        gaps_by_candidate = []

        for index, candidate in enumerate(
            state.get(
                "knowledge_candidates",
                [],
            )
        ):
            gap_request = GapAnalysisRequest(
                candidate=candidate,
                mission=request.mission,
                conversation_context=(
                    request.conversation_context
                ),
                retrieved_knowledge=(
                    request.retrieved_knowledge
                ),
                retrieved_evidence=(
                    request.retrieved_evidence
                ),
            )

            start = time.perf_counter()

            result = self.gap_analyzer.analyze(
                gap_request
            )

            elapsed = time.perf_counter() - start

            print(
                f"[PERF] gap_analyze "
                f"candidate={index}: "
                f"{elapsed:.2f}s"
            )

            gaps_by_candidate.append(
                result.gaps
            )

        return {
            "gaps_by_candidate":
                gaps_by_candidate
        }

    # ---------------------------------------------------------
    # 4. Conflict Detection
    # ---------------------------------------------------------

    def _conflict_detect(
        self,
        state: KDNAState,
    ):
        request = state["request"]

        candidates = state.get(
            "knowledge_candidates",
            [],
        )

        relations_by_candidate = state.get(
            "semantic_relations_by_candidate",
            [],
        )

        conflicts_by_candidate = []

        for index, candidate in enumerate(
            candidates
        ):
            relations = (
                relations_by_candidate[index]
                if index < len(relations_by_candidate)
                else []
            )

            conflict_request = ConflictAnalysisRequest(
                candidate=candidate,
                mission=request.mission,
                semantic_relations=relations,
                retrieved_knowledge=(
                    request.retrieved_knowledge
                ),
                retrieved_evidence=(
                    request.retrieved_evidence
                ),
            )

            start = time.perf_counter()

            result = self.conflict_detector.detect(
                conflict_request
            )

            elapsed = time.perf_counter() - start

            print(
                f"[PERF] conflict_detect "
                f"candidate={index}: "
                f"{elapsed:.2f}s"
            )

            conflicts_by_candidate.append(
                result.conflicts
            )

        return {
            "conflicts_by_candidate":
                conflicts_by_candidate
        }

    # ---------------------------------------------------------
    # 5. Gap / Conflict Dedup & Top-K
    # ---------------------------------------------------------

    def _reduce_results(
        self,
        state: KDNAState,
    ):
        all_gaps = [
            gap
            for candidate_gaps in state.get(
                "gaps_by_candidate",
                [],
            )
            for gap in candidate_gaps
        ]

        all_conflicts = [
            conflict
            for candidate_conflicts in state.get(
                "conflicts_by_candidate",
                [],
            )
            for conflict in candidate_conflicts
        ]

        reduced_gaps = deduplicate_gaps(
            all_gaps
        )

        reduced_conflicts = select_conflicts(
            all_conflicts
        )

        print(
            f"[RESULT] gaps "
            f"{len(all_gaps)} -> "
            f"{len(reduced_gaps)}"
        )

        print(
            f"[RESULT] conflicts "
            f"{len(all_conflicts)} -> "
            f"{len(reduced_conflicts)}"
        )

        return {
            "reduced_gaps":
                reduced_gaps,
            "reduced_conflicts":
                reduced_conflicts,
        }

    # ---------------------------------------------------------
    # 6. Question Planning
    # ---------------------------------------------------------

    def _question_plan(
        self,
        state: KDNAState,
    ):
        request = state["request"]

        candidates = state.get(
            "knowledge_candidates",
            [],
        )

        if not candidates:
            print(
                "[INTERVIEW-END] "
                "no knowledge candidates"
            )

            return {
                "question_candidates": [],
                "next_question": None,
            }

        # -----------------------------------------------------
        # 1. Novelty 기반 종료
        # -----------------------------------------------------

        max_novelty = max(
            (
                candidate.novelty_score
                for candidate in candidates
            ),
            default=0.0,
        )

        if max_novelty < MIN_NOVELTY_SCORE:
            print(
                "[INTERVIEW-END] "
                f"low novelty: "
                f"{max_novelty:.2f}"
            )

            return {
                "question_candidates": [],
                "next_question": None,
            }

        # -----------------------------------------------------
        # 2. 기존 AI 질문 수집
        # -----------------------------------------------------

        previous_ai_questions = []

        for message in request.conversation_context:
            speaker = getattr(
                message.speaker,
                "value",
                message.speaker,
            )

            if str(speaker).upper() == "AI":
                previous_ai_questions.append(
                    message.content
                )

        # -----------------------------------------------------
        # 3. 턴 진행도에 따른 동적 Threshold
        # -----------------------------------------------------

        question_threshold = (
            _get_question_threshold(
                len(previous_ai_questions)
            )
        )

        print(
            "[QUESTION-THRESHOLD] "
            f"previous_ai_questions="
            f"{len(previous_ai_questions)}, "
            f"threshold="
            f"{question_threshold:.2f}"
        )

        # -----------------------------------------------------
        # 4. 대표 Knowledge Candidate 선택
        # -----------------------------------------------------

        primary_candidate = max(
            candidates,
            key=lambda item: (
                item.confidence_score,
                item.novelty_score,
            ),
        )

        question_request = QuestionPlanningRequest(
            candidate=primary_candidate,
            mission=request.mission,
            gaps=state.get(
                "reduced_gaps",
                [],
            ),
            conflicts=state.get(
                "reduced_conflicts",
                [],
            ),
            conversation_context=(
                request.conversation_context[-8:]
            ),
        )

        start = time.perf_counter()

        result = self.question_planner.plan(
            question_request
        )

        elapsed = time.perf_counter() - start

        print(
            f"[PERF] question_plan: "
            f"{elapsed:.2f}s"
        )

        # Top 3 + 질문 자체 중복 제거
        questions = select_questions(
            result.question_candidates
        )

        if not questions:
            print(
                "[INTERVIEW-END] "
                "no question candidates"
            )

            return {
                "question_candidates": [],
                "next_question": None,
            }

        # -----------------------------------------------------
        # 5. Value Score + 기존 질문 반복 여부 필터
        # -----------------------------------------------------

        eligible_questions = []

        for question in questions:

            # 현재 턴 Threshold 미달
            if (
                question.value_score
                < question_threshold
            ):
                print(
                    "[QUESTION-SKIP] "
                    f"low value_score="
                    f"{question.value_score:.3f} "
                    f"< threshold="
                    f"{question_threshold:.2f}"
                )

                continue

            # 기존 AI 질문과 유사한 질문인지 확인
            repeated = any(
                is_similar_text(
                    question.question,
                    previous_question,
                    threshold=(
                        QUESTION_SIMILARITY_THRESHOLD
                    ),
                )
                for previous_question
                in previous_ai_questions
            )

            if repeated:
                print(
                    "[QUESTION-SKIP] "
                    "similar to previous question: "
                    f"{question.question}"
                )

                continue

            eligible_questions.append(
                question
            )

        # -----------------------------------------------------
        # 6. 유효 질문이 없으면 종료
        # -----------------------------------------------------

        if not eligible_questions:
            best_score = max(
                (
                    question.value_score
                    for question in questions
                ),
                default=0.0,
            )

            print(
                "[INTERVIEW-END] "
                "no valuable/non-repeated "
                "question "
                f"(best_score="
                f"{best_score:.3f}, "
                f"threshold="
                f"{question_threshold:.2f})"
            )

            return {
                "question_candidates": [],
                "next_question": None,
            }

        # -----------------------------------------------------
        # 7. 최종 Top 3
        # -----------------------------------------------------

        eligible_questions = (
            eligible_questions[:3]
        )

        next_question = (
            eligible_questions[0]
        )

        print(
            "[NEXT-QUESTION] "
            f"value_score="
            f"{next_question.value_score:.3f}, "
            f"threshold="
            f"{question_threshold:.2f}"
        )

        return {
            "question_candidates":
                eligible_questions,
            "next_question":
                next_question,
        }

    # ---------------------------------------------------------
    # 7. Final Response
    # ---------------------------------------------------------

    def _finalize(
        self,
        state: KDNAState,
    ):
        response = InterviewAnalysisResponse(
            knowledge_candidates=state.get(
                "knowledge_candidates",
                [],
            ),
            gaps=state.get(
                "reduced_gaps",
                [],
            ),
            conflicts=state.get(
                "reduced_conflicts",
                [],
            ),
            question_candidates=state.get(
                "question_candidates",
                [],
            ),
            next_question=state.get(
                "next_question"
            ),
        )

        return {
            "response": response
        }

    # ---------------------------------------------------------
    # Graph
    # ---------------------------------------------------------

    def _build_graph(self):
        builder = StateGraph(KDNAState)

        builder.add_node(
            "knowledge_extract",
            self._knowledge_extract,
        )

        builder.add_node(
            "semantic_align",
            self._semantic_align,
        )

        builder.add_node(
            "gap_analyze",
            self._gap_analyze,
        )

        builder.add_node(
            "conflict_detect",
            self._conflict_detect,
        )

        builder.add_node(
            "reduce_results",
            self._reduce_results,
        )

        builder.add_node(
            "question_plan",
            self._question_plan,
        )

        builder.add_node(
            "finalize",
            self._finalize,
        )

        builder.add_edge(
            START,
            "knowledge_extract",
        )

        builder.add_edge(
            "knowledge_extract",
            "semantic_align",
        )

        builder.add_edge(
            "semantic_align",
            "gap_analyze",
        )

        builder.add_edge(
            "gap_analyze",
            "conflict_detect",
        )

        builder.add_edge(
            "conflict_detect",
            "reduce_results",
        )

        builder.add_edge(
            "reduce_results",
            "question_plan",
        )

        builder.add_edge(
            "question_plan",
            "finalize",
        )

        builder.add_edge(
            "finalize",
            END,
        )

        return builder.compile()

    # ---------------------------------------------------------
    # Public Analyze
    # ---------------------------------------------------------

    def analyze(
        self,
        request: InterviewAnalysisRequest,
    ):
        total_start = time.perf_counter()

        result = self.graph.invoke(
            {
                "request": request
            }
        )

        total_elapsed = (
            time.perf_counter()
            - total_start
        )

        print(
            f"[PERF] TOTAL interview_analyze: "
            f"{total_elapsed:.2f}s"
        )

        return result["response"]