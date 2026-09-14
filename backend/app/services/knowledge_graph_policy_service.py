"""
Central Knowledge Graph policy layer.

AI synthesis operations are proposals, not database commands.  This module
translates the proposal into a small set of canonical apply actions and
applies the same invariants regardless of whether the AI returned MERGE,
ENRICH, SUPERSEDE, SPLIT_BY_CONTEXT, ADD_EXCEPTION, or KEEP_CONFLICT.
"""

from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher
from enum import Enum
import re
import uuid
from types import SimpleNamespace
from typing import Any

from sqlalchemy.orm import Session

from app.models.interview_analysis import KnowledgeCandidate
from app.models.knowledge_core import KnowledgeUnit
from app.models.knowledge_synthesis import (
    KnowledgeSynthesis,
    KnowledgeSynthesisRelation,
    KnowledgeSynthesisUnit,
)
from app.services.knowledge_duplicate_service import (
    DuplicateKnowledgeMatch,
    MaterialChangeAssessment,
    assess_synthesized_unit_material_change,
    find_duplicate_active_knowledge,
)


SUPPORTED_SYNTHESIS_OPERATIONS = {
    "MERGE",
    "ENRICH",
    "SUPERSEDE",
    "ADD_EXCEPTION",
    "SPLIT_BY_CONTEXT",
    "KEEP_CONFLICT",
}

VERSION_OPERATIONS = {
    "ENRICH",
    "SUPERSEDE",
}

EXCEPTION_PARENT_TYPES = {
    "PRINCIPLE",
    "DECISION_RULE",
}

ATOMIC_IDENTITY_CONTEXT_KEYS = (
    "project",
    "domain",
    "system",
    "scope",
    "phase",
    "time",
)


class GraphApplyAction(str, Enum):
    """Canonical database actions understood by the apply service."""

    REUSE_EXISTING = "REUSE_EXISTING"
    REUSE_TARGET = "REUSE_TARGET"
    CREATE_NEW = "CREATE_NEW"
    CREATE_VERSION = "CREATE_VERSION"


class KnowledgeGraphPolicyViolation(ValueError):
    """The synthesis snapshot violates a backend graph invariant."""


@dataclass(frozen=True)
class AtomicVersionIdentityAssessment:
    """Whether Candidate and target represent the same atomic knowledge slot."""

    same_atomic_unit: bool
    reason: str
    conflicting_context_key: str | None = None


def _normalize_identity_text(value: Any) -> str | None:
    if value is None:
        return None

    text = str(value).strip().lower()
    if not text:
        return None

    return " ".join(
        re.findall(r"[A-Za-z0-9가-힣_]+", text)
    )


def _identity_context_values_match(
    left: Any,
    right: Any,
) -> bool:
    left_text = _normalize_identity_text(left)
    right_text = _normalize_identity_text(right)

    if left_text is None or right_text is None:
        return True

    if left_text == right_text:
        return True

    left_compact = left_text.replace(" ", "")
    right_compact = right_text.replace(" ", "")

    # Small wording expansions such as "읽기 조회" -> "직접 읽기 조회"
    # remain the same atomic context.
    shorter = min(len(left_compact), len(right_compact))
    if (
        shorter >= 3
        and (
            left_compact in right_compact
            or right_compact in left_compact
        )
    ):
        return True

    left_tokens = set(left_text.split())
    right_tokens = set(right_text.split())

    if left_tokens and right_tokens:
        overlap = len(left_tokens & right_tokens)
        containment = overlap / min(
            len(left_tokens),
            len(right_tokens),
        )
        if containment >= 0.6:
            return True

    return (
        SequenceMatcher(
            None,
            left_text,
            right_text,
        ).ratio()
        >= 0.72
    )


def assess_atomic_version_identity(
    candidate: KnowledgeCandidate,
    target: KnowledgeUnit,
) -> AtomicVersionIdentityAssessment:
    """
    Decide whether a same-type Candidate is eligible to become a new version
    of ``target``.

    Same ``knowledge_type`` is necessary but not sufficient.  A version chain
    must keep the same atomic context.  A Candidate about a different scope,
    phase, system, or time is independent knowledge even when the AI proposes
    ENRICH/SUPERSEDE.

    This is intentionally based on the original Candidate rather than the AI
    synthesized proposal: a proposal may already have merged the target text
    into a new mega-knowledge unit, which must not be used as evidence that the
    two atoms were the same.
    """

    if candidate.knowledge_type != target.knowledge_type:
        return AtomicVersionIdentityAssessment(
            same_atomic_unit=False,
            reason=(
                "knowledge_type differs: "
                f"candidate={candidate.knowledge_type}, "
                f"target={target.knowledge_type}"
            ),
        )

    candidate_context = candidate.context or {}
    target_context = target.context or {}

    for key in ATOMIC_IDENTITY_CONTEXT_KEYS:
        candidate_value = candidate_context.get(key)
        target_value = target_context.get(key)

        if candidate_value is None or target_value is None:
            continue

        if key == "project":
            matches = (
                _normalize_identity_text(candidate_value)
                == _normalize_identity_text(target_value)
            )
        else:
            matches = _identity_context_values_match(
                candidate_value,
                target_value,
            )

        if not matches:
            return AtomicVersionIdentityAssessment(
                same_atomic_unit=False,
                reason=(
                    "atomic context differs at "
                    f"context.{key}: "
                    f"candidate={candidate_value!r}, "
                    f"target={target_value!r}"
                ),
                conflicting_context_key=key,
            )

    return AtomicVersionIdentityAssessment(
        same_atomic_unit=True,
        reason="same knowledge_type and compatible atomic context",
    )


