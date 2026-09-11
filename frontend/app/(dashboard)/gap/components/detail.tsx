import {
  HelpCircle,
} from "lucide-react";

import type {
  MissionKnowledgeGap,
} from "@/services/gap";

import {
  dimensionIconMap,
  dimensionLabelMap,
  formatGapScore,
  formatTopic,
  gapTypeLabelMap,
} from "../utils";

type GapDetailProps = {
  selectedTopic: string;
  gaps: MissionKnowledgeGap[];
};

export default function GapDetail({
  selectedTopic,
  gaps,
}: GapDetailProps) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      {!selectedTopic ? (
        <div className="flex min-h-[360px] items-center justify-center">
          <div className="text-center">
            <p className="text-sm font-black text-slate-600">
              선택할 Gap이 없습니다.
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-400">
              Gap이 생성된 Mission을 선택해 주세요.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* 선택 Topic 정보 */}
          <div className="mb-5">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-500">
              선택한 주제
            </p>

            <h2 className="mt-1 text-lg font-black text-slate-900">
              {formatTopic(selectedTopic)}
            </h2>

            <p className="mt-1 text-xs font-semibold text-slate-500">
              {gaps.length}개 Gap 항목
            </p>
          </div>

          {/* Dimension별 실제 Gap */}
          <div className="grid gap-3 md:grid-cols-2">
            {gaps.map((gap) => {
              const Icon =
                dimensionIconMap[gap.dimension] ??
                HelpCircle;

              const dimensionLabel =
                dimensionLabelMap[gap.dimension] ??
                gap.dimension;

              return (
                <div
                  key={gap.gap_id}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-500">
                        <Icon className="h-4 w-4" />
                      </div>

                      <div>
                        <span className="text-xs font-black text-slate-800">
                          {dimensionLabel}
                        </span>

                        <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                          {gapTypeLabelMap[
                            gap.gap_type
                          ] ?? gap.gap_type}
                        </p>
                      </div>
                    </div>

                    <span className="text-sm font-black text-rose-500">
                      {formatGapScore(
                        gap.gap_score
                      )}
                    </span>
                  </div>

                  {/* Gap 발생 이유 */}
                  <p className="mt-3 text-xs font-semibold leading-6 text-slate-600">
                    {gap.reason}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}