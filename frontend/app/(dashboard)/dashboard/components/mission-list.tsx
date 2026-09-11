import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Loader2,
  Target,
} from "lucide-react";

import type { MissionResponse } from "@/services/mission";
import type { InterviewResponse } from "@/services/interview";

import ActiveMissionCard from "./mission-card";

type ActiveMissionItem = {
  mission: MissionResponse;
  interview: InterviewResponse;
};

type ActiveMissionListProps = {
  activeMissions: ActiveMissionItem[];
  loading: boolean;
  errorMessage: string;
};

export default function ActiveMissionList({
  activeMissions,
  loading,
  errorMessage,
}: ActiveMissionListProps) {
  return (
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

      {errorMessage && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-sm font-semibold text-rose-600">
            {errorMessage}
          </p>
        </div>
      )}

      {loading ? (
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
          {activeMissions.map(({ mission, interview }) => (
            <ActiveMissionCard
              key={mission.mission_id}
              mission={mission}
              interview={interview}
            />
          ))}
        </div>
      )}
    </section>
  );
}