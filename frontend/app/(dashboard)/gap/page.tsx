"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Box,
  ChevronDown,
  CircleAlert,
  Clock3,
  Database,
  Gauge,
  HelpCircle,
  Lightbulb,
  Link2,
  MessageSquareText,
  Scale,
  Settings2,
} from "lucide-react";
import { gapMock } from "@/mocks/gapMock";

type TopicId = keyof typeof gapMock.dimensions;

const topicIconMap = {
  "service-boundary": Box,
  "data-ownership": Database,
  transaction: Link2,
  exception: Settings2,
  "failure-cases": AlertTriangle,
};

const topicLabelMap = {
  "service-boundary": "서비스 경계",
  "data-ownership": "데이터 소유권",
  transaction: "트랜잭션",
  exception: "예외",
  "failure-cases": "실패 사례",
};

const dimensionIconMap = {
  WHAT: HelpCircle,
  WHY: Lightbulb,
  WHEN: Clock3,
  HOW: Settings2,
  SIGNAL: Gauge,
  EXCEPTION: CircleAlert,
  FAILURE: AlertTriangle,
  TRADE_OFF: Scale,
};

const dimensionLabelMap = {
  WHAT: "무엇을 (WHAT)",
  WHY: "왜 (WHY)",
  WHEN: "언제 (WHEN)",
  HOW: "어떻게 (HOW)",
  SIGNAL: "판단 신호 (SIGNAL)",
  EXCEPTION: "예외 조건 (EXCEPTION)",
  FAILURE: "실패 사례 (FAILURE)",
  TRADE_OFF: "트레이드오프 (TRADE_OFF)",
};

export default function GapPage() {
  const router = useRouter();

  const [selectedMissionId, setSelectedMissionId] = useState(
    gapMock.mission.missionId
  );

  const [selectedTopicId, setSelectedTopicId] =
    useState<TopicId>("exception");

  const selectedTopic = useMemo(
    () =>
      gapMock.topics.find((topic) => topic.id === selectedTopicId) ??
      gapMock.topics[0],
    [selectedTopicId]
  );

  const selectedDimensions =
    gapMock.dimensions[selectedTopicId] ?? [];

  const selectedTopicLabel =
    topicLabelMap[selectedTopicId as keyof typeof topicLabelMap] ??
    selectedTopic.label;

  // 추천 질문을 Interview 화면으로 전달
  const handleAskExpert = () => {
    const params = new URLSearchParams({
      missionId: selectedMissionId,
      topic: selectedTopicId,
      question: gapMock.recommendedQuestion,
    });

    router.push(`/interview?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-3 text-slate-900 sm:p-4 lg:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        {/* 화면 제목 */}
        <header className="px-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Knowledge Gap Map
          </h1>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            현재 Mission에서 지식이 덜 채워진 주제와 세부 항목을 확인합니다.
          </p>
        </header>

        {/* Mission 선택 */}
        <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="shrink-0">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                선택한 미션
              </p>
            </div>

            <div className="relative min-w-0 flex-1">
              <select
                value={selectedMissionId}
                onChange={(e) => setSelectedMissionId(e.target.value)}
                className="h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 pr-10 text-sm font-bold text-slate-800 outline-none transition hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value={gapMock.mission.missionId}>
                  {gapMock.mission.title}
                </option>
              </select>

              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>
        </section>

        {/* Gap 분석 영역 */}
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          {/* 좌측: 주제별 Coverage */}
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <BarChart3 className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-sm font-black text-slate-900">
                  주제별 지식 커버리지
                </h2>

                <p className="text-[11px] font-semibold text-slate-400">
                  Topic Knowledge Coverage
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {gapMock.topics.map((topic) => {
                const Icon =
                  topicIconMap[
                    topic.id as keyof typeof topicIconMap
                  ] ?? Box;

                const topicLabel =
                  topicLabelMap[
                    topic.id as keyof typeof topicLabelMap
                  ] ?? topic.label;

                const isSelected = topic.id === selectedTopicId;
                const isLow = topic.coverage < 30;

                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() =>
                      setSelectedTopicId(topic.id as TopicId)
                    }
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? "border-blue-300 bg-blue-50 shadow-sm"
                        : "border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            isLow
                              ? "text-rose-500"
                              : isSelected
                                ? "text-blue-600"
                                : "text-slate-500"
                          }`}
                        />

                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-slate-800">
                            {topicLabel}
                          </p>

                          <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">
                            {topic.label}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-black ${
                          isLow
                            ? "text-rose-500"
                            : "text-blue-600"
                        }`}
                      >
                        {topic.coverage}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${
                          isLow ? "bg-rose-500" : "bg-blue-500"
                        }`}
                        style={{
                          width: `${topic.coverage}%`,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 우측: 선택 Topic 상세 Gap 분석 */}
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-500">
                  선택한 주제
                </p>

                <h2 className="mt-1 text-lg font-black text-slate-900">
                  {selectedTopicLabel}
                </h2>

                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {selectedTopic.label}
                </p>

                <p className="mt-1 text-xs font-semibold text-slate-500">
                  8개 지식 항목별 충족 수준
                </p>
              </div>

              <div className="rounded-2xl bg-blue-50 px-4 py-3 text-right">
                <p className="text-[11px] font-bold text-slate-400">
                  커버리지
                </p>

                <p className="text-xl font-black text-blue-600">
                  {selectedTopic.coverage}%
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {selectedDimensions.map((item) => {
                const Icon =
                  dimensionIconMap[
                    item.dimension as keyof typeof dimensionIconMap
                  ] ?? HelpCircle;

                const dimensionLabel =
                  dimensionLabelMap[
                    item.dimension as keyof typeof dimensionLabelMap
                  ] ?? item.dimension;

                const isCritical = item.value < 30;

                return (
                  <div
                    key={item.dimension}
                    className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            isCritical
                              ? "bg-rose-100 text-rose-500"
                              : "bg-blue-100 text-blue-600"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        <span className="text-xs font-black text-slate-800">
                          {dimensionLabel}
                        </span>
                      </div>

                      <span
                        className={`text-sm font-black ${
                          isCritical
                            ? "text-rose-500"
                            : "text-blue-600"
                        }`}
                      >
                        {item.value}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${
                          isCritical
                            ? "bg-rose-500"
                            : "bg-blue-500"
                        }`}
                        style={{
                          width: `${item.value}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* 추천 질문 */}
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <MessageSquareText className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-sm font-black text-slate-900">
                추천 질문
              </h2>

              <p className="text-[11px] font-semibold text-slate-400">
                Recommended Question
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm font-bold leading-6 text-slate-700">
              “{gapMock.recommendedQuestion}”
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
        </section>
      </div>
    </div>
  );
}