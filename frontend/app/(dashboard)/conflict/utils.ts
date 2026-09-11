// 심각도 한글 표시
const severityLabelMap: Record<string, string> = {
  HIGH: "높음",
  MEDIUM: "중간",
  LOW: "낮음",
};

// Conflict Type 한글 표시
const conflictTypeLabelMap: Record<string, string> = {
  CONDITIONAL_CONFLICT: "조건부 충돌",
  CONTEXT_DIFFERENCE: "Context 차이",
  DIRECT_CONFLICT: "직접 충돌",
};

export function getConflictTypeLabel(conflictType: string) {
  return conflictTypeLabelMap[conflictType] ?? conflictType;
}

export function getSeverityLabel(severity: string) {
  return severityLabelMap[severity] ?? severity;
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