import Link from "next/link";
import {
  ArrowRight,
  Target,
} from "lucide-react";

import type { MissionResponse } from "@/services/mission";
import type { InterviewResponse } from "@/services/interview";

type ActiveMissionCardProps = {
  mission: MissionResponse;
  interview: InterviewResponse;
};

export default function ActiveMissionCard({
  mission,
  interview,
}: ActiveMissionCardProps) {
  return (
    <Link
      href={`/interview?missionId=${encodeURIComponent(
        mission.mission_id
      )}&interviewId=${encodeURIComponent(
        interview.interview_id
      )}&interviewStatus=${encodeURIComponent(
        interview.status
      )}`}
      className="group block rounded-[26px] border border-slate-200/70 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
            <Target className="h-7 w-7" />
          </div>

          <div className="min-w-0">
            {/* Mission 정보 */}
            <h3 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
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

        {/* Interview 이동 */}
        <div className="flex shrink-0 items-center gap-1 text-sm font-bold text-blue-600 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          인터뷰 계속하기
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}