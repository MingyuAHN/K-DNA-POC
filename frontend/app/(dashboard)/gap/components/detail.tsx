import {
  Clock3,
  HelpCircle,
  History,
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
  // 최신순 정렬
  const sortedGaps = [...gaps].sort(
    (a, b) => {
      const aTime = a.created_at
        ? new Date(
            a.created_at
          ).getTime()
        : 0;

      const bTime = b.created_at
        ? new Date(
            b.created_at
          ).getTime()
        : 0;

      return bTime - aTime;
    }
  );

  const latestGap =
    sortedGaps[0] ?? null;

  const previousGaps =
    sortedGaps.slice(1);

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      {!selectedTopic ? (
        <div className="flex min-h-[360px] items-center justify-center">
          <div className="text-center">
            <p className="text-sm font-black text-slate-600">
              선택할 Gap이 없습니다.
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-400">
              Gap이 탐지된 Mission을 선택해 주세요.
            </p>
          </div>
        </div>
      ) : !latestGap ? (
        <div className="flex min-h-[360px] items-center justify-center">
          <div className="text-center">
            <p className="text-sm font-black text-slate-600">
              탐지된 Gap이 없습니다.
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-400">
              선택한 Topic의 Gap 이력이 없습니다.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Topic 정보 */}
          <div className="mb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-500">
              선택한 주제
            </p>

            <h2 className="mt-1 text-lg font-black text-slate-900">
              {formatTopic(
                selectedTopic
              )}
            </h2>

            <p className="mt-1 text-xs font-semibold text-slate-500">
              총 {sortedGaps.length}건의 Gap 탐지 이력
            </p>
          </div>

          {/* 최신 Gap */}
          <div className="rounded-[22px] border border-blue-100 bg-blue-50/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black text-blue-600">
                  최신 Gap
                </p>

                <p className="mt-0.5 text-xs font-semibold text-slate-400">
                  가장 최근에 탐지된 Gap입니다.
                </p>
              </div>

              {latestGap.created_at && (
                <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                  <Clock3 className="h-3.5 w-3.5" />

                  {formatDateTime(
                    latestGap.created_at
                  )}
                </div>
              )}
            </div>

            <GapCard
              gap={latestGap}
              highlight
            />
          </div>

          {/* 이전 탐지 이력 */}
          {previousGaps.length > 0 && (
            <div className="mt-4">
              <div className="mb-3 flex items-center gap-2">
                <History className="h-4 w-4 text-slate-500" />

                <h3 className="text-sm font-black text-slate-900">
                  이전 탐지 이력
                </h3>

                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">
                  {previousGaps.length}건
                </span>
              </div>

              <div className="space-y-3">
                {previousGaps.map(
                  (gap) => (
                    <GapHistoryItem
                      key={gap.gap_id}
                      gap={gap}
                    />
                  )
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

type GapCardProps = {
  gap: MissionKnowledgeGap;
  highlight?: boolean;
};

function GapCard({
  gap,
  highlight = false,
}: GapCardProps) {
  const Icon =
    dimensionIconMap[
      gap.dimension
    ] ?? HelpCircle;

  const dimensionLabel =
    dimensionLabelMap[
      gap.dimension
    ] ?? gap.dimension;

  const gapTypeLabel =
    gapTypeLabelMap[
      gap.gap_type
    ] ?? gap.gap_type;

  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? "border-blue-100 bg-white"
          : "border-slate-100 bg-slate-50/70"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {/* Dimension */}
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              highlight
                ? "bg-blue-100 text-blue-600"
                : "bg-rose-100 text-rose-500"
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-black text-slate-800">
              {dimensionLabel}
            </p>

            <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
              {gapTypeLabel}
            </span>
          </div>
        </div>

        {/* Gap Score */}
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-bold text-slate-400">
            Gap Score
          </p>

          <p className="mt-0.5 text-lg font-black text-rose-500">
            {formatGapScore(
              gap.gap_score
            )}
          </p>
        </div>
      </div>

      {/* 탐지 이유 */}
      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="text-[10px] font-black text-slate-400">
          탐지 이유
        </p>

        <p className="mt-1.5 whitespace-pre-line text-sm font-semibold leading-6 text-slate-700">
          {gap.reason}
        </p>
      </div>
    </div>
  );
}

function GapHistoryItem({
  gap,
}: {
  gap: MissionKnowledgeGap;
}) {
  const Icon =
    dimensionIconMap[
      gap.dimension
    ] ?? HelpCircle;

  const dimensionLabel =
    dimensionLabelMap[
      gap.dimension
    ] ?? gap.dimension;

  const gapTypeLabel =
    gapTypeLabelMap[
      gap.gap_type
    ] ?? gap.gap_type;

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {/* Dimension */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Icon className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black text-slate-800">
                {dimensionLabel}
              </p>

              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-500">
                {gapTypeLabel}
              </span>
            </div>

            {gap.created_at && (
              <p className="mt-1 text-[10px] font-semibold text-slate-400">
                {formatDateTime(
                  gap.created_at
                )}
              </p>
            )}
          </div>
        </div>

        {/* Gap Score */}
        <span className="shrink-0 text-xs font-black text-rose-500">
          {formatGapScore(
            gap.gap_score
          )}
        </span>
      </div>

      {/* 탐지 이유 */}
      <p className="mt-3 whitespace-pre-line text-xs font-semibold leading-6 text-slate-600">
        {gap.reason}
      </p>
    </div>
  );
}

// 탐지 시점 표시
function formatDateTime(
  value: string
) {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}