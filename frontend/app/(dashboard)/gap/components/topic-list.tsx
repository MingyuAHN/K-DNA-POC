import {
  BarChart3,
  Box,
} from "lucide-react";

import type { MissionKnowledgeGap } from "@/services/gap";

import {
  formatGapScore,
  formatTopic,
  getAverageGapScore,
  topicIconMap,
} from "../utils";

type TopicGroup = {
  topic: string;
  items: MissionKnowledgeGap[];
};

type TopicListProps = {
  topicGroups: TopicGroup[];
  selectedTopic: string;
  selectedMissionTitle?: string;
  totalGapCount: number;
  loading: boolean;
  onSelect: (topic: string) => void;
};

export default function TopicList({
  topicGroups,
  selectedTopic,
  selectedMissionTitle,
  totalGapCount,
  loading,
  onSelect,
}: TopicListProps) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <BarChart3 className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-sm font-black text-slate-900">
              주제별 지식 Gap
            </h2>

            <p className="text-[11px] font-semibold text-slate-400">
              Topic Knowledge Gap
            </p>
          </div>
        </div>

        {!loading && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
            {totalGapCount}건
          </span>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center text-sm font-semibold text-slate-400">
          Gap을 불러오는 중입니다.
        </div>
      ) : topicGroups.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center">
          <p className="text-sm font-bold text-slate-600">
            등록된 Gap이 없습니다.
          </p>

          <p className="mt-1 text-xs font-semibold text-slate-400">
            {selectedMissionTitle ?? "선택한 Mission"}의 분석 결과에
            Gap이 생성되면 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {topicGroups.map(({ topic, items }) => {
            const Icon =
              topicIconMap[topic] ?? Box;

            const isSelected =
              topic === selectedTopic;

            const averageScore =
              getAverageGapScore(items);

            return (
              <button
                key={topic}
                type="button"
                onClick={() => onSelect(topic)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  isSelected
                    ? "border-blue-300 bg-blue-50 shadow-sm"
                    : "border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isSelected
                          ? "text-blue-600"
                          : "text-slate-500"
                      }`}
                    />

                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-slate-800">
                        {formatTopic(topic)}
                      </p>

                      <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                        {items.length}개 Gap
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-black text-rose-500">
                    {formatGapScore(
                      averageScore
                    )}
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