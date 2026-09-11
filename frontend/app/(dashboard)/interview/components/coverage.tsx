"use client";

import { BookOpen } from "lucide-react";

import { interviewMock } from "@/mocks/interviewMock";

import { coverageIconMap } from "../utils";

type CoverageItem =
  (typeof interviewMock.coverageItems)[number];

type CoverageProps = {
  items: CoverageItem[];
};

export default function Coverage({
  items,
}: CoverageProps) {
  return (
    <aside className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      {/* 제목 */}
      <div className="mb-5 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
          <BookOpen className="h-5 w-5 text-blue-600" />
        </div>

        <div>
          <h2 className="text-sm font-black text-slate-900">
            주제별 지식 커버리지
          </h2>

          <p className="text-[11px] font-semibold text-slate-400">
            Knowledge Coverage
          </p>
        </div>
      </div>

      {/* Coverage */}
      <div className="space-y-4">
        {items.map((item) => {
          const Icon =
            coverageIconMap[item.iconType];

          const isLow =
            item.value < 30;

          return (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {Icon && (
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isLow
                          ? "text-rose-500"
                          : "text-blue-500"
                      }`}
                    />
                  )}

                  <span className="truncate text-xs font-bold text-slate-700">
                    {item.label}
                  </span>
                </div>

                <span
                  className={`text-xs font-black ${
                    isLow
                      ? "text-rose-500"
                      : "text-blue-600"
                  }`}
                >
                  {item.value}%
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${
                    isLow
                      ? "bg-rose-500"
                      : "bg-blue-500"
                  }`}
                  style={{
                    width: `${item.value}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-center text-[10px] font-semibold text-slate-400">
        Coverage API 연동 전 예시 데이터
      </p>
    </aside>
  );
}