const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000";

/* Graph 노드 타입 */
export type KnowledgeGraphNode = {
  knowledge_id: string;
  knowledge_type: string;
  statement: string;
  context: Record<string, unknown>;
  status: string;
  confidence_score: number | null;
  version: number;
  root_knowledge_id: string | null;
  supersedes_id: string | null;
};

/* Graph 관계선 타입 */
export type KnowledgeGraphEdge = {
  relation_id: string;
  source: string;   
  target: string;
  relation_type: string;
  confidence_score: number | null;
  source_analysis_id: string | null;
};

/* Knowledge Graph API 응답 타입 */
export type KnowledgeGraphResponse = {
  mission_id: string;
  node_count: number;
  edge_count: number;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
};

/* 공통 에러 메시지 추출 */
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

/* Mission 단위 Knowledge Graph 조회 */
export async function getKnowledgeGraph(
  missionId: string
): Promise<KnowledgeGraphResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/missions/${missionId}/knowledge-graph`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Knowledge Graph 조회에 실패했습니다."
      )
    );
  }

  return response.json();
}