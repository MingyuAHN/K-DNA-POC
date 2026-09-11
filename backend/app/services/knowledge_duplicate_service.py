# Duplicate detection combines lexical, context, semantic, polarity-safety,
# and evidence-reuse logic.

import logging
import math
import re
import uuid
from dataclasses import dataclass
from difflib import SequenceMatcher
from sqlalchemy.orm import Session
from app.clients.ai_client import AIClientError, ai_client
from app.models.interview_analysis import InterviewAnalysis, KnowledgeCandidate
from app.models.interview_message import InterviewMessage
from app.models.knowledge_core import Evidence, KnowledgeUnit
from app.schemas.embedding import EmbeddingItemRequest, EmbeddingRequest
logger = logging.getLogger(__name__)
ACTIVE_KNOWLEDGE_STATUSES = {'VERIFIED', 'EXPERT_OPINION'}
EMBEDDING_MODEL = 'text-embedding-3-small'
EMBEDDING_DIMENSION = 1536
SEMANTIC_CANDIDATE_LIMIT = 24
SAME_TYPE_MAX_LENGTH_RATIO = 1.2
CROSS_TYPE_MAX_LENGTH_RATIO = 1.15
SAME_TYPE_STRONG_SEQUENCE_THRESHOLD = 0.88
SAME_TYPE_STRONG_JACCARD_THRESHOLD = 0.75
SAME_TYPE_STRONG_CONTAINMENT_THRESHOLD = 0.82
CROSS_TYPE_STRONG_CONTAINMENT_THRESHOLD = 0.78
CROSS_TYPE_STRONG_TOKEN_CONTAINMENT_THRESHOLD = 0.65
SAME_TYPE_MIN_SEMANTIC_SIMILARITY = 0.8
SAME_TYPE_MIN_COMBINED_SCORE = 0.7
CROSS_TYPE_MIN_SEMANTIC_SIMILARITY = 0.8
CROSS_TYPE_MIN_COMBINED_SCORE = 0.62
CROSS_TYPE_MIN_TOKEN_CONTAINMENT = 0.18
CROSS_TYPE_MIN_CHAR_CONTAINMENT = 0.25
CROSS_TYPE_MIN_SEQUENCE_RATIO = 0.42
CROSS_TYPE_HIGH_SEMANTIC_OVERRIDE = 0.9
DUPLICATE_DIAGNOSTIC_MIN_SEMANTIC = 0.72
RULE_LIKE_KNOWLEDGE_TYPES = {'PRINCIPLE', 'DECISION_RULE', 'HEURISTIC'}
STRICT_CONTEXT_KEYS = ('project',)
FUZZY_CONTEXT_KEYS = ('domain', 'phase')
NEGATION_MARKERS = ('않', '아니', '없', '불가', '불가능', '금지')
HARD_NEGATION_MARKERS = ('금지', '불가', '불가능', '해서는 안', '하면 안', '하지 말', '말아야')
INSUFFICIENCY_MARKERS = ('부족', '충분하지', '충분치', '만으로는 어렵', '만으로 어렵')
SUFFICIENCY_MARKERS = ('충분하다', '충분함', '충분조건', '충족한다', '충족되면')
INSUFFICIENCY_DECISION_VERBS = ('결정', '판단', '확정', '정당화')
POLARITY_MIN_SEQUENCE_RATIO = 0.58
POLARITY_MIN_BIDIRECTIONAL_TOKEN_CONTAINMENT = 0.45
POLARITY_MIN_BIDIRECTIONAL_CHAR_CONTAINMENT = 0.45
INSUFFICIENCY_SUBCLAIM_MAX_LENGTH_RATIO = 0.8
INSUFFICIENCY_SUBCLAIM_MIN_TAG_OVERLAP = 2
INSUFFICIENCY_SUBCLAIM_MIN_TOKEN_CONTAINMENT = 0.35
INSUFFICIENCY_SUBCLAIM_MIN_CHAR_CONTAINMENT = 0.35
EXCEPTION_MARKERS = ('다만', '예외', '반대로', '경우에는', '때에는', 'unless')

# --- Result / metric models ---
@dataclass(frozen=True)
class DuplicateKnowledgeMatch:
    knowledge: KnowledgeUnit
    match_type: str
    sequence_ratio: float
    token_jaccard: float
    token_containment: float
    char_containment: float
    semantic_similarity: float | None
    combined_score: float
    tag_overlap_count: int

