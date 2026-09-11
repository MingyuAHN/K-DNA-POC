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

import type { MissionKnowledgeGap } from "@/services/gap";

// Topic별 아이콘
export const topicIconMap: Record<string, typeof Box> = {
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
export const dimensionLabelMap: Record<string, string> = {
  WHAT: "무엇을 (WHAT)",
  WHY: "왜 (WHY)",
  WHEN: "언제 (WHEN)",
  HOW: "어떻게 (HOW)",
  SIGNAL: "판단 신호 (SIGNAL)",
  EXCEPTION: "예외 조건 (EXCEPTION)",
  FAILURE: "실패 사례 (FAILURE)",
  TRADE_OFF: "트레이드오프 (TRADE_OFF)",
};

// Gap Type 한글 표시
export const gapTypeLabelMap: Record<string, string> = {
  MISSING: "지식 부족",
  INCOMPLETE: "불완전",
  UNCERTAIN: "불확실",
  LOW_EVIDENCE: "근거 부족",
};

// Topic 표시
export function formatTopic(topic: string) {
  return topic
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());
}

// Gap Score 표시
export function formatGapScore(score: number | null) {
  if (score === null || score === undefined) {
    return "-";
  }

  return `${Math.round(score * 100)}%`;
}

// Topic별 평균 Gap Score
export function getAverageGapScore(
  items: MissionKnowledgeGap[]
) {
  const scores = items
    .map((item) => item.gap_score)
    .filter((score): score is number => score !== null);

  if (scores.length === 0) {
    return null;
  }

  return (
    scores.reduce(
      (sum, score) => sum + score,
      0
    ) / scores.length
  );
}