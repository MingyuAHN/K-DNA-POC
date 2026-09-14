// 지식 유형 표시
export function formatKnowledgeType(
  knowledgeType: string
) {
  return knowledgeType
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

// 신뢰도 표시
export function formatConfidence(
  value: number | null
) {
  if (value === null) {
    return "-";
  }

  return `${Math.round(value * 100)}%`;
}