@dataclass(frozen=True)
class _SimilarityMetrics:
    knowledge: KnowledgeUnit
    sequence_ratio: float
    token_jaccard: float
    token_containment: float
    char_containment: float
    length_ratio: float
    tag_overlap_count: int
    same_type: bool

# --- Text similarity helpers ---
def _normalize_text(value: str | None) -> str:
    if not value:
        return ''
    tokens = re.findall('[A-Za-z0-9가-힣_]+', value.lower())
    return ' '.join(tokens)

def _compact_text(value: str | None) -> str:
    return _normalize_text(value).replace(' ', '')

def _token_set(value: str | None) -> set[str]:
    normalized = _normalize_text(value)
    if not normalized:
        return set()
    return {token for token in normalized.split() if len(token) >= 2}

def _char_ngrams(value: str | None, size: int=3) -> set[str]:
    compact = _compact_text(value)
    if not compact:
        return set()
    if len(compact) < size:
        return {compact}
    return {compact[index:index + size] for index in range(len(compact) - size + 1)}

def _sequence_ratio(left: str | None, right: str | None) -> float:
    left_normalized = _normalize_text(left)
    right_normalized = _normalize_text(right)
    if not left_normalized or not right_normalized:
        return 0.0
    return SequenceMatcher(None, left_normalized, right_normalized).ratio()

def _token_jaccard(left: str | None, right: str | None) -> float:
    left_tokens = _token_set(left)
    right_tokens = _token_set(right)
    if not left_tokens or not right_tokens:
        return 0.0
    union = left_tokens | right_tokens
    if not union:
        return 0.0
    intersection = left_tokens & right_tokens
    return len(intersection) / len(union)

def _token_containment(candidate_statement: str | None, knowledge_statement: str | None) -> float:
    """
    Candidate의 핵심 토큰이 기존 Knowledge 안에 얼마나
    포함되는지 계산한다.

    Candidate가 기존 Knowledge의 하위 표현일 때
    Jaccard보다 안정적으로 높은 값을 주기 위한 지표다.
    """
    candidate_tokens = _token_set(candidate_statement)
    knowledge_tokens = _token_set(knowledge_statement)
    if not candidate_tokens or not knowledge_tokens:
        return 0.0
    intersection = candidate_tokens & knowledge_tokens
    return len(intersection) / len(candidate_tokens)

def _char_containment(candidate_statement: str | None, knowledge_statement: str | None) -> float:
    """
    Candidate의 문자 3-gram이 기존 Knowledge에 얼마나
    포함되는지 계산한다.

    AI가 조사를 바꾸거나 문장 순서를 조금 바꾼 경우의
    paraphrase 보조 지표로 사용한다.
    """
    candidate_ngrams = _char_ngrams(candidate_statement)
    knowledge_ngrams = _char_ngrams(knowledge_statement)
    if not candidate_ngrams or not knowledge_ngrams:
        return 0.0
    intersection = candidate_ngrams & knowledge_ngrams
    return len(intersection) / len(candidate_ngrams)

def _statement_length_ratio(candidate_statement: str | None, knowledge_statement: str | None) -> float:
    candidate_text = _compact_text(candidate_statement)
    knowledge_text = _compact_text(knowledge_statement)
    if not knowledge_text:
        return 999.0
    return len(candidate_text) / len(knowledge_text)

def _cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = 0.0
    left_norm = 0.0
    right_norm = 0.0
    for left_value, right_value in zip(left, right):
        dot += left_value * right_value
        left_norm += left_value * left_value
        right_norm += right_value * right_value
    if left_norm <= 0.0 or right_norm <= 0.0:
        return 0.0
    return dot / (math.sqrt(left_norm) * math.sqrt(right_norm))

