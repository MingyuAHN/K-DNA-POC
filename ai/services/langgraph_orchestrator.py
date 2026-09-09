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
# Question quality policy
# ---------------------------------------------------------

QUESTION_SIMILARITY_THRESHOLD = 0.82


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

        # Knowledge Candidate가 전혀 없는 예외 상황
        if not candidates:
            print(
                "[QUESTION] "
                "no knowledge candidates"
            )

            return {
                "question_candidates": [],
                "next_question": None,
            }

        # -----------------------------------------------------
        # 1. 높은 Gap Score 순으로 정렬
        # -----------------------------------------------------

        ranked_gaps = sorted(
            state.get(
                "reduced_gaps",
                [],
            ),
            key=lambda gap: gap.gap_score,
            reverse=True,
        )

        # -----------------------------------------------------
        # 2. 가장 중요한 Knowledge Candidate 선택
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
            gaps=ranked_gaps,
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

        # Question Candidate 내부 중복 제거 + Top 3
        questions = select_questions(
            result.question_candidates
        )

        # Question Planner 자체가 질문을 생성하지 못한
        # 예외적인 경우에만 null
        if not questions:
            print(
                "[QUESTION] "
                "no question candidates generated"
            )

            return {
                "question_candidates": [],
                "next_question": None,
            }

        # -----------------------------------------------------
        # 3. 이전 AI 질문 수집
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
        # 4. 이전 질문과 의미적으로 유사한 질문 제외
        #
        # 이 로직은 인터뷰 종료용이 아니라
        # 반복 질문 방지용이다.
        # -----------------------------------------------------

        non_repeated_questions = []

        for question in questions:
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

            non_repeated_questions.append(
                question
            )

        # -----------------------------------------------------
        # 5. 새로운 질문이 있으면 우선 사용
        # -----------------------------------------------------

        if non_repeated_questions:
            final_questions = (
                non_repeated_questions[:3]
            )

        # -----------------------------------------------------
        # 6. 모든 질문이 이전 질문과 유사하더라도
        #    자동 종료하지 않는다.
        #
        # Question Planner가 반환한 질문 중
        # 가장 가치가 높은 질문을 fallback으로 사용한다.
        # -----------------------------------------------------

        else:
            final_questions = questions[:3]

            print(
                "[QUESTION-FALLBACK] "
                "all candidates were similar; "
                "using highest-value question"
            )

        # -----------------------------------------------------
        # 7. 가장 가치 높은 질문을 next_question으로 선택
        # -----------------------------------------------------

        next_question = final_questions[0]

        print(
            "[NEXT-QUESTION] "
            f"value_score="
            f"{next_question.value_score:.3f}, "
            f"previous_ai_questions="
            f"{len(previous_ai_questions)}"
        )

        return {
            "question_candidates":
                final_questions,
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