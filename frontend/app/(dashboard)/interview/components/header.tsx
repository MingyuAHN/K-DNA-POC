"use client";

import {
  Check,
  ChevronDown,
  Plus,
} from "lucide-react";

import type { MissionResponse } from "@/services/mission";
import type { InterviewResponse } from "@/services/interview";

import {
  formatInterviewDate,
  getInterviewStatusLabel,
} from "../utils";

type HeaderProps = {
  mission: MissionResponse | null;
  missionLoading: boolean;
  missionError: string;

  interviews: InterviewResponse[];
  selectedInterview: InterviewResponse | null;
  selectedInterviewId: string;

  interviewsLoading: boolean;
  isDropdownOpen: boolean;

  isSending: boolean;
  isCompleting: boolean;
  hasMissionId: boolean;

  onToggleDropdown: () => void;
  onInterviewChange: (interviewId: string) => void;
  onOpenCreate: () => void;
};

export default function InterviewHeader({
  mission,
  missionLoading,
  missionError,
  interviews,
  selectedInterview,
  selectedInterviewId,
  interviewsLoading,
  isDropdownOpen,
  isSending,
  isCompleting,
  hasMissionId,
  onToggleDropdown,
  onInterviewChange,
  onOpenCreate,
}: HeaderProps) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      {/* Mission */}
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

      {/* Interview 선택 */}
      <div className="flex w-full flex-col gap-2 lg:w-[430px]">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
              Interview
            </p>

            <div className="relative">
              <button
                type="button"
                onClick={onToggleDropdown}
                disabled={
                  interviewsLoading ||
                  interviews.length === 0 ||
                  isSending ||
                  isCompleting
                }
                className={`flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl border bg-white px-4 py-2.5 text-left transition ${
                  isDropdownOpen
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
                        <StatusBadge
                          status={selectedInterview.status}
                        />

                        <span className="truncate text-[11px] font-semibold text-slate-400">
                          {formatInterviewDate(
                            selectedInterview.created_at
                          )}
                        </span>
                      </div>
                    </div>

                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-400 transition ${
                        isDropdownOpen
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
              {isDropdownOpen &&
                interviews.length > 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    <div className="max-h-[280px] space-y-1 overflow-y-auto">
                      {interviews.map((interview) => {
                        const isSelected =
                          interview.interview_id ===
                          selectedInterviewId;

                        return (
                          <button
                            key={interview.interview_id}
                            type="button"
                            onClick={() =>
                              onInterviewChange(
                                interview.interview_id
                              )
                            }
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                              isSelected
                                ? "bg-blue-50"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <StatusDot
                              status={interview.status}
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
                                <StatusBadge
                                  status={interview.status}
                                />

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
                      })}
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* 새 Interview */}
          <button
            type="button"
            onClick={onOpenCreate}
            disabled={
              !hasMissionId ||
              isSending ||
              isCompleting
            }
            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            <Plus className="h-4 w-4" />
            새 인터뷰
          </button>
        </div>

        {/* 현재 상태 */}
        {selectedInterview && (
          <div className="flex items-center justify-between gap-3 px-1">
            <span className="truncate text-[11px] font-semibold text-slate-400">
              {interviews.length}개 Interview
            </span>

            <StatusBadge
              status={selectedInterview.status}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const style =
    status === "IN_PROGRESS"
      ? "bg-blue-50 text-blue-600"
      : status === "COMPLETED"
        ? "bg-emerald-50 text-emerald-600"
        : status === "CANCELLED"
          ? "bg-rose-50 text-rose-600"
          : "bg-violet-50 text-violet-600";

  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[10px] font-black ${style}`}
    >
      {getInterviewStatusLabel(status)}
    </span>
  );
}

function StatusDot({
  status,
}: {
  status: string;
}) {
  const style =
    status === "IN_PROGRESS"
      ? "bg-blue-500"
      : status === "COMPLETED"
        ? "bg-emerald-500"
        : status === "CANCELLED"
          ? "bg-rose-500"
          : "bg-violet-500";

  return (
    <div
      className={`h-2.5 w-2.5 shrink-0 rounded-full ${style}`}
    />
  );
}