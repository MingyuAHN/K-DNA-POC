"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Target,
  SearchCheck,
  FileText,
  CircleCheckBig,
  TriangleAlert,
  ArrowRight,
  Loader2,
  BriefcaseBusiness,
} from "lucide-react";

import { dashboardMock } from "@/mocks/dashboardMock";

import {
  getMissions,
  type MissionResponse,
} from "@/services/mission";

import {
  getMissionInterviews,
  type InterviewResponse,
} from "@/services/interview";

type ActiveMissionItem = {
  mission: MissionResponse;
  interview: InterviewResponse;
};

export default function DashboardPage() {
  const dashboardData = dashboardMock;

  // 실제 진행 가능한 Mission 목록
  const [activeMissions, setActiveMissions] = useState<
    ActiveMissionItem[]
  >([]);

  const [activeMissionsLoading, setActiveMissionsLoading] =
    useState(true);

  const [activeMissionsError, setActiveMissionsError] =
    useState("");

  // ============================================================
  // Dashboard 진행 Mission 조회
  //
  // Mission 목록 조회
  // → 각 Mission의 Interview 목록 조회
  // → IN_PROGRESS 우선
  // → 없으면 CREATED
  //
  // COMPLETED / CANCELLED만 존재하는 Mission은
  // Dashboard "진행 중인 미션"에서는 제외
  // ============================================================

  useEffect(() => {
    const fetchActiveMissions = async () => {
      try {
        setActiveMissionsLoading(true);
        setActiveMissionsError("");

        const missionData = await getMissions();

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
          (
            item
          ): item is ActiveMissionItem =>
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

    fetchActiveMissions();
  }, []);

  // ============================================================
  // 전체 시스템 기준 KPI 카드
  //
  // 진행 중 Mission 숫자만 실제 조회 결과 사용.
  // 나머지 KPI는 아직 기존 mock 유지.
  // ============================================================

  const summaryCards = [
    {
      label: "진행 중인 미션",
      value: activeMissionsLoading
        ? "-"
        : activeMissions.length,
      unit: "개",
      icon: Target,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      barColor: "bg-blue-600",
    },
    {
      label: "지식 후보",
      value: dashboardData.summary.candidates,
      unit: "개",
      icon: SearchCheck,
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      barColor: "bg-indigo-600",
    },
    {
      label: "지식 단위",
      value: dashboardData.summary.knowledgeUnits,
      unit: "개",
      icon: FileText,
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
      barColor: "bg-violet-600",
    },
    {
      label: "검증 완료",
      value: dashboardData.summary.verifiedKnowledge,
      unit: "개",
      icon: CircleCheckBig,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      barColor: "bg-emerald-600",
    },
    {
      label: "갈등 이슈",
      value: dashboardData.summary.conflicts,
      unit: "건",
      icon: TriangleAlert,
      iconBg: "bg-rose-100",
      iconColor: "text-rose-600",
      barColor: "bg-rose-500",
    },
  ];

  const getInterviewStatusLabel = (
    interview: InterviewResponse
  ) => {
    if (interview.status === "IN_PROGRESS") {
      return "진행 중";
    }

    if (interview.status === "CREATED") {
      return "시작 전";
    }

    return interview.status;
  };

  return (
    <div className="bg-[#F8FAFC] px-3 pb-2 pt-1 text-slate-900 sm:px-4 lg:px-5">
      <div className="mx-auto max-w-[1600px] space-y-3">
        {/* Dashboard 화면 제목 */}
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
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100">
              <Target className="h-4 w-4 text-blue-600" />
            </div>

            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-800">
                전체 현황
              </h2>

              <p className="text-xs font-semibold text-slate-400">
                전체 시스템 기준 KPI
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {summaryCards.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="group relative overflow-hidden rounded-[22px] border border-slate-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className={`absolute left-0 top-0 h-full w-1.5 ${item.barColor}`}
                  />

                  <div className="mb-3 flex items-center justify-between">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.iconBg}`}
                    >
                      <Icon
                        className={`h-5 w-5 ${item.iconColor}`}
                      />
                    </div>
                  </div>

                  <p className="text-[11px] font-bold text-slate-500 sm:text-xs">
                    {item.label}
                  </p>

                  <div className="mt-1 flex items-end gap-1">
                    <span className="text-2xl font-black leading-none text-slate-900 sm:text-3xl">
                      {item.value}
                    </span>

                    <span className="pb-0.5 text-xs font-bold text-slate-400">
                      {item.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 진행 중인 Mission */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100">
                <Target className="h-4 w-4 text-indigo-600" />
              </div>

              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-slate-800 sm:text-xl">
                  진행 중인 미션
                </h2>

                <p className="text-xs font-semibold text-slate-400">
                  현재 이어서 진행할 수 있는 Mission
                </p>
              </div>
            </div>

            <Link
              href="/mission"
              className="text-xs font-bold text-blue-600 transition hover:text-blue-700"
            >
              전체 미션 보기
            </Link>
          </div>

          {activeMissionsError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-sm font-semibold text-rose-600">
                {activeMissionsError}
              </p>
            </div>
          )}

          {activeMissionsLoading ? (
            <div className="flex min-h-[180px] items-center justify-center gap-2 rounded-[26px] border border-slate-200 bg-white">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />

              <p className="text-sm font-semibold text-slate-400">
                진행 중인 Mission을 불러오는 중입니다.
              </p>
            </div>
          ) : activeMissions.length === 0 ? (
            <div className="flex min-h-[180px] items-center justify-center rounded-[26px] border border-slate-200 bg-white">
              <div className="text-center">
                <BriefcaseBusiness className="mx-auto h-8 w-8 text-slate-300" />

                <p className="mt-3 text-sm font-bold text-slate-500">
                  진행 중인 Mission이 없습니다.
                </p>

                <Link
                  href="/mission"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600"
                >
                  새 Mission 만들기
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {activeMissions.map(
                ({ mission, interview }) => (
                  <Link
                    key={mission.mission_id}
                    href={`/interview?missionId=${encodeURIComponent(
                      mission.mission_id
                    )}&interviewId=${encodeURIComponent(
                      interview.interview_id
                    )}&interviewStatus=${encodeURIComponent(
                      interview.status
                    )}`}
                    className="group block rounded-[26px] border border-slate-200/70 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                            <Target className="h-7 w-7" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-500">
                                Active Mission
                              </p>

                              <span className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-600">
                                {getInterviewStatusLabel(
                                  interview
                                )}
                              </span>
                            </div>

                            <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                              {mission.title}
                            </h3>

                            <p className="mt-2 text-sm font-semibold text-blue-600">
                              {mission.domain}
                            </p>

                            {mission.objective && (
                              <p className="mt-2 max-w-[900px] text-sm font-medium leading-6 text-slate-500">
                                {mission.objective}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1 text-sm font-bold text-blue-600 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                          인터뷰 계속하기
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>

                      {/* Coverage는 아직 실제 API 미연동 */}
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-extrabold text-slate-800">
                              Knowledge Coverage
                            </p>

                            <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                              Coverage API 연동 전
                            </p>
                          </div>

                          <span className="text-xs font-bold text-slate-400">
                            미연동
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}