@dataclass(frozen=True)
class GraphRelationPlan:
    """One relation approved by the central graph policy."""

    synthesized_index: int
    target_knowledge_id: uuid.UUID
    relation_type: str


@dataclass(frozen=True)
class ExceptionParentRelationAssessment:
    """Whether a PRINCIPLE is a safe parent for an EXCEPTION edge."""

    compatible: bool
    score: float
    reason: str


@dataclass(frozen=True)
class GraphReconciliationRelationPlan:
    """One existing-node relation discovered after a graph mutation."""

    source_knowledge_id: uuid.UUID
    target_knowledge_id: uuid.UUID
    relation_type: str
    reason: str


@dataclass(frozen=True)
class KnowledgeGraphPolicyPlan:
    """
    Canonical plan produced immediately before DB mutation.

    The policy owns relation selection as well as node/version selection.
    ``relations_to_apply`` therefore contains only relations that survived
    backend semantic checks.  The apply service must never fall back to the
    raw AI relation rows.

    Plain duplicate/no-op plans carry no relation plans.  ADD_EXCEPTION is the
    intentional exception: even when its EXCEPTION child is reused, the
    parent -> EXCEPTION HAS_EXCEPTION edge can still be meaningful.
    """

    action: GraphApplyAction
    reason: str
    proposal: KnowledgeSynthesisUnit
    reused_knowledge: KnowledgeUnit | None = None
    version_target: KnowledgeUnit | None = None
    duplicate_match: DuplicateKnowledgeMatch | None = None
    material_assessment: MaterialChangeAssessment | None = None
    relations_to_apply: tuple[GraphRelationPlan, ...] = ()
    apply_proposed_relations: bool | None = None

    def __post_init__(self) -> None:
        # Keep constructor/read compatibility with the previous boolean field,
        # while making the canonical relation plan the actual source of truth.
        if self.apply_proposed_relations is None:
            object.__setattr__(
                self,
                "apply_proposed_relations",
                bool(self.relations_to_apply),
            )

    @property
    def creates_knowledge(self) -> bool:
        return self.action in {
            GraphApplyAction.CREATE_NEW,
            GraphApplyAction.CREATE_VERSION,
        }

    @property
    def is_plain_reuse(self) -> bool:
        return (
            self.action
            in {
                GraphApplyAction.REUSE_EXISTING,
                GraphApplyAction.REUSE_TARGET,
            }
            and not self.relations_to_apply
        )


def _proposal_as_candidate(
    proposal: KnowledgeSynthesisUnit,
) -> Any:
    """Adapt a stored synthesized unit to duplicate-service input."""

    return SimpleNamespace(
        candidate_id=None,
        statement=proposal.statement,
        knowledge_type=proposal.knowledge_type,
        context=proposal.context or {},
        decision_rule=proposal.decision_rule,
        rationale=proposal.rationale,
        exception=proposal.exception,
    )


def _validate_relation_shape(
    synthesis: KnowledgeSynthesis,
    proposals: list[KnowledgeSynthesisUnit],
    targets: list[KnowledgeUnit],
    relations: list[KnowledgeSynthesisRelation],
) -> None:
    proposal_by_index = {
        proposal.synthesized_index: proposal
        for proposal in proposals
    }

    for relation in relations:
        proposal = proposal_by_index.get(
            relation.synthesized_index
        )

        if proposal is None:
            raise KnowledgeGraphPolicyViolation(
                "Synthesis relation references a missing synthesized unit"
            )

        if relation.relation_type == "HAS_EXCEPTION":
            if proposal.knowledge_type != "EXCEPTION":
                raise KnowledgeGraphPolicyViolation(
                    "HAS_EXCEPTION must point to an EXCEPTION Knowledge Unit"
                )

    if synthesis.operation == "MERGE":
        if any(
            relation.relation_type == "SUPERSEDES"
            for relation in relations
        ):
            raise KnowledgeGraphPolicyViolation(
                "MERGE cannot create a SUPERSEDES relation"
            )

    if synthesis.operation == "ADD_EXCEPTION":
        if len(relations) != 1:
            raise KnowledgeGraphPolicyViolation(
                "ADD_EXCEPTION requires exactly one HAS_EXCEPTION relation"
            )

        relation = relations[0]
        target = targets[0]
        proposal = proposals[0]

        if (
            relation.relation_type != "HAS_EXCEPTION"
            or relation.synthesized_index
            != proposal.synthesized_index
            or relation.target_knowledge_id
            != target.knowledge_id
        ):
            raise KnowledgeGraphPolicyViolation(
                "ADD_EXCEPTION relation must link the parent target to the "
                "synthesized EXCEPTION unit with HAS_EXCEPTION"
            )


