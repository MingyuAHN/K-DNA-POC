import {
  ArrowRight,
  FileText,
  GitCompareArrows,
  HelpCircle,
  MessageSquareText,
  ShieldAlert,
} from "lucide-react";

import type { MissionResponse } from "@/services/mission";
import type { MissionKnowledgeConflict } from "@/services/conflict";

import {
  getConflictTypeLabel,
  getSeverityLabel,
} from "../utils";

type ConflictDetailProps = {
  conflict: MissionKnowledgeConflict | null;
  mission: MissionResponse | null;
  onAskExpert: () => void;
};

export default function ConflictDetail({
  conflict,
  mission,
  onAskExpert,
}: ConflictDetailProps) {
  return (
    <section className="space-y-4">
      {!conflict ? (
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
                  {getConflictTypeLabel(conflict.conflict_type)}
                </h2>

                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {conflict.conflict_id} · {mission?.title}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-xl px-3 py-2 text-xs font-black ${
                    conflict.severity === "HIGH"
                      ? "bg-rose-100 text-rose-600"
                      : conflict.severity === "MEDIUM"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  심각도 {getSeverityLabel(conflict.severity)}
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
                  {getConflictTypeLabel(conflict.conflict_type)}
                </span>

                <span className="text-xs font-semibold text-slate-400">
                  {conflict.conflict_type}
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

            {conflict.sources.length === 0 ? (
              <div className="rounded-[22px] border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-400 shadow-sm">
                저장된 Conflict Source가 없습니다.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-3">
                {conflict.sources.map((source) => (
                  <SourceCard
                    key={source.conflict_source_id}
                    title={source.source_type}
                    subtitle={source.source_id ?? "Conflict Source"}
                    content={source.content}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Context Difference */}
          {conflict.context_difference && (
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
                {conflict.context_difference}
              </p>
            </div>
          )}

          {/* 확인되지 않은 조건 */}
          {conflict.unknown_condition && (
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
                {conflict.unknown_condition}
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
              {conflict.description}
            </p>
          </div>

          {/* 추천 후속 질문 */}
          {conflict.recommended_question && (
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
                  “{conflict.recommended_question}”
                </p>

                <button
                  type="button"
                  onClick={onAskExpert}
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
  );
}

type SourceCardProps = {
  title: string;
  subtitle: string;
  content: string;
};

function SourceCard({
  title,
  subtitle,
  content,
}: SourceCardProps) {
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