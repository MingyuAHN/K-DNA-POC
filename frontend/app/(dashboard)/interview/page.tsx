"use client";

import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  AlertTriangle,
  ArrowUp,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  Database,
  Layers3,
  Lightbulb,
  Link2,
  MessageSquareText,
  Plus,
  Search,
  ShieldAlert,
  Square,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";

import { interviewMock } from "@/mocks/interviewMock";

import {
  getMission,
  type MissionResponse,
} from "@/services/mission";

import {
  completeInterview,
  createExpert,
  createInterview,
  getExperts,
  getInterviewMessages,
  getMissionInterviews,
  processInterviewTurn,
  type ExpertResponse,
  type InterviewMessage,
  type InterviewResponse,
  type InterviewTurnResponse,
} from "@/services/interview";


/* ============================================================
   Coverage 아이콘
============================================================ */

const coverageIconMap = {
  layers: Layers3,
  database: Database,
  link: Link2,
  alert: CircleAlert,
  warning: AlertTriangle,
};


/* ============================================================
   메시지 시간 표시
============================================================ */

function formatMessageTime(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}


/* ============================================================
   Interview 생성일 표시
============================================================ */

function formatInterviewDate(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}


/* ============================================================
   Interview 상태 표시
============================================================ */

function getInterviewStatusLabel(status: string) {
  switch (status) {
    case "CREATED":
      return "생성됨";

    case "IN_PROGRESS":
      return "진행 중";

    case "COMPLETED":
      return "종료";

    case "CANCELLED":
      return "취소";

    default:
      return status;
  }
}


/* ============================================================
   Interview 실제 화면
============================================================ */

function InterviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const missionId =
    searchParams.get("missionId");

  const queryInterviewId =
    searchParams.get("interviewId");


  // ============================================================
  // Interview 선택
  // ============================================================

  const [
    interviews,
    setInterviews,
  ] = useState<InterviewResponse[]>([]);

  const [
    selectedInterviewId,
    setSelectedInterviewId,
  ] = useState(
    queryInterviewId ?? ""
  );

  const [
    isInterviewDropdownOpen,
    setIsInterviewDropdownOpen,
  ] = useState(false);

  const [
    interviewsLoading,
    setInterviewsLoading,
  ] = useState(true);

  const [
    interviewListError,
    setInterviewListError,
  ] = useState("");


  // ============================================================
  // 새 Interview
  // ============================================================

  const [
    isCreateOpen,
    setIsCreateOpen,
  ] = useState(false);

  const [
    interviewTitle,
    setInterviewTitle,
  ] = useState("");

  const [
    isCreatingInterview,
    setIsCreatingInterview,
  ] = useState(false);

  const [
    createInterviewError,
    setCreateInterviewError,
  ] = useState("");


  // ============================================================
  // Expert 선택 / 등록
  // ============================================================

  const [
    experts,
    setExperts,
  ] = useState<ExpertResponse[]>([]);

  const [
    expertSearch,
    setExpertSearch,
  ] = useState("");

  const [
    selectedExpertId,
    setSelectedExpertId,
  ] = useState("");

  const [
    expertsLoading,
    setExpertsLoading,
  ] = useState(false);

  const [
    expertError,
    setExpertError,
  ] = useState("");

  const [
    isNewExpertOpen,
    setIsNewExpertOpen,
  ] = useState(false);

  const [
    newExpertName,
    setNewExpertName,
  ] = useState("");

  const [
    newExpertOrganization,
    setNewExpertOrganization,
  ] = useState("");

  const [
    newExpertRole,
    setNewExpertRole,
  ] = useState("");

  const [
    isCreatingExpert,
    setIsCreatingExpert,
  ] = useState(false);


  // 전문가 답변
  const [message, setMessage] =
    useState("");

  // 실제 Interview 대화 목록
  const [messages, setMessages] =
    useState<InterviewMessage[]>([]);

  // 가장 최근 AI 분석 결과
  const [
    latestTurn,
    setLatestTurn,
  ] =
    useState<InterviewTurnResponse | null>(
      null
    );

  // Mission 조회 상태
  const [mission, setMission] =
    useState<MissionResponse | null>(null);

  const [
    missionLoading,
    setMissionLoading,
  ] = useState(true);

  const [
    missionError,
    setMissionError,
  ] = useState("");

  // Interview 메시지 상태
  const [
    messagesLoading,
    setMessagesLoading,
  ] = useState(true);

  const [
    messageError,
    setMessageError,
  ] = useState("");

  const [
    isSending,
    setIsSending,
  ] = useState(false);

  // Interview 종료 상태
  const [
    isInterviewCompleted,
    setIsInterviewCompleted,
  ] = useState(false);

  const [
    isCompleting,
    setIsCompleting,
  ] = useState(false);

  // Coverage는 아직 실제 API 미연동
  const coverageItems =
    interviewMock.coverageItems;


  /* ==========================================================
     현재 선택된 Interview
  ========================================================== */

  const selectedInterview =
    useMemo(() => {
      return (
        interviews.find(
          (interview) =>
            interview.interview_id ===
            selectedInterviewId
        ) ?? null
      );
    }, [
      interviews,
      selectedInterviewId,
    ]);


  /* ==========================================================
     Mission 조회
  ========================================================== */

  useEffect(() => {
    const fetchMission =
      async () => {
        if (!missionId) {
          setMissionError(
            "Mission ID가 없습니다."
          );

          setMissionLoading(false);

          return;
        }

        try {
          setMissionLoading(true);
          setMissionError("");

          const data =
            await getMission(
              missionId
            );

          setMission(data);
        } catch (error) {
          console.error(
            "MISSION FETCH ERROR:",
            error
          );

          setMissionError(
            error instanceof Error
              ? error.message
              : "Mission 조회 중 오류가 발생했습니다."
          );
        } finally {
          setMissionLoading(false);
        }
      };

    void fetchMission();
  }, [missionId]);


  /* ==========================================================
     Mission별 Interview 목록 조회
  ========================================================== */

  const fetchInterviews =
    useCallback(async () => {
      if (!missionId) {
        setInterviewListError(
          "Mission ID가 없습니다."
        );

        setInterviewsLoading(false);

        return;
      }

      try {
        setInterviewsLoading(true);
        setInterviewListError("");

        const data =
          await getMissionInterviews(
            missionId
          );

        // 최신 Interview부터 표시
        const sortedInterviews = [
          ...data.interviews,
        ].sort(
          (a, b) =>
            new Date(
              b.created_at
            ).getTime() -
            new Date(
              a.created_at
            ).getTime()
        );

        setInterviews(
          sortedInterviews
        );

        // URL Interview 우선 선택
        const queryInterview =
          sortedInterviews.find(
            (interview) =>
              interview.interview_id ===
              queryInterviewId
          );

        const currentInterview =
          sortedInterviews.find(
            (interview) =>
              interview.interview_id ===
              selectedInterviewId
          );

        const nextInterview =
          queryInterview ??
          currentInterview ??
          sortedInterviews[0] ??
          null;

        if (!nextInterview) {
          setSelectedInterviewId("");
          setIsInterviewCompleted(false);

          return;
        }

        setSelectedInterviewId(
          nextInterview.interview_id
        );

        setIsInterviewCompleted(
          nextInterview.status ===
            "COMPLETED"
        );

        if (
          nextInterview.interview_id !==
          queryInterviewId
        ) {
          router.replace(
            `/interview?missionId=${encodeURIComponent(
              missionId
            )}&interviewId=${encodeURIComponent(
              nextInterview.interview_id
            )}`
          );
        }
      } catch (error) {
        console.error(
          "INTERVIEW LIST FETCH ERROR:",
          error
        );

        setInterviewListError(
          error instanceof Error
            ? error.message
            : "Interview 목록을 불러오는 중 오류가 발생했습니다."
        );
      } finally {
        setInterviewsLoading(false);
      }
    }, [
      missionId,
      queryInterviewId,
      router,
      selectedInterviewId,
    ]);


  useEffect(() => {
    void fetchInterviews();
  }, [fetchInterviews]);


  /* ==========================================================
     Expert 목록 조회
  ========================================================== */

  const fetchExperts =
    useCallback(
      async (query = "") => {
        try {
          setExpertsLoading(true);
          setExpertError("");

          const data =
            await getExperts(
              query,
              100
            );

          setExperts(
            data.experts
          );
        } catch (error) {
          console.error(
            "EXPERT LIST FETCH ERROR:",
            error
          );

          setExpertError(
            error instanceof Error
              ? error.message
              : "전문가 목록을 불러오는 중 오류가 발생했습니다."
          );
        } finally {
          setExpertsLoading(false);
        }
      },
      []
    );


  // 새 Interview 창을 열면 Expert 조회
  useEffect(() => {
    if (!isCreateOpen) {
      return;
    }

    void fetchExperts("");
  }, [
    isCreateOpen,
    fetchExperts,
  ]);


  /* ==========================================================
     Interview 변경
  ========================================================== */

  const handleInterviewChange = (
    interviewId: string
  ) => {
    if (
      !missionId ||
      interviewId ===
        selectedInterviewId
    ) {
      return;
    }

    const nextInterview =
      interviews.find(
        (interview) =>
          interview.interview_id ===
          interviewId
      );

    setSelectedInterviewId(
      interviewId
    );

    // 이전 Interview 데이터 초기화
    setLatestTurn(null);
    setMessages([]);
    setMessage("");
    setMessageError("");

    setIsInterviewCompleted(
      nextInterview?.status ===
        "COMPLETED"
    );

    setIsInterviewDropdownOpen(false);

    router.replace(
      `/interview?missionId=${encodeURIComponent(
        missionId
      )}&interviewId=${encodeURIComponent(
        interviewId
      )}`
    );
  };


  /* ==========================================================
     새 Interview 창 열기
  ========================================================== */

  const handleOpenCreateInterview =
    () => {
      setCreateInterviewError("");
      setExpertError("");
      setSelectedExpertId(
        selectedInterview?.expert_id ?? ""
      );
      setExpertSearch("");
      setInterviewTitle("");
      setIsNewExpertOpen(false);

      setNewExpertName("");
      setNewExpertOrganization("");
      setNewExpertRole("");

      setIsInterviewDropdownOpen(false);

      setIsCreateOpen(true);
    };


  /* ==========================================================
     새 Interview 창 닫기
  ========================================================== */

  const handleCloseCreateInterview =
    () => {
      if (
        isCreatingInterview ||
        isCreatingExpert
      ) {
        return;
      }

      setIsCreateOpen(false);
      setIsNewExpertOpen(false);

      setCreateInterviewError("");
      setExpertError("");
    };


  /* ==========================================================
     Expert 검색
  ========================================================== */

  const handleExpertSearch =
    async () => {
      await fetchExperts(
        expertSearch
      );
    };


  /* ==========================================================
     새 Expert 등록
  ========================================================== */

  const handleCreateExpert =
    async () => {
      if (
        !newExpertName.trim()
      ) {
        setExpertError(
          "전문가 이름을 입력해주세요."
        );

        return;
      }

      try {
        setIsCreatingExpert(true);
        setExpertError("");

        const createdExpert =
          await createExpert({
            name:
              newExpertName.trim(),

            organization:
              newExpertOrganization.trim() ||
              null,

            role:
              newExpertRole.trim() ||
              null,

            metadata: {},
          });

        // 생성된 Expert 자동 선택
        setSelectedExpertId(
          createdExpert.expert_id
        );

        setExperts((current) => [
          createdExpert,
          ...current.filter(
            (expert) =>
              expert.expert_id !==
              createdExpert.expert_id
          ),
        ]);

        setIsNewExpertOpen(false);

        setNewExpertName("");
        setNewExpertOrganization("");
        setNewExpertRole("");
      } catch (error) {
        console.error(
          "EXPERT CREATE ERROR:",
          error
        );

        setExpertError(
          error instanceof Error
            ? error.message
            : "전문가 등록 중 오류가 발생했습니다."
        );
      } finally {
        setIsCreatingExpert(false);
      }
    };


  /* ==========================================================
     새 Interview 생성
  ========================================================== */

  const handleCreateInterview =
    async () => {
      if (!missionId) {
        setCreateInterviewError(
          "Mission ID가 없습니다."
        );

        return;
      }

      if (!selectedExpertId) {
        setCreateInterviewError(
          "Expert를 선택해주세요."
        );

        return;
      }

      try {
        setIsCreatingInterview(true);
        setCreateInterviewError("");

        const createdInterview =
          await createInterview(
            missionId,
            {
              expert_id:
                selectedExpertId,

              title:
                interviewTitle.trim() ||
                null,
            }
          );

        // 생성된 Interview를 목록에 즉시 추가
        setInterviews(
          (current) => [
            createdInterview,
            ...current.filter(
              (interview) =>
                interview.interview_id !==
                createdInterview.interview_id
            ),
          ]
        );

        setSelectedInterviewId(
          createdInterview.interview_id
        );

        setIsInterviewCompleted(
          createdInterview.status ===
            "COMPLETED"
        );

        // 이전 Interview 데이터 초기화
        setLatestTurn(null);
        setMessages([]);
        setMessage("");
        setMessageError("");

        setIsCreateOpen(false);

        // 생성된 Interview로 이동
        router.replace(
          `/interview?missionId=${encodeURIComponent(
            missionId
          )}&interviewId=${encodeURIComponent(
            createdInterview.interview_id
          )}`
        );
      } catch (error) {
        console.error(
          "INTERVIEW CREATE ERROR:",
          error
        );

        setCreateInterviewError(
          error instanceof Error
            ? error.message
            : "인터뷰 생성 중 오류가 발생했습니다."
        );
      } finally {
        setIsCreatingInterview(false);
      }
    };


  /* ==========================================================
     Interview 대화 이력 조회
  ========================================================== */

  const fetchMessages =
    useCallback(async () => {
      if (!selectedInterviewId) {
        setMessages([]);
        setMessagesLoading(false);

        return;
      }

      try {
        setMessagesLoading(true);
        setMessageError("");

        const data =
          await getInterviewMessages(
            selectedInterviewId
          );

        setMessages(
          data.messages
        );
      } catch (error) {
        console.error(
          "INTERVIEW MESSAGES FETCH ERROR:",
          error
        );

        setMessageError(
          error instanceof Error
            ? error.message
            : "인터뷰 대화 이력을 불러오는 중 오류가 발생했습니다."
        );
      } finally {
        setMessagesLoading(false);
      }
    }, [
      selectedInterviewId,
    ]);


  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);


  /* ==========================================================
     선택 Interview 상태 동기화
  ========================================================== */

  useEffect(() => {
    if (!selectedInterview) {
      setIsInterviewCompleted(
        false
      );

      return;
    }

    setIsInterviewCompleted(
      selectedInterview.status ===
        "COMPLETED"
    );
  }, [selectedInterview]);


  /* ==========================================================
     전문가 답변 전송
  ========================================================== */

  const handleSubmit = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    const trimmedMessage =
      message.trim();

    if (
      !trimmedMessage ||
      isSending ||
      isCompleting ||
      isInterviewCompleted
    ) {
      return;
    }

    if (!selectedInterviewId) {
      setMessageError(
        "Interview ID가 없습니다."
      );

      return;
    }

    try {
      setIsSending(true);
      setMessageError("");

      // 답변 저장 → AI 분석 → 다음 질문 생성
      const turnResult =
        await processInterviewTurn(
          selectedInterviewId,
          {
            content:
              trimmedMessage,
          }
        );

      setLatestTurn(
        turnResult
      );

      setMessage("");

      // 후속 질문이 없으면 종료
      if (
        turnResult.next_question ===
        null
      ) {
        setIsInterviewCompleted(
          true
        );

        setInterviews(
          (current) =>
            current.map(
              (interview) =>
                interview.interview_id ===
                selectedInterviewId
                  ? {
                      ...interview,
                      status:
                        "COMPLETED",
                    }
                  : interview
            )
        );
      }

      await fetchMessages();
    } catch (error) {
      console.error(
        "INTERVIEW TURN ERROR:",
        error
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : "인터뷰 AI 처리 중 오류가 발생했습니다.";

      setMessageError(
        errorMessage
      );

      if (
        errorMessage ===
        "Interview is already completed"
      ) {
        setIsInterviewCompleted(
          true
        );

        setInterviews(
          (current) =>
            current.map(
              (interview) =>
                interview.interview_id ===
                selectedInterviewId
                  ? {
                      ...interview,
                      status:
                        "COMPLETED",
                    }
                  : interview
            )
        );
      }

      await fetchMessages();
    } finally {
      setIsSending(false);
    }
  };


  /* ==========================================================
     인터뷰 수동 종료
  ========================================================== */

  const handleEndInterview =
    async () => {
      if (
        !selectedInterviewId ||
        isSending ||
        isCompleting ||
        isInterviewCompleted
      ) {
        return;
      }

      try {
        setIsCompleting(true);
        setMessageError("");

        const completedInterview =
          await completeInterview(
            selectedInterviewId
          );

        if (
          completedInterview.status ===
          "COMPLETED"
        ) {
          setIsInterviewCompleted(
            true
          );

          setMessage("");

          setInterviews(
            (current) =>
              current.map(
                (interview) =>
                  interview.interview_id ===
                  selectedInterviewId
                    ? completedInterview
                    : interview
              )
          );
        }
      } catch (error) {
        console.error(
          "INTERVIEW COMPLETE ERROR:",
          error
        );

        const errorMessage =
          error instanceof Error
            ? error.message
            : "인터뷰 종료 중 오류가 발생했습니다.";

        setMessageError(
          errorMessage
        );

        if (
          errorMessage ===
          "Interview is already completed"
        ) {
          setIsInterviewCompleted(
            true
          );
        }
      } finally {
        setIsCompleting(false);
      }
    };


  /* ==========================================================
     최신 Turn 대표 데이터
  ========================================================== */

  const latestKnowledgeCandidate =
    latestTurn
      ?.knowledge_candidates[0] ??
    null;

  const latestExceptionCandidate =
    latestTurn?.knowledge_candidates.find(
      (candidate) =>
        candidate.type ===
          "EXCEPTION" ||
        Boolean(
          candidate.exception
        )
    ) ?? null;

  const latestConflict =
    latestTurn?.conflicts[0] ??
    null;

  const latestGap =
    latestTurn?.gaps[0] ??
    null;


  return (
    <div className="min-h-screen bg-[#F8FAFC] p-3 text-slate-900 sm:p-4 lg:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">

        {/* 화면 제목 */}
        <header className="px-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Interview
          </h1>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            전문가와의 대화를 통해 Knowledge Candidate와 Gap / Conflict를
            발견합니다.
          </p>
        </header>


        {/* 현재 Mission 정보 */}
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">

          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-500">
              Current Mission
            </p>

            {missionLoading ? (
              <p className="mt-1 text-sm font-semibold text-slate-400">
                Mission 정보를 불러오는 중입니다.
              </p>
            ) : missionError ? (
              <p className="mt-1 text-sm font-semibold text-rose-500">
                {missionError}
              </p>
            ) : mission ? (
              <>
                <h2 className="mt-1 text-lg font-black text-slate-900">
                  {mission.title}
                </h2>

                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {mission.domain}
                </p>

                {mission.objective && (
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    {mission.objective}
                  </p>
                )}
              </>
            ) : null}
          </div>


          <div className="flex w-full flex-col gap-2 lg:w-[430px]">

            <div className="flex items-end gap-2">

              {/* Interview 선택 */}
              <div className="min-w-0 flex-1">

                <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Interview
                </p>

                <div className="relative">

                  {/* 선택된 Interview */}
                  <button
                    type="button"
                    onClick={() =>
                      setIsInterviewDropdownOpen(
                        (current) => !current
                      )
                    }
                    disabled={
                      interviewsLoading ||
                      interviews.length === 0 ||
                      isSending ||
                      isCompleting
                    }
                    className={`flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl border bg-white px-4 py-2.5 text-left transition ${
                      isInterviewDropdownOpen
                        ? "border-blue-400 ring-4 ring-blue-100"
                        : "border-slate-300 hover:border-slate-400"
                    } disabled:cursor-not-allowed disabled:bg-slate-100`}
                  >
                    {selectedInterview ? (
                      <>
                        <div className="min-w-0 flex-1">

                          <p className="truncate text-sm font-black text-slate-800">
                            {selectedInterview.title ||
                              "제목 없는 Interview"}
                          </p>

                          <div className="mt-1 flex items-center gap-2">

                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
                                selectedInterview.status ===
                                "IN_PROGRESS"
                                  ? "bg-blue-50 text-blue-600"
                                  : selectedInterview.status ===
                                      "COMPLETED"
                                    ? "bg-emerald-50 text-emerald-600"
                                    : selectedInterview.status ===
                                        "CANCELLED"
                                      ? "bg-rose-50 text-rose-600"
                                      : "bg-violet-50 text-violet-600"
                              }`}
                            >
                              {getInterviewStatusLabel(
                                selectedInterview.status
                              )}
                            </span>

                            <span className="truncate text-[11px] font-semibold text-slate-400">
                              {formatInterviewDate(
                                selectedInterview.created_at
                              )}
                            </span>

                          </div>

                        </div>

                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-slate-400 transition ${
                            isInterviewDropdownOpen
                              ? "rotate-180"
                              : ""
                          }`}
                        />
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-slate-400">
                          {interviewsLoading
                            ? "Interview 불러오는 중..."
                            : "Interview가 없습니다."}
                        </span>

                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </>
                    )}
                  </button>


                  {/* Interview 목록 */}
                  {isInterviewDropdownOpen &&
                    interviews.length > 0 && (
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">

                        <div className="max-h-[280px] space-y-1 overflow-y-auto">

                          {interviews.map(
                            (interview) => {
                              const isSelected =
                                interview.interview_id ===
                                selectedInterviewId;

                              return (
                                <button
                                  key={
                                    interview.interview_id
                                  }
                                  type="button"
                                  onClick={() =>
                                    handleInterviewChange(
                                      interview.interview_id
                                    )
                                  }
                                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                                    isSelected
                                      ? "bg-blue-50"
                                      : "hover:bg-slate-50"
                                  }`}
                                >

                                  {/* 상태 점 */}
                                  <div
                                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                      interview.status ===
                                      "IN_PROGRESS"
                                        ? "bg-blue-500"
                                        : interview.status ===
                                            "COMPLETED"
                                          ? "bg-emerald-500"
                                          : interview.status ===
                                              "CANCELLED"
                                            ? "bg-rose-500"
                                            : "bg-violet-500"
                                    }`}
                                  />


                                  <div className="min-w-0 flex-1">

                                    <p
                                      className={`truncate text-sm ${
                                        isSelected
                                          ? "font-black text-blue-700"
                                          : "font-bold text-slate-800"
                                      }`}
                                    >
                                      {interview.title ||
                                        "제목 없는 Interview"}
                                    </p>

                                    <div className="mt-1 flex items-center gap-2">

                                      <span
                                        className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
                                          interview.status ===
                                          "IN_PROGRESS"
                                            ? "bg-blue-50 text-blue-600"
                                            : interview.status ===
                                                "COMPLETED"
                                              ? "bg-emerald-50 text-emerald-600"
                                              : interview.status ===
                                                  "CANCELLED"
                                                ? "bg-rose-50 text-rose-600"
                                                : "bg-violet-50 text-violet-600"
                                        }`}
                                      >
                                        {getInterviewStatusLabel(
                                          interview.status
                                        )}
                                      </span>

                                      <span className="text-[11px] font-semibold text-slate-400">
                                        {formatInterviewDate(
                                          interview.created_at
                                        )}
                                      </span>

                                    </div>

                                  </div>


                                  {isSelected && (
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                                      <Check className="h-4 w-4" />
                                    </div>
                                  )}

                                </button>
                              );
                            }
                          )}

                        </div>

                      </div>
                    )}

                </div>
              </div>


              {/* 새 Interview */}
              <button
                type="button"
                onClick={
                  handleOpenCreateInterview
                }
                disabled={
                  !missionId ||
                  isSending ||
                  isCompleting
                }
                className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                <Plus className="h-4 w-4" />
                새 인터뷰
              </button>

            </div>


            {/* 현재 Interview 상태 */}
            {selectedInterview && (
              <div className="flex items-center justify-between gap-3 px-1">

                <span className="truncate text-[11px] font-semibold text-slate-400">
                  {interviews.length}개 Interview
                </span>

                <span
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-black ${
                    selectedInterview.status ===
                    "COMPLETED"
                      ? "bg-emerald-50 text-emerald-600"
                      : selectedInterview.status ===
                          "IN_PROGRESS"
                        ? "bg-blue-50 text-blue-600"
                        : selectedInterview.status ===
                            "CANCELLED"
                          ? "bg-rose-50 text-rose-600"
                          : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {getInterviewStatusLabel(
                    selectedInterview.status
                  )}
                </span>

              </div>
            )}

          </div>

        </section>


        {/* Interview 목록 오류 */}
        {interviewListError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
            {interviewListError}
          </div>
        )}


        {/* 새 Interview 생성 영역 */}
        {isCreateOpen && (
          <section className="rounded-[24px] border border-blue-200 bg-white p-5 shadow-sm">

            <div className="flex items-start justify-between gap-3">

              <div>
                <h2 className="text-base font-black text-slate-900">
                  새 인터뷰 생성
                </h2>

                <p className="mt-1 text-xs font-semibold text-slate-500">
                  기존 Expert를 선택하거나 새 Expert를 등록한 뒤 인터뷰를
                  생성합니다.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  handleCloseCreateInterview
                }
                disabled={
                  isCreatingInterview ||
                  isCreatingExpert
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed"
              >
                <X className="h-4 w-4" />
              </button>

            </div>


            <div className="mt-5 grid gap-5 lg:grid-cols-2">

              {/* 전문가 선택 */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">

                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-blue-600" />

                  <h3 className="text-sm font-black text-slate-800">
                    전문가 선택
                  </h3>
                </div>


                {/* Expert 검색 */}
                <div className="mt-3 flex gap-2">

                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="text"
                      value={
                        expertSearch
                      }
                      onChange={(event) =>
                        setExpertSearch(
                          event.target.value
                        )
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key ===
                          "Enter"
                        ) {
                          event.preventDefault();

                          void handleExpertSearch();
                        }
                      }}
                      placeholder="이름, 소속, 역할 검색"
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void handleExpertSearch()
                    }
                    disabled={
                      expertsLoading
                    }
                    className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    검색
                  </button>

                </div>


                {expertError && (
                  <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
                    {expertError}
                  </p>
                )}


                {/* Expert 목록 */}
                <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto">

                  {expertsLoading ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-xs font-semibold text-slate-400">
                      Expert를 불러오는 중입니다.
                    </div>
                  ) : experts.length ===
                    0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs font-semibold text-slate-400">
                      조회된 Expert가 없습니다.
                    </div>
                  ) : (
                    experts.map(
                      (expert) => {
                        const isSelected =
                          selectedExpertId ===
                          expert.expert_id;

                        return (
                          <button
                            key={
                              expert.expert_id
                            }
                            type="button"
                            onClick={() =>
                              setSelectedExpertId(
                                expert.expert_id
                              )
                            }
                            className={`w-full rounded-xl border p-3 text-left transition ${
                              isSelected
                                ? "border-blue-300 bg-blue-50"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">

                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-slate-800">
                                  {expert.name}
                                </p>

                                <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">
                                  {expert.organization ||
                                    "소속 없음"}
                                  {" · "}
                                  {expert.role ||
                                    "역할 없음"}
                                </p>
                              </div>

                              {isSelected && (
                                <span className="shrink-0 rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-black text-white">
                                  선택됨
                                </span>
                              )}

                            </div>
                          </button>
                        );
                      }
                    )
                  )}

                </div>


                {/* 새 Expert 등록 */}
                <button
                  type="button"
                  onClick={() =>
                    setIsNewExpertOpen(
                      (current) =>
                        !current
                    )
                  }
                  className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 text-xs font-black text-blue-600 transition hover:bg-blue-100"
                >
                  <UserPlus className="h-4 w-4" />
                  새 전문가 등록
                </button>

              </div>


              {/* Interview 설정 */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">

                <h3 className="text-sm font-black text-slate-800">
                  Interview 정보
                </h3>

                <label className="mt-4 block text-xs font-black text-slate-600">
                  인터뷰 제목
                </label>

                <input
                  type="text"
                  value={
                    interviewTitle
                  }
                  onChange={(event) =>
                    setInterviewTitle(
                      event.target.value
                    )
                  }
                  placeholder="예: MSA 서비스 분리 기준 인터뷰"
                  className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />


                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">

                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
                    선택된 Expert
                  </p>

                  {selectedExpertId ? (
                    (() => {
                      const expert =
                        experts.find(
                          (item) =>
                            item.expert_id ===
                            selectedExpertId
                        );

                      return (
                        <div className="mt-2">
                          <p className="text-sm font-black text-slate-800">
                            {expert?.name ??
                              "선택된 Expert"}
                          </p>

                          {expert && (
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {expert.organization ||
                                "소속 없음"}
                              {" · "}
                              {expert.role ||
                                "역할 없음"}
                            </p>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <p className="mt-2 text-xs font-semibold text-slate-400">
                      Expert를 선택해주세요.
                    </p>
                  )}

                </div>


                {createInterviewError && (
                  <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
                    {createInterviewError}
                  </p>
                )}


                <button
                  type="button"
                  onClick={() =>
                    void handleCreateInterview()
                  }
                  disabled={
                    isCreatingInterview ||
                    isCreatingExpert ||
                    !selectedExpertId
                  }
                  className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  <Plus className="h-4 w-4" />

                  {isCreatingInterview
                    ? "인터뷰 생성 중..."
                    : "인터뷰 생성"}
                </button>

              </div>

            </div>


            {/* 새 Expert 등록 폼 */}
            {isNewExpertOpen && (
              <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">

                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-blue-600" />

                  <h3 className="text-sm font-black text-slate-800">
                    새 Expert 등록
                  </h3>
                </div>


                <div className="mt-4 grid gap-3 md:grid-cols-3">

                  <div>
                    <label className="text-xs font-black text-slate-600">
                      이름 *
                    </label>

                    <input
                      type="text"
                      value={
                        newExpertName
                      }
                      onChange={(event) =>
                        setNewExpertName(
                          event.target.value
                        )
                      }
                      placeholder="홍길동"
                      className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>


                  <div>
                    <label className="text-xs font-black text-slate-600">
                      소속
                    </label>

                    <input
                      type="text"
                      value={
                        newExpertOrganization
                      }
                      onChange={(event) =>
                        setNewExpertOrganization(
                          event.target.value
                        )
                      }
                      placeholder="ABC Tech"
                      className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>


                  <div>
                    <label className="text-xs font-black text-slate-600">
                      역할
                    </label>

                    <input
                      type="text"
                      value={
                        newExpertRole
                      }
                      onChange={(event) =>
                        setNewExpertRole(
                          event.target.value
                        )
                      }
                      placeholder="MSA Architect"
                      className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                </div>


                <div className="mt-4 flex justify-end">

                  <button
                    type="button"
                    onClick={() =>
                      void handleCreateExpert()
                    }
                    disabled={
                      isCreatingExpert ||
                      !newExpertName.trim()
                    }
                    className="flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    <UserPlus className="h-4 w-4" />

                    {isCreatingExpert
                      ? "등록 중..."
                      : "Expert 등록"}
                  </button>

                </div>

              </div>
            )}

          </section>
        )}


        {/* Interview 3단 구조 */}
        <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_310px]">

          {/* 좌측: Knowledge Coverage */}
          <aside className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">

            <div className="mb-5 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>

              <div>
                <h2 className="text-sm font-black text-slate-900">
                  주제별 지식 커버리지
                </h2>

                <p className="text-[11px] font-semibold text-slate-400">
                  Knowledge Coverage
                </p>
              </div>
            </div>


            <div className="space-y-4">
              {coverageItems.map(
                (item) => {
                  const Icon =
                    coverageIconMap[
                      item.iconType as keyof typeof coverageIconMap
                    ];

                  const isLow =
                    item.value < 30;

                  return (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">

                        <div className="flex min-w-0 items-center gap-2">
                          <Icon
                            className={`h-4 w-4 shrink-0 ${
                              isLow
                                ? "text-rose-500"
                                : "text-blue-500"
                            }`}
                          />

                          <span className="truncate text-xs font-bold text-slate-700">
                            {item.label}
                          </span>
                        </div>


                        <span
                          className={`text-xs font-black ${
                            isLow
                              ? "text-rose-500"
                              : "text-blue-600"
                          }`}
                        >
                          {item.value}%
                        </span>

                      </div>


                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${
                            isLow
                              ? "bg-rose-500"
                              : "bg-blue-500"
                          }`}
                          style={{
                            width: `${item.value}%`,
                          }}
                        />
                      </div>

                    </div>
                  );
                }
              )}
            </div>


            <p className="mt-4 text-center text-[10px] font-semibold text-slate-400">
              Coverage API 연동 전 예시 데이터
            </p>

          </aside>


          {/* 중앙: AI ↔ Expert 대화 */}
          <main className="flex min-h-[650px] flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">

            <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100">
                <MessageSquareText className="h-5 w-5 text-indigo-600" />
              </div>

              <div>
                <h2 className="text-sm font-black text-slate-900">
                  인터뷰 대화
                </h2>

                <p className="text-[11px] font-semibold text-slate-400">
                  AI ↔ Expert Conversation
                </p>
              </div>

            </div>


            {/* 대화 영역 */}
            <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50/40 p-5">

              {messagesLoading ? (
                <div className="flex h-full min-h-[300px] items-center justify-center">
                  <p className="text-sm font-semibold text-slate-400">
                    인터뷰 대화를 불러오는 중입니다.
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full min-h-[300px] items-center justify-center">

                  <div className="text-center">

                    <MessageSquareText className="mx-auto h-8 w-8 text-slate-300" />

                    <p className="mt-3 text-sm font-bold text-slate-500">
                      아직 저장된 대화가 없습니다.
                    </p>

                    <p className="mt-1 text-xs font-medium text-slate-400">
                      전문가 답변을 입력하면 인터뷰가 시작됩니다.
                    </p>

                  </div>

                </div>
              ) : (
                messages.map(
                  (item) => {
                    const isAI =
                      item.role ===
                      "ASSISTANT";

                    const isExpert =
                      item.role ===
                      "USER";

                    const isSystem =
                      item.role ===
                      "SYSTEM";


                    if (isSystem) {
                      return (
                        <div
                          key={
                            item.message_id
                          }
                          className="flex justify-center"
                        >
                          <div className="max-w-[85%] rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-center">

                            <p className="text-[11px] font-bold text-slate-400">
                              System ·{" "}
                              {formatMessageTime(
                                item.created_at
                              )}
                            </p>

                            <p className="mt-1 whitespace-pre-wrap break-words text-xs font-medium text-slate-600">
                              {item.content}
                            </p>

                          </div>
                        </div>
                      );
                    }


                    return (
                      <div
                        key={
                          item.message_id
                        }
                        className={`flex gap-3 ${
                          isAI
                            ? "justify-start"
                            : "justify-end"
                        }`}
                      >

                        {isAI && (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                            <Bot className="h-5 w-5" />
                          </div>
                        )}


                        <div
                          className={`max-w-[78%] ${
                            isAI
                              ? "text-left"
                              : "text-right"
                          }`}
                        >

                          <div className="mb-1 flex items-center gap-2">

                            {!isAI && (
                              <div className="flex-1" />
                            )}

                            <span className="text-[11px] font-bold text-slate-400">
                              {isAI
                                ? "K-DNA AI"
                                : "Expert"}{" "}
                              ·{" "}
                              {formatMessageTime(
                                item.created_at
                              )}
                            </span>

                          </div>


                          <div
                            className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-left text-sm font-medium leading-6 shadow-sm ${
                              isAI
                                ? "rounded-tl-md border border-slate-200 bg-white text-slate-700"
                                : "rounded-tr-md bg-slate-900 text-white"
                            }`}
                          >
                            {item.content}
                          </div>

                        </div>


                        {isExpert && (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600">
                            <UserRound className="h-5 w-5" />
                          </div>
                        )}

                      </div>
                    );
                  }
                )
              )}

            </div>


            {/* 입력 영역 */}
            <form
              onSubmit={handleSubmit}
              className="border-t border-slate-200 bg-white p-4"
            >

              {messageError && (
                <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
                  {messageError}
                </p>
              )}


              {isSending && (
                <p className="mb-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-600">
                  Expert 답변을 분석하고 다음 질문을 생성하고 있습니다.
                </p>
              )}


              {isCompleting && (
                <p className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
                  인터뷰를 종료하고 있습니다.
                </p>
              )}


              {isInterviewCompleted && (
                <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
                  인터뷰가 종료되었습니다. 더 이상 답변을 입력할 수 없습니다.
                </p>
              )}


              <div className="flex items-end gap-2">

                <textarea
                  value={message}
                  onChange={(event) =>
                    setMessage(
                      event.target.value
                    )
                  }
                  placeholder={
                    isInterviewCompleted
                      ? "종료된 인터뷰입니다."
                      : "전문가 답변을 입력하세요."
                  }
                  rows={1}
                  disabled={
                    isSending ||
                    isCompleting ||
                    isInterviewCompleted ||
                    !selectedInterviewId
                  }
                  className="min-h-[48px] flex-1 resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />


                <button
                  type="submit"
                  disabled={
                    isSending ||
                    isCompleting ||
                    isInterviewCompleted ||
                    !selectedInterviewId ||
                    message.trim().length ===
                      0
                  }
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                  aria-label="답변 전송"
                >
                  <ArrowUp className="h-5 w-5" />
                </button>

              </div>


              <button
                type="button"
                onClick={
                  handleEndInterview
                }
                disabled={
                  isSending ||
                  isCompleting ||
                  isInterviewCompleted ||
                  !selectedInterviewId
                }
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-bold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <Square className="h-4 w-4" />

                {isInterviewCompleted
                  ? "인터뷰 종료됨"
                  : isCompleting
                    ? "인터뷰 종료 중..."
                    : "인터뷰 종료"}
              </button>

            </form>

          </main>


          {/* 우측: Live Insight */}
          <aside className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">

            <div className="mb-3 flex items-center gap-2">

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
                <Lightbulb className="h-5 w-5 text-amber-600" />
              </div>

              <div>
                <h2 className="text-sm font-black text-slate-900">
                  실시간 인사이트
                </h2>

                <p className="text-[11px] font-semibold text-slate-400">
                  Live Insight
                </p>
              </div>

            </div>


            {!latestTurn ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">

                <Lightbulb className="mx-auto h-6 w-6 text-slate-300" />

                <p className="mt-2 text-xs font-bold text-slate-500">
                  아직 AI 분석 결과가 없습니다.
                </p>

                <p className="mt-1 text-[11px] font-medium leading-5 text-slate-400">
                  전문가 답변을 전송하면 Knowledge Candidate, Gap,
                  Conflict 분석 결과가 표시됩니다.
                </p>

              </div>
            ) : (
              <div className="space-y-3">

                {/* Knowledge Candidate */}
                {latestKnowledgeCandidate && (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">

                    <div className="mb-2 flex items-center gap-2 text-blue-600">
                      <BookOpen className="h-4 w-4" />

                      <span className="text-[11px] font-black uppercase">
                        New Knowledge
                      </span>
                    </div>


                    <p className="mb-1 text-[10px] font-black uppercase text-blue-500">
                      {
                        latestKnowledgeCandidate.type
                      }
                    </p>


                    <h3 className="text-sm font-black text-slate-900">
                      {
                        latestKnowledgeCandidate.statement
                      }
                    </h3>


                    {latestKnowledgeCandidate.rationale && (
                      <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
                        {
                          latestKnowledgeCandidate.rationale
                        }
                      </p>
                    )}


                    <p className="mt-2 text-[10px] font-bold text-slate-400">
                      Confidence{" "}
                      {Math.round(
                        latestKnowledgeCandidate.confidence_score *
                          100
                      )}
                      %
                    </p>

                  </div>
                )}


                {/* Exception */}
                {latestExceptionCandidate && (
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">

                    <div className="mb-2 flex items-center gap-2 text-amber-600">
                      <ShieldAlert className="h-4 w-4" />

                      <span className="text-[11px] font-black uppercase">
                        Exception
                      </span>
                    </div>


                    <h3 className="text-sm font-black text-slate-900">
                      {latestExceptionCandidate.type ===
                      "EXCEPTION"
                        ? latestExceptionCandidate.statement
                        : latestExceptionCandidate.exception}
                    </h3>


                    {latestExceptionCandidate.type ===
                      "EXCEPTION" &&
                      latestExceptionCandidate.exception && (
                        <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
                          {
                            latestExceptionCandidate.exception
                          }
                        </p>
                      )}

                  </div>
                )}


                {/* Conflict */}
                {latestConflict && (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4">

                    <div className="mb-2 flex items-center gap-2 text-rose-600">
                      <AlertTriangle className="h-4 w-4" />

                      <span className="text-[11px] font-black uppercase">
                        Conflict
                      </span>
                    </div>


                    <p className="mb-1 text-[10px] font-black uppercase text-rose-500">
                      {
                        latestConflict.conflict_type
                      }{" "}
                      ·{" "}
                      {
                        latestConflict.severity
                      }
                    </p>


                    <h3 className="text-sm font-black text-slate-900">
                      {
                        latestConflict.description
                      }
                    </h3>


                    {latestConflict.context_difference && (
                      <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
                        {
                          latestConflict.context_difference
                        }
                      </p>
                    )}


                    {latestConflict.recommended_question && (
                      <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold leading-5 text-rose-600">
                        {
                          latestConflict.recommended_question
                        }
                      </p>
                    )}

                  </div>
                )}


                {/* Gap */}
                {latestGap && (
                  <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">

                    <div className="mb-2 flex items-center gap-2 text-violet-600">
                      <CircleAlert className="h-4 w-4" />

                      <span className="text-[11px] font-black uppercase">
                        Gap
                      </span>
                    </div>


                    <p className="mb-1 text-[10px] font-black uppercase text-violet-500">
                      {latestGap.topic} ·{" "}
                      {
                        latestGap.dimension
                      }
                    </p>


                    <h3 className="text-sm font-black text-slate-900">
                      {
                        latestGap.gap_type
                      }
                    </h3>


                    <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
                      {latestGap.reason}
                    </p>


                    <p className="mt-2 text-[10px] font-bold text-slate-400">
                      Gap Score{" "}
                      {Math.round(
                        latestGap.gap_score *
                          100
                      )}
                      %
                    </p>

                  </div>
                )}


                {/* 표시할 분석 결과 없음 */}
                {!latestKnowledgeCandidate &&
                  !latestExceptionCandidate &&
                  !latestConflict &&
                  !latestGap && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">

                      <p className="text-xs font-semibold text-slate-500">
                        이번 답변에서 표시할 Knowledge Candidate, Gap,
                        Conflict가 생성되지 않았습니다.
                      </p>

                    </div>
                  )}

              </div>
            )}

          </aside>

        </div>
      </div>
    </div>
  );
}


/* ============================================================
   Page
============================================================ */

export default function InterviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] p-3 text-slate-900 sm:p-4 lg:p-6">
          <div className="mx-auto max-w-[1600px]">
            <section className="rounded-[24px] border border-slate-200 bg-white p-10 text-center shadow-sm">
              <p className="text-sm font-semibold text-slate-400">
                Interview를 불러오는 중입니다.
              </p>
            </section>
          </div>
        </div>
      }
    >
      <InterviewPageContent />
    </Suspense>
  );
}