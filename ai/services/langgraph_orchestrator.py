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
)

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

    # 1. Knowledge Extraction
    def _knowledge_extract(
        self,
        state: KDNAState,
    ):
        request = state["request"]

        result = self.knowledge_extractor.extract(
            request
        )

        return {
            "knowledge_candidates":
                select_knowledge_candidates(
                    result.knowledge_candidates
                )
        }

    # 2. Semantic Alignment
    def _semantic_align(
        self,
        state: KDNAState,
    ):
        request = state["request"]

        relations_by_candidate = []

        for candidate in state.get(
            "knowledge_candidates",
            [],
        ):
            alignment_request = SemanticAlignmentRequest(
                candidate=candidate,
                retrieved_knowledge=request.retrieved_knowledge,
                retrieved_evidence=request.retrieved_evidence,
            )

            result = self.semantic_aligner.align(
                alignment_request
            )

            relations_by_candidate.append(
                result.relations
            )

        return {
            "semantic_relations_by_candidate":
                relations_by_candidate
        }

    # 3. Gap Analysis
    def _gap_analyze(
        self,
        state: KDNAState,
    ):
        request = state["request"]

        gaps_by_candidate = []

        for candidate in state.get(
            "knowledge_candidates",
            [],
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

            result = self.gap_analyzer.analyze(
                gap_request
            )

            gaps_by_candidate.append(
                result.gaps
            )

        return {
            "gaps_by_candidate":
                gaps_by_candidate
        }

    # 4. Conflict Detection
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

            result = self.conflict_detector.detect(
                conflict_request
            )

            conflicts_by_candidate.append(
                result.conflicts
            )

        return {
            "conflicts_by_candidate":
                conflicts_by_candidate
        }

    # 5. Gap / Conflict Dedup & Top-K
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

        return {
            "reduced_gaps": deduplicate_gaps(
                all_gaps
            ),
            "reduced_conflicts": select_conflicts(
                all_conflicts
            ),
        }

    # 6. Question Planning
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
            return {
                "question_candidates": [],
                "next_question": None,
            }

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

        result = self.question_planner.plan(
            question_request
        )

        questions = select_questions(
            result.question_candidates
        )

        next_question = (
            questions[0]
            if questions
            else None
        )

        return {
            "question_candidates": questions,
            "next_question": next_question,
        }

    # 7. Final Response
    def _finalize(
        self,
        state: KDNAState,
    ):
        all_gaps = [
            gap
            for gaps in state.get(
                "gaps_by_candidate",
                [],
            )
            for gap in gaps
        ]

        all_conflicts = [
            conflict
            for conflicts in state.get(
                "conflicts_by_candidate",
                [],
            )
            for conflict in conflicts
        ]

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
            "question_plan",
            self._question_plan,
        )

        builder.add_node(
            "finalize",
            self._finalize,
        )

        builder.add_node(
            "reduce_results",
            self._reduce_results,
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

    def analyze(
        self,
        request: InterviewAnalysisRequest,
    ) -> InterviewAnalysisResponse:

        state = self.graph.invoke(
            {
                "request": request
            }
        )

        return state["response"]