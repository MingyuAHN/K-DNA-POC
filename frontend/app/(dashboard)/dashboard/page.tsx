"use client";

import { useEffect, useState, useCallback } from "react";
import {
  RotateCw,
  Mic,
  BriefcaseBusiness,
  CalendarDays,
  HelpCircle,
} from "lucide-react";

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    return {
      from: formatLocalDate(firstDay),
      to: formatLocalDate(lastDay),
    };
  });

  const fetchStats = useCallback(async () => {
    setIsLoading(true);

    try {
      const res = await fetch(
        `/api/dashboard?from=${dateRange.from}&to=${dateRange.to}`
      );

      if (!res.ok) throw new Error();

      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (isLoading || !data) {
    return (
      <div className="flex h-[70vh] items-center justify-center bg-slate-50">
        <RotateCw className="h-8 w-8 animate-spin text-indigo-500 sm:h-10 sm:w-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-3 text-slate-900 sm:p-4 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-5 sm:space-y-6 lg:space-y-8">
        {/* 헤더 */}
        <header className="flex flex-col gap-4 px-1 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter text-slate-900 sm:text-4xl lg:text-5xl">
              실적 대시보드
            </h1>

            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 opacity-80 sm:text-sm sm:tracking-[0.15em]">
              상담사 현황은 상담일자 기준 · 영업 실적은 영업일자 기준
            </p>
          </div>

          {/* 모바일 대응 날짜 필터 */}
          <div className="flex w-full flex-col gap-2 rounded-2xl border border-slate-200/60 bg-white p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between lg:w-auto">
            <div className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-slate-400" />

                <span className="text-[11px] font-bold text-slate-500 sm:hidden">
                  조회 기간
                </span>
              </div>

              <div className="flex flex-col gap-2 text-[13px] font-bold text-slate-700 sm:flex-row sm:items-center sm:gap-2">
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) =>
                    setDateRange({
                      ...dateRange,
                      from: e.target.value,
                    })
                  }
                  className="rounded-lg bg-white px-2 py-2 outline-none sm:bg-transparent sm:px-0 sm:py-0"
                />

                <span className="hidden text-slate-300 sm:block">~</span>

                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) =>
                    setDateRange({
                      ...dateRange,
                      to: e.target.value,
                    })
                  }
                  className="rounded-lg bg-white px-2 py-2 outline-none sm:bg-transparent sm:px-0 sm:py-0"
                />
              </div>
            </div>

            <button
              onClick={fetchStats}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white transition-all duration-300 hover:bg-indigo-600 sm:h-10"
              type="button"
            >
              <RotateCw
                className={`h-3.5 w-3.5 ${
                  isLoading ? "animate-spin" : ""
                }`}
              />
              조회
            </button>
          </div>
        </header>

        {/* 기준 안내 */}
        <section className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-xs font-bold text-indigo-700">
            상담사별 업무 현황은 선택한 기간의 <span className="font-black">상담일자</span> 기준으로 집계됩니다.
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-xs font-bold text-emerald-700">
            영업사원별 실적과 매출은 선택한 기간의 <span className="font-black">영업일자</span> 기준으로 집계됩니다.
          </div>
        </section>

        {/* 요약 카드 */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: "전체 접수",
              value: data.summary.total,
              unit: "건",
              color: "bg-blue-600",
            },
            {
              label: "매출 합계",
              value: data.summary.totalCommission.toLocaleString(),
              unit: "원",
              color: "bg-emerald-600",
            },
            {
              label: "TM 미배정",
              value: data.summary.unassignedTM,
              unit: "건",
              color: "bg-rose-500",
            },
            {
              label: "영업 미배정",
              value: data.summary.unassignedSales,
              unit: "건",
              color: "bg-orange-500",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-[22px] border border-slate-100 bg-white p-4 shadow-sm transition-all hover:shadow-md sm:rounded-[24px] sm:p-6"
            >
              <div
                className={`absolute left-0 top-0 h-full w-1.5 ${item.color}`}
              />

              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:mb-1.5 sm:text-[12px]">
                {item.label}
              </p>

              <p className="break-all text-xl font-black leading-tight text-slate-900 sm:text-3xl">
                {item.value}

                <span className="ml-1 text-[10px] font-bold text-slate-400 opacity-70 sm:ml-1.5 sm:text-sm">
                  {item.unit}
                </span>
              </p>
            </div>
          ))}
        </section>

        {/* 상담사 현황 */}
        <section className="space-y-4 sm:space-y-5">
          <div className="flex flex-col gap-1 px-1 sm:px-2">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 shadow-inner">
                <Mic className="h-4 w-4 text-indigo-600" />
              </div>

              <h2 className="text-lg font-extrabold tracking-tight text-slate-800 sm:text-xl">
                상담사별 업무 현황
              </h2>
            </div>
            <p className="pl-9 text-xs font-bold text-slate-400">
              선택 기간 내 상담일자 기준
            </p>
          </div>

          {data.tmList.map((tm: any, i: number) => (
            <div
              key={i}
              className="group rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-sm transition-all hover:border-indigo-200 sm:rounded-[32px] sm:p-6"
            >
              <div className="mb-5 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-400 shadow-sm transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-500 sm:h-14 sm:w-14 sm:text-base">
                  {String(i + 1).padStart(2, "0")}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-black text-slate-900 sm:text-xl">
                    {tm.name}
                  </p>

                  <p className="mt-1 inline-block rounded-md bg-indigo-50/50 px-2 py-0.5 text-[11px] font-bold text-indigo-500 sm:text-[12px]">
                    배정 {tm.total}건
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3">
                {data.headers.consult.map((h: string) => {
                  const count = tm.statusCounts[h] || 0;
                  const isPending = h === "미지정";

                  return (
                    <div
                      key={h}
                      className={`rounded-2xl border p-3 transition-all duration-300 sm:p-4 ${
                        count > 0
                          ? isPending
                            ? "border-amber-200 bg-amber-50/60 shadow-sm"
                            : "border-indigo-100 bg-indigo-50/60 shadow-sm"
                          : "border-slate-100/50 bg-slate-50/40"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p
                          className={`text-[10px] font-extrabold sm:text-[11px] ${
                            count > 0
                              ? isPending
                                ? "text-amber-700"
                                : "text-indigo-700"
                              : "text-slate-500"
                          }`}
                        >
                          {h}
                        </p>

                        {isPending && count > 0 && (
                          <HelpCircle className="h-3.5 w-3.5 animate-pulse text-amber-500" />
                        )}
                      </div>

                      <p
                        className={`text-xl font-black leading-none sm:text-2xl ${
                          count > 0
                            ? "text-slate-900"
                            : "text-slate-300"
                        }`}
                      >
                        {count}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* 영업 현황 */}
        <section className="space-y-4 sm:space-y-5">
          <div className="flex flex-col gap-1 px-1 sm:px-2">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 shadow-inner">
                <BriefcaseBusiness className="h-4 w-4 text-emerald-600" />
              </div>

              <h2 className="text-lg font-extrabold tracking-tight text-slate-800 sm:text-xl">
                영업사원별 실적 그리드
              </h2>
            </div>
            <p className="pl-9 text-xs font-bold text-slate-400">
              선택 기간 내 영업일자 기준
            </p>
          </div>

          {data.salesList.map((sales: any, i: number) => (
            <div
              key={i}
              className="group rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-sm transition-all hover:border-emerald-200 sm:rounded-[32px] sm:p-6 lg:p-7"
            >
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-emerald-500 text-xl font-black text-white shadow-lg shadow-emerald-200/50 transition-transform group-hover:scale-105 sm:h-16 sm:w-16 sm:rounded-[22px] sm:text-2xl">
                    {sales.name[0]}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                      {sales.name}
                    </p>

                    <p className="mt-1 break-all text-sm font-bold text-emerald-600">
                      매출 ₩{sales.commission.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 shadow-inner lg:min-w-[180px]">
                  <span className="text-[11px] font-bold text-slate-500 sm:text-[12px]">
                    전체 배정
                  </span>

                  <span className="text-sm font-black text-slate-900 sm:text-base">
                    {sales.total}
                    <span className="ml-0.5 text-[10px] font-bold text-slate-400 sm:text-xs">
                      건
                    </span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 lg:gap-3">
                {data.headers.sales.map((h: string) => {
                  const count = sales.statusCounts[h] || 0;
                  const isPending = h === "미지정";

                  return (
                    <div
                      key={h}
                      className={`flex flex-col justify-center rounded-2xl border p-3 transition-all duration-300 sm:p-4 ${
                        count > 0
                          ? isPending
                            ? "border-amber-200 bg-amber-50/60 shadow-sm"
                            : "border-emerald-100 bg-emerald-50/60 shadow-sm"
                          : "border-slate-100/50 bg-slate-50/40"
                      }`}
                    >
                      <p
                        className={`mb-2 text-[10px] font-extrabold leading-tight sm:text-[11px] ${
                          count > 0
                            ? isPending
                              ? "text-amber-700"
                              : "text-emerald-700"
                            : "text-slate-500"
                        }`}
                      >
                        {h}
                      </p>

                      <p
                        className={`text-xl font-black leading-none sm:text-2xl ${
                          count > 0
                            ? "text-slate-900"
                            : "text-slate-300"
                        }`}
                      >
                        {count}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
