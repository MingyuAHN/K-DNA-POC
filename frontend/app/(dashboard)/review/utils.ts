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