# --- Context compatibility ---
def _normalize_context_value(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    if not text:
        return None
    return text

def _fuzzy_context_values_match(left: str, right: str) -> bool:
    """
    AI가 같은 Context를 조금 다르게 표현하는 것은 허용하되,
    한 단어만 우연히 겹치는 경우까지 같은 Context로 보지는 않는다.

    예:
    - "MSA" vs "MSA Architecture" -> compatible
    - "DB 분리 전" vs "DB 분리 이전" -> compatible
    - "Migration Phase 1" vs "Migration Phase 2" -> conflict
    - "MSA Architecture" vs "Security Architecture" -> conflict
    """
    if left == right:
        return True
    left_compact = _compact_text(left)
    right_compact = _compact_text(right)
    if left_compact and right_compact and (left_compact in right_compact or right_compact in left_compact):
        return True
    left_numbers = set(re.findall('\\d+', left))
    right_numbers = set(re.findall('\\d+', right))
    if left_numbers and right_numbers and (left_numbers != right_numbers):
        return False
    left_tokens = _token_set(left)
    right_tokens = _token_set(right)
    if not left_tokens or not right_tokens:
        return False
    intersection = left_tokens & right_tokens
    if not intersection:
        return False
    smaller_size = min(len(left_tokens), len(right_tokens))
    union_size = len(left_tokens | right_tokens)
    containment = len(intersection) / smaller_size if smaller_size else 0.0
    jaccard = len(intersection) / union_size if union_size else 0.0
    return containment >= 0.6 or jaccard >= 0.5

def _contexts_are_compatible(candidate: KnowledgeCandidate, knowledge: KnowledgeUnit) -> bool:
    """
    Context는 Duplicate 판단의 안전장치로만 사용한다.

    - project는 둘 다 값이 있을 때 정확히 달라지면
      다른 적용 맥락으로 본다.
    - domain / phase는 둘 다 값이 있을 때 토큰/포함 관계조차
      없는 명백한 차이만 충돌로 본다.
    - scope/system은 AI가 동일 지식에도 표현을 자주 바꾸므로
      hard conflict로 사용하지 않는다.
    """
    candidate_context = candidate.context or {}
    knowledge_context = knowledge.context or {}
    for key in STRICT_CONTEXT_KEYS:
        candidate_value = _normalize_context_value(candidate_context.get(key))
        knowledge_value = _normalize_context_value(knowledge_context.get(key))
        if candidate_value is not None and knowledge_value is not None and (candidate_value != knowledge_value):
            return False
    for key in FUZZY_CONTEXT_KEYS:
        candidate_value = _normalize_context_value(candidate_context.get(key))
        knowledge_value = _normalize_context_value(knowledge_context.get(key))
        if candidate_value is None or knowledge_value is None:
            continue
        if not _fuzzy_context_values_match(candidate_value, knowledge_value):
            return False
    return True

# --- Semantic safety guards ---
def _contains_any_marker(value: str | None, markers: tuple[str, ...]) -> bool:
    normalized = _normalize_text(value)
    compact = normalized.replace(' ', '')
    return any((_compact_text(marker) in compact for marker in markers if _compact_text(marker)))

def _expresses_insufficient_condition(value: str | None) -> bool:
    """
    "A만으로는 부족하다", "A만으로 결정하지 않는다"처럼
    특정 조건만으로는 충분하지 않다는 의미를 감지한다.

    이런 표현은 문장에 부정어가 있어도 핵심 결론 자체를
    반대로 뒤집는 부정과는 다르므로 별도로 취급한다.
    """
    compact = _compact_text(value)
    if not compact:
        return False

    if any(_compact_text(marker) in compact for marker in INSUFFICIENCY_MARKERS):
        return True

    if '만으로' not in compact:
        return False

    if '어렵' in compact or '곤란' in compact:
        return True

    return any(
        f'{verb}하지않' in compact
        or f'{verb}할수없' in compact
        for verb in INSUFFICIENCY_DECISION_VERBS
    )

def _expresses_sufficient_condition(value: str | None) -> bool:
    """
    특정 조건만으로 충분하다는 명시적 표현을 감지한다.

    "A만으로 결정한다" / "A만으로 판단할 수 있다"처럼
    insufficiency 표현과 직접 반대되는 경우도 감지한다.
    """
    compact = _compact_text(value)
    if not compact:
        return False

    if _expresses_insufficient_condition(value):
        return False

    if any(_compact_text(marker) in compact for marker in SUFFICIENCY_MARKERS):
        return True

    if '만으로' not in compact:
        return False

    return any(verb in compact for verb in INSUFFICIENCY_DECISION_VERBS)

def _has_polarity_mismatch(candidate: KnowledgeCandidate, knowledge: KnowledgeUnit) -> bool:
    """
    Embedding은 긍정/부정 문장을 가깝게 볼 수 있으므로
    실제로 결론 방향이 반대인 경우에는 Duplicate로 합치지 않는다.

    다만 "A만으로 결정하지 않는다"와 "A만으로는 부족하다"처럼
    같은 불충분성을 서로 다른 표현으로 설명한 경우는
    polarity mismatch로 보지 않는다.
    """
    candidate_insufficient = _expresses_insufficient_condition(candidate.statement)
    knowledge_insufficient = _expresses_insufficient_condition(knowledge.statement)
    candidate_sufficient = _expresses_sufficient_condition(candidate.statement)
    knowledge_sufficient = _expresses_sufficient_condition(knowledge.statement)

    if (candidate_insufficient and knowledge_sufficient) or (knowledge_insufficient and candidate_sufficient):
        return True

    candidate_hard_negative = _contains_any_marker(candidate.statement, HARD_NEGATION_MARKERS)
    knowledge_hard_negative = _contains_any_marker(knowledge.statement, HARD_NEGATION_MARKERS)

    if candidate_hard_negative != knowledge_hard_negative:
        if candidate_hard_negative or knowledge_hard_negative:
            return True

    # "A만으로는 부족하다" 같은 insufficiency는 문장의 전체 결론을
    # 부정하는 것이 아니라 조건의 불충분성을 설명하는 qualifier다.
    # 한쪽에만 insufficiency가 있고 상대가 그 조건을 명시적으로
    # 충분하다고 주장하지 않는다면 semantic duplicate 비교를 허용한다.
    if candidate_insufficient or knowledge_insufficient:
        return False

    candidate_negative = _contains_any_marker(candidate.statement, NEGATION_MARKERS)
    knowledge_negative = _contains_any_marker(knowledge.statement, NEGATION_MARKERS)

    if candidate_negative == knowledge_negative:
        return False

    sequence_ratio = _sequence_ratio(candidate.statement, knowledge.statement)
    candidate_to_knowledge_token = _token_containment(candidate.statement, knowledge.statement)
    knowledge_to_candidate_token = _token_containment(knowledge.statement, candidate.statement)
    bidirectional_token_containment = min(candidate_to_knowledge_token, knowledge_to_candidate_token)
    candidate_to_knowledge_char = _char_containment(candidate.statement, knowledge.statement)
    knowledge_to_candidate_char = _char_containment(knowledge.statement, candidate.statement)
    bidirectional_char_containment = min(candidate_to_knowledge_char, knowledge_to_candidate_char)

    return (
        sequence_ratio >= POLARITY_MIN_SEQUENCE_RATIO
        or bidirectional_token_containment >= POLARITY_MIN_BIDIRECTIONAL_TOKEN_CONTAINMENT
        or bidirectional_char_containment >= POLARITY_MIN_BIDIRECTIONAL_CHAR_CONTAINMENT
    )

def _candidate_adds_exception_signal(candidate: KnowledgeCandidate, knowledge: KnowledgeUnit) -> bool:
    """
    Candidate가 기존 Knowledge에 없던 예외/분기 표현을
    추가했다면 중복이 아니라 ENRICH 후보로 남긴다.
    """
    candidate_exception = _normalize_text(candidate.exception)
    knowledge_exception = _normalize_text(knowledge.exception)
    if candidate_exception and candidate_exception != knowledge_exception:
        return True
    candidate_has_marker = _contains_any_marker(candidate.statement, EXCEPTION_MARKERS)
    knowledge_has_marker = _contains_any_marker(knowledge.statement, EXCEPTION_MARKERS)
    return candidate_has_marker and (not knowledge_has_marker)

def _types_are_duplicate_compatible(candidate: KnowledgeCandidate, knowledge: KnowledgeUnit) -> bool:
    if candidate.knowledge_type == knowledge.knowledge_type:
        return True
    return candidate.knowledge_type in RULE_LIKE_KNOWLEDGE_TYPES and knowledge.knowledge_type in RULE_LIKE_KNOWLEDGE_TYPES

# --- Tag / cheap ranking helpers ---
def _tag_token_set(context: dict | None) -> set[str]:
    """
    Duplicate 구조 신호용 Context 토큰을 만든다.

    AI는 같은 의미를 어떤 Turn에서는 tags에, 다른 Turn에서는
    constraints에 넣을 수 있으므로 둘을 함께 사용한다.
    이 값은 단독 Duplicate 판정이 아니라 semantic/lexical 판정의
    보조 신호로만 사용된다.
    """
    if not context:
        return set()

    result: set[str] = set()

    for key in ('tags', 'constraints'):
        values = context.get(key, [])
        if not isinstance(values, list):
            continue

        for value in values:
            if not isinstance(value, str):
                continue
            result.update(_token_set(value))

    return result

def _tag_overlap_count(candidate: KnowledgeCandidate, knowledge: KnowledgeUnit) -> int:
    candidate_tags = _tag_token_set(candidate.context or {})
    knowledge_tags = _tag_token_set(knowledge.context or {})
    return len(candidate_tags & knowledge_tags)

def _build_metrics(candidate: KnowledgeCandidate, knowledge: KnowledgeUnit) -> _SimilarityMetrics:
    return _SimilarityMetrics(knowledge=knowledge, sequence_ratio=_sequence_ratio(candidate.statement, knowledge.statement), token_jaccard=_token_jaccard(candidate.statement, knowledge.statement), token_containment=_token_containment(candidate.statement, knowledge.statement), char_containment=_char_containment(candidate.statement, knowledge.statement), length_ratio=_statement_length_ratio(candidate.statement, knowledge.statement), tag_overlap_count=_tag_overlap_count(candidate=candidate, knowledge=knowledge), same_type=candidate.knowledge_type == knowledge.knowledge_type)

def _is_contained_insufficiency_duplicate(
    candidate: KnowledgeCandidate,
    knowledge: KnowledgeUnit,
    metrics: _SimilarityMetrics,
) -> bool:
    """
    기존 Knowledge가 이미 더 풍부한 형태로 "A만으로는 부족하다"는
    명제를 포함하고 있고 Candidate가 그 일부 명제만 다시 진술한 경우를
    Duplicate로 억제한다.

    실제 Interview에서는 하나의 답변에서 AI가:
    - "운영 자립성이 확보되면 DB 분리"
    - "소유권/직접 쓰기 정리만으로는 부족"
    처럼 하나의 기존 Knowledge를 두 Candidate로 분리할 수 있다.

    이때 짧은 insufficiency Candidate가 기존의 더 풍부한 Knowledge에
    이미 포함되어 있으면 별도 Version을 만들 필요가 없다.

    안전장치:
    - Candidate와 Knowledge가 모두 insufficiency를 표현해야 한다.
    - Candidate가 기존 Knowledge보다 짧은 sub-claim이어야 한다.
    - Context tag/constraint와 lexical containment가 함께 뒷받침되어야 한다.
    - 예외/분기 추가 여부는 이 함수 전에 별도로 차단한다.
    """
    if not _expresses_insufficient_condition(candidate.statement):
        return False
    if not _expresses_insufficient_condition(knowledge.statement):
        return False
    if metrics.length_ratio > INSUFFICIENCY_SUBCLAIM_MAX_LENGTH_RATIO:
        return False
    if metrics.tag_overlap_count < INSUFFICIENCY_SUBCLAIM_MIN_TAG_OVERLAP:
        return False
    return (
        metrics.token_containment >= INSUFFICIENCY_SUBCLAIM_MIN_TOKEN_CONTAINMENT
        and metrics.char_containment >= INSUFFICIENCY_SUBCLAIM_MIN_CHAR_CONTAINMENT
    )

def _cheap_rank_score(metrics: _SimilarityMetrics) -> float:
    tag_score = min(metrics.tag_overlap_count / 3.0, 1.0)
    type_bonus = 0.1 if metrics.same_type else 0.0
    return metrics.char_containment * 0.3 + metrics.token_containment * 0.25 + metrics.sequence_ratio * 0.2 + metrics.token_jaccard * 0.15 + tag_score * 0.1 + type_bonus

def _is_strong_lexical_duplicate(metrics: _SimilarityMetrics) -> bool:
    if metrics.same_type:
        if metrics.length_ratio > SAME_TYPE_MAX_LENGTH_RATIO:
            return False
        return metrics.sequence_ratio >= SAME_TYPE_STRONG_SEQUENCE_THRESHOLD or metrics.token_jaccard >= SAME_TYPE_STRONG_JACCARD_THRESHOLD or metrics.char_containment >= SAME_TYPE_STRONG_CONTAINMENT_THRESHOLD
    if metrics.length_ratio > CROSS_TYPE_MAX_LENGTH_RATIO:
        return False
    return metrics.char_containment >= CROSS_TYPE_STRONG_CONTAINMENT_THRESHOLD and metrics.token_containment >= CROSS_TYPE_STRONG_TOKEN_CONTAINMENT_THRESHOLD and (metrics.tag_overlap_count >= 2)

# --- Embedding helpers ---
def _get_embedding_vectors(texts: list[str], embedding_cache: dict[str, list[float]]) -> dict[str, list[float]]:
    """
    기존 AI Embedding endpoint를 batch로 사용한다.

    KnowledgeUnit 자체에 embedding 컬럼을 추가하지 않고
    한 sync 실행 동안만 in-memory cache를 사용한다.

    Embedding 장애가 나도 Interview/DNA 파이프라인 전체를
    막지 않고 문자열 기반 판정으로 fallback한다.
    """
    unique_texts: list[str] = []
    for text in texts:
        cleaned = text.strip()
        if not cleaned:
            continue
        if cleaned in embedding_cache:
            continue
        if cleaned in unique_texts:
            continue
        unique_texts.append(cleaned)
    if not unique_texts:
        return embedding_cache
    request_ids: dict[uuid.UUID, str] = {}
    items = []
    for text in unique_texts:
        item_id = uuid.uuid4()
        request_ids[item_id] = text
        items.append(EmbeddingItemRequest(item_id=item_id, item_type='QUERY', text=text))
    try:
        response = ai_client.create_embeddings(request=EmbeddingRequest(items=items))
    except AIClientError as exc:
        logger.warning('Duplicate semantic embedding failed; lexical fallback will be used: %s', str(exc))
        return embedding_cache
    if response.model != EMBEDDING_MODEL or response.dimension != EMBEDDING_DIMENSION:
        logger.warning('Duplicate semantic embedding returned unexpected model or dimension: model=%s dimension=%s', response.model, response.dimension)
        return embedding_cache
    for item in response.embeddings:
        text = request_ids.get(item.item_id)
        if text is None:
            continue
        if item.item_type != 'QUERY':
            continue
        if len(item.vector) != EMBEDDING_DIMENSION:
            continue
        embedding_cache[text] = [float(value) for value in item.vector]
    return embedding_cache

def _semantic_similarity(candidate_statement: str, knowledge_statement: str, embedding_cache: dict[str, list[float]]) -> float | None:
    candidate_vector = embedding_cache.get(candidate_statement.strip())
    knowledge_vector = embedding_cache.get(knowledge_statement.strip())
    if candidate_vector is None or knowledge_vector is None:
        return None
    return _cosine_similarity(candidate_vector, knowledge_vector)

# --- Duplicate decision rules ---
def _semantic_combined_score(metrics: _SimilarityMetrics, semantic_similarity: float) -> float:
    tag_score = min(metrics.tag_overlap_count / 3.0, 1.0)
    return semantic_similarity * 0.55 + metrics.char_containment * 0.2 + metrics.token_containment * 0.15 + tag_score * 0.1

def _is_semantic_duplicate(metrics: _SimilarityMetrics, semantic_similarity: float) -> tuple[bool, float]:
    combined_score = _semantic_combined_score(metrics=metrics, semantic_similarity=semantic_similarity)
    if metrics.same_type:
        if metrics.length_ratio > SAME_TYPE_MAX_LENGTH_RATIO:
            return (False, combined_score)
        has_structural_support = metrics.tag_overlap_count >= 1 or metrics.token_containment >= 0.4 or metrics.char_containment >= 0.5
        return (semantic_similarity >= SAME_TYPE_MIN_SEMANTIC_SIMILARITY and combined_score >= SAME_TYPE_MIN_COMBINED_SCORE and has_structural_support, combined_score)
    if metrics.length_ratio > CROSS_TYPE_MAX_LENGTH_RATIO:
        return (False, combined_score)
    has_structural_support = metrics.token_containment >= CROSS_TYPE_MIN_TOKEN_CONTAINMENT or metrics.char_containment >= CROSS_TYPE_MIN_CHAR_CONTAINMENT or metrics.sequence_ratio >= CROSS_TYPE_MIN_SEQUENCE_RATIO
    has_tag_support = metrics.tag_overlap_count >= 1
    high_semantic_override = semantic_similarity >= CROSS_TYPE_HIGH_SEMANTIC_OVERRIDE and has_tag_support
    normal_semantic_match = semantic_similarity >= CROSS_TYPE_MIN_SEMANTIC_SIMILARITY and combined_score >= CROSS_TYPE_MIN_COMBINED_SCORE and has_tag_support and has_structural_support
    return (normal_semantic_match or high_semantic_override, combined_score)

# --- Public duplicate detection entry point ---
def find_duplicate_active_knowledge(db: Session, mission_id: uuid.UUID, candidate: KnowledgeCandidate, embedding_cache: dict[str, list[float]] | None=None) -> DuplicateKnowledgeMatch | None:
    """
    같은 Mission의 활성 Knowledge 중 Candidate와
    사실상 동일한 지식을 찾는다.

    순서:
    1. Context / Type / polarity 안전성 검사
    2. 정규화 Exact
    3. 강한 lexical duplicate
    4. Embedding + lexical/context hybrid duplicate

    Candidate가 기존보다 더 풍부하거나 예외/조건 분기를
    추가한 경우에는 Duplicate로 억제하지 않고
    Synthesis/ENRICH로 넘긴다.
    """
    knowledge_rows = db.query(KnowledgeUnit).filter(KnowledgeUnit.mission_id == mission_id, KnowledgeUnit.status.in_(ACTIVE_KNOWLEDGE_STATUSES)).order_by(KnowledgeUnit.version.desc(), KnowledgeUnit.created_at.asc()).all()
    if not knowledge_rows:
        return None
    candidate_normalized = _normalize_text(candidate.statement)
    compatible_metrics: list[_SimilarityMetrics] = []
    for knowledge in knowledge_rows:
        if not _types_are_duplicate_compatible(candidate=candidate, knowledge=knowledge):
            continue
        if not _contexts_are_compatible(candidate=candidate, knowledge=knowledge):
            continue
        if _has_polarity_mismatch(candidate=candidate, knowledge=knowledge):
            continue
        if _candidate_adds_exception_signal(candidate=candidate, knowledge=knowledge):
            continue
        knowledge_normalized = _normalize_text(knowledge.statement)
        metrics = _build_metrics(candidate=candidate, knowledge=knowledge)
        if candidate_normalized and candidate_normalized == knowledge_normalized:
            return DuplicateKnowledgeMatch(knowledge=knowledge, match_type='EXACT', sequence_ratio=1.0, token_jaccard=1.0, token_containment=1.0, char_containment=1.0, semantic_similarity=None, combined_score=1.0, tag_overlap_count=metrics.tag_overlap_count)
        if _is_contained_insufficiency_duplicate(candidate=candidate, knowledge=knowledge, metrics=metrics):
            return DuplicateKnowledgeMatch(knowledge=knowledge, match_type='INSUFFICIENCY_CONTAINMENT', sequence_ratio=metrics.sequence_ratio, token_jaccard=metrics.token_jaccard, token_containment=metrics.token_containment, char_containment=metrics.char_containment, semantic_similarity=None, combined_score=_cheap_rank_score(metrics), tag_overlap_count=metrics.tag_overlap_count)
        compatible_metrics.append(metrics)
    if not compatible_metrics:
        return None
    lexical_matches = [metrics for metrics in compatible_metrics if _is_strong_lexical_duplicate(metrics)]
    if lexical_matches:
        lexical_matches.sort(key=_cheap_rank_score, reverse=True)
        best = lexical_matches[0]
        return DuplicateKnowledgeMatch(knowledge=best.knowledge, match_type='SAME_TYPE_LEXICAL' if best.same_type else 'CROSS_TYPE_LEXICAL', sequence_ratio=best.sequence_ratio, token_jaccard=best.token_jaccard, token_containment=best.token_containment, char_containment=best.char_containment, semantic_similarity=None, combined_score=_cheap_rank_score(best), tag_overlap_count=best.tag_overlap_count)
    compatible_metrics.sort(key=_cheap_rank_score, reverse=True)
    semantic_candidates = compatible_metrics[:SEMANTIC_CANDIDATE_LIMIT]
    cache = embedding_cache if embedding_cache is not None else {}
    texts = [candidate.statement]
    texts.extend((metrics.knowledge.statement for metrics in semantic_candidates))
    _get_embedding_vectors(texts=texts, embedding_cache=cache)
    best_match: DuplicateKnowledgeMatch | None = None
    best_score = 0.0
    best_observed_metrics: _SimilarityMetrics | None = None
    best_observed_semantic: float | None = None
    best_observed_combined = 0.0
    for metrics in semantic_candidates:
        semantic_similarity = _semantic_similarity(candidate_statement=candidate.statement, knowledge_statement=metrics.knowledge.statement, embedding_cache=cache)
        if semantic_similarity is None:
            continue
        is_duplicate, combined_score = _is_semantic_duplicate(metrics=metrics, semantic_similarity=semantic_similarity)
        if best_observed_semantic is None or semantic_similarity > best_observed_semantic:
            best_observed_metrics = metrics
            best_observed_semantic = semantic_similarity
            best_observed_combined = combined_score
        if not is_duplicate:
            continue
        ranking_score = combined_score + (0.01 if metrics.same_type else 0.0)
        if ranking_score <= best_score:
            continue
        best_score = ranking_score
        best_match = DuplicateKnowledgeMatch(knowledge=metrics.knowledge, match_type='SAME_TYPE_SEMANTIC' if metrics.same_type else 'CROSS_TYPE_SEMANTIC', sequence_ratio=metrics.sequence_ratio, token_jaccard=metrics.token_jaccard, token_containment=metrics.token_containment, char_containment=metrics.char_containment, semantic_similarity=semantic_similarity, combined_score=combined_score, tag_overlap_count=metrics.tag_overlap_count)
    if best_match is None and best_observed_metrics is not None and (best_observed_semantic is not None) and (best_observed_semantic >= DUPLICATE_DIAGNOSTIC_MIN_SEMANTIC):
        logger.warning('Duplicate candidate not suppressed; best semantic candidate metrics: candidate_id=%s knowledge_id=%s candidate_type=%s knowledge_type=%s semantic=%.4f combined=%.4f sequence=%.4f token_jaccard=%.4f token_containment=%.4f char_containment=%.4f length_ratio=%.4f tags=%s', candidate.candidate_id, best_observed_metrics.knowledge.knowledge_id, candidate.knowledge_type, best_observed_metrics.knowledge.knowledge_type, best_observed_semantic, best_observed_combined, best_observed_metrics.sequence_ratio, best_observed_metrics.token_jaccard, best_observed_metrics.token_containment, best_observed_metrics.char_containment, best_observed_metrics.length_ratio, best_observed_metrics.tag_overlap_count)
    return best_match

# --- Evidence reuse for suppressed duplicates ---
def reuse_existing_knowledge_for_duplicate(db: Session, analysis: InterviewAnalysis, candidate: KnowledgeCandidate, match: DuplicateKnowledgeMatch) -> None:
    """
    Duplicate Candidate를 삭제하지 않는다.

    새 Knowledge Unit / Synthesis를 만들지 않고
    기존 활성 Knowledge를 재사용하며,
    이번 전문가 답변은 Evidence로 누적한다.
    """
    knowledge = match.knowledge
    source_message = db.query(InterviewMessage).filter(InterviewMessage.message_id == analysis.source_message_id).first()
    if source_message is not None:
        existing_evidence = db.query(Evidence).filter(Evidence.knowledge_id == knowledge.knowledge_id, Evidence.source_type == 'INTERVIEW_MESSAGE', Evidence.source_id == str(source_message.message_id)).first()
        if existing_evidence is None:
            db.add(Evidence(knowledge_id=knowledge.knowledge_id, source_type='INTERVIEW_MESSAGE', source_id=str(source_message.message_id), source_text=source_message.content, confidence_score=candidate.confidence_score, metadata_={'candidate_id': str(candidate.candidate_id), 'analysis_id': str(analysis.analysis_id), 'duplicate_of_knowledge_id': str(knowledge.knowledge_id), 'duplicate_match_type': match.match_type, 'sequence_ratio': match.sequence_ratio, 'token_jaccard': match.token_jaccard, 'token_containment': match.token_containment, 'char_containment': match.char_containment, 'semantic_similarity': match.semantic_similarity, 'combined_score': match.combined_score, 'tag_overlap_count': match.tag_overlap_count, 'source': 'AUTO_DUPLICATE_SUPPRESSION'}))
    candidate.validation_status = 'VERIFIED'
    logger.info('Duplicate knowledge suppressed candidate_id=%s knowledge_id=%s match_type=%s semantic=%s combined=%.4f sequence=%.4f token_jaccard=%.4f token_containment=%.4f char_containment=%.4f tag_overlap=%s', candidate.candidate_id, knowledge.knowledge_id, match.match_type, f'{match.semantic_similarity:.4f}' if match.semantic_similarity is not None else 'n/a', match.combined_score, match.sequence_ratio, match.token_jaccard, match.token_containment, match.char_containment, match.tag_overlap_count)
    db.commit()
    db.refresh(candidate)
