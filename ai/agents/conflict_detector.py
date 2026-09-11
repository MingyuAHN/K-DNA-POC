from shared.schemas.interview import (
    ConflictAnalysisRequest,
    ConflictAnalysisResponse,
    ConflictSource,
)

from ai.services.llm_gateway import LLMGateway
from ai.services.prompt_loader import load_prompt


class ConflictDetector:

    def __init__(self, llm_gateway: LLMGateway):
        self.llm = llm_gateway
        self.system_prompt = load_prompt(
            "conflict_detector.md"
        )

    def detect(
        self,
        request: ConflictAnalysisRequest,
    ) -> ConflictAnalysisResponse:

        candidate = request.candidate

        relations = [
            relation.model_dump(mode="json")
            for relation in request.semantic_relations
        ]

        knowledge = [
            item.model_dump(mode="json")
            for item in request.retrieved_knowledge
        ]

        knowledge_units = [
            item.model_dump(mode="json")
            for item in request.retrieved_knowledge_units
        ]

        evidence = [
            item.model_dump(mode="json")
            for item in request.retrieved_evidence
        ]

        user_prompt = f"""
다음 Knowledge Candidate와 기존 Knowledge/Evidence 사이의
Conflict를 분석하세요.

[Mission]

{request.mission.model_dump_json(indent=2)}


[Knowledge Candidate]

{candidate.model_dump_json(indent=2)}


[Semantic Relations]

{relations}


[Retrieved Baseline Knowledge]

{knowledge}


[Retrieved Existing Knowledge Units]

{knowledge_units}


[Retrieved Evidence]

{evidence}
"""

        result = self.llm.generate_structured(
            system_prompt=self.system_prompt,
            user_prompt=user_prompt,
            response_model=ConflictAnalysisResponse,
        )

        # -----------------------------------------------------
        # Deterministic Source Registry
        #
        # 실제 Retrieval Input에 존재하는 Source만 등록한다.
        #
        # Baseline Claim
        #   → source_type = Knowledge
        #   → source_id = claim_id
        #
        # Existing Knowledge Unit
        #   → source_type = Knowledge
        #   → source_id = knowledge_id
        #
        # Evidence
        #   → source_type = Evidence
        #   → source_id = chunk_id
        # -----------------------------------------------------

        source_registry = {}

        for item in request.retrieved_knowledge:
            source_id = str(item.claim_id)

            source_registry[source_id] = {
                "source_type": "Knowledge",
                "content": item.statement,
            }

        for item in request.retrieved_knowledge_units:
            source_id = str(item.knowledge_id)

            source_registry[source_id] = {
                "source_type": "Knowledge",
                "content": item.statement,
            }

        for item in request.retrieved_evidence:
            source_id = str(item.chunk_id)

            source_registry[source_id] = {
                "source_type": "Evidence",
                "content": item.content,
            }

        # -----------------------------------------------------
        # Semantic CONTRADICTS Source
        #
        # Semantic Alignment에서 실제 Retrieval Source와
        # CONTRADICTS 관계가 확인된 경우 해당 ID를 기록한다.
        #
        # Conflict 자체를 새로 만드는 용도가 아니다.
        # 이미 LLM이 생성한 Conflict의 Provenance를 보강하기 위한
        # deterministic source 정보이다.
        # -----------------------------------------------------

        contradiction_source_ids = []

        for relation in request.semantic_relations:

            relation_value = getattr(
                relation.relation,
                "value",
                relation.relation,
            )

            if relation_value != "CONTRADICTS":
                continue

            target_id = str(
                relation.target_id
            )

            if target_id not in source_registry:
                print(
                    "[CONFLICT-SOURCE-GUARD] "
                    "skip CONTRADICTS target not found "
                    "in retrieval input: "
                    f"{target_id}",
                    flush=True,
                )
                continue

            if target_id not in contradiction_source_ids:
                contradiction_source_ids.append(
                    target_id
                )

        # -----------------------------------------------------
        # Deterministic Conflict Source Guard
        #
        # 1. LLM이 반환한 Source ID가 실제 Input Source인지 검증
        # 2. source_type/content를 원본 Input 기준으로 정규화
        # 3. 임의 생성 ID(candidate 등) 제거
        # 4. Semantic CONTRADICTS Source가 빠졌다면 복원
        # 5. 한 Candidate 안의 동일 Conflict 중복 제거
        # -----------------------------------------------------

        guarded_conflicts = []
        seen_conflicts = set()

        for conflict in result.conflicts:

            guarded_sources = []
            seen_sources = set()

            # -------------------------------------------------
            # LLM이 반환한 Source 검증
            # -------------------------------------------------

            for source in conflict.sources:

                source_id = str(
                    source.source_id
                )

                registered_source = (
                    source_registry.get(
                        source_id
                    )
                )

                if registered_source is None:
                    print(
                        "[CONFLICT-SOURCE-GUARD] "
                        "skip unknown source_id: "
                        f"{source_id}",
                        flush=True,
                    )
                    continue

                expected_source_type = (
                    registered_source[
                        "source_type"
                    ]
                )

                source_key = (
                    expected_source_type,
                    source_id,
                )

                if source_key in seen_sources:
                    continue

                seen_sources.add(
                    source_key
                )

                # ID뿐 아니라 source_type/content도
                # 실제 Retrieval Input을 기준으로 정규화한다.
                guarded_sources.append(
                    source.model_copy(
                        update={
                            "source_type":
                                expected_source_type,
                            "source_id":
                                source_id,
                            "content":
                                registered_source[
                                    "content"
                                ],
                        }
                    )
                )

            # -------------------------------------------------
            # Semantic Alignment에서 CONTRADICTS인데
            # LLM Conflict Source에서 빠진 실제 Source 복원
            # -------------------------------------------------

            for source_id in contradiction_source_ids:

                registered_source = (
                    source_registry[source_id]
                )

                expected_source_type = (
                    registered_source[
                        "source_type"
                    ]
                )

                source_key = (
                    expected_source_type,
                    source_id,
                )

                if source_key in seen_sources:
                    continue

                seen_sources.add(
                    source_key
                )

                guarded_sources.append(
                    ConflictSource(
                        source_type=(
                            expected_source_type
                        ),
                        source_id=source_id,
                        content=(
                            registered_source[
                                "content"
                            ]
                        ),
                    )
                )

                print(
                    "[CONFLICT-SOURCE-ALIGN] "
                    "add CONTRADICTS source: "
                    f"type={expected_source_type}, "
                    f"id={source_id}",
                    flush=True,
                )

            # -------------------------------------------------
            # Persist 가능한 실제 Source가 하나도 없으면 제거
            # -------------------------------------------------

            if not guarded_sources:
                print(
                    "[CONFLICT-SOURCE-GUARD] "
                    "skip conflict because "
                    "no valid source remains",
                    flush=True,
                )
                continue

            # -------------------------------------------------
            # Candidate 단위 Conflict Dedup
            #
            # 같은 Conflict Type + 같은 Source 집합이면
            # 동일 Conflict로 간주한다.
            # -------------------------------------------------

            conflict_type = getattr(
                conflict.conflict_type,
                "value",
                conflict.conflict_type,
            )

            conflict_key = (
                str(conflict_type),
                tuple(
                    sorted(
                        (
                            str(
                                source.source_type
                            ),
                            str(
                                source.source_id
                            ),
                        )
                        for source
                        in guarded_sources
                    )
                ),
            )

            if conflict_key in seen_conflicts:
                print(
                    "[CONFLICT-DEDUP] "
                    "skip duplicate conflict: "
                    f"{conflict_key}",
                    flush=True,
                )
                continue

            seen_conflicts.add(
                conflict_key
            )

            guarded_conflicts.append(
                conflict.model_copy(
                    update={
                        "sources":
                            guarded_sources
                    }
                )
            )

        return result.model_copy(
            update={
                "conflicts":
                    guarded_conflicts
            }
        )