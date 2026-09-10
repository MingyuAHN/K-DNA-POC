"use client";

import {
  Check,
  ChevronDown,
  Target,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { MissionResponse } from "@/services/mission";

type MissionSelectorProps = {
  missions: MissionResponse[];
  selectedMissionId: string;
  onChange: (missionId: string) => void;
  loading?: boolean;
};

export default function MissionSelector({
  missions,
  selectedMissionId,
  onChange,
  loading = false,
}: MissionSelectorProps) {
  const [open, setOpen] = useState(false);

  const containerRef =
    useRef<HTMLDivElement | null>(null);

  // 현재 선택 Mission
  const selectedMission = useMemo(
    () =>
      missions.find(
        (mission) =>
          mission.mission_id ===
          selectedMissionId
      ) ?? null,
    [missions, selectedMissionId]
  );

  // 바깥 클릭 시 닫기
  useEffect(() => {
    const handleOutsideClick = (
      event: MouseEvent
    ) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      {/* 현재 Mission */}
      <button
        type="button"
        onClick={() =>
          !loading &&
          missions.length > 0 &&
          setOpen((current) => !current)
        }
        className={`
          flex w-full items-center gap-4
          rounded-[22px]
          border
          bg-white
          px-5 py-4
          text-left
          shadow-sm
          transition-all
          duration-200
          ${
            open
              ? "border-blue-300 ring-4 ring-blue-50"
              : "border-slate-200 hover:border-blue-200 hover:shadow-md"
          }
        `}
      >
        {/* Mission 아이콘 */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Target className="h-5 w-5" />
        </div>

        {/* Mission 정보 */}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-500">
            Current Mission
          </p>

          {loading ? (
            <p className="mt-1 text-sm font-bold text-slate-400">
              Mission을 불러오는 중입니다.
            </p>
          ) : selectedMission ? (
            <>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-black text-slate-900">
                  {selectedMission.title}
                </h3>

                {selectedMission.domain && (
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
                    {selectedMission.domain}
                  </span>
                )}
              </div>

              {selectedMission.objective && (
                <p className="mt-1 truncate text-xs font-semibold text-slate-400">
                  {selectedMission.objective}
                </p>
              )}
            </>
          ) : (
            <>
              <h3 className="mt-1 text-sm font-black text-slate-700">
                Mission을 선택해 주세요
              </h3>

              <p className="mt-1 text-xs font-semibold text-slate-400">
                분석할 Mission을 선택합니다.
              </p>
            </>
          )}
        </div>

        {/* 변경 */}
        <div className="flex shrink-0 items-center gap-2 text-xs font-black text-slate-400">
          <span className="hidden sm:inline">
            변경
          </span>

          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Mission 목록 */}
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-2 shadow-[0_20px_50px_rgba(15,23,42,0.14)]">
          <div className="max-h-[340px] space-y-1 overflow-y-auto">
            {missions.map((mission) => {
              const selected =
                mission.mission_id ===
                selectedMissionId;

              return (
                <button
                  key={mission.mission_id}
                  type="button"
                  onClick={() => {
                    onChange(
                      mission.mission_id
                    );

                    setOpen(false);
                  }}
                  className={`
                    flex w-full items-center gap-3
                    rounded-2xl
                    px-4 py-3
                    text-left
                    transition
                    ${
                      selected
                        ? "bg-blue-50"
                        : "hover:bg-slate-50"
                    }
                  `}
                >
                  <div
                    className={`
                      flex h-9 w-9 shrink-0 items-center justify-center
                      rounded-xl
                      ${
                        selected
                          ? "bg-blue-100 text-blue-600"
                          : "bg-slate-100 text-slate-500"
                      }
                    `}
                  >
                    <Target className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-black ${
                        selected
                          ? "text-blue-700"
                          : "text-slate-800"
                      }`}
                    >
                      {mission.title}
                    </p>

                    <div className="mt-1 flex min-w-0 items-center gap-2">
                      {mission.domain && (
                        <span className="shrink-0 text-[10px] font-bold text-slate-400">
                          {mission.domain}
                        </span>
                      )}

                      {mission.objective && (
                        <>
                          <span className="text-slate-300">
                            ·
                          </span>

                          <span className="truncate text-[10px] font-semibold text-slate-400">
                            {mission.objective}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {selected && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}