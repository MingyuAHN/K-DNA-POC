"use client";

import { useEffect, useState } from "react";

import {
  getMissions,
  type MissionResponse,
} from "@/services/mission";

import {
  getMissionInterviews,
  type InterviewResponse,
} from "@/services/interview";

import {
  getMissionKnowledgeUnits,
  type KnowledgeUnitResponse,
} from "@/services/dashboard";

import { getMissionConflicts } from "@/services/conflict";

import DashboardSummarySection from "./components/summary";
import ActiveMissionList from "./components/mission-list";

import type { DashboardSummary } from "./utils";

type ActiveMissionItem = {
  mission: MissionResponse;
  interview: InterviewResponse;
};

export default function DashboardPage() {
  // 진행 가능한 Mission
  const [activeMissions, setActiveMissions] = useState<
    ActiveMissionItem[]
  >([]);

  // 전체 Mission
  const [allMissions, setAllMissions] = useState<MissionResponse[]>(
    []
  );

  // 실데이터 KPI
  const [realSummary, setRealSummary] =
    useState<DashboardSummary>({
      knowledgeUnits: 0,
      verifiedKnowledge: 0,
      conflicts: 0,
    });

  const [activeMissionsLoading, setActiveMissionsLoading] =
    useState(true);

  const [summaryLoading, setSummaryLoading] = useState(true);

  const [activeMissionsError, setActiveMissionsError] =
    useState("");

  const [summaryError, setSummaryError] = useState("");

  // ============================================================
  // Mission 목록 + 진행 중 Interview 조회
  // ============================================================

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setActiveMissionsLoading(true);
        setActiveMissionsError("");

        const missionData = await getMissions();

        // KPI 조회에서도 사용
        setAllMissions(missionData.missions);

        const results = await Promise.all(
          missionData.missions.map(async (mission) => {
            try {
              const interviewData =
                await getMissionInterviews(
                  mission.mission_id
                );

              const sortedInterviews = [
                ...interviewData.interviews,
              ].sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime()
              );

              // 진행 중 Interview 우선
              const selectedInterview =
                sortedInterviews.find(
                  (interview) =>
                    interview.status === "IN_PROGRESS"
                ) ??
                sortedInterviews.find(
                  (interview) =>
                    interview.status === "CREATED"
                ) ??
                null;

              if (!selectedInterview) {
                return null;
              }

              return {
                mission,
                interview: selectedInterview,
              };
            } catch (error) {
              console.error(
                `MISSION INTERVIEW FETCH ERROR: ${mission.mission_id}`,
                error
              );

              return null;
            }
          })
        );

        const filtered = results.filter(
          (item): item is ActiveMissionItem =>
            item !== null
        );

        setActiveMissions(filtered);
      } catch (error) {
        console.error(
          "DASHBOARD ACTIVE MISSIONS FETCH ERROR:",
          error
        );

        setActiveMissionsError(
          error instanceof Error
            ? error.message
            : "진행 중인 Mission을 불러오는 중 오류가 발생했습니다."
        );
      } finally {
        setActiveMissionsLoading(false);
      }
    };

    void fetchDashboardData();
  }, []);

  // ============================================================
  // 전체 Mission 기준 KPI 조회
  // Knowledge Unit / VERIFIED / Conflict
  // ============================================================

  useEffect(() => {
    if (allMissions.length === 0) {
      setRealSummary({
        knowledgeUnits: 0,
        verifiedKnowledge: 0,
        conflicts: 0,
      });

      setSummaryLoading(false);
      return;
    }

    const fetchSummary = async () => {
      try {
        setSummaryLoading(true);
        setSummaryError("");

        const results = await Promise.all(
          allMissions.map(async (mission) => {
            const [knowledgeUnits, conflictData] =
              await Promise.all([
                getMissionKnowledgeUnits(
                  mission.mission_id
                ),
                getMissionConflicts(
                  mission.mission_id
                ),
              ]);

            return {
              knowledgeUnits,
              conflicts: conflictData.total,
            };
          })
        );

        // 전체 Knowledge Unit
        const allKnowledgeUnits = results.flatMap(
          (result) => result.knowledgeUnits
        );

        // VERIFIED 상태만 집계
        const verifiedKnowledge =
          allKnowledgeUnits.filter(
            (unit: KnowledgeUnitResponse) =>
              unit.status === "VERIFIED"
          ).length;

        // 전체 Conflict
        const totalConflicts = results.reduce(
          (sum, result) =>
            sum + result.conflicts,
          0
        );

        setRealSummary({
          knowledgeUnits: allKnowledgeUnits.length,
          verifiedKnowledge,
          conflicts: totalConflicts,
        });
      } catch (error) {
        console.error(
          "DASHBOARD SUMMARY FETCH ERROR:",
          error
        );

        setSummaryError(
          error instanceof Error
            ? error.message
            : "Dashboard KPI를 불러오는 중 오류가 발생했습니다."
        );
      } finally {
        setSummaryLoading(false);
      }
    };

    void fetchSummary();
  }, [allMissions]);

  return (
    <div className="bg-[#F8FAFC] px-3 pb-2 pt-1 text-slate-900 sm:px-4 lg:px-5">
      <div className="mx-auto max-w-[1600px] space-y-3">
        {/* Dashboard 제목 */}
        <header className="px-1">
          <div className="space-y-0.5">
            <h1 className="text-3xl font-black tracking-tighter text-slate-900 sm:text-4xl lg:text-5xl">
              Dashboard
            </h1>

            <p className="text-sm font-semibold text-slate-500">
              K-DNA의 전체 지식 현황과 진행 중인 Mission을
              확인합니다.
            </p>
          </div>
        </header>

        {/* 전체 시스템 KPI */}
        <DashboardSummarySection
          activeMissionCount={activeMissions.length}
          activeMissionsLoading={activeMissionsLoading}
          summary={realSummary}
          summaryLoading={summaryLoading}
        />

        {/* KPI 오류 */}
        {summaryError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="text-sm font-semibold text-rose-600">
              {summaryError}
            </p>
          </div>
        )}

        {/* 진행 중인 Mission */}
        <ActiveMissionList
          activeMissions={activeMissions}
          loading={activeMissionsLoading}
          errorMessage={activeMissionsError}
        />
      </div>
    </div>
  );
}