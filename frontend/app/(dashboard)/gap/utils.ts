import {
  AlertTriangle,
  Box,
  CircleAlert,
  Clock3,
  Database,
  Gauge,
  HelpCircle,
  Lightbulb,
  Link2,
  Scale,
  Settings2,
} from "lucide-react";

// Topic별 아이콘
export const topicIconMap: Record<
  string,
  typeof Box
> = {
  "service-boundary": Box,
  SERVICE_BOUNDARY: Box,

  "data-ownership": Database,
  DATA_OWNERSHIP: Database,

  transaction: Link2,
  TRANSACTION: Link2,

  exception: Settings2,
  EXCEPTION: Settings2,

  "failure-cases": AlertTriangle,
  FAILURE_CASES: AlertTriangle,
};

// Dimension별 아이콘
export const dimensionIconMap: Record<
  string,
  typeof HelpCircle
> = {
  WHAT: HelpCircle,
  WHY: Lightbulb,
  WHEN: Clock3,
  HOW: Settings2,
  SIGNAL: Gauge,
  EXCEPTION: CircleAlert,
  FAILURE: AlertTriangle,
  TRADE_OFF: Scale,
};

// Dimension 한글 표시
export const dimensionLabelMap: Record<
  string,
  string
> = {
  WHAT: "무엇을",
  WHY: "왜",
  WHEN: "언제",
  HOW: "어떻게",
  SIGNAL: "판단 신호",
  EXCEPTION: "예외 조건",
  FAILURE: "실패 사례",
  TRADE_OFF: "트레이드오프",
};

// Gap Type 한글 표시
export const gapTypeLabelMap: Record<
  string,
  string
> = {
  // 기존 타입
  MISSING: "지식 부족",
  INCOMPLETE: "불완전",
  UNCERTAIN: "불확실",
  LOW_EVIDENCE: "근거 부족",

  // 현재 Gap 분석 타입
  MISSING_KNOWLEDGE: "지식 부족",
  MISSING_SIGNAL:
    "판단 신호 부족",
  MISSING_EXCEPTION:
    "예외 정보 부족",
  MISSING_EVIDENCE:
    "근거 부족",
  MISSING_CONTEXT:
    "맥락 정보 부족",
  MISSING_FAILURE:
    "실패 사례 부족",
  MISSING_TRADE_OFF:
    "트레이드오프 부족",
};

// Topic 표시
export function formatTopic(
  topic: string
) {
  return topic
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(
      /\b\w/g,
      (value) =>
        value.toUpperCase()
    );
}

// Gap Score 표시
export function formatGapScore(
  score: number | null
) {
  if (
    score === null ||
    score === undefined
  ) {
    return "-";
  }

  return `${Math.round(
    score * 100
  )}%`;
}