def _validate_structure(
    synthesis: KnowledgeSynthesis,
    candidate: KnowledgeCandidate,
    proposals: list[KnowledgeSynthesisUnit],
    targets: list[KnowledgeUnit],
    relations: list[KnowledgeSynthesisRelation],
) -> None:
    operation = synthesis.operation

    if operation not in SUPPORTED_SYNTHESIS_OPERATIONS:
        raise KnowledgeGraphPolicyViolation(
            f"Unsupported synthesis operation: {operation}"
        )

    # One Candidate represents one atomic Knowledge unit in this PoC.  If an
    # AI response wants to create multiple units, it must be normalized during
    # synthesis and reviewed again instead of being applied implicitly.
    if len(proposals) != 1:
        raise KnowledgeGraphPolicyViolation(
            "Atomic synthesis requires exactly one synthesized knowledge unit"
        )

    proposal = proposals[0]

    if operation in VERSION_OPERATIONS:
        if len(targets) != 1:
            raise KnowledgeGraphPolicyViolation(
                f"{operation} requires exactly one target knowledge"
            )

        target = targets[0]
        if not (
            candidate.knowledge_type
            == target.knowledge_type
            == proposal.knowledge_type
        ):
            raise KnowledgeGraphPolicyViolation(
                "Cross-type knowledge version update is not allowed: "
                f"candidate={candidate.knowledge_type}, "
                f"target={target.knowledge_type}, "
                f"proposal={proposal.knowledge_type}"
            )

        identity = assess_atomic_version_identity(
            candidate=candidate,
            target=target,
        )
        if not identity.same_atomic_unit:
            raise KnowledgeGraphPolicyViolation(
                "Version operation requires the same atomic knowledge: "
                + identity.reason
            )

    elif operation == "MERGE":
        if targets:
            raise KnowledgeGraphPolicyViolation(
                "MERGE must create independent knowledge and must not have "
                "version targets"
            )

    elif operation == "ADD_EXCEPTION":
        if len(targets) != 1:
            raise KnowledgeGraphPolicyViolation(
                "ADD_EXCEPTION requires exactly one parent target"
            )

        explicit_exception = (
            (candidate.exception or "").strip()
            if candidate.knowledge_type != "EXCEPTION"
            else candidate.statement.strip()
        )
        if not explicit_exception:
            raise KnowledgeGraphPolicyViolation(
                "ADD_EXCEPTION requires an explicit exception from the "
                "Candidate; AI-generated exception semantics are not "
                "accepted as backend truth"
            )

        target = targets[0]
        if (
            target.knowledge_type not in EXCEPTION_PARENT_TYPES
            or proposal.knowledge_type != "EXCEPTION"
        ):
            raise KnowledgeGraphPolicyViolation(
                "ADD_EXCEPTION must link a PRINCIPLE/DECISION_RULE parent "
                "to one EXCEPTION unit"
            )

    _validate_relation_shape(
        synthesis=synthesis,
        proposals=proposals,
        targets=targets,
        relations=relations,
    )


def _decision_rule_then(value: Any) -> str | None:
    """Return the decision outcome text from dict/Pydantic-like rule data."""

    decision_rule = getattr(value, "decision_rule", None)

    if isinstance(decision_rule, dict):
        then_value = decision_rule.get("then")
    else:
        then_value = getattr(decision_rule, "then", None)

    if then_value is None:
        return None

    text = str(then_value).strip()
    return text or None


def _decision_rule_conditions(value: Any) -> list[str]:
    """Return normalized non-empty IF condition strings."""

    decision_rule = getattr(value, "decision_rule", None)

    if isinstance(decision_rule, dict):
        raw_conditions = decision_rule.get("if_conditions")
    else:
        raw_conditions = getattr(
            decision_rule,
            "if_conditions",
            None,
        )

    if not isinstance(raw_conditions, (list, tuple)):
        return []

    result = []
    for raw in raw_conditions:
        text = str(raw).strip()
        if text:
            result.append(text)

    return result


