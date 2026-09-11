import type { InterviewResponse } from "@/services/interview";

export type DashboardSummary = {
  knowledgeUnits: number;
  verifiedKnowledge: number;
  conflicts: number;
};

export function getInterviewStatusLabel(
  interview: InterviewResponse
) {
  if (interview.status === "IN_PROGRESS") {
    return "진행 중";
  }

  if (interview.status === "CREATED") {
    return "시작 전";
  }

  return interview.status;
}