import {
  FileText,
  GitCompareArrows,
  HelpCircle,
  MessageSquareText,
  ShieldAlert,
} from "lucide-react";

import type { MissionResponse } from "@/services/mission";
import type { MissionKnowledgeConflict } from "@/services/conflict";

import {
  getConflictTypeDescription,
  getConflictTypeLabel,
  getSeverityLabel,
  getSourceTypeLabel,
} from "../utils";

type ConflictDetailProps = {
  conflict: MissionKnowledgeConflict | null;
  mission: MissionResponse | null;
};

export default function ConflictDetail({
  conflict,
  mission,
}: ConflictDetailProps) {
  if (!conflict) {
    return (
      <section className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-center">
          <p className="text-sm font-black text-slate-600">
            선택할 Conflict가 없습니다.
          </p>

          <p className="mt-1 text-xs font-semibold text-slate-400">
            Conflict가 생성된 Mission을 선택해 주세요.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* 요약 */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-500">
              선택한 충돌
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-900">
              {getConflictTypeLabel(conflict.conflict_type)}
            </h2>

            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              {getConflictTypeDescription(conflict.conflict_type)}
            </p>

            {mission?.title && (
              <p className="mt-2 text-xs font-semibold text-slate-400">
                {mission.title}
              </p>
            )}
          </div>

          <span
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${
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

      {/* 상충 근거 */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-black text-slate-900">
            상충 근거
          </h3>

          <p className="mt-1 text-xs font-semibold text-slate-400">
            비교에 사용된 기존 지식과 근거입니다.
          </p>
        </div>

        {conflict.sources.length === 0 ? (
          <p className="text-sm font-semibold text-slate-400">
            저장된 상충 근거가 없습니다.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {conflict.sources.map((source) => (
              <SourceRow
                key={source.conflict_source_id}
                type={source.source_type}
                content={source.content}
              />
            ))}
          </div>
        )}
      </div>

      {/* Context Difference */}
      {conflict.context_difference && (
        <InfoCard
          icon={
            <GitCompareArrows className="h-5 w-5" />
          }
          iconClassName="bg-blue-100 text-blue-600"
          borderClassName="border-blue-100"
          backgroundClassName="bg-blue-50/40"
          title="기존 지식과의 맥락 차이"
          content={conflict.context_difference}
        />
      )}

      {/* Unknown Condition */}
      {conflict.unknown_condition && (
        <InfoCard
          icon={<HelpCircle className="h-5 w-5" />}
          iconClassName="bg-amber-100 text-amber-600"
          borderClassName="border-amber-100"
          backgroundClassName="bg-amber-50/50"
          title="아직 확인되지 않은 조건"
          content={conflict.unknown_condition}
        />
      )}

      {/* AI 분석 */}
      <InfoCard
        icon={<ShieldAlert className="h-5 w-5" />}
        iconClassName="bg-violet-100 text-violet-600"
        borderClassName="border-violet-100"
        backgroundClassName="bg-violet-50/50"
        title="AI 분석 결과"
        content={conflict.description}
      />

      {/* 추천 확인 질문 */}
      {conflict.recommended_question && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <MessageSquareText className="h-5 w-5" />
            </div>

            <h3 className="text-sm font-black text-slate-900">
              추천 확인 질문
            </h3>
          </div>

          <div className="rounded-2xl bg-blue-50/70 p-4">
            <p className="text-sm font-bold leading-7 text-slate-700">
              “{conflict.recommended_question}”
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

type SourceRowProps = {
  type: string;
  content: string;
};

function SourceRow({
  type,
  content,
}: SourceRowProps) {
  return (
    <div className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        <FileText className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-black text-slate-500">
          {getSourceTypeLabel(type)}
        </p>

        <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
          {content}
        </p>
      </div>
    </div>
  );
}

type InfoCardProps = {
  icon: React.ReactNode;
  iconClassName: string;
  borderClassName: string;
  backgroundClassName: string;
  title: string;
  content: string;
};

function InfoCard({
  icon,
  iconClassName,
  borderClassName,
  backgroundClassName,
  title,
  content,
}: InfoCardProps) {
  return (
    <div
      className={`rounded-[24px] border p-5 shadow-sm ${borderClassName} ${backgroundClassName}`}
    >
      <div className="mb-3 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClassName}`}
        >
          {icon}
        </div>

        <h3 className="text-sm font-black text-slate-900">
          {title}
        </h3>
      </div>

      <p className="text-sm font-semibold leading-7 text-slate-700">
        {content}
      </p>
    </div>
  );
}