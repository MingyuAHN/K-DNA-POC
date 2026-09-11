"use client";

import { ChevronDown } from "lucide-react";

interface MissionSelectProps {
  missionId: string;
  missionTitle: string;
}

export default function MissionSelect({
  missionId,
  missionTitle,
}: MissionSelectProps) {
  return (
    <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="shrink-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            선택한 미션
          </p>
        </div>

        <div className="relative min-w-0 flex-1">
          <select
            value={missionId}
            onChange={() => {}}
            className="h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 pr-10 text-sm font-bold text-slate-800 outline-none"
          >
            <option value={missionId}>{missionTitle}</option>
          </select>

          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </div>
      </div>
    </section>
  );
}