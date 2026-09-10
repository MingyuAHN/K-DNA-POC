"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  FileText,
  GitCompareArrows,
  HelpCircle,
  MessageSquareText,
  ShieldAlert,
} from "lucide-react";

import MissionSelector from "@/app/components/common/mission-selector";

import {
  getMissions,
  type MissionResponse,
} from "@/services/mission";

import {
  getMissionConflicts,
  type MissionKnowledgeConflict,
} from "@/services/conflict";

// 심각도 한글 표시
const severityLabelMap: Record<string, string> = {
  HIGH: "높음",
  MEDIUM: "중간",
  LOW: "낮음",
};

// Conflict Type 한글 표시
const conflictTypeLabelMap: Record<string, string> = {
  CONDITIONAL_CONFLICT: "조건부 충돌",
  CONTEXT_DIFFERENCE: "Context 차이",
  DIRECT_CONFLICT: "직접 충돌",
};

// Conflict Type Badge 스타일
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

function getConflictTypeLabel(conflictType: string) {
  return conflictTypeLabelMap[conflictType] ?? conflictType;
}

function getSeverityLabel(severity: string) {
  return severityLabelMap[severity] ?? severity;
}

// 생성일 표시
function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ConflictPage() {
  const router = useRouter();

  // Mission 목록
  const [missions, setMissions] = useState<MissionResponse[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState("");

  // Conflict 목록
  const [conflicts, setConflicts] = useState<MissionKnowledgeConflict[]>([]);
  const [selectedConflictId, setSelectedConflictId] = useState("");

  // 화면 상태
  const [isMissionLoading, setIsMissionLoading] = useState(true);
  const [isConflictLoading, setIsConflictLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // 실제 Mission 목록 조회
  useEffect(() => {
    let isMounted = true;

    const loadMissions = async () => {
      try {
        setIsMissionLoading(true);
        setErrorMessage("");

        const data = await getMissions();

        if (!isMounted) {
          return;
        }

        setMissions(data.missions);

        // 첫 Mission 기본 선택
        if (data.missions.length > 0) {
          setSelectedMissionId((currentMissionId) => {
            return currentMissionId || data.missions[0].mission_id;
          });
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Mission 목록 조회에 실패했습니다."
        );
      } finally {
        if (isMounted) {
          setIsMissionLoading(false);
        }
      }
    };

    void loadMissions();

    return () => {
      isMounted = false;
    };
  }, []);

  // 선택한 Mission의 실제 Conflict 조회
  useEffect(() => {
    if (!selectedMissionId) {
      setConflicts([]);
      setSelectedConflictId("");
      return;
    }

    let isMounted = true;

    const loadConflicts = async () => {
      try {
        setIsConflictLoading(true);
        setErrorMessage("");

        const data = await getMissionConflicts(selectedMissionId);

        if (!isMounted) {
          return;
        }

        setConflicts(data.conflicts);

        // 첫 Conflict 기본 선택
        setSelectedConflictId(
          data.conflicts[0]?.conflict_id ?? ""
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setConflicts([]);
        setSelectedConflictId("");

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Conflict 목록 조회에 실패했습니다."
        );
      } finally {
        if (isMounted) {
          setIsConflictLoading(false);
        }
      }
    };

    void loadConflicts();

    return () => {
      isMounted = false;
    };
  }, [selectedMissionId]);

  // 현재 선택 Mission
  const selectedMission = useMemo(() => {
    return (
      missions.find(
        (mission) => mission.mission_id === selectedMissionId
      ) ?? null
    );
  }, [missions, selectedMissionId]);

  // 현재 선택 Conflict
  const selectedConflict = useMemo(() => {
    return (
      conflicts.find(
        (conflict) =>
          conflict.conflict_id === selectedConflictId
      ) ??
      conflicts[0] ??
      null
    );
  }, [conflicts, selectedConflictId]);

  // 추천 질문을 Interview 화면으로 전달
  const handleAskExpert = () => {
    if (
      !selectedMissionId ||
      !selectedConflict ||
      !selectedConflict.recommended_question
    ) {
      return;
    }

    const params = new URLSearchParams({
      missionId: selectedMissionId,
      conflictId: selectedConflict.conflict_id,
      question: selectedConflict.recommended_question,
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

        {/* Mission 선택 */}
        <MissionSelector
          missions={missions}
          selectedMissionId={selectedMissionId}
          onChange={setSelectedMissionId}
          loading={isMissionLoading}
        />

        {/* API 오류 */}
        {errorMessage && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {errorMessage}
          </div>
        )}

        {/* Main */}
        <div className="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
          {/* 좌측 Conflict 목록 */}
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900">
                  충돌 목록
                </h2>

                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Conflict List
                </p>
              </div>

              {!isConflictLoading && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
                  {conflicts.length}건
                </span>
              )}
            </div>

            {/* Conflict 로딩 */}
            {isConflictLoading ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center text-sm font-semibold text-slate-400">
                Conflict를 불러오는 중입니다.
              </div>
            ) : conflicts.length === 0 ? (
              /* Conflict 없음 */
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center">
                <p className="text-sm font-bold text-slate-600">
                  등록된 Conflict가 없습니다.
                </p>

                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {selectedMission?.title ?? "선택한 Mission"}의 분석 결과에
                  Conflict가 생성되면 표시됩니다.
                </p>
              </div>
            ) : (
              /* 실제 Conflict 목록 */
              <div className="space-y-3">
                {conflicts.map((conflict) => {
                  const isSelected =
                    conflict.conflict_id === selectedConflictId;

                  const typeStyle =
                    conflictTypeStyleMap[conflict.conflict_type] ?? {
                      className: "bg-slate-100 text-slate-600",
                    };

                  return (
                    <button
                      key={conflict.conflict_id}
                      type="button"
                      onClick={() =>
                        setSelectedConflictId(conflict.conflict_id)
                      }
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? "border-blue-300 bg-blue-50 shadow-sm"
                          : "border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-[11px] font-black text-slate-400">
                          {conflict.conflict_id.slice(0, 8)}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-black ${typeStyle.className}`}
                        >
                          {getConflictTypeLabel(
                            conflict.conflict_type
                          )}
                        </span>
                      </div>

                      <p className="line-clamp-2 text-sm font-black leading-5 text-slate-900">
                        {conflict.description}
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-[10px] font-semibold text-slate-400">
                          {formatDate(conflict.created_at)}
                        </span>

                        <span
                          className={`text-[10px] font-black ${
                            conflict.severity === "HIGH"
                              ? "text-rose-500"
                              : conflict.severity === "MEDIUM"
                                ? "text-amber-600"
                                : "text-slate-500"
                          }`}
                        >
                          심각도{" "}
                          {getSeverityLabel(conflict.severity)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* 우측 Conflict 상세 */}
          <section className="space-y-4">
            {!selectedConflict ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-center">
                  <p className="text-sm font-black text-slate-600">
                    선택할 Conflict가 없습니다.
                  </p>

                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Conflict가 생성된 Mission을 선택해 주세요.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Conflict 기본 정보 */}
                <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-500">
                        Selected Conflict
                      </p>

                      <h2 className="mt-1 text-xl font-black text-slate-900">
                        {getConflictTypeLabel(
                          selectedConflict.conflict_type
                        )}
                      </h2>

                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {selectedConflict.conflict_id} ·{" "}
                        {selectedMission?.title}
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
                        {getSeverityLabel(
                          selectedConflict.severity
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Conflict Type */}
                  <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                      Conflict Type
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-slate-900">
                        {getConflictTypeLabel(
                          selectedConflict.conflict_type
                        )}
                      </span>

                      <span className="text-xs font-semibold text-slate-400">
                        {selectedConflict.conflict_type}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 상충 근거 */}
                <div>
                  <div className="mb-3 px-1">
                    <h3 className="text-sm font-black text-slate-900">
                      상충 근거
                    </h3>

                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                      Conflict Sources
                    </p>
                  </div>

                  {selectedConflict.sources.length === 0 ? (
                    <div className="rounded-[22px] border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-400 shadow-sm">
                      저장된 Conflict Source가 없습니다.
                    </div>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-3">
                      {selectedConflict.sources.map((source) => (
                        <SourceCard
                          key={source.conflict_source_id}
                          title={source.source_type}
                          subtitle={
                            source.source_id ?? "Conflict Source"
                          }
                          content={source.content}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Context Difference */}
                {selectedConflict.context_difference && (
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

                    <p className="text-sm font-semibold leading-7 text-slate-700">
                      {selectedConflict.context_difference}
                    </p>
                  </div>
                )}

                {/* 확인되지 않은 조건 */}
                {selectedConflict.unknown_condition && (
                  <div className="rounded-[24px] border border-amber-100 bg-amber-50/50 p-5 shadow-sm">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                        <HelpCircle className="h-5 w-5" />
                      </div>

                      <div>
                        <h3 className="text-sm font-black text-slate-900">
                          아직 확인되지 않은 조건
                        </h3>

                        <p className="text-[11px] font-semibold text-slate-400">
                          Unknown Condition
                        </p>
                      </div>
                    </div>

                    <p className="text-sm font-semibold leading-7 text-slate-700">
                      {selectedConflict.unknown_condition}
                    </p>
                  </div>
                )}

                {/* AI Conflict 분석 */}
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
                    {selectedConflict.description}
                  </p>
                </div>

                {/* 추천 후속 질문 */}
                {selectedConflict.recommended_question && (
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
                        “{selectedConflict.recommended_question}”
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
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// Conflict 근거 카드
function SourceCard({
  title,
  subtitle,
  content,
}: {
  title: string;
  subtitle: string;
  content: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <FileText className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="truncate text-xs font-black text-slate-900">
            {title}
          </p>

          <p className="truncate text-[10px] font-semibold text-slate-400">
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