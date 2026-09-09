"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowUp,
  BookOpen,
  Bot,
  CircleAlert,
  Database,
  Layers3,
  Lightbulb,
  Link2,
  MessageSquareText,
  ShieldAlert,
  Square,
  UserRound,
} from "lucide-react";
import { interviewMock } from "@/mocks/interviewMock";
import { getMission, type MissionResponse } from "@/services/mission";
import {
  getInterviewMessages,
  processInterviewTurn,
  type InterviewMessage,
  type InterviewTurnResponse,
} from "@/services/interview";

const coverageIconMap = {
  layers: Layers3,
  database: Database,
  link: Link2,
  alert: CircleAlert,
  warning: AlertTriangle,
};

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

export default function InterviewPage() {
  const searchParams = useSearchParams();

  const missionId = searchParams.get("missionId");
  const interviewId = searchParams.get("interviewId");

  // 전문가가 입력하는 현재 답변
  const [message, setMessage] = useState("");

  // 실제 Interview 대화 목록
  const [messages, setMessages] = useState<InterviewMessage[]>([]);

  // 가장 최근 AI /turns 분석 결과
  const [latestTurn, setLatestTurn] =
    useState<InterviewTurnResponse | null>(null);

  // Mission 조회 상태
  const [mission, setMission] = useState<MissionResponse | null>(null);
  const [missionLoading, setMissionLoading] = useState(true);
  const [missionError, setMissionError] = useState("");

  // Interview 메시지 조회 / 전송 상태
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messageError, setMessageError] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Coverage는 아직 실제 API 미연동 영역
  const coverageItems = interviewMock.coverageItems;

  // URL의 missionId 기준 실제 Mission 조회
  useEffect(() => {
    const fetchMission = async () => {
      if (!missionId) {
        setMissionError("Mission ID가 없습니다.");
        setMissionLoading(false);
        return;
      }

      try {
        setMissionLoading(true);
        setMissionError("");

        const data = await getMission(missionId);

        setMission(data);
      } catch (error) {
        console.error("MISSION FETCH ERROR:", error);

        setMissionError(
          error instanceof Error
            ? error.message
            : "Mission 조회 중 오류가 발생했습니다."
        );
      } finally {
        setMissionLoading(false);
      }
    };

    fetchMission();
  }, [missionId]);

  // Interview 대화 이력 조회
  const fetchMessages = useCallback(async () => {
    if (!interviewId) {
      setMessageError("Interview ID가 없습니다.");
      setMessagesLoading(false);
      return;
    }

    try {
      setMessagesLoading(true);
      setMessageError("");

      const data = await getInterviewMessages(interviewId);

      setMessages(data.messages);
    } catch (error) {
      console.error("INTERVIEW MESSAGES FETCH ERROR:", error);

      setMessageError(
        error instanceof Error
          ? error.message
          : "인터뷰 대화 이력을 불러오는 중 오류가 발생했습니다."
      );
    } finally {
      setMessagesLoading(false);
    }
  }, [interviewId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // 전문가 답변 전송
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage || isSending) {
      return;
    }

    if (!interviewId) {
      setMessageError("Interview ID가 없습니다.");
      return;
    }

    try {
      setIsSending(true);
      setMessageError("");

      // 변경:
      // 기존 /messages 단순 저장 대신 /turns 호출
      // Backend에서 USER 저장 → AI 분석 → ASSISTANT 저장까지 수행
      const turnResult = await processInterviewTurn(interviewId, {
        content: trimmedMessage,
      });

      // 최신 AI 분석 결과 저장
      setLatestTurn(turnResult);

      // 성공 후 입력창 초기화
      setMessage("");

      // USER + ASSISTANT 메시지를 Backend 기준으로 다시 조회
      await fetchMessages();
    } catch (error) {
      console.error("INTERVIEW TURN ERROR:", error);

      setMessageError(
        error instanceof Error
          ? error.message
          : "인터뷰 AI 처리 중 오류가 발생했습니다."
      );

      // /turns는 AI 호출 전에 USER 메시지를 저장할 수 있으므로
      // 실패한 경우에도 Backend 메시지 상태를 다시 확인
      await fetchMessages();
    } finally {
      setIsSending(false);
    }
  };

  // 인터뷰 종료
  // 현재 종료 API Contract가 없으므로 실제 요청은 하지 않음
  const handleEndInterview = () => {
    console.log("INTERVIEW END");
  };

  // 최신 Turn에서 화면에 표시할 대표 데이터
  const latestKnowledgeCandidate =
    latestTurn?.knowledge_candidates[0] ?? null;

  const latestExceptionCandidate =
    latestTurn?.knowledge_candidates.find(
      (candidate) =>
        candidate.type === "EXCEPTION" ||
        Boolean(candidate.exception)
    ) ?? null;

  const latestConflict =
    latestTurn?.conflicts[0] ?? null;

  const latestGap =
    latestTurn?.gaps[0] ?? null;

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
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
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

          {mission && (
            <div className="rounded-xl bg-blue-50 px-4 py-2 text-xs font-bold text-blue-600">
              {mission.status}
            </div>
          )}
        </section>

        {/* Interview 3단 구조 */}
        <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_310px]">
          {/* 좌측: Topic별 Knowledge Coverage */}
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
              {coverageItems.map((item) => {
                const Icon =
                  coverageIconMap[
                    item.iconType as keyof typeof coverageIconMap
                  ];

                const isLow = item.value < 30;

                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            isLow ? "text-rose-500" : "text-blue-500"
                          }`}
                        />

                        <span className="truncate text-xs font-bold text-slate-700">
                          {item.label}
                        </span>
                      </div>

                      <span
                        className={`text-xs font-black ${
                          isLow ? "text-rose-500" : "text-blue-600"
                        }`}
                      >
                        {item.value}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${
                          isLow ? "bg-rose-500" : "bg-blue-500"
                        }`}
                        style={{
                          width: `${item.value}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
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
                messages.map((item) => {
                  const isAI = item.role === "ASSISTANT";
                  const isExpert = item.role === "USER";
                  const isSystem = item.role === "SYSTEM";

                  if (isSystem) {
                    return (
                      <div
                        key={item.message_id}
                        className="flex justify-center"
                      >
                        <div className="max-w-[85%] rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-center">
                          <p className="text-[11px] font-bold text-slate-400">
                            System · {formatMessageTime(item.created_at)}
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
                      key={item.message_id}
                      className={`flex gap-3 ${
                        isAI ? "justify-start" : "justify-end"
                      }`}
                    >
                      {isAI && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                          <Bot className="h-5 w-5" />
                        </div>
                      )}

                      <div
                        className={`max-w-[78%] ${
                          isAI ? "text-left" : "text-right"
                        }`}
                      >
                        <div className="mb-1 flex items-center gap-2">
                          {!isAI && <div className="flex-1" />}

                          <span className="text-[11px] font-bold text-slate-400">
                            {isAI ? "K-DNA AI" : "Expert"} ·{" "}
                            {formatMessageTime(item.created_at)}
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
                })
              )}
            </div>

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

              <div className="flex items-end gap-2">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="전문가 답변을 입력하세요."
                  rows={1}
                  disabled={isSending || !interviewId}
                  className="min-h-[48px] flex-1 resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />

                <button
                  type="submit"
                  disabled={
                    isSending ||
                    !interviewId ||
                    message.trim().length === 0
                  }
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                  aria-label="답변 전송"
                >
                  <ArrowUp className="h-5 w-5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleEndInterview}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-bold text-rose-600 transition hover:bg-rose-100"
              >
                <Square className="h-4 w-4" />
                인터뷰 종료
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
                      {latestKnowledgeCandidate.type}
                    </p>

                    <h3 className="text-sm font-black text-slate-900">
                      {latestKnowledgeCandidate.statement}
                    </h3>

                    {latestKnowledgeCandidate.rationale && (
                      <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
                        {latestKnowledgeCandidate.rationale}
                      </p>
                    )}

                    <p className="mt-2 text-[10px] font-bold text-slate-400">
                      Confidence{" "}
                      {Math.round(
                        latestKnowledgeCandidate.confidence_score * 100
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
                      {latestExceptionCandidate.type === "EXCEPTION"
                        ? latestExceptionCandidate.statement
                        : latestExceptionCandidate.exception}
                    </h3>

                    {latestExceptionCandidate.type === "EXCEPTION" &&
                      latestExceptionCandidate.exception && (
                        <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
                          {latestExceptionCandidate.exception}
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
                      {latestConflict.conflict_type} ·{" "}
                      {latestConflict.severity}
                    </p>

                    <h3 className="text-sm font-black text-slate-900">
                      {latestConflict.description}
                    </h3>

                    {latestConflict.context_difference && (
                      <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
                        {latestConflict.context_difference}
                      </p>
                    )}

                    {latestConflict.recommended_question && (
                      <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold leading-5 text-rose-600">
                        {latestConflict.recommended_question}
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
                      {latestGap.topic} · {latestGap.dimension}
                    </p>

                    <h3 className="text-sm font-black text-slate-900">
                      {latestGap.gap_type}
                    </h3>

                    <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
                      {latestGap.reason}
                    </p>

                    <p className="mt-2 text-[10px] font-bold text-slate-400">
                      Gap Score {Math.round(latestGap.gap_score * 100)}%
                    </p>
                  </div>
                )}

                {/* 분석 결과는 왔지만 표시할 항목이 없는 경우 */}
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