def _decision_rule_refinement_compatible(
    source: Any,
    target: Any,
) -> bool:
    """
    Decide whether DECISION_RULE -> DECISION_RULE can safely be REFINES.

    Refinement requires the same decision outcome and, when both rules expose
    structured IF conditions, at least one semantically overlapping condition.
    This preserves narrower/specialized rules while rejecting parallel choices.

    Examples:
      general service request -> API
      immediate-response service request -> API      => refinement-compatible

      immediate response -> API
      async propagation / loose coupling -> Event    => parallel, not REFINES
    """

    source_then = _decision_rule_then(source)
    target_then = _decision_rule_then(target)

    if (
        source_then is not None
        and target_then is not None
        and not _identity_context_values_match(
            source_then,
            target_then,
        )
    ):
        return False

    source_conditions = _decision_rule_conditions(source)
    target_conditions = _decision_rule_conditions(target)

    # Missing structured condition data is not enough evidence to veto an
    # otherwise valid AI relation.  We only reject when both sides are explicit.
    if not source_conditions or not target_conditions:
        return True

    return any(
        _identity_context_values_match(
            source_condition,
            target_condition,
        )
        for source_condition in source_conditions
        for target_condition in target_conditions
    )


def _resolve_relation_target_map(
    db: Session,
    synthesis: KnowledgeSynthesis,
    targets: list[KnowledgeUnit],
    relations: list[KnowledgeSynthesisRelation],
) -> dict[uuid.UUID, KnowledgeUnit]:
    """Resolve every existing Knowledge node referenced by relation proposals."""

    result = {
        target.knowledge_id: target
        for target in targets
    }

    missing_ids = {
        relation.target_knowledge_id
        for relation in relations
        if relation.target_knowledge_id not in result
    }

    if missing_ids:
        rows = (
            db.query(KnowledgeUnit)
            .filter(
                KnowledgeUnit.knowledge_id.in_(
                    list(missing_ids)
                )
            )
            .all()
        )

        for row in rows:
            result[row.knowledge_id] = row

    for relation in relations:
        target = result.get(
            relation.target_knowledge_id
        )

        if target is None:
            raise KnowledgeGraphPolicyViolation(
                "Synthesis relation target knowledge not found: "
                f"{relation.target_knowledge_id}"
            )

        target_mission_id = getattr(
            target,
            "mission_id",
            synthesis.mission_id,
        )
        if target_mission_id != synthesis.mission_id:
            raise KnowledgeGraphPolicyViolation(
                "Synthesis relation target belongs to another mission"
            )

    return result


def _build_relation_policy_plans(
    db: Session,
    synthesis: KnowledgeSynthesis,
    proposals: list[KnowledgeSynthesisUnit],
    targets: list[KnowledgeUnit],
    relations: list[KnowledgeSynthesisRelation],
) -> tuple[GraphRelationPlan, ...]:
    """
    Convert raw AI relation proposals into backend-approved relation plans.

    Node creation/versioning and relation creation are intentionally governed
    by the same central policy layer.  The apply service receives only these
    canonical relation plans and never re-interprets raw AI relation semantics.
    """

    if not relations:
        return ()

    proposal_by_index = {
        proposal.synthesized_index: proposal
        for proposal in proposals
    }
    relation_targets = _resolve_relation_target_map(
        db=db,
        synthesis=synthesis,
        targets=targets,
        relations=relations,
    )

    result: list[GraphRelationPlan] = []
    seen: set[tuple[int, uuid.UUID, str]] = set()

    version_target_id = (
        targets[0].knowledge_id
        if synthesis.operation in VERSION_OPERATIONS
        and len(targets) == 1
        else None
    )

    for relation in relations:
        proposal = proposal_by_index[
            relation.synthesized_index
        ]
        target = relation_targets[
            relation.target_knowledge_id
        ]
        relation_type = relation.relation_type

        # CREATE_VERSION already creates the canonical SUPERSEDES edge in the
        # apply service.  AI SUPPORTS/REFINES/SUPERSEDES edges to the exact
        # predecessor would duplicate or contradict that version relationship.
        if (
            version_target_id is not None
            and relation.target_knowledge_id
            == version_target_id
            and relation_type
            in {
                "SUPPORTS",
                "REFINES",
                "SUPERSEDES",
            }
        ):
            continue

        # A compatible PRINCIPLE/EXCEPTION pair has one canonical semantic
        # relation: PRINCIPLE --HAS_EXCEPTION--> EXCEPTION.  If the AI also
        # proposes a generic REFINES/SUPPORTS edge for that same pair, drop the
        # generic edge here.  Post-apply reconciliation will add HAS_EXCEPTION
        # in the correct direction, independent of Human Review approval order.
        #
        # This prevents the real frontend regression where approving EXCEPTION
        # first and PRINCIPLE later produced both:
        #   PRINCIPLE --REFINES------> EXCEPTION
        #   PRINCIPLE --HAS_EXCEPTION-> EXCEPTION
        if relation_type in {
            "REFINES",
            "SUPPORTS",
        }:
            exception_pair_assessment = None

            if (
                proposal.knowledge_type == "PRINCIPLE"
                and target.knowledge_type == "EXCEPTION"
            ):
                exception_pair_assessment = (
                    assess_exception_parent_relation(
                        parent=proposal,
                        exception=target,
                    )
                )

            elif (
                proposal.knowledge_type == "EXCEPTION"
                and target.knowledge_type == "PRINCIPLE"
            ):
                exception_pair_assessment = (
                    assess_exception_parent_relation(
                        parent=target,
                        exception=proposal,
                    )
                )

            if (
                exception_pair_assessment is not None
                and exception_pair_assessment.compatible
            ):
                continue

        # Two DECISION_RULE nodes with different outcomes are parallel choices,
        # not refinement.  This blocks the smoke-test regression:
        #   immediate response -> API
        #   async propagation / loose coupling -> Event
        # even when their context fields are otherwise very similar.
        if (
            relation_type == "REFINES"
            and proposal.knowledge_type == "DECISION_RULE"
            and target.knowledge_type == "DECISION_RULE"
            and not _decision_rule_refinement_compatible(
                proposal,
                target,
            )
        ):
            continue

        key = (
            relation.synthesized_index,
            relation.target_knowledge_id,
            relation_type,
        )
        if key in seen:
            continue

        seen.add(key)
        result.append(
            GraphRelationPlan(
                synthesized_index=(
                    relation.synthesized_index
                ),
                target_knowledge_id=(
                    relation.target_knowledge_id
                ),
                relation_type=relation_type,
            )
        )

    return tuple(result)


