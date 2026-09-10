const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

// Conflict Source 타입
export type MissionConflictSource = {
  conflict_source_id: string;
  source_type: string;
  source_id: string | null;
  content: string;
  created_at: string;
};

// Mission Conflict 타입
export type MissionKnowledgeConflict = {
  conflict_id: string;
  mission_id: string;
  interview_id: string;
  analysis_id: string;
  conflict_type: string;
  severity: string;
  description: string;
  context_difference: string | null;
  unknown_condition: string | null;
  recommended_question: string | null;
  sources: MissionConflictSource[];
  created_at: string;
};

// Conflict 목록 응답 타입
export type MissionKnowledgeConflictListResponse = {
  total: number;
  conflicts: MissionKnowledgeConflict[];
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

// Mission 기준 Conflict 목록 조회
export async function getMissionConflicts(
  missionId: string
): Promise<MissionKnowledgeConflictListResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/missions/${missionId}/conflicts`,
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
        "Conflict 목록 조회에 실패했습니다."
      )
    );
  }

  return response.json();
}