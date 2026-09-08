"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CircleAlert,
  FileText,
  GitCompareArrows,
  HelpCircle,
  MessageSquareText,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { conflictMock } from "@/mocks/conflictMock";

type Conflict = (typeof conflictMock.conflicts)[number];

const severityLabelMap = {
  HIGH: "높음",
  MEDIUM: "중간",
  LOW: "낮음",
};

const statusLabelMap = {
  OPEN: "확인 필요",
  REVIEW: "검토 중",
};

const conflictTypeStyleMap: Record<
  string,
  {
    className: string;
  }
> = {
  CONDITIONAL_CONFLICT: {
    className: "bg-amber-100 text-amber-700",
  },
  CONTEXT_DIFFERENCE: {
    className: "bg-blue-100 text-blue-700",
  },
  DIRECT_CONFLICT: {
    className: "bg-rose-100 text-rose-700",
  },
};

export default function ConflictPage() {
  const router = useRouter();

  const [selectedConflictId, setSelectedConflictId] = useState(
    conflictMock.conflicts[0].id
  );

  const selectedConflict = useMemo(
    () =>
      conflictMock.conflicts.find(
        (conflict) => conflict.id === selectedConflictId
      ) ?? conflictMock.conflicts[0],
    [selectedConflictId]
  );

  const handleAskExpert = () => {
    const params = new URLSearchParams({
      missionId: conflictMock.mission.missionId,
      conflictId: selectedConflict.id,
      question: selectedConflict.recommendedQuestion,
    });

    router.push(`/interview?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-3 text-slate-900 sm:p-4 lg:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        {/* 화면 제목 */}
        <header className="px-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Conflict Center
          </h1>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            전문가 발언과 기존 지식·프로젝트 근거 사이의 충돌 원인과
            조건을 확인합니다.
          </p>
        </header>

        {/* Mission */}
        <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="shrink-0">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                선택한 미션
              </p>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex h-11 w-full items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800">
                {conflictMock.mission.title}
              </div>
            </div>
          </div>
        </section>

        {/* Main */}
        <div className="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
          {/* 좌측 Conflict 목록 */}
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-sm font-black text-slate-900">
                충돌 목록
              </h2>

              <p className="mt-1 text-[11px] font-semibold text-slate-400">
                Conflict List
              </p>
            </div>

            <div className="space-y-3">
              {conflictMock.conflicts.map((conflict) => {
                const isSelected =
                  conflict.id === selectedConflictId;

                const typeStyle =
                  conflictTypeStyleMap[
                    conflict.conflictType
                  ] ?? {
                    className: "bg-slate-100 text-slate-600",
                  };

                return (
                  <button
                    key={conflict.id}
                    type="button"
                    onClick={() =>
                      setSelectedConflictId(conflict.id)
                    }
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? "border-blue-300 bg-blue-50 shadow-sm"
                        : "border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-[11px] font-black text-slate-400">
                        {conflict.id}
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black ${typeStyle.className}`}
                      >
                        {conflict.conflictTypeLabel}
                      </span>
                    </div>

                    <p className="text-sm font-black leading-5 text-slate-900">
                      {conflict.title}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-[11px] font-semibold text-slate-500">
                        {conflict.topic}
                      </span>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black ${
                            conflict.severity === "HIGH"
                              ? "text-rose-500"
                              : conflict.severity === "MEDIUM"
                                ? "text-amber-600"
                                : "text-slate-500"
                          }`}
                        >
                          {
                            severityLabelMap[
                              conflict.severity as keyof typeof severityLabelMap
                            ]
                          }
                        </span>

                        <span className="text-[10px] font-bold text-blue-600">
                          {
                            statusLabelMap[
                              conflict.status as keyof typeof statusLabelMap
                            ]
                          }
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 우측 상세 */}
          <section className="space-y-4">
            {/* Conflict 기본 정보 */}
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-500">
                    Selected Conflict
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    {selectedConflict.title}
                  </h2>

                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {selectedConflict.id} · {selectedConflict.topic}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-xl px-3 py-2 text-xs font-black ${
                      selectedConflict.severity === "HIGH"
                        ? "bg-rose-100 text-rose-600"
                        : selectedConflict.severity === "MEDIUM"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    심각도{" "}
                    {
                      severityLabelMap[
                        selectedConflict.severity as keyof typeof severityLabelMap
                      ]
                    }
                  </span>

                  <span className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-600">
                    {
                      statusLabelMap[
                        selectedConflict.status as keyof typeof statusLabelMap
                      ]
                    }
                  </span>
                </div>
              </div>

              {/* Conflict Type 설명 */}
              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Conflict Type
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-black text-slate-900">
                    {selectedConflict.conflictTypeLabel}
                  </span>

                  <span className="text-xs font-semibold text-slate-400">
                    {selectedConflict.conflictType}
                  </span>
                </div>
              </div>
            </div>

            {/* 상충 Source */}
            <div>
              <div className="mb-3 px-1">
                <h3 className="text-sm font-black text-slate-900">
                  상충 근거
                </h3>

                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Conflict Sources
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <SourceCard
                  icon={UserRound}
                  title={selectedConflict.sources.expert.title}
                  subtitle="Expert Statement"
                  content={
                    selectedConflict.sources.expert.content
                  }
                />

                <SourceCard
                  icon={BookOpenCheck}
                  title={
                    selectedConflict.sources.guideline.title
                  }
                  subtitle="Architecture Guideline"
                  content={
                    selectedConflict.sources.guideline.content
                  }
                />

                <SourceCard
                  icon={FileText}
                  title={selectedConflict.sources.project.title}
                  subtitle="Project Evidence"
                  content={
                    selectedConflict.sources.project.content
                  }
                />
              </div>
            </div>

            {/* Context Difference */}
            <div className="rounded-[24px] border border-blue-100 bg-blue-50/40 p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <GitCompareArrows className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Context 차이
                  </h3>

                  <p className="text-[11px] font-semibold text-slate-400">
                    Context Difference
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
                <ContextBox
                  label="Context A"
                  value={
                    selectedConflict.contextDifference.sourceA
                  }
                />

                <div className="hidden items-center justify-center md:flex">
                  <GitCompareArrows className="h-5 w-5 text-blue-400" />
                </div>

                <ContextBox
                  label="Context B"
                  value={
                    selectedConflict.contextDifference.sourceB
                  }
                />
              </div>

              <p className="mt-4 text-sm font-semibold leading-7 text-slate-700">
                {
                  selectedConflict.contextDifference
                    .description
                }
              </p>
            </div>

            {/* Unknown Condition */}
            <div className="rounded-[24px] border border-amber-100 bg-amber-50/50 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <HelpCircle className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {
                      selectedConflict.unknownCondition
                        .title
                    }
                  </h3>

                  <p className="text-[11px] font-semibold text-slate-400">
                    Unknown Condition
                  </p>
                </div>
              </div>

              <p className="text-sm font-semibold leading-7 text-slate-700">
                {
                  selectedConflict.unknownCondition
                    .description
                }
              </p>
            </div>

            {/* AI 분석 */}
            <div className="rounded-[24px] border border-violet-100 bg-violet-50/50 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                  <ShieldAlert className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    AI 충돌 분석
                  </h3>

                  <p className="text-[11px] font-semibold text-slate-400">
                    Conflict Analysis
                  </p>
                </div>
              </div>

              <p className="text-sm font-semibold leading-7 text-slate-700">
                {selectedConflict.aiAnalysis}
              </p>
            </div>

            {/* 추천 확인 질문 */}
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <MessageSquareText className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    추천 확인 질문
                  </h3>

                  <p className="text-[11px] font-semibold text-slate-400">
                    Recommended Clarification
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-sm font-bold leading-6 text-slate-700">
                  “{selectedConflict.recommendedQuestion}”
                </p>

                <button
                  type="button"
                  onClick={handleAskExpert}
                  className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
                >
                  전문가에게 질문하기
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SourceCard({
  icon: Icon,
  title,
  subtitle,
  content,
}: {
  icon: typeof UserRound;
  title: string;
  subtitle: string;
  content: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>

        <div>
          <p className="text-xs font-black text-slate-900">
            {title}
          </p>

          <p className="text-[10px] font-semibold text-slate-400">
            {subtitle}
          </p>
        </div>
      </div>

      <p className="text-xs font-semibold leading-6 text-slate-700">
        {content}
      </p>
    </div>
  );
}

function ContextBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-400">
        {label}
      </p>

      <p className="mt-2 text-sm font-black text-slate-800">
        {value}
      </p>
    </div>
  );
}