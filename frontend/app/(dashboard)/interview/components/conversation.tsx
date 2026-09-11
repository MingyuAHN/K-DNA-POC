"use client";

import type {
  FormEventHandler,
} from "react";

import {
  ArrowUp,
  Bot,
  MessageSquareText,
  Square,
  UserRound,
} from "lucide-react";

import type { InterviewMessage } from "@/services/interview";

import { formatMessageTime } from "../utils";

type ConversationProps = {
  messages: InterviewMessage[];
  messagesLoading: boolean;

  message: string;
  messageError: string;

  isSending: boolean;
  isCompleting: boolean;
  isInterviewCompleted: boolean;

  hasSelectedInterview: boolean;

  onMessageChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onEndInterview: () => void;
};

export default function Conversation({
  messages,
  messagesLoading,
  message,
  messageError,
  isSending,
  isCompleting,
  isInterviewCompleted,
  hasSelectedInterview,
  onMessageChange,
  onSubmit,
  onEndInterview,
}: ConversationProps) {
  return (
    <main className="flex min-h-[650px] flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      {/* 제목 */}
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

      {/* 대화 */}
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
          messages.map((item) => (
            <MessageBubble
              key={item.message_id}
              message={item}
            />
          ))
        )}
      </div>

      {/* 입력 */}
      <form
        onSubmit={onSubmit}
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
              onMessageChange(
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
              !hasSelectedInterview
            }
            className="min-h-[48px] flex-1 resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          />

          <button
            type="submit"
            disabled={
              isSending ||
              isCompleting ||
              isInterviewCompleted ||
              !hasSelectedInterview ||
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
          onClick={onEndInterview}
          disabled={
            isSending ||
            isCompleting ||
            isInterviewCompleted ||
            !hasSelectedInterview
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
  );
}

function MessageBubble({
  message,
}: {
  message: InterviewMessage;
}) {
  const isAI =
    message.role === "ASSISTANT";

  const isExpert =
    message.role === "USER";

  const isSystem =
    message.role === "SYSTEM";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[85%] rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-center">
          <p className="text-[11px] font-bold text-slate-400">
            System ·{" "}
            {formatMessageTime(
              message.created_at
            )}
          </p>

          <p className="mt-1 whitespace-pre-wrap break-words text-xs font-medium text-slate-600">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
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
              message.created_at
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
          {message.content}
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