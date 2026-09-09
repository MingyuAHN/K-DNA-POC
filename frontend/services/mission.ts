const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export type MissionCreateRequest = {
  title: string;
  domain: string;
  objective: string;
};

export type MissionResponse = {
  mission_id: string;
  title: string;
  domain: string;
  objective: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type MissionListResponse = {
  total: number;
  missions: MissionResponse[];
};

export type MissionDocumentResponse = {
  document_id: string;
  mission_id: string;
  file_name: string;
  document_type: string;
  content_uri: string | null;
  processing_status: string;
  created_at: string;
  updated_at: string;
};

// Backend 오류 응답 메시지 추출
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

// Mission 생성
export async function createMission(
  payload: MissionCreateRequest
): Promise<MissionResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/missions`,
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
        "미션 생성 중 오류가 발생했습니다."
      )
    );
  }

  return response.json();
}

// Mission 목록 조회
export async function getMissions(): Promise<MissionListResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/missions`
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Mission 목록 조회에 실패했습니다."
      )
    );
  }

  return response.json();
}

// Mission 단건 조회
export async function getMission(
  missionId: string
): Promise<MissionResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/missions/${missionId}`
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Mission 조회에 실패했습니다."
      )
    );
  }

  return response.json();
}

// Mission별 Seed 문서 업로드
export async function uploadMissionDocument(
  missionId: string,
  file: File
): Promise<MissionDocumentResponse> {
  const formData = new FormData();

  // Backend multipart field명
  formData.append("file", file);

  const response = await fetch(
    `${API_BASE_URL}/api/v1/missions/${missionId}/documents`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        `${file.name} 업로드 중 오류가 발생했습니다.`
      )
    );
  }

  return response.json();
}