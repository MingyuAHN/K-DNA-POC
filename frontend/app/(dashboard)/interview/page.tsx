"use client";

import { FormEvent, useState } from "react";
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

interface ChatMessage {
  id: number;
  speaker: "AI" | "EXPERT";
  content: string;
  time: string;
}

const coverageIconMap = {
  layers: Layers3,
  database: Database,
  link: Link2,
  alert: CircleAlert,
  warning: AlertTriangle,
};

export default function InterviewPage() {
  // 전문가가 입력하는 현재 답변
  const [message, setMessage] = useState("");

  // 인터뷰 대화 목록
  const [messages, setMessages] = useState<ChatMessage[]>(
    interviewMock.messages
  );

  const mission = interviewMock.mission;
  const coverageItems = interviewMock.coverageItems;
  const insights = interviewMock.insights;

  // 전문가 답변 전송
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage) return;

    const now = new Date();

    const time = now.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const newMessage: ChatMessage = {
      id: Date.now(),
      speaker: "EXPERT",
      content: trimmedMessage,
      time,
    };

    setMessages((prev) => [...prev, newMessage]);
    setMessage("");

    /*
     * TODO: API 연동 위치
     *
     * POST /api/v1/interviews/{interview_id}/messages
     *
     * Response:
     * - new_knowledge_units
     * - new_gaps
     * - conflicts
     * - next_question
     *
     * 응답값으로 중앙 AI 질문과 우측 Live Insight 갱신
     */
  };

  // 인터뷰 종료
  const handleEndInterview = () => {
    console.log("INTERVIEW END");
  };

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

            <h2 className="mt-1 text-lg font-black text-slate-900">
              {mission.title}
            </h2>

            <p className="mt-1 text-xs font-semibold text-slate-500">
              {mission.expertRole}
            </p>
          </div>

          <div className="rounded-xl bg-blue-50 px-4 py-2 text-xs font-bold text-blue-600">
            {mission.statusLabel}
          </div>
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

            {/* 대화 내용 */}
            <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50/40 p-5">
              {messages.map((item) => {
                const isAI = item.speaker === "AI";

                return (
                  <div
                    key={item.id}
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
                          {isAI ? "K-DNA AI" : "Expert"} · {item.time}
                        </span>
                      </div>

                      <div
                        className={`rounded-2xl px-4 py-3 text-sm font-medium leading-6 shadow-sm ${
                          isAI
                            ? "rounded-tl-md border border-slate-200 bg-white text-slate-700"
                            : "rounded-tr-md bg-slate-900 text-white"
                        }`}
                      >
                        {item.content}
                      </div>
                    </div>

                    {!isAI && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600">
                        <UserRound className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 전문가 답변 입력 */}
            <form
              onSubmit={handleSubmit}
              className="border-t border-slate-200 bg-white p-4"
            >
              <div className="flex items-end gap-2">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="전문가 답변을 입력하세요."
                  rows={1}
                  className="min-h-[48px] flex-1 resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />

                <button
                  type="submit"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700"
                  aria-label="답변 전송"
                >
                  <ArrowUp className="h-5 w-5" />
                </button>
              </div>

              {/* 인터뷰 종료 버튼 */}
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
            <div className="mb-5 flex items-center gap-2">
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

            <div className="space-y-3">
              {/* New Rule */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-blue-600">
                  <BookOpen className="h-4 w-4" />

                  <span className="text-[11px] font-black uppercase">
                    New Rule
                  </span>
                </div>

                <h3 className="text-sm font-black text-slate-900">
                  {insights.newRule.title}
                </h3>

                <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
                  {insights.newRule.description}
                </p>
              </div>

              {/* Exception */}
              <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-amber-600">
                  <ShieldAlert className="h-4 w-4" />

                  <span className="text-[11px] font-black uppercase">
                    Exception
                  </span>
                </div>

                <h3 className="text-sm font-black text-slate-900">
                  {insights.exception.title}
                </h3>

                <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
                  {insights.exception.description}
                </p>
              </div>

              {/* Conflict */}
              <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-rose-600">
                  <AlertTriangle className="h-4 w-4" />

                  <span className="text-[11px] font-black uppercase">
                    Conflict
                  </span>
                </div>

                <h3 className="text-sm font-black text-slate-900">
                  {insights.conflict.title}
                </h3>

                <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
                  {insights.conflict.description}
                </p>
              </div>

              {/* Gap */}
              <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-violet-600">
                  <CircleAlert className="h-4 w-4" />

                  <span className="text-[11px] font-black uppercase">
                    Gap
                  </span>
                </div>

                <h3 className="text-sm font-black text-slate-900">
                  {insights.gap.title}
                </h3>

                <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
                  {insights.gap.description}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}