_RELATION_STOPWORDS = {
    "서비스",
    "데이터",
    "경우",
    "경우에",
    "경우에는",
    "단계",
    "운영",
    "사용",
    "처리",
    "기준",
    "구조",
    "관련",
    "대상",
    "통해",
    "위해",
    "해야",
    "한다",
    "된다",
    "있다",
    "없다",
    "대한",
    "the",
    "and",
    "or",
    "to",
    "of",
    "for",
    "in",
}


def _relation_value_text(value: Any) -> str:
    """Flatten statement/context/rule fields used for relation matching."""

    parts: list[str] = []

    for attr in (
        "statement",
        "rationale",
        "exception",
    ):
        raw = getattr(value, attr, None)
        if raw:
            parts.append(str(raw))

    decision_rule = getattr(value, "decision_rule", None)
    if isinstance(decision_rule, dict):
        for key in (
            "then",
            "if_conditions",
            "unless",
        ):
            raw = decision_rule.get(key)
            if isinstance(raw, (list, tuple)):
                parts.extend(str(item) for item in raw if item)
            elif raw:
                parts.append(str(raw))

    context = getattr(value, "context", None) or {}
    if isinstance(context, dict):
        for key in (
            "project",
            "domain",
            "system",
            "scope",
            "phase",
            "time",
            "tags",
            "constraints",
        ):
            raw = context.get(key)
            if isinstance(raw, (list, tuple, set)):
                parts.extend(str(item) for item in raw if item)
            elif raw:
                parts.append(str(raw))

    return " ".join(parts)


def _canonical_relation_text(value: Any) -> str:
    text = _relation_value_text(value).lower()

    substitutions = (
        (
            r"database\s+per\s+service",
            " database_per_service ",
        ),
        (
            r"shared\s*db",
            " shared_database ",
        ),
        (
            r"데이터베이스",
            " database ",
        ),
        (
            r"\bdb\b",
            " database ",
        ),
        (
            r"직접\s*(접근|조회|변경|쓰기|읽기)",
            " direct_access ",
        ),
        (
            r"direct\s+(database\s+)?(access|query|read|write)",
            " direct_access ",
        ),
        (
            r"전용\s*database",
            " dedicated_database ",
        ),
        (
            r"전용\s*db",
            " dedicated_database ",
        ),
    )

    for pattern, replacement in substitutions:
        text = re.sub(
            pattern,
            replacement,
            text,
            flags=re.IGNORECASE,
        )

    return " ".join(
        re.findall(
            r"[a-z0-9가-힣_]+",
            text,
        )
    )


def _relation_tokens(value: Any) -> set[str]:
    text = _canonical_relation_text(value)
    result: set[str] = set()

    for token in text.split():
        if len(token) < 2:
            continue
        if token in _RELATION_STOPWORDS:
            continue
        result.add(token)

    return result


