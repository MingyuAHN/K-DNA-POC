"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import MissionSelector from "@/app/components/common/mission-selector";

import {
  getMissions,
  type MissionResponse,
} from "@/services/mission";

import {
  getMissionConflicts,
  type MissionKnowledgeConflict,
} from "@/services/conflict";

import ConflictList from "./components/list";
import ConflictDetail from "./components/detail";

export default function ConflictPage() {
  const router = useRouter();

  // Mission 목록
  const [missions, setMissions] = useState<MissionResponse[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState("");

  // Conflict 목록
  const [conflicts, setConflicts] = useState<
    MissionKnowledgeConflict[]
  >([]);
  const [selectedConflictId, setSelectedConflictId] = useState("");

  // 화면 상태
  const [isMissionLoading, setIsMissionLoading] = useState(true);
  const [isConflictLoading, setIsConflictLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Mission 목록 조회
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

        if (data.missions.length > 0) {
          setSelectedMissionId((currentMissionId) => {
            return currentMissionId || data.missions[0].mission_id;
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

  // 선택한 Mission의 Conflict 조회
  useEffect(() => {
    if (!selectedMissionId) {
      setConflicts([]);
      setSelectedConflictId("");
      return;
    }

    let isMounted = true;

    const loadConflicts = async () => {
      try {
        setIsConflictLoading(true);
        setErrorMessage("");

        const data = await getMissionConflicts(selectedMissionId);

        if (!isMounted) {
          return;
        }

        setConflicts(data.conflicts);

        setSelectedConflictId(
          data.conflicts[0]?.conflict_id ?? ""
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setConflicts([]);
        setSelectedConflictId("");

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Conflict 목록 조회에 실패했습니다."
        );
      } finally {
        if (isMounted) {
          setIsConflictLoading(false);
        }
      }
    };

    void loadConflicts();

    return () => {
      isMounted = false;
    };
  }, [selectedMissionId]);

  // 현재 선택 Mission
  const selectedMission = useMemo(() => {
    return (
      missions.find(
        (mission) => mission.mission_id === selectedMissionId
      ) ?? null
    );
  }, [missions, selectedMissionId]);

  // 현재 선택 Conflict
  const selectedConflict = useMemo(() => {
    return (
      conflicts.find(
        (conflict) =>
          conflict.conflict_id === selectedConflictId
      ) ??
      conflicts[0] ??
      null
    );
  }, [conflicts, selectedConflictId]);

  // 추천 질문을 Interview 화면으로 전달
  const handleAskExpert = () => {
    if (
      !selectedMissionId ||
      !selectedConflict ||
      !selectedConflict.recommended_question
    ) {
      return;
    }

    const params = new URLSearchParams({
      missionId: selectedMissionId,
      conflictId: selectedConflict.conflict_id,
      question: selectedConflict.recommended_question,
    });

    router.push(`/interview?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-3 text-slate-900 sm:p-4 lg:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        {/* 화면 제목 */}
        <header className="px-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Conflict Center
          </h1>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            전문가 발언과 기존 지식·프로젝트 근거 사이의 충돌 원인과
            조건을 확인합니다.
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

        {/* Main */}
        <div className="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
          <ConflictList
            conflicts={conflicts}
            selectedConflictId={selectedConflictId}
            selectedMissionTitle={selectedMission?.title}
            loading={isConflictLoading}
            onSelect={setSelectedConflictId}
          />

          <ConflictDetail
            conflict={selectedConflict}
            mission={selectedMission}
            onAskExpert={handleAskExpert}
          />
        </div>
      </div>
    </div>
  );
}