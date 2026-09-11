import {
  Target,
  SearchCheck,
  FileText,
  CircleCheckBig,
  TriangleAlert,
} from "lucide-react";

import type { DashboardSummary } from "../utils";

type DashboardSummaryProps = {
  activeMissionCount: number;
  activeMissionsLoading: boolean;
  summary: DashboardSummary;
  summaryLoading: boolean;
};

export default function DashboardSummarySection({
  activeMissionCount,
  activeMissionsLoading,
  summary,
  summaryLoading,
}: DashboardSummaryProps) {
  const summaryCards = [
    {
      label: "진행 중인 미션",
      value: activeMissionsLoading ? "-" : activeMissionCount,
      unit: "개",
      icon: Target,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      barColor: "bg-blue-600",
    },
    {
      label: "지식 후보",
      // Mission 단위 Candidate 조회 API 확인 전
      value: "-",
      unit: "개",
      icon: SearchCheck,
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      barColor: "bg-indigo-600",
    },
    {
      label: "지식 단위",
      value: summaryLoading ? "-" : summary.knowledgeUnits,
      unit: "개",
      icon: FileText,
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
      barColor: "bg-violet-600",
    },
    {
      label: "검증 완료",
      value: summaryLoading ? "-" : summary.verifiedKnowledge,
      unit: "개",
      icon: CircleCheckBig,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      barColor: "bg-emerald-600",
    },
    {
      label: "갈등 이슈",
      value: summaryLoading ? "-" : summary.conflicts,
      unit: "건",
      icon: TriangleAlert,
      iconBg: "bg-rose-100",
      iconColor: "text-rose-600",
      barColor: "bg-rose-500",
    },
  ];

  return (
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
  );
}