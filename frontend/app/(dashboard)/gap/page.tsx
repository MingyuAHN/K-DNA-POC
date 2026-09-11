"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import MissionSelector from "@/app/components/common/mission-selector";

import {
  getMissions,
  type MissionResponse,
} from "@/services/mission";

import {
  getMissionGaps,
  type MissionKnowledgeGap,
} from "@/services/gap";

import TopicList from "./components/topic-list";
import GapDetail from "./components/detail";

export default function GapPage() {
  // Mission
  const [
    missions,
    setMissions,
  ] = useState<MissionResponse[]>([]);

  const [
    selectedMissionId,
    setSelectedMissionId,
  ] = useState("");

  // Gap
  const [
    gaps,
    setGaps,
  ] = useState<MissionKnowledgeGap[]>([]);

  const [
    selectedTopic,
    setSelectedTopic,
  ] = useState("");

  // 상태
  const [
    isMissionLoading,
    setIsMissionLoading,
  ] = useState(true);

  const [
    isGapLoading,
    setIsGapLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  // 실제 Mission 목록 조회
  useEffect(() => {
    let isMounted = true;

    const loadMissions = async () => {
      try {
        setIsMissionLoading(true);
        setErrorMessage("");

        const data =
          await getMissions();

        if (!isMounted) {
          return;
        }

        setMissions(
          data.missions
        );

        // 첫 Mission 기본 선택
        if (
          data.missions.length > 0
        ) {
          setSelectedMissionId(
            (current) => {
              return (
                current ||
                data.missions[0]
                  .mission_id
              );
            }
          );
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
          setIsMissionLoading(
            false
          );
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

        const data =
          await getMissionGaps(
            selectedMissionId
          );

        if (!isMounted) {
          return;
        }

        setGaps(data.gaps);

        // 첫 Topic 기본 선택
        setSelectedTopic(
          data.gaps[0]?.topic ?? ""
        );
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
          setIsGapLoading(
            false
          );
        }
      }
    };

    void loadGaps();

    return () => {
      isMounted = false;
    };
  }, [selectedMissionId]);

  // 현재 Mission
  const selectedMission =
    useMemo(() => {
      return (
        missions.find(
          (mission) =>
            mission.mission_id ===
            selectedMissionId
        ) ?? null
      );
    }, [
      missions,
      selectedMissionId,
    ]);

  // Topic별 Gap 그룹화
  const topicGroups =
    useMemo(() => {
      const map =
        new Map<
          string,
          MissionKnowledgeGap[]
        >();

      gaps.forEach((gap) => {
        const current =
          map.get(gap.topic) ?? [];

        current.push(gap);

        map.set(
          gap.topic,
          current
        );
      });

      return Array.from(
        map.entries()
      ).map(
        ([topic, items]) => ({
          topic,
          items,
        })
      );
    }, [gaps]);

  // 선택 Topic의 Gap 목록
  const selectedTopicGaps =
    useMemo(() => {
      return gaps.filter(
        (gap) =>
          gap.topic ===
          selectedTopic
      );
    }, [
      gaps,
      selectedTopic,
    ]);

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
          selectedMissionId={
            selectedMissionId
          }
          onChange={
            setSelectedMissionId
          }
          loading={
            isMissionLoading
          }
        />

        {/* API 오류 */}
        {errorMessage && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {errorMessage}
          </div>
        )}

        {/* Gap 분석 영역 */}
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <TopicList
            topicGroups={
              topicGroups
            }
            selectedTopic={
              selectedTopic
            }
            selectedMissionTitle={
              selectedMission?.title
            }
            totalGapCount={
              gaps.length
            }
            loading={
              isGapLoading
            }
            onSelect={
              setSelectedTopic
            }
          />

          <GapDetail
            selectedTopic={
              selectedTopic
            }
            gaps={
              selectedTopicGaps
            }
          />
        </div>
      </div>
    </div>
  );
}