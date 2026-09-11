"use client";

import {
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  Loader2,
  Network,
  RotateCcw,
} from "lucide-react";

import type { MissionResponse } from "@/services/mission";

import {
  formatMissionDate,
  getMissionStatusLabel,
} from "../utils";

type MissionListProps = {
  missions: MissionResponse[];
  loading: boolean;
  errorMessage: string;
  openingMissionId: string | null;

  onRefresh: () => void;
  onOpenMission: (
    mission: MissionResponse
  ) => void;
  onOpenDna: (
    missionId: string
  ) => void;
};

export default function MissionList({
  missions,
  loading,
  errorMessage,
  openingMissionId,
  onRefresh,
  onOpenMission,
  onOpenDna,
}: MissionListProps) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            기존 미션
          </h2>

          <p className="mt-1 text-xs font-medium text-slate-500">
            이전에 생성한 미션의 인터뷰 또는 Knowledge DNA를 확인할 수 있습니다.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={
            loading ||
            Boolean(openingMissionId)
          }
          className="flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw
            className={`h-4 w-4 ${
              loading
                ? "animate-spin"
                : ""
            }`}
          />

          새로고침
        </button>
      </div>

      {/* 오류 */}
      {errorMessage && (
        <div className="border-b border-rose-100 bg-rose-50 px-5 py-3">
          <p className="text-sm font-semibold text-rose-600">
            {errorMessage}
          </p>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <LoadingState />
      ) : missions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {missions.map((mission) => {
            const isOpening =
              openingMissionId ===
              mission.mission_id;

            return (
              <div
                key={mission.mission_id}
                className="group flex min-h-[170px] flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <BriefcaseBusiness className="h-5 w-5" />
                  </div>

                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
                    {getMissionStatusLabel(
                      mission.status
                    )}
                  </span>
                </div>

                <h3 className="mt-3 line-clamp-2 text-sm font-black leading-5 text-slate-900">
                  {mission.title}
                </h3>

                <p className="mt-1 text-xs font-semibold text-blue-600">
                  {mission.domain}
                </p>

                {mission.objective && (
                  <p className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-slate-500">
                    {mission.objective}
                  </p>
                )}

                <div className="mt-auto pt-4">
                  <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    <Clock3 className="h-3.5 w-3.5" />

                    {formatMissionDate(
                      mission.created_at
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenMission(
                          mission
                        )
                      }
                      disabled={Boolean(
                        openingMissionId
                      )}
                      className="flex h-9 items-center justify-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-600 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isOpening ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          조회 중
                        </>
                      ) : (
                        <>
                          인터뷰
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onOpenDna(
                          mission.mission_id
                        )
                      }
                      disabled={Boolean(
                        openingMissionId
                      )}
                      className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 text-xs font-black text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Network className="h-4 w-4" />
                      Knowledge DNA
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[150px] items-center justify-center gap-2">
      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />

      <p className="text-sm font-semibold text-slate-400">
        Mission 목록을 불러오는 중입니다.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[150px] items-center justify-center">
      <div className="text-center">
        <BriefcaseBusiness className="mx-auto h-7 w-7 text-slate-300" />

        <p className="mt-2 text-sm font-bold text-slate-500">
          생성된 Mission이 없습니다.
        </p>

        <p className="mt-1 text-xs font-medium text-slate-400">
          아래에서 새로운 Mission을 생성해주세요.
        </p>
      </div>
    </div>
  );
}