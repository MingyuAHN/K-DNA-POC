"use client";

import {
  type FormEvent,
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

import Conversation from "./components/conversation";
import Coverage from "./components/coverage";
import CreatePanel from "./components/create-panel";
import InterviewHeader from "./components/header";
import Insight from "./components/insight";

function InterviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const missionId =
    searchParams.get("missionId");

  const queryInterviewId =
    searchParams.get("interviewId");

  // Interview
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

  // Interview 생성
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

  // Expert
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

  // 대화
  const [
    message,
    setMessage,
  ] = useState("");

  const [
    messages,
    setMessages,
  ] = useState<InterviewMessage[]>([]);

  const [
    latestTurn,
    setLatestTurn,
  ] = useState<InterviewTurnResponse | null>(
    null
  );

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

  // Mission
  const [
    mission,
    setMission,
  ] = useState<MissionResponse | null>(
    null
  );

  const [
    missionLoading,
    setMissionLoading,
  ] = useState(true);

  const [
    missionError,
    setMissionError,
  ] = useState("");

  // 종료
  const [
    isInterviewCompleted,
    setIsInterviewCompleted,
  ] = useState(false);

  const [
    isCompleting,
    setIsCompleting,
  ] = useState(false);

  // Coverage Mock
  const coverageItems =
    interviewMock.coverageItems;

  // 선택 Interview
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

  // Live Insight 복원
  useEffect(() => {
    if (!selectedInterviewId) {
      setLatestTurn(null);
      return;
    }

    const storageKey =
      `interview-latest-turn:${selectedInterviewId}`;

    const savedTurn =
      sessionStorage.getItem(
        storageKey
      );

    if (!savedTurn) {
      setLatestTurn(null);
      return;
    }

    try {
      const parsedTurn =
        JSON.parse(
          savedTurn
        ) as InterviewTurnResponse;

      setLatestTurn(parsedTurn);
    } catch {
      sessionStorage.removeItem(
        storageKey
      );

      setLatestTurn(null);
    }
  }, [selectedInterviewId]);

  // Mission 조회
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

  // Interview 목록 조회
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
          setIsInterviewCompleted(
            false
          );
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

  // Expert 목록 조회
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

  // 생성창 Expert 조회
  useEffect(() => {
    if (!isCreateOpen) {
      return;
    }

    void fetchExperts("");
  }, [
    isCreateOpen,
    fetchExperts,
  ]);

  // Interview 변경
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

    setLatestTurn(null);
    setMessages([]);
    setMessage("");
    setMessageError("");

    setIsInterviewCompleted(
      nextInterview?.status ===
        "COMPLETED"
    );

    setIsInterviewDropdownOpen(
      false
    );

    router.replace(
      `/interview?missionId=${encodeURIComponent(
        missionId
      )}&interviewId=${encodeURIComponent(
        interviewId
      )}`
    );
  };

  // 생성창 열기
  const handleOpenCreateInterview =
    () => {
      setCreateInterviewError("");
      setExpertError("");

      setSelectedExpertId(
        selectedInterview?.expert_id ??
          ""
      );

      setExpertSearch("");
      setInterviewTitle("");
      setIsNewExpertOpen(false);

      setNewExpertName("");
      setNewExpertOrganization("");
      setNewExpertRole("");

      setIsInterviewDropdownOpen(
        false
      );

      setIsCreateOpen(true);
    };

  // 생성창 닫기
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

  // Expert 검색
  const handleExpertSearch =
    async () => {
      await fetchExperts(
        expertSearch
      );
    };

  // Expert 생성
  const handleCreateExpert =
    async () => {
      if (!newExpertName.trim()) {
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

  // Interview 생성
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
        setIsCreatingInterview(
          true
        );

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

        setLatestTurn(null);
        setMessages([]);
        setMessage("");
        setMessageError("");

        setIsCreateOpen(false);

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
        setIsCreatingInterview(
          false
        );
      }
    };

  // 메시지 조회
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
    }, [selectedInterviewId]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  // Interview 상태 동기화
  useEffect(() => {
    if (!selectedInterview) {
      setIsInterviewCompleted(false);
      return;
    }

    setIsInterviewCompleted(
      selectedInterview.status ===
        "COMPLETED"
    );
  }, [selectedInterview]);

  // 답변 전송
  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
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

      sessionStorage.setItem(
        `interview-latest-turn:${selectedInterviewId}`,
        JSON.stringify(
          turnResult
        )
      );

      if (missionId) {
        sessionStorage.setItem(
          `knowledge-graph-dirty:${missionId}`,
          "true"
        );
      }

      setMessage("");

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

  // Interview 종료
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-3 text-slate-900 sm:p-4 lg:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        {/* 제목 */}
        <header className="px-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Interview
          </h1>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            전문가와의 대화를 통해 Knowledge Candidate와 Gap /
            Conflict를 발견합니다.
          </p>
        </header>

        {/* 상단 정보 */}
        <InterviewHeader
          mission={mission}
          missionLoading={
            missionLoading
          }
          missionError={
            missionError
          }
          interviews={
            interviews
          }
          selectedInterview={
            selectedInterview
          }
          selectedInterviewId={
            selectedInterviewId
          }
          interviewsLoading={
            interviewsLoading
          }
          isDropdownOpen={
            isInterviewDropdownOpen
          }
          isSending={isSending}
          isCompleting={
            isCompleting
          }
          hasMissionId={
            Boolean(missionId)
          }
          onToggleDropdown={() =>
            setIsInterviewDropdownOpen(
              (current) => !current
            )
          }
          onInterviewChange={
            handleInterviewChange
          }
          onOpenCreate={
            handleOpenCreateInterview
          }
        />

        {/* 목록 오류 */}
        {interviewListError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
            {interviewListError}
          </div>
        )}

        {/* Interview 생성 */}
        {isCreateOpen && (
          <CreatePanel
            experts={experts}
            expertsLoading={
              expertsLoading
            }
            expertError={
              expertError
            }
            expertSearch={
              expertSearch
            }
            selectedExpertId={
              selectedExpertId
            }
            interviewTitle={
              interviewTitle
            }
            createInterviewError={
              createInterviewError
            }
            isNewExpertOpen={
              isNewExpertOpen
            }
            newExpertName={
              newExpertName
            }
            newExpertOrganization={
              newExpertOrganization
            }
            newExpertRole={
              newExpertRole
            }
            isCreatingInterview={
              isCreatingInterview
            }
            isCreatingExpert={
              isCreatingExpert
            }
            onClose={
              handleCloseCreateInterview
            }
            onExpertSearchChange={
              setExpertSearch
            }
            onExpertSearch={() =>
              void handleExpertSearch()
            }
            onSelectExpert={
              setSelectedExpertId
            }
            onInterviewTitleChange={
              setInterviewTitle
            }
            onCreateInterview={() =>
              void handleCreateInterview()
            }
            onToggleNewExpert={() =>
              setIsNewExpertOpen(
                (current) =>
                  !current
              )
            }
            onNewExpertNameChange={
              setNewExpertName
            }
            onNewExpertOrganizationChange={
              setNewExpertOrganization
            }
            onNewExpertRoleChange={
              setNewExpertRole
            }
            onCreateExpert={() =>
              void handleCreateExpert()
            }
          />
        )}

        {/* Interview */}
        <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_310px]">
          <Coverage
            items={coverageItems}
          />

          <Conversation
            messages={messages}
            messagesLoading={
              messagesLoading
            }
            message={message}
            messageError={
              messageError
            }
            isSending={isSending}
            isCompleting={
              isCompleting
            }
            isInterviewCompleted={
              isInterviewCompleted
            }
            hasSelectedInterview={
              Boolean(
                selectedInterviewId
              )
            }
            onMessageChange={
              setMessage
            }
            onSubmit={
              handleSubmit
            }
            onEndInterview={() =>
              void handleEndInterview()
            }
          />

          <Insight
            latestTurn={
              latestTurn
            }
          />
        </div>
      </div>
    </div>
  );
}

// Page
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