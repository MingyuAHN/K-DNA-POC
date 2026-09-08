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

export type ExpertCreateRequest = {
  name: string;
  organization: string;
  role: string;
  metadata: Record<string, unknown>;
};

export type ExpertResponse = {
  expert_id: string;
  name: string;
  organization: string;
  role: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type InterviewCreateRequest = {
  expert_id: string;
  title: string;
};

export type InterviewResponse = {
  interview_id: string;
  mission_id: string;
  expert_id: string;
  title: string;
  status: InterviewStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
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
  metadata: Record<string, unknown>;
  created_at: string;
};

export type InterviewMessagesResponse = {
  interview_id: string;
  messages: InterviewMessage[];
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

// Expert 메시지 저장
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