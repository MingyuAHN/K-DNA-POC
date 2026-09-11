"use client";

import {
  Plus,
  Search,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";

import type { ExpertResponse } from "@/services/interview";

type CreatePanelProps = {
  experts: ExpertResponse[];
  expertsLoading: boolean;
  expertError: string;

  expertSearch: string;
  selectedExpertId: string;

  interviewTitle: string;
  createInterviewError: string;

  isNewExpertOpen: boolean;
  newExpertName: string;
  newExpertOrganization: string;
  newExpertRole: string;

  isCreatingInterview: boolean;
  isCreatingExpert: boolean;

  onClose: () => void;

  onExpertSearchChange: (value: string) => void;
  onExpertSearch: () => void;
  onSelectExpert: (expertId: string) => void;

  onInterviewTitleChange: (value: string) => void;
  onCreateInterview: () => void;

  onToggleNewExpert: () => void;
  onNewExpertNameChange: (value: string) => void;
  onNewExpertOrganizationChange: (value: string) => void;
  onNewExpertRoleChange: (value: string) => void;
  onCreateExpert: () => void;
};

export default function CreatePanel({
  experts,
  expertsLoading,
  expertError,
  expertSearch,
  selectedExpertId,
  interviewTitle,
  createInterviewError,
  isNewExpertOpen,
  newExpertName,
  newExpertOrganization,
  newExpertRole,
  isCreatingInterview,
  isCreatingExpert,
  onClose,
  onExpertSearchChange,
  onExpertSearch,
  onSelectExpert,
  onInterviewTitleChange,
  onCreateInterview,
  onToggleNewExpert,
  onNewExpertNameChange,
  onNewExpertOrganizationChange,
  onNewExpertRoleChange,
  onCreateExpert,
}: CreatePanelProps) {
  const selectedExpert =
    experts.find(
      (expert) =>
        expert.expert_id === selectedExpertId
    ) ?? null;

  return (
    <section className="rounded-[24px] border border-blue-200 bg-white p-5 shadow-sm">
      {/* 제목 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-900">
            새 인터뷰 생성
          </h2>

          <p className="mt-1 text-xs font-semibold text-slate-500">
            기존 Expert를 선택하거나 새 Expert를 등록한 뒤
            인터뷰를 생성합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
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
        {/* Expert 선택 */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-blue-600" />

            <h3 className="text-sm font-black text-slate-800">
              전문가 선택
            </h3>
          </div>

          {/* 검색 */}
          <div className="mt-3 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                value={expertSearch}
                onChange={(event) =>
                  onExpertSearchChange(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onExpertSearch();
                  }
                }}
                placeholder="이름, 소속, 역할 검색"
                className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <button
              type="button"
              onClick={onExpertSearch}
              disabled={expertsLoading}
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
            ) : experts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs font-semibold text-slate-400">
                조회된 Expert가 없습니다.
              </div>
            ) : (
              experts.map((expert) => {
                const isSelected =
                  selectedExpertId ===
                  expert.expert_id;

                return (
                  <button
                    key={expert.expert_id}
                    type="button"
                    onClick={() =>
                      onSelectExpert(
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
              })
            )}
          </div>

          <button
            type="button"
            onClick={onToggleNewExpert}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 text-xs font-black text-blue-600 transition hover:bg-blue-100"
          >
            <UserPlus className="h-4 w-4" />
            새 전문가 등록
          </button>
        </div>

        {/* Interview 정보 */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <h3 className="text-sm font-black text-slate-800">
            Interview 정보
          </h3>

          <label className="mt-4 block text-xs font-black text-slate-600">
            인터뷰 제목
          </label>

          <input
            type="text"
            value={interviewTitle}
            onChange={(event) =>
              onInterviewTitleChange(
                event.target.value
              )
            }
            placeholder="예: MSA 서비스 분리 기준 인터뷰"
            className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />

          {/* 선택 Expert */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
              선택된 Expert
            </p>

            {selectedExpertId ? (
              <div className="mt-2">
                <p className="text-sm font-black text-slate-800">
                  {selectedExpert?.name ??
                    "선택된 Expert"}
                </p>

                {selectedExpert && (
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {selectedExpert.organization ||
                      "소속 없음"}
                    {" · "}
                    {selectedExpert.role ||
                      "역할 없음"}
                  </p>
                )}
              </div>
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
            onClick={onCreateInterview}
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

      {/* 새 Expert */}
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
                value={newExpertName}
                onChange={(event) =>
                  onNewExpertNameChange(
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
                value={newExpertOrganization}
                onChange={(event) =>
                  onNewExpertOrganizationChange(
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
                value={newExpertRole}
                onChange={(event) =>
                  onNewExpertRoleChange(
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
              onClick={onCreateExpert}
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
  );
}