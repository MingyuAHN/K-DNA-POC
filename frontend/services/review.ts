const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export type ReviewContext = Record<string, unknown>;

export type ReviewDecisionRule =
  | Record<string, unknown>
  | null;

export type KnowledgeReviewCandidate = {
  candidate_id: string;
  analysis_id: string;
  interview_id: string;
  source_message_id: string;

  statement: string;
  knowledge_type: string;
  context: ReviewContext;
  decision_rule: ReviewDecisionRule;
  rationale: string | null;
  exception: string | null;

  novelty_score: number | null;
  confidence_score: number | null;
  validation_status: string;

  review_status: string;
  review_reason: string | null;

  synthesis_id: string | null;
  synthesis_status: string | null;
  synthesis_operation: string | null;
  synthesis_reason: string | null;

  created_at: string;
};

export type KnowledgeReviewCandidateListResponse = {
  mission_id: string;
  total: number;
  candidates: KnowledgeReviewCandidate[];
};

export type KnowledgeSynthesisRequest = {
  related_knowledge_ids?: string[];
};

export type SynthesizedKnowledgeUnit = {
  synthesis_unit_id: string;
  synthesized_index: number;

  statement: string;
  type: string;

  context: Record<string, unknown>;
  decision_rule: Record<string, unknown> | null;

  rationale: string | null;
  exception: string | null;

  novelty_score: number;
  confidence_score: number;

  validation_status: string;
};

export type SynthesisRelation = {
  synthesis_relation_id: string;
  synthesized_index: number;
  target_knowledge_id: string;
  relation: string;
  reason: string | null;
};

export type KnowledgeSynthesisResponse = {
  synthesis_id: string;
  candidate_id: string;
  mission_id: string;

  operation: string;

  target_knowledge_ids: string[];

  synthesized_knowledge_units: SynthesizedKnowledgeUnit[];

  relations: SynthesisRelation[];

  reason: string | null;
};

export type SynthesisDecision =
  | "APPROVE"
  | "REJECT";

export type KnowledgeSynthesisValidationRequest = {
  decision: SynthesisDecision;
  reason?: string | null;
  validated_by?: string | null;
};

export type AppliedKnowledgeUnit = {
  synthesis_unit_id: string;
  knowledge_id: string;
  knowledge_type: string;
  statement: string;
  version: number;
  status: string;
};

export type KnowledgeSynthesisValidationResponse = {
  synthesis_id: string;
  decision: SynthesisDecision;
  status: string;
  operation: string;

  resulting_knowledge_ids: string[];
  knowledge_units: AppliedKnowledgeUnit[];

  reason: string | null;
  validated_by: string | null;
};

async function getErrorMessage(
  response: Response,
  fallbackMessage: string
) {
  try {
    const data = await response.json();

    if (typeof data?.detail === "string") {
      return data.detail;
    }

    return fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

// Mission 기준 Review Candidate 조회
export async function getMissionReviewCandidates(
  missionId: string
): Promise<KnowledgeReviewCandidateListResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/missions/${missionId}/knowledge-review-candidates`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Review Candidate 목록 조회에 실패했습니다."
      )
    );
  }

  return response.json();
}

// Candidate Synthesis
export async function synthesizeKnowledgeCandidate(
  candidateId: string,
  payload: KnowledgeSynthesisRequest = {}
): Promise<KnowledgeSynthesisResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/knowledge-candidates/${candidateId}/synthesize`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        related_knowledge_ids:
          payload.related_knowledge_ids ?? [],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Knowledge Synthesis에 실패했습니다."
      )
    );
  }

  return response.json();
}

// Synthesis 승인 / 거절
export async function validateKnowledgeSynthesis(
  synthesisId: string,
  payload: KnowledgeSynthesisValidationRequest
): Promise<KnowledgeSynthesisValidationResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/knowledge-syntheses/${synthesisId}/validate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        payload.decision === "APPROVE"
          ? "Knowledge 승인에 실패했습니다."
          : "Knowledge 거절에 실패했습니다."
      )
    );
  }

  return response.json();
}