"use client";

import {
  BarChart3,
  Box,
} from "lucide-react";

import type {
  MissionKnowledgeGap,
} from "@/services/gap";

import {
  formatTopic,
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
      {/* 목록 헤더 */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <BarChart3 className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-sm font-black text-slate-900">
              주제별 Gap 이력
            </h2>

            <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
              같은 Topic의 Gap을 묶어 표시합니다.
            </p>
          </div>
        </div>

        {!loading && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
            {topicGroups.length}개 주제 · Gap {totalGapCount}건
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
            탐지된 Gap이 없습니다.
          </p>

          <p className="mt-1 text-xs font-semibold text-slate-400">
            {selectedMissionTitle ?? "선택한 Mission"}에서 Gap이 탐지되면
            표시됩니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {topicGroups.map(
            ({ topic, items }) => {
              const Icon =
                topicIconMap[topic] ??
                Box;

              const isSelected =
                topic ===
                selectedTopic;

              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() =>
                    onSelect(topic)
                  }
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? "border-blue-300 bg-blue-50 shadow-sm"
                      : "border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {/* Topic 아이콘 */}
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          isSelected
                            ? "text-blue-600"
                            : "text-slate-500"
                        }`}
                      />

                      <div className="min-w-0">
                        {/* Topic 이름 */}
                        <p className="line-clamp-2 text-xs font-black leading-5 text-slate-800">
                          {formatTopic(
                            topic
                          )}
                        </p>

                        {/* Gap 건수 */}
                        <p className="mt-1 text-[10px] font-semibold text-slate-400">
                          Gap {items.length}건
                        </p>
                      </div>
                    </div>

                    {/* 선택 표시 */}
                    {isSelected && (
                      <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-black text-blue-600">
                        선택됨
                      </span>
                    )}
                  </div>
                </button>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}