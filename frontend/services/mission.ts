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

export type DocumentParseResponse = {
  document_id: string;
  processing_status: string;
  raw_text_length: number;
  raw_text_preview: string;
};

export type DocumentChunkResponse = {
  document_id: string;
  processing_status: string;
  chunk_count: number;
  chunks: Array<{
    chunk_id: string;
    seq: number;
    content_preview: string;
  }>;
};

export type DocumentClaimExtractionResponse = {
  schema_version: string;
  document_id: string;
  processing_status: string;
  chunk_count: number;
  extracted_claim_count: number;
  claims: Array<{
    claim_id: string;
    mission_id: string;
    source_chunk_id: string;
    claim_type: string;
    statement: string;
    context: Record<string, unknown>;
    source_text: string | null;
    confidence_score: number | null;
  }>;
};

export type DocumentEmbeddingResponse = {
  document_id: string;
  processing_status: string;
  model: string;
  dimension: number;
  chunk_total: number;
  chunk_embedded: number;
  baseline_claim_total: number;
  baseline_claim_embedded: number;
};

// Backend 오류 메시지 추출
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

// Seed 문서 업로드
export async function uploadMissionDocument(
  missionId: string,
  file: File
): Promise<MissionDocumentResponse> {
  const formData = new FormData();

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

// 문서 Parsing
export async function parseMissionDocument(
  documentId: string
): Promise<DocumentParseResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/documents/${documentId}/parse`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Seed 문서 Parsing 중 오류가 발생했습니다."
      )
    );
  }

  return response.json();
}

// 문서 Chunk 생성
export async function chunkMissionDocument(
  documentId: string
): Promise<DocumentChunkResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/documents/${documentId}/chunk`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Seed 문서 Chunk 생성 중 오류가 발생했습니다."
      )
    );
  }

  return response.json();
}

// Baseline Claim 추출
export async function extractMissionDocumentClaims(
  documentId: string
): Promise<DocumentClaimExtractionResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/documents/${documentId}/claims/extract`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Seed 문서 Claim 추출 중 오류가 발생했습니다."
      )
    );
  }

  return response.json();
}

// Embedding 생성
export async function generateMissionDocumentEmbeddings(
  documentId: string
): Promise<DocumentEmbeddingResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/documents/${documentId}/embeddings/generate`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Seed 문서 Embedding 생성 중 오류가 발생했습니다."
      )
    );
  }

  return response.json();
}

// Seed 전체 전처리
export async function processMissionDocument(
  documentId: string
) {
  console.log("PARSE START", documentId);
  await parseMissionDocument(documentId);

  console.log("CHUNK START", documentId);
  await chunkMissionDocument(documentId);

  console.log("CLAIMS START", documentId);
  await extractMissionDocumentClaims(documentId);

  console.log("EMBEDDINGS START", documentId);
  await generateMissionDocumentEmbeddings(documentId);

  console.log("PROCESS COMPLETE", documentId);
}