def _relation_concepts(value: Any) -> set[str]:
    """Extract a small set of high-signal domain-independent-ish concepts."""

    text = _canonical_relation_text(value)
    compact = text.replace(" ", "")
    concepts: set[str] = set()

    if "direct_access" in text and "database" in text:
        concepts.add("DIRECT_DATABASE_ACCESS")

    if "shared_database" in text:
        concepts.add("SHARED_DATABASE")

    if (
        "database_per_service" in text
        or "dedicated_database" in text
    ):
        concepts.add("DATABASE_OWNERSHIP_BOUNDARY")

    if "api" in text and "이벤트" in text:
        concepts.add("API_EVENT_INTEGRATION")

    if (
        "서비스간" in compact
        and (
            "데이터" in compact
            or "연계" in compact
            or "접근" in compact
        )
    ):
        concepts.add("INTERSERVICE_DATA_ACCESS")

    return concepts


def _token_overlap_count(
    left: set[str],
    right: set[str],
) -> int:
    """Count exact/contained meaningful-token overlaps conservatively."""

    matched_left: set[str] = set()

    for left_token in left:
        for right_token in right:
            if left_token == right_token:
                matched_left.add(left_token)
                break

            shorter = min(
                len(left_token),
                len(right_token),
            )
            if shorter < 3:
                continue

            if (
                left_token in right_token
                or right_token in left_token
            ):
                matched_left.add(left_token)
                break

    return len(matched_left)


def _is_permissive_exception(value: Any) -> bool:
    """Reject restrictive facts mislabeled EXCEPTION from auto-linking."""

    text = _relation_value_text(value).lower()
    markers = (
        "허용",
        "예외",
        "한시",
        "제한적으로",
        "임시",
        "가능하다",
        "가능할",
        "allow",
        "exception",
        "temporar",
    )

    return any(marker in text for marker in markers)


def _is_normative_parent(value: Any) -> bool:
    """Require the parent PRINCIPLE to actually state a normative rule."""

    text = _relation_value_text(value).lower()
    markers = (
        "금지",
        "허용하지",
        "않고",
        "않는다",
        "하지 않는다",
        "대신",
        "원칙",
        "우선",
        "기본",
        "해야",
        "사용한다",
        "처리한다",
        "must",
        "should",
        "shall",
        "prohibit",
        "not allow",
    )

    return any(marker in text for marker in markers)


def assess_exception_parent_relation(
    parent: KnowledgeUnit,
    exception: KnowledgeUnit,
) -> ExceptionParentRelationAssessment:
    """
    Decide whether ``parent --HAS_EXCEPTION--> exception`` can be inferred.

    Auto-reconciliation is intentionally conservative:
    - only PRINCIPLE parents are inferred automatically;
    - the EXCEPTION must contain permissive/exception semantics;
    - project/domain must not conflict;
    - scope/system and topic semantics must overlap.

    DECISION_RULE parents remain supported when the reviewed synthesis
    explicitly proposes HAS_EXCEPTION, but they are not guessed after the fact.
    This avoids attaching one conditional rule to another merely because both
    mention the same technology or object.
    """

    if getattr(parent, "knowledge_type", None) != "PRINCIPLE":
        return ExceptionParentRelationAssessment(
            compatible=False,
            score=0.0,
            reason=(
                "automatic exception reconciliation only infers "
                "PRINCIPLE -> EXCEPTION"
            ),
        )

    if getattr(exception, "knowledge_type", None) != "EXCEPTION":
        return ExceptionParentRelationAssessment(
            compatible=False,
            score=0.0,
            reason="target is not EXCEPTION knowledge",
        )

    if not _is_normative_parent(parent):
        return ExceptionParentRelationAssessment(
            compatible=False,
            score=0.0,
            reason="parent principle is not expressed as a normative rule",
        )

    if not _is_permissive_exception(exception):
        return ExceptionParentRelationAssessment(
            compatible=False,
            score=0.0,
            reason=(
                "EXCEPTION is restrictive/non-permissive; do not infer "
                "HAS_EXCEPTION automatically"
            ),
        )

    parent_context = getattr(parent, "context", None) or {}
    exception_context = getattr(exception, "context", None) or {}

    score = 0.0

    for key in ("project", "domain"):
        parent_value = parent_context.get(key)
        exception_value = exception_context.get(key)

        if parent_value is None or exception_value is None:
            continue

        if key == "project":
            matches = (
                _normalize_identity_text(parent_value)
                == _normalize_identity_text(exception_value)
            )
        else:
            matches = _identity_context_values_match(
                parent_value,
                exception_value,
            )

        if not matches:
            return ExceptionParentRelationAssessment(
                compatible=False,
                score=0.0,
                reason=(
                    f"context.{key} conflicts: "
                    f"parent={parent_value!r}, "
                    f"exception={exception_value!r}"
                ),
            )

        score += 1.0

    comparable_topic_context = 0
    matching_topic_context = 0

    for key in ("system", "scope"):
        parent_value = parent_context.get(key)
        exception_value = exception_context.get(key)

        if parent_value is None or exception_value is None:
            continue

        comparable_topic_context += 1

        if _identity_context_values_match(
            parent_value,
            exception_value,
        ):
            matching_topic_context += 1
            score += 2.0

    parent_concepts = _relation_concepts(parent)
    exception_concepts = _relation_concepts(exception)
    shared_concepts = parent_concepts & exception_concepts

    if shared_concepts:
        score += min(
            4.0,
            2.0 * len(shared_concepts),
        )

    parent_tokens = _relation_tokens(parent)
    exception_tokens = _relation_tokens(exception)
    overlap_count = _token_overlap_count(
        parent_tokens,
        exception_tokens,
    )

    if overlap_count:
        score += min(
            3.0,
            float(overlap_count),
        )

    if (
        comparable_topic_context > 0
        and matching_topic_context == 0
        and not shared_concepts
    ):
        return ExceptionParentRelationAssessment(
            compatible=False,
            score=score,
            reason="scope/system do not overlap and no shared semantic concept",
        )

    if not shared_concepts and overlap_count < 2:
        return ExceptionParentRelationAssessment(
            compatible=False,
            score=score,
            reason="insufficient shared topic semantics",
        )

    if score < 5.0:
        return ExceptionParentRelationAssessment(
            compatible=False,
            score=score,
            reason=(
                "exception-parent semantic score below safe threshold: "
                f"score={score:.1f}"
            ),
        )

    details = []
    if shared_concepts:
        details.append(
            "shared_concepts="
            + ",".join(sorted(shared_concepts))
        )
    if matching_topic_context:
        details.append(
            f"matching_context_slots={matching_topic_context}"
        )
    if overlap_count:
        details.append(
            f"token_overlap={overlap_count}"
        )

    return ExceptionParentRelationAssessment(
        compatible=True,
        score=score,
        reason=(
            "compatible PRINCIPLE/EXCEPTION semantics"
            + (
                ": " + "; ".join(details)
                if details
                else ""
            )
        ),
    )


