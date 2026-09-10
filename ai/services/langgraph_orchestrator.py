import time
from concurrent.futures import ThreadPoolExecutor, as_completed
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


# Candidate는 postprocessor에서 최대 3개로 제한하고 있으므로
# 외부 LLM 호출도 최대 3개까지만 동시에 실행한다.
MAX_PARALLEL_CANDIDATES = 3

# 자동 종료 용도가 아니라 "같은 질문을 또 하지 않기" 위한 기준이다.
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
    # Parallel helper
    # ---------------------------------------------------------

    @staticmethod
    def _parallel_map(
        stage_name: str,
        items: list,
        worker,
    ) -> list:
        """
        Candidate별 독립적인 외부 LLM 호출을 병렬 실행한다.

        주의:
        - future 완료 순서와 Candidate 순서는 다를 수 있다.
        - 결과를 index 위치에 다시 넣어서 입력 Candidate 순서를 보존한다.
        - 하나의 작업이라도 예외가 발생하면 해당 요청 전체를 실패시킨다.
          기존 순차 실행과 동일한 fail-fast 성격을 유지한다.
        """
        if not items:
            return []

        worker_count = min(
            MAX_PARALLEL_CANDIDATES,
            len(items),
        )

        results = [None] * len(items)

        stage_start = time.perf_counter()

        with ThreadPoolExecutor(
            max_workers=worker_count,
            thread_name_prefix=f"kdna-{stage_name}",
        ) as executor:
            future_to_index = {
                executor.submit(
                    worker,
                    index,
                    item,
                ): index
                for index, item in enumerate(items)
            }

            for future in as_completed(
                future_to_index
            ):
                index = future_to_index[future]

                try:
                    results[index] = future.result()
                except Exception as exc:
                    print(
                        f"[ERROR] {stage_name} "
                        f"candidate={index}: "
                        f"{type(exc).__name__}: {exc}",
                        flush=True,
                    )
                    raise

        stage_elapsed = (
            time.perf_counter()
            - stage_start
        )

        print(
            f"[PERF] {stage_name} parallel_total: "
            f"{stage_elapsed:.2f}s "
            f"(workers={worker_count}, "
            f"candidates={len(items)})",
            flush=True,
        )

        return results

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
            f"{elapsed:.2f}s",
            flush=True,
        )

        candidates = select_knowledge_candidates(
            result.knowledge_candidates
        )

        print(
            f"[RESULT] knowledge_candidates="
            f"{len(candidates)}",
            flush=True,
        )

        return {
            "knowledge_candidates": candidates
        }

    # ---------------------------------------------------------
    # 2. Semantic Alignment - Candidate 병렬화
    # ---------------------------------------------------------

    def _semantic_align(
        self,
        state: KDNAState,
    ):
        request = state["request"]
        candidates = state.get(
            "knowledge_candidates",
            [],
        )

        def run_one(
            index: int,
            candidate: KnowledgeCandidate,
        ):
            alignment_request = (
                SemanticAlignmentRequest(
                    candidate=candidate,
                    retrieved_knowledge=(
                        request.retrieved_knowledge
                    ),
                    retrieved_evidence=(
                        request.retrieved_evidence
                    ),
                )
            )

            start = time.perf_counter()

            result = self.semantic_aligner.align(
                alignment_request
            )

            elapsed = (
                time.perf_counter()
                - start
            )

            print(
                f"[PERF] semantic_align "
                f"candidate={index}: "
                f"{elapsed:.2f}s",
                flush=True,
            )

            return result.relations

        relations_by_candidate = (
            self._parallel_map(
                stage_name="semantic_align",
                items=candidates,
                worker=run_one,
            )
        )

        return {
            "semantic_relations_by_candidate":
                relations_by_candidate
        }

    # ---------------------------------------------------------
    # 3. Gap Analysis - Candidate 병렬화
    # ---------------------------------------------------------

    def _gap_analyze(
        self,
        state: KDNAState,
    ):
        request = state["request"]
        candidates = state.get(
            "knowledge_candidates",
            [],
        )

        def run_one(
            index: int,
            candidate: KnowledgeCandidate,
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

            elapsed = (
                time.perf_counter()
                - start
            )

            print(
                f"[PERF] gap_analyze "
                f"candidate={index}: "
                f"{elapsed:.2f}s",
                flush=True,
            )

            return result.gaps

        gaps_by_candidate = (
            self._parallel_map(
                stage_name="gap_analyze",
                items=candidates,
                worker=run_one,
            )
        )

        return {
            "gaps_by_candidate":
                gaps_by_candidate
        }

    # ---------------------------------------------------------
    # 4. Conflict Detection - Candidate 병렬화
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

        def run_one(
            index: int,
            candidate: KnowledgeCandidate,
        ):
            relations = (
                relations_by_candidate[index]
                if index
                < len(relations_by_candidate)
                else []
            )

            conflict_request = (
                ConflictAnalysisRequest(
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
            )

            start = time.perf_counter()

            result = (
                self.conflict_detector.detect(
                    conflict_request
                )
            )

            elapsed = (
                time.perf_counter()
                - start
            )

            print(
                f"[PERF] conflict_detect "
                f"candidate={index}: "
                f"{elapsed:.2f}s",
                flush=True,
            )

            return result.conflicts

        conflicts_by_candidate = (
            self._parallel_map(
                stage_name="conflict_detect",
                items=candidates,
                worker=run_one,
            )
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
            f"{len(reduced_gaps)}",
            flush=True,
        )

        print(
            f"[RESULT] conflicts "
            f"{len(all_conflicts)} -> "
            f"{len(reduced_conflicts)}",
            flush=True,
        )

        return {
            "reduced_gaps":
                reduced_gaps,
            "reduced_conflicts":
                reduced_conflicts,
        }

    # ---------------------------------------------------------
    # 6. Question Planning
    #
    # 인터뷰 자동 종료 정책 없음.
    # 인터뷰 종료는 Front/Backend의 사용자 종료 동작이 담당한다.
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

        reduced_gaps = state.get(
            "reduced_gaps",
            [],
        )

        reduced_conflicts = state.get(
            "reduced_conflicts",
            [],
        )

        # 분석 가능한 Knowledge Candidate 자체가 없는 예외 상황
        if not candidates:
            print(
                "[QUESTION] "
                "no knowledge candidates",
                flush=True,
            )

            return {
                "question_candidates": [],
                "next_question": None,
            }

        previous_ai_questions = []

        for message in (
            request.conversation_context
        ):
            speaker = getattr(
                message.speaker,
                "value",
                message.speaker,
            )

            if (
                str(speaker).upper()
                == "AI"
            ):
                previous_ai_questions.append(
                    message.content
                )

        ranked_gaps = sorted(
            reduced_gaps,
            key=lambda gap:
                gap.gap_score,
            reverse=True,
        )

        primary_candidate = max(
            candidates,
            key=lambda item: (
                item.confidence_score,
                item.novelty_score,
            ),
        )

        question_request = (
            QuestionPlanningRequest(
                candidate=primary_candidate,
                mission=request.mission,
                gaps=ranked_gaps,
                conflicts=reduced_conflicts,
                conversation_context=(
                    request.conversation_context[-8:]
                ),
            )
        )

        start = time.perf_counter()

        result = self.question_planner.plan(
            question_request
        )

        elapsed = (
            time.perf_counter()
            - start
        )

        print(
            f"[PERF] question_plan: "
            f"{elapsed:.2f}s",
            flush=True,
        )

        questions = select_questions(
            result.question_candidates
        )

        # Planner가 질문을 생성하지 못한 예외 상황
        if not questions:
            print(
                "[QUESTION] "
                "planner returned no questions",
                flush=True,
            )

            return {
                "question_candidates": [],
                "next_question": None,
            }

        # 이전 AI 질문과 너무 유사한 질문은 우선 제외한다.
        # 단, 전부 유사하더라도 인터뷰를 자동 종료하지 않고
        # 가장 가치가 높은 질문을 fallback으로 선택한다.
        eligible_questions = []

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
                    f"{question.question}",
                    flush=True,
                )
                continue

            eligible_questions.append(
                question
            )

        if eligible_questions:
            final_questions = (
                eligible_questions[:3]
            )

            next_question = (
                final_questions[0]
            )
        else:
            # 자동 종료하지 않는다.
            # 모든 후보가 기존 질문과 유사할 경우
            # 현재 후보 중 value_score가 가장 높은 질문 사용.
            fallback_question = max(
                questions,
                key=lambda item:
                    item.value_score,
            )

            final_questions = (
                questions[:3]
            )

            next_question = (
                fallback_question
            )

            print(
                "[QUESTION-FALLBACK] "
                "all questions similar; "
                "using highest-value question",
                flush=True,
            )

        print(
            "[NEXT-QUESTION] "
            f"value_score="
            f"{next_question.value_score:.3f}, "
            f"previous_ai_questions="
            f"{len(previous_ai_questions)}",
            flush=True,
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

        # Stage-level parallelization:
        #
        #                    ┌─ gap_analyze ───────────────┐
        # knowledge_extract ─┤                            ├─ reduce_results
        #                    └─ semantic_align ─ conflict ┘
        #
        # Gap Analysis는 Semantic Alignment 결과에 의존하지 않으므로
        # Knowledge Extraction 직후 동시에 시작할 수 있다.
        # Conflict Detection만 Semantic Alignment 결과를 기다린다.
        #
        # list 형태의 start nodes를 사용해 gap_analyze와
        # conflict_detect가 모두 완료된 뒤 reduce_results를 실행한다.

        builder.add_edge(
            "knowledge_extract",
            "semantic_align",
        )

        builder.add_edge(
            "knowledge_extract",
            "gap_analyze",
        )

        builder.add_edge(
            "semantic_align",
            "conflict_detect",
        )

        builder.add_edge(
            [
                "gap_analyze",
                "conflict_detect",
            ],
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
            f"{total_elapsed:.2f}s",
            flush=True,
        )

        return result["response"]
