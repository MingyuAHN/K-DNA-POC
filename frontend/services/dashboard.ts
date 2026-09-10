const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

// Knowledge Unit 타입
export type KnowledgeUnitResponse = {
  knowledge_id: string;
  mission_id: string;
  source_candidate_id: string | null;

  knowledge_type: string;
  statement: string;

  context: Record<string, unknown>;

  decision_rule: Record<string, unknown> | null;
  rationale: string | null;
  exception: string | null;

  status: string;
  confidence_score: number | null;

  version: number;

  root_knowledge_id: string | null;
  supersedes_id: string | null;

  change_reason: string | null;

  created_at: string;
  updated_at: string;
};

// API 오류 메시지 처리
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

// Mission 기준 Knowledge Unit 조회
export async function getMissionKnowledgeUnits(
  missionId: string
): Promise<KnowledgeUnitResponse[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/missions/${missionId}/knowledge-units`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Knowledge Unit 조회에 실패했습니다."
      )
    );
  }

  return response.json();
}