def _load_active_verified_knowledge(
    db: Session,
    mission_id: uuid.UUID,
) -> list[KnowledgeUnit]:
    return (
        db.query(KnowledgeUnit)
        .filter(
            KnowledgeUnit.mission_id == mission_id,
            KnowledgeUnit.status == "VERIFIED",
        )
        .all()
    )


def build_post_apply_relation_reconciliation_plans(
    db: Session,
    mission_id: uuid.UUID,
    changed_knowledge: KnowledgeUnit,
) -> tuple[GraphReconciliationRelationPlan, ...]:
    """
    Discover missing semantic relations after a new Knowledge node/version.

    This makes graph construction independent from Human Review approval order.
    The first supported inferred relation is the high-confidence, directional
    PRINCIPLE -> EXCEPTION HAS_EXCEPTION edge.  Broader automatic inference of
    REFINES/SUPPORTS is intentionally out of scope until similarly strict rules
    exist for those semantics.
    """

    changed_type = getattr(
        changed_knowledge,
        "knowledge_type",
        None,
    )

    if changed_type not in {
        "PRINCIPLE",
        "EXCEPTION",
    }:
        return ()

    active_rows = _load_active_verified_knowledge(
        db=db,
        mission_id=mission_id,
    )

    result: list[GraphReconciliationRelationPlan] = []
    seen: set[tuple[uuid.UUID, uuid.UUID, str]] = set()

    for other in active_rows:
        if (
            other.knowledge_id
            == changed_knowledge.knowledge_id
        ):
            continue

        if changed_type == "PRINCIPLE":
            parent = changed_knowledge
            exception = other
        else:
            parent = other
            exception = changed_knowledge

        if getattr(parent, "knowledge_type", None) != "PRINCIPLE":
            continue
        if getattr(exception, "knowledge_type", None) != "EXCEPTION":
            continue

        assessment = assess_exception_parent_relation(
            parent=parent,
            exception=exception,
        )

        if not assessment.compatible:
            continue

        key = (
            parent.knowledge_id,
            exception.knowledge_id,
            "HAS_EXCEPTION",
        )
        if key in seen:
            continue

        seen.add(key)
        result.append(
            GraphReconciliationRelationPlan(
                source_knowledge_id=(
                    parent.knowledge_id
                ),
                target_knowledge_id=(
                    exception.knowledge_id
                ),
                relation_type="HAS_EXCEPTION",
                reason=assessment.reason,
            )
        )

    return tuple(result)


