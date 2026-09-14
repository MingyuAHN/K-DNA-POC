// 지식 유형 한글 표시
const knowledgeTypeLabelMap: Record<
  string,
  string
> = {
  FACT: "사실",
  PRINCIPLE: "원칙",
  DECISION_RULE: "판단 규칙",
  HEURISTIC: "경험 규칙",
  EXCEPTION: "예외",
  FAILURE_LESSON: "실패 교훈",
  TRADE_OFF: "트레이드오프",
  EXPERT_OPINION: "전문가 의견",
};

// 지식 유형 표시
export function formatKnowledgeType(
  knowledgeType: string
) {
  return (
    knowledgeTypeLabelMap[
      knowledgeType
    ] ?? knowledgeType
  );
}