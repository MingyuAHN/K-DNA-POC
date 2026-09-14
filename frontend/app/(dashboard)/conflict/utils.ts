// 심각도 한글 표시
const severityLabelMap: Record<string, string> = {
  HIGH: "높음",
  MEDIUM: "중간",
  LOW: "낮음",
};

// Conflict Type 한글 표시
const conflictTypeLabelMap: Record<string, string> = {
  CONDITIONAL_CONFLICT: "조건부 충돌",
  CONTEXT_DIFFERENCE: "맥락 차이 · 양립 가능",
  DIRECT_CONFLICT: "직접 충돌",
  WORDING_DIFFERENCE: "표현 차이 · 의미 유사",
};

// Conflict Type 설명
const conflictTypeDescriptionMap: Record<string, string> = {
  CONDITIONAL_CONFLICT:
    "조건에 따라 서로 다른 규칙이 적용될 수 있습니다.",
  CONTEXT_DIFFERENCE:
    "적용되는 상황이 달라 두 지식이 모두 맞을 수 있습니다.",
  DIRECT_CONFLICT:
    "같은 맥락에서 두 주장이 직접 상충하여 재확인이 필요합니다.",
  WORDING_DIFFERENCE:
    "표현은 다르지만 의미상 같은 지식일 가능성이 높습니다.",
};

// Source Type 사용자 표시
const sourceTypeLabelMap: Record<string, string> = {
  BASELINE_CLAIM: "기존 지식",
  KNOWLEDGE_UNIT: "검증된 지식",
  EVIDENCE: "근거 자료",
};

export function getConflictTypeLabel(conflictType: string) {
  return conflictTypeLabelMap[conflictType] ?? conflictType;
}

export function getConflictTypeDescription(conflictType: string) {
  return conflictTypeDescriptionMap[conflictType] ?? "";
}

export function getSeverityLabel(severity: string) {
  return severityLabelMap[severity] ?? severity;
}

export function getSourceTypeLabel(sourceType: string) {
  return sourceTypeLabelMap[sourceType] ?? sourceType;
}

// 생성일 표시
export function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}