def build_knowledge_graph_policy_plan(
    db: Session,
    synthesis: KnowledgeSynthesis,
    candidate: KnowledgeCandidate,
    proposals: list[KnowledgeSynthesisUnit],
    targets: list[KnowledgeUnit],
    relations: list[KnowledgeSynthesisRelation],
    embedding_cache: dict[str, list[float]] | None = None,
) -> KnowledgeGraphPolicyPlan:
    """
    Produce one canonical apply plan for the current graph snapshot.

    Policy order is intentionally operation-independent:

    1. Validate graph invariants.
    2. Detect semantic duplicate/no-op against the *current* Mission graph.
    3. Only then decide whether a new unit/version may be created.

    This prevents an AI operation change (MERGE -> ENRICH -> SPLIT, etc.) from
    bypassing a guard that was implemented in only one operation branch.
    """

    _validate_structure(
        synthesis=synthesis,
        candidate=candidate,
        proposals=proposals,
        targets=targets,
        relations=relations,
    )

    proposal = proposals[0]

    # ADD_EXCEPTION is special because the parent Candidate and the child
    # EXCEPTION are different atomic knowledge.  Duplicate detection therefore
    # runs on the normalized EXCEPTION proposal, while the HAS_EXCEPTION edge
    # is still allowed to be applied when the child is reused.
    if synthesis.operation == "ADD_EXCEPTION":
        duplicate_match = find_duplicate_active_knowledge(
            db=db,
            mission_id=synthesis.mission_id,
            candidate=_proposal_as_candidate(proposal),
            embedding_cache=embedding_cache,
        )

        if duplicate_match is not None:
            if duplicate_match.knowledge.knowledge_type != "EXCEPTION":
                raise KnowledgeGraphPolicyViolation(
                    "ADD_EXCEPTION duplicate resolution must reuse an "
                    "EXCEPTION Knowledge Unit"
                )

            return KnowledgeGraphPolicyPlan(
                action=GraphApplyAction.REUSE_EXISTING,
                reason=(
                    "ADD_EXCEPTION child is duplicate/no-op; reuse the "
                    "existing EXCEPTION and apply only the parent relation"
                ),
                proposal=proposal,
                reused_knowledge=duplicate_match.knowledge,
                duplicate_match=duplicate_match,
                relations_to_apply=_build_relation_policy_plans(
                    db=db,
                    synthesis=synthesis,
                    proposals=proposals,
                    targets=targets,
                    relations=relations,
                ),
            )

        return KnowledgeGraphPolicyPlan(
            action=GraphApplyAction.CREATE_NEW,
            reason=(
                "ADD_EXCEPTION child is new atomic EXCEPTION knowledge"
            ),
            proposal=proposal,
            relations_to_apply=_build_relation_policy_plans(
                db=db,
                synthesis=synthesis,
                proposals=proposals,
                targets=targets,
                relations=relations,
            ),
        )

    # Every other operation first passes through the same Mission-wide
    # duplicate/no-op gate.  The AI operation cannot bypass it.
    duplicate_match = find_duplicate_active_knowledge(
        db=db,
        mission_id=synthesis.mission_id,
        candidate=candidate,
        embedding_cache=embedding_cache,
    )

    if duplicate_match is not None:
        return KnowledgeGraphPolicyPlan(
            action=GraphApplyAction.REUSE_EXISTING,
            reason=(
                "Candidate is duplicate/no-op of existing active knowledge"
            ),
            proposal=proposal,
            reused_knowledge=duplicate_match.knowledge,
            duplicate_match=duplicate_match,
            relations_to_apply=(),
        )

    if synthesis.operation in VERSION_OPERATIONS:
        target = targets[0]
        material_assessment = (
            assess_synthesized_unit_material_change(
                target=target,
                proposal=proposal,
                embedding_cache=embedding_cache,
            )
        )

        if not material_assessment.material_change:
            return KnowledgeGraphPolicyPlan(
                action=GraphApplyAction.REUSE_TARGET,
                reason=(
                    "Synthesized proposal has no material change from target"
                ),
                proposal=proposal,
                reused_knowledge=target,
                version_target=target,
                material_assessment=material_assessment,
                relations_to_apply=(),
            )

        return KnowledgeGraphPolicyPlan(
            action=GraphApplyAction.CREATE_VERSION,
            reason="Material same-type version change",
            proposal=proposal,
            version_target=target,
            material_assessment=material_assessment,
            relations_to_apply=_build_relation_policy_plans(
                db=db,
                synthesis=synthesis,
                proposals=proposals,
                targets=targets,
                relations=relations,
            ),
        )

    # MERGE, SPLIT_BY_CONTEXT and KEEP_CONFLICT all converge here.  Their AI
    # labels may still matter to the reviewed explanation/relation semantics,
    # but they do not get separate duplicate/version safety logic.
    return KnowledgeGraphPolicyPlan(
        action=GraphApplyAction.CREATE_NEW,
        reason=(
            f"{synthesis.operation} creates one new atomic Knowledge Unit"
        ),
        proposal=proposal,
        relations_to_apply=_build_relation_policy_plans(
            db=db,
            synthesis=synthesis,
            proposals=proposals,
            targets=targets,
            relations=relations,
        ),
    )
