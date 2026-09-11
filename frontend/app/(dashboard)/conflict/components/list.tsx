import type { MissionKnowledgeConflict } from "@/services/conflict";

import {
  formatDate,
  getConflictTypeLabel,
  getSeverityLabel,
} from "../utils";

type ConflictListProps = {
  conflicts: MissionKnowledgeConflict[];
  selectedConflictId: string;
  selectedMissionTitle?: string;
  loading: boolean;
  onSelect: (conflictId: string) => void;
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

export default function ConflictList({
  conflicts,
  selectedConflictId,
  selectedMissionTitle,
  loading,
  onSelect,
}: ConflictListProps) {
  return (
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

        {!loading && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
            {conflicts.length}건
          </span>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center text-sm font-semibold text-slate-400">
          Conflict를 불러오는 중입니다.
        </div>
      ) : conflicts.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center">
          <p className="text-sm font-bold text-slate-600">
            등록된 Conflict가 없습니다.
          </p>

          <p className="mt-1 text-xs font-semibold text-slate-400">
            {selectedMissionTitle ?? "선택한 Mission"}의 분석 결과에
            Conflict가 생성되면 표시됩니다.
          </p>
        </div>
      ) : (
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
                onClick={() => onSelect(conflict.conflict_id)}
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
                    {getConflictTypeLabel(conflict.conflict_type)}
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
                    심각도 {getSeverityLabel(conflict.severity)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}