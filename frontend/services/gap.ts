const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

// Mission Gap 타입
export type MissionKnowledgeGap = {
  gap_id: string;
  mission_id: string;
  interview_id: string;
  analysis_id: string;
  topic: string;
  dimension: string;
  gap_type: string;
  gap_score: number | null;
  reason: string;
  created_at: string;
};

// Gap 목록 응답 타입
export type MissionKnowledgeGapListResponse = {
  total: number;
  gaps: MissionKnowledgeGap[];
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

// Mission 기준 Gap 목록 조회
export async function getMissionGaps(
  missionId: string
): Promise<MissionKnowledgeGapListResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/missions/${missionId}/gaps`,
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
        "Gap 목록 조회에 실패했습니다."
      )
    );
  }

  return response.json();
}