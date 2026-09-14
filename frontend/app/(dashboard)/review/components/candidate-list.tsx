"use client";

import type {
  KnowledgeReviewCandidate,
} from "@/services/review";

import {
  formatKnowledgeType,
} from "../utils";

type CandidateListProps = {
  candidates: KnowledgeReviewCandidate[];
  selectedCandidateId: string;
  loading: boolean;
  onSelect: (
    candidateId: string
  ) => void;
};

export default function CandidateList({
  candidates,
  selectedCandidateId,
  loading,
  onSelect,
}: CandidateListProps) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      {/* 목록 헤더 */}
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900">
            지식 후보 목록
          </h2>

          <p className="mt-1 text-xs font-semibold text-slate-400">
            전문가 검토가 필요한 지식 후보입니다.
          </p>
        </div>

        {!loading && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
            {candidates.length}건
          </span>
        )}
      </div>

      {/* 후보 목록 영역 */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex min-h-[180px] items-center justify-center">
            <p className="text-sm font-semibold text-slate-400">
              Review 대상을 불러오는 중입니다.
            </p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 text-center">
            <div>
              <p className="text-sm font-black text-slate-700">
                검토할 지식 후보가 없습니다.
              </p>

              <p className="mt-1 text-xs font-semibold text-slate-400">
                현재 Mission의 Review 대상이 모두 처리되었습니다.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {candidates.map(
              (candidate) => {
                const isSelected =
                  candidate.candidate_id ===
                  selectedCandidateId;

                return (
                  <button
                    key={
                      candidate.candidate_id
                    }
                    type="button"
                    onClick={() =>
                      onSelect(
                        candidate.candidate_id
                      )
                    }
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? "border-blue-300 bg-blue-50 shadow-sm"
                        : "border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {/* 지식 유형 + 상태 */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
                        {formatKnowledgeType(
                          candidate.knowledge_type
                        )}
                      </span>

                      <StatusBadge />
                    </div>

                    {/* Candidate 내용 */}
                    <p className="mt-3 line-clamp-3 text-sm font-black leading-6 text-slate-900">
                      {
                        candidate.statement
                      }
                    </p>
                  </button>
                );
              }
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function StatusBadge() {
  return (
    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-700">
      검토 대기
    </span>
  );
}