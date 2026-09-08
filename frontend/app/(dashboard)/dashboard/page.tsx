"use client";

import Link from "next/link";
import {
  Target,
  SearchCheck,
  FileText,
  CircleCheckBig,
  TriangleAlert,
  UserRound,
  ArrowRight,
} from "lucide-react";
import { dashboardMock } from "@/mocks/dashboardMock";

export default function DashboardPage() {
  const dashboardData = dashboardMock;

  // 전체 시스템 기준 KPI 카드
  const summaryCards = [
    {
      label: "진행 중인 미션",
      value: dashboardData.summary.activeMissions,
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-3 text-slate-900 sm:p-4 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6 lg:space-y-8">
        {/* Dashboard 화면 제목 */}
        <header className="px-1">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter text-slate-900 sm:text-4xl lg:text-5xl">
              Dashboard
            </h1>

            <p className="text-sm font-semibold text-slate-500">
              K-DNA의 전체 지식 현황과 진행 중인 Mission을 확인합니다.
            </p>
          </div>
        </header>

        {/* 전체 시스템 KPI */}
        <section>
          <div className="mb-4 flex items-center gap-2 px-1">
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
                  className="group relative overflow-hidden rounded-[22px] border border-slate-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:p-5"
                >
                  <div
                    className={`absolute left-0 top-0 h-full w-1.5 ${item.barColor}`}
                  />

                  <div className="mb-5 flex items-center justify-between">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.iconBg}`}
                    >
                      <Icon className={`h-5 w-5 ${item.iconColor}`} />
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
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100">
              <Target className="h-4 w-4 text-indigo-600" />
            </div>

            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-800 sm:text-xl">
                진행 중인 미션
              </h2>

              <p className="text-xs font-semibold text-slate-400">
                현재 활성화된 Mission의 Knowledge Coverage
              </p>
            </div>
          </div>

          {/* Active Mission 카드 */}
          <Link
            href="/interview"
            className="group block rounded-[26px] border border-slate-200/70 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:p-6 lg:p-7"
          >
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                    <Target className="h-7 w-7" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-500">
                      Active Mission
                    </p>

                    <h3 className="mt-1 truncate text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                      {dashboardData.activeMission.title}
                    </h3>

                    <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-500">
                      <UserRound className="h-4 w-4 text-slate-400" />

                      <span>{dashboardData.activeMission.expertRole}</span>
                    </div>

                    <p className="mt-3 max-w-[760px] text-sm font-medium leading-6 text-slate-500">
                      {dashboardData.activeMission.description}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1 text-sm font-bold text-blue-600 opacity-0 transition-opacity group-hover:opacity-100">
                  인터뷰 계속하기
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>

              {/* Knowledge Coverage */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-extrabold text-slate-800">
                      Knowledge Coverage
                    </p>

                    <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                      현재 Mission의 지식 충족 정도
                    </p>
                  </div>

                  <span className="text-xl font-black text-blue-600">
                    {dashboardData.activeMission.coverage}%
                  </span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                    style={{
                      width: `${dashboardData.activeMission.coverage}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </Link>
        </section>
      </div>
    </div>
  );
}