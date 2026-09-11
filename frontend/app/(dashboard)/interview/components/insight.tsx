"use client";

import {
  AlertTriangle,
  BookOpen,
  CircleAlert,
  Lightbulb,
  ShieldAlert,
} from "lucide-react";

import type { InterviewTurnResponse } from "@/services/interview";

type InsightProps = {
  latestTurn: InterviewTurnResponse | null;
};

export default function Insight({
  latestTurn,
}: InsightProps) {
  const latestKnowledgeCandidate =
    latestTurn?.knowledge_candidates[0] ??
    null;

  const latestExceptionCandidate =
    latestTurn?.knowledge_candidates.find(
      (candidate) =>
        candidate.type === "EXCEPTION" ||
        Boolean(candidate.exception)
    ) ?? null;

  const latestConflict =
    latestTurn?.conflicts[0] ??
    null;

  const latestGap =
    latestTurn?.gaps[0] ??
    null;

  return (
    <aside className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      {/* 제목 */}
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
          {/* Knowledge */}
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
                  latestKnowledgeCandidate.confidence_score *
                    100
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
                {latestExceptionCandidate.type ===
                "EXCEPTION"
                  ? latestExceptionCandidate.statement
                  : latestExceptionCandidate.exception}
              </h3>

              {latestExceptionCandidate.type ===
                "EXCEPTION" &&
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
                {latestGap.topic} ·{" "}
                {latestGap.dimension}
              </p>

              <h3 className="text-sm font-black text-slate-900">
                {latestGap.gap_type}
              </h3>

              <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
                {latestGap.reason}
              </p>

              <p className="mt-2 text-[10px] font-bold text-slate-400">
                Gap Score{" "}
                {Math.round(
                  latestGap.gap_score *
                    100
                )}
                %
              </p>
            </div>
          )}

          {/* 분석 결과 없음 */}
          {!latestKnowledgeCandidate &&
            !latestExceptionCandidate &&
            !latestConflict &&
            !latestGap && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">
                  이번 답변에서 표시할 Knowledge Candidate,
                  Gap, Conflict가 생성되지 않았습니다.
                </p>
              </div>
            )}
        </div>
      )}
    </aside>
  );
}