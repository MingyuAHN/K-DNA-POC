const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export type InterviewStatus =
  | "CREATED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type InterviewMessageRole =
  | "USER"
  | "ASSISTANT"
  | "SYSTEM";


// ============================================================
// Expert
// ============================================================

export type ExpertCreateRequest = {
  name: string;
  organization?: string | null;
  role?: string | null;
  metadata: Record<string, unknown>;
};

export type ExpertResponse = {
  expert_id: string;
  name: string;
  organization: string | null;
  role: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ExpertListResponse = {
  total: number;
  experts: ExpertResponse[];
};


// ============================================================
// Interview
// ============================================================

export type InterviewCreateRequest = {
  expert_id: string;
  title?: string | null;
};

export type InterviewResponse = {
  interview_id: string;
  mission_id: string;
  expert_id: string;
  title: string | null;
  status: InterviewStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MissionInterviewListResponse = {
  mission_id: string;
  total: number;
  interviews: InterviewResponse[];
};

export type InterviewMessageCreateRequest = {
  content: string;
};

export type InterviewMessage = {
  message_id: string;
  interview_id: string;
  role: InterviewMessageRole;
  content: string;
  sequence: number;
  created_at: string;
};

export type InterviewMessagesResponse = {
  interview_id: string;
  messages: InterviewMessage[];
};


// ============================================================
// Interview Turn
// ============================================================

export type KnowledgeContext = {
  project: string | null;
  phase: string | null;
  domain: string | null;
  system: string | null;
  scope: string | null;
  time: string | null;
  constraints: string[];
  tags: string[];
};

export type DecisionRule = {
  if_conditions: string[];
  then: string;
  unless: string[];
};

export type KnowledgeCandidateItem = {
  statement: string;
  type: string;
  context: KnowledgeContext;
  decision_rule: DecisionRule | null;
  rationale: string | null;
  exception: string | null;
  novelty_score: number;
  confidence_score: number;
  validation_status: string;
};

export type KnowledgeGapItem = {
  topic: string;
  dimension: string;
  gap_type: string;
  gap_score: number;
  reason: string;
};

export type ConflictSourceItem = {
  source_type: string;
  source_id: string | null;
  content: string;
};

export type KnowledgeConflictItem = {
  conflict_type: string;
  severity: string;
  description: string;
  sources: ConflictSourceItem[];
  context_difference: string | null;
  unknown_condition: string | null;
  recommended_question: string | null;
};

export type QuestionCandidateItem = {
  question: string;
  question_type: string;
  target_gap: string | null;
  gap_reduction_score: number;
  novelty_score: number;
  business_impact_score: number;
  conflict_resolution_score: number;
  redundancy_score: number;
  value_score: number;
};

export type InterviewTurnRequest = {
  content: string;
  knowledge_top_k?: number;
  evidence_top_k?: number;
  history_limit?: number;
};

export type InterviewTurnResponse = {
  analysis_id: string;
  interview_id: string;
  user_message_id: string;
  assistant_message_id: string | null;
  user_message: string;
  knowledge_candidates: KnowledgeCandidateItem[];
  gaps: KnowledgeGapItem[];
  conflicts: KnowledgeConflictItem[];
  question_candidates: QuestionCandidateItem[];
  next_question: QuestionCandidateItem | null;
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


// ============================================================
// Expert API
// ============================================================

// Expert 목록 조회 / 검색
export async function getExperts(
  query = "",
  limit = 100
): Promise<ExpertListResponse> {
  const searchParams = new URLSearchParams();

  if (query.trim()) {
    searchParams.set("query", query.trim());
  }

  searchParams.set("limit", String(limit));

  const response = await fetch(
    `${API_BASE_URL}/api/v1/experts?${searchParams.toString()}`
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "전문가 목록을 불러오는 중 오류가 발생했습니다."
      )
    );
  }

  return response.json();
}


// Expert 단건 조회
export async function getExpert(
  expertId: string
): Promise<ExpertResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/experts/${expertId}`
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "전문가 정보를 불러오는 중 오류가 발생했습니다."
      )
    );
  }

  return response.json();
}


// Expert 등록
export async function createExpert(
  payload: ExpertCreateRequest
): Promise<ExpertResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/experts`,
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
        "전문가 등록 중 오류가 발생했습니다."
      )
    );
  }

  return response.json();
}


// ============================================================
// Interview API
// ============================================================

// Interview 생성
export async function createInterview(
  missionId: string,
  payload: InterviewCreateRequest
): Promise<InterviewResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/missions/${missionId}/interviews`,
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
        "인터뷰 생성 중 오류가 발생했습니다."
      )
    );
  }

  return response.json();
}


// Mission별 Interview 목록 조회
export async function getMissionInterviews(
  missionId: string
): Promise<MissionInterviewListResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/missions/${missionId}/interviews`
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Mission의 인터뷰 목록을 불러오는 중 오류가 발생했습니다."
      )
    );
  }

  return response.json();
}


// Expert 메시지 저장
// /turns 사용 시 이 함수와 동시에 호출하면 안 됨.
export async function sendInterviewMessage(
  interviewId: string,
  payload: InterviewMessageCreateRequest
): Promise<InterviewMessage> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/interviews/${interviewId}/messages`,
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
        "메시지 전송 중 오류가 발생했습니다."
      )
    );
  }

  return response.json();
}


// Interview 대화 이력 조회
export async function getInterviewMessages(
  interviewId: string
): Promise<InterviewMessagesResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/interviews/${interviewId}/messages`
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "인터뷰 대화 이력을 불러오는 중 오류가 발생했습니다."
      )
    );
  }

  const data: InterviewMessagesResponse = await response.json();

  return {
    ...data,
    messages: [...data.messages].sort(
      (a, b) => a.sequence - b.sequence
    ),
  };
}


// Interview 1 Turn 처리
// 답변 저장 → AI 분석 → 후속 질문 생성
export async function processInterviewTurn(
  interviewId: string,
  payload: InterviewTurnRequest
): Promise<InterviewTurnResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/interviews/${interviewId}/turns`,
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
        "인터뷰 AI 처리 중 오류가 발생했습니다."
      )
    );
  }

  return response.json();
}


// Interview 수동 종료
export async function completeInterview(
  interviewId: string
): Promise<InterviewResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/interviews/${interviewId}/complete`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "인터뷰 종료 중 오류가 발생했습니다."
      )
    );
  }

  return response.json();
}