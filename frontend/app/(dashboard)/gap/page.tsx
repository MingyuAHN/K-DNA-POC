"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Box,
  CircleAlert,
  Clock3,
  Database,
  Gauge,
  HelpCircle,
  Lightbulb,
  Link2,
  Scale,
  Settings2,
} from "lucide-react";

import MissionSelector from "@/app/components/common/mission-selector";

import {
  getMissions,
  type MissionResponse,
} from "@/services/mission";

import {
  getMissionGaps,
  type MissionKnowledgeGap,
} from "@/services/gap";

// Topic별 아이콘
const topicIconMap: Record<string, typeof Box> = {
  "service-boundary": Box,
  SERVICE_BOUNDARY: Box,
  "data-ownership": Database,
  DATA_OWNERSHIP: Database,
  transaction: Link2,
  TRANSACTION: Link2,
  exception: Settings2,
  EXCEPTION: Settings2,
  "failure-cases": AlertTriangle,
  FAILURE_CASES: AlertTriangle,
};

// Dimension별 아이콘
const dimensionIconMap: Record<string, typeof HelpCircle> = {
  WHAT: HelpCircle,
  WHY: Lightbulb,
  WHEN: Clock3,
  HOW: Settings2,
  SIGNAL: Gauge,
  EXCEPTION: CircleAlert,
  FAILURE: AlertTriangle,
  TRADE_OFF: Scale,
};

// Dimension 한글 표시
const dimensionLabelMap: Record<string, string> = {
  WHAT: "무엇을 (WHAT)",
  WHY: "왜 (WHY)",
  WHEN: "언제 (WHEN)",
  HOW: "어떻게 (HOW)",
  SIGNAL: "판단 신호 (SIGNAL)",
  EXCEPTION: "예외 조건 (EXCEPTION)",
  FAILURE: "실패 사례 (FAILURE)",
  TRADE_OFF: "트레이드오프 (TRADE_OFF)",
};

// Gap Type 한글 표시
const gapTypeLabelMap: Record<string, string> = {
  MISSING: "지식 부족",
  INCOMPLETE: "불완전",
  UNCERTAIN: "불확실",
  LOW_EVIDENCE: "근거 부족",
};

// Topic 표시용
function formatTopic(topic: string) {
  return topic
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());
}

// Gap Score 표시
function formatGapScore(score: number | null) {
  if (score === null || score === undefined) {
    return "-";
  }

  return `${Math.round(score * 100)}%`;
}

export default function GapPage() {
  // Mission
  const [missions, setMissions] = useState<MissionResponse[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState("");

  // Gap
  const [gaps, setGaps] = useState<MissionKnowledgeGap[]>([]);
  const [selectedTopic, setSelectedTopic] = useState("");

  // 상태
  const [isMissionLoading, setIsMissionLoading] = useState(true);
  const [isGapLoading, setIsGapLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // 실제 Mission 목록 조회
  useEffect(() => {
    let isMounted = true;

    const loadMissions = async () => {
      try {
        setIsMissionLoading(true);
        setErrorMessage("");

        const data = await getMissions();

        if (!isMounted) {
          return;
        }

        setMissions(data.missions);

        // 첫 Mission 기본 선택
        if (data.missions.length > 0) {
          setSelectedMissionId((current) => {
            return current || data.missions[0].mission_id;
          });
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Mission 목록 조회에 실패했습니다."
        );
      } finally {
        if (isMounted) {
          setIsMissionLoading(false);
        }
      }
    };

    void loadMissions();

    return () => {
      isMounted = false;
    };
  }, []);

  // 선택 Mission의 실제 Gap 조회
  useEffect(() => {
    if (!selectedMissionId) {
      setGaps([]);
      setSelectedTopic("");
      return;
    }

    let isMounted = true;

    const loadGaps = async () => {
      try {
        setIsGapLoading(true);
        setErrorMessage("");

        const data = await getMissionGaps(selectedMissionId);

        if (!isMounted) {
          return;
        }

        setGaps(data.gaps);

        // 첫 Topic 기본 선택
        setSelectedTopic(data.gaps[0]?.topic ?? "");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setGaps([]);
        setSelectedTopic("");

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Gap 목록 조회에 실패했습니다."
        );
      } finally {
        if (isMounted) {
          setIsGapLoading(false);
        }
      }
    };

    void loadGaps();

    return () => {
      isMounted = false;
    };
  }, [selectedMissionId]);

  // 현재 Mission
  const selectedMission = useMemo(() => {
    return (
      missions.find(
        (mission) => mission.mission_id === selectedMissionId
      ) ?? null
    );
  }, [missions, selectedMissionId]);

  // Topic별 Gap 그룹화
  const topicGroups = useMemo(() => {
    const map = new Map<string, MissionKnowledgeGap[]>();

    gaps.forEach((gap) => {
      const current = map.get(gap.topic) ?? [];
      current.push(gap);
      map.set(gap.topic, current);
    });

    return Array.from(map.entries()).map(([topic, items]) => ({
      topic,
      items,
    }));
  }, [gaps]);

  // 선택 Topic의 Gap 목록
  const selectedTopicGaps = useMemo(() => {
    return gaps.filter((gap) => gap.topic === selectedTopic);
  }, [gaps, selectedTopic]);

  // Topic별 평균 Gap Score
  const getAverageGapScore = (items: MissionKnowledgeGap[]) => {
    const scores = items
      .map((item) => item.gap_score)
      .filter((score): score is number => score !== null);

    if (scores.length === 0) {
      return null;
    }

    return (
      scores.reduce((sum, score) => sum + score, 0) /
      scores.length
    );
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
            현재 Mission에서 지식이 부족하거나 추가 확인이 필요한 항목을
            확인합니다.
          </p>
        </header>

        {/* Mission 선택 */}
        <MissionSelector
          missions={missions}
          selectedMissionId={selectedMissionId}
          onChange={setSelectedMissionId}
          loading={isMissionLoading}
        />

        {/* API 오류 */}
        {errorMessage && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {errorMessage}
          </div>
        )}

        {/* Gap 분석 영역 */}
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          {/* 좌측 Topic 목록 */}
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

              {!isGapLoading && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
                  {gaps.length}건
                </span>
              )}
            </div>

            {isGapLoading ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center text-sm font-semibold text-slate-400">
                Gap을 불러오는 중입니다.
              </div>
            ) : topicGroups.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center">
                <p className="text-sm font-bold text-slate-600">
                  등록된 Gap이 없습니다.
                </p>

                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {selectedMission?.title ?? "선택한 Mission"}의 분석 결과에
                  Gap이 생성되면 표시됩니다.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {topicGroups.map(({ topic, items }) => {
                  const Icon =
                    topicIconMap[topic] ?? Box;

                  const isSelected = topic === selectedTopic;
                  const averageScore =
                    getAverageGapScore(items);

                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => setSelectedTopic(topic)}
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
                          {formatGapScore(averageScore)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* 우측 선택 Topic 상세 */}
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
                    {selectedTopicGaps.length}개 Gap 항목
                  </p>
                </div>

                {/* Dimension별 실제 Gap */}
                <div className="grid gap-3 md:grid-cols-2">
                  {selectedTopicGaps.map((gap) => {
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
                                {gapTypeLabelMap[gap.gap_type] ??
                                  gap.gap_type}
                              </p>
                            </div>
                          </div>

                          <span className="text-sm font-black text-rose-500">
                            {formatGapScore(gap.gap_score)}
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
        </div>
      </div>
    </div>
  );
}