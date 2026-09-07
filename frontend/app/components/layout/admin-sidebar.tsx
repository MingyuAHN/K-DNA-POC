"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, ShieldCheck } from "lucide-react";

interface MenuItem {
  id: string;
  title: string;
  path: string;
  icon: string;
}

interface UserInfo {
  name: string;
  role?: string;
  role_id?: string | number;
  role_name?: string;
}

export default function AdminSidebar({
  onLogoutOpen,
}: {
  onLogoutOpen: () => void;
}) {
  const pathname = usePathname();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchMenus = async () => {
      setIsLoading(true);

      try {
        const storedUser = localStorage.getItem("user");

        if (!storedUser) {
          if (!isMounted) return;
          setUser(null);
          setMenuItems([]);
          return;
        }

        let currentUser: UserInfo;

        try {
          currentUser = JSON.parse(storedUser);
        } catch (e) {
          console.error("유저 정보 파싱 에러:", e);
          localStorage.removeItem("user");

          if (!isMounted) return;
          setUser(null);
          setMenuItems([]);
          return;
        }

        if (!isMounted) return;
        setUser(currentUser);

        const roleId = currentUser?.role_id;

        if (!roleId || roleId === "undefined" || roleId === "null") {
          console.error("role_id가 없습니다.");
          setMenuItems([]);
          return;
        }

        const response = await fetch(`/api/menus?role_id=${roleId}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("메뉴 응답 오류");
        }

        const data = await response.json();

        if (!isMounted) return;

        if (Array.isArray(data)) {
          setMenuItems(data);
        } else {
          setMenuItems([]);
        }
      } catch (error) {
        console.error("사이드바 메뉴 로드 실패:", error);

        if (!isMounted) return;
        setMenuItems([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchMenus();

    return () => {
      isMounted = false;
    };
  }, []);

  const displayRole = user?.role_name || user?.role || "권한 확인 중";

  return (
    <aside className="dashboard-sidebar-surface relative flex h-[100dvh] max-h-[100dvh] min-h-[100dvh] w-full flex-col overflow-hidden text-slate-100">
      {/* 배경 장식 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-24 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -right-20 top-1/3 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/35 to-transparent" />
      </div>

      {/* 브랜드 */}
      <div className="relative z-10 shrink-0 px-5 pt-4 pb-3 fade-up sm:pb-4">
        <div className="group relative overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,15,30,0.92),rgba(6,12,24,0.82))] px-5 py-3.5 shadow-[0_18px_44px_rgba(2,6,23,0.24)] backdrop-blur-xl sm:py-4">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),transparent_32%,transparent_68%,rgba(59,130,246,0.05))]" />
          <div className="absolute -left-8 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full bg-blue-500/12 blur-3xl transition-transform duration-700 group-hover:scale-125" />
          <div className="absolute right-0 top-0 h-full w-20 bg-gradient-to-l from-blue-500/6 to-transparent opacity-80" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-400/20 to-transparent" />

          <div className="relative flex items-center gap-3.5">
            {/* 로고 */}
            <div className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 text-white shadow-[0_14px_30px_rgba(59,130,246,0.26)] transition-all duration-500 group-hover:-translate-y-0.5 group-hover:scale-[1.03] sm:h-[58px] sm:w-[58px]">
              <div className="absolute inset-0 rounded-[18px] bg-[linear-gradient(135deg,rgba(255,255,255,0.18),transparent_35%,transparent_70%,rgba(255,255,255,0.06))]" />
              <svg
                className="relative z-10 h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 12l10 5 10-5" />
                <path d="M2 17l10 5 10-5" />
              </svg>
            </div>

            {/* 텍스트 */}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[1.15rem] font-extrabold leading-tight tracking-[-0.03em] text-white">
                Admin OS
              </h1>
              <p className="mt-1 truncate text-[0.82rem] font-semibold leading-tight tracking-[-0.01em] text-slate-400">
                관리 시스템
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 사용자 카드 */}
      <div
        className="relative z-10 shrink-0 px-6 pb-3 soft-scale-in sm:pb-5"
        style={{ animationDelay: "80ms" }}
      >
        <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_44px_rgba(2,6,23,0.22)] backdrop-blur-xl sm:rounded-[26px] sm:p-5">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent)]" />
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-blue-500/10 blur-2xl" />

          <div className="relative">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-emerald-200 sm:mb-4">
              <ShieldCheck className="h-3 w-3" />
              VERIFIED
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-bold tracking-tight text-white sm:text-lg">
                  {user?.name || "불러오는 중..."}
                </p>
                <div className="mt-1.5 flex items-center gap-2 text-sm text-slate-400 sm:mt-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 [animation:dot-ping-soft_1.8s_ease-out_infinite]" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </span>
                  <span className="truncate">{displayRole}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[11px] font-medium text-slate-300 shadow-inner">
                실시간
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 메뉴 */}
      <nav className="custom-scrollbar relative z-10 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div
          className="mb-3 px-3 fade-up sm:mb-4"
          style={{ animationDelay: "120ms" }}
        >
          <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">
            NAVIGATION
          </p>
        </div>

        <ul className="space-y-2">
          {isLoading ? (
            [1, 2, 3, 4, 5].map((i) => (
              <li
                key={i}
                className="overflow-hidden rounded-2xl border border-white/6 bg-white/[0.03]"
              >
                <div className="relative h-14 animate-pulse">
                  <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-white/10 to-transparent [animation:shimmer-x_1.8s_linear_infinite]" />
                </div>
              </li>
            ))
          ) : menuItems.length > 0 ? (
            menuItems.map((item, index) => {
              const isActive =
                pathname === item.path || pathname.startsWith(item.path + "/");

              return (
                <li
                  key={item.id}
                  className="fade-up"
                  style={{ animationDelay: `${160 + index * 40}ms` }}
                >
                  <Link
                    href={item.path}
                    className={`group relative flex items-center gap-4 overflow-hidden rounded-2xl border px-4 py-3 transition-all duration-300 sm:py-3.5 ${
                      isActive
                        ? "border-blue-400/20 bg-gradient-to-r from-blue-500/18 via-indigo-500/14 to-violet-500/12 text-white shadow-[0_16px_34px_rgba(37,99,235,0.16)]"
                        : "border-transparent bg-transparent text-slate-400 hover:border-white/8 hover:bg-white/[0.045] hover:text-white"
                    }`}
                  >
                    <div
                      className={`absolute inset-0 opacity-0 transition-opacity duration-500 ${
                        isActive
                          ? "bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.08)_20%,transparent_40%)] opacity-100 [animation:shimmer-x_3.2s_linear_infinite]"
                          : "group-hover:opacity-100 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.05)_20%,transparent_40%)]"
                      }`}
                    />

                    <span
                      className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition-all duration-300 ${
                        isActive
                          ? "border-blue-300/20 bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] [animation:pulse-glow_2.6s_ease-in-out_infinite_alternate]"
                          : "border-white/8 bg-white/[0.03] group-hover:border-blue-400/15 group-hover:bg-blue-500/10 group-hover:scale-105"
                      }`}
                    >
                      {item.icon}
                    </span>

                    <div className="relative z-10 min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold tracking-tight">
                        {item.title}
                      </span>
                    </div>

                    <div className="relative z-10 ml-auto flex items-center">
                      <span
                        className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                          isActive
                            ? "bg-white shadow-[0_0_12px_rgba(255,255,255,0.95)]"
                            : "bg-transparent group-hover:bg-blue-400/70"
                        }`}
                      />
                    </div>
                  </Link>
                </li>
              );
            })
          ) : (
            <div className="mx-2 rounded-[24px] border border-dashed border-white/10 bg-white/[0.025] px-5 py-10 text-center text-sm text-slate-500">
              접근 가능한 메뉴가 없습니다.
            </div>
          )}
        </ul>
      </nav>

      {/* 하단 액션 */}
      <div className="relative z-20 shrink-0 bg-[linear-gradient(180deg,rgba(8,15,30,0),rgba(8,15,30,0.84)_22%,rgba(8,15,30,0.96))] px-6 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
        <div className="mb-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent sm:mb-4" />

        <button
          onClick={onLogoutOpen}
          className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[18px] border border-rose-400/15 bg-rose-500/[0.08] px-4 py-3.5 text-sm font-semibold text-rose-200 shadow-[0_14px_32px_rgba(244,63,94,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-300/25 hover:bg-rose-500/[0.14] hover:text-white sm:rounded-[20px] sm:py-4"
          type="button"
        >
          <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.12)_20%,transparent_40%)] [animation:shimmer-x_2.8s_linear_infinite]" />
          <LogOut className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          <span className="relative z-10">로그아웃</span>
        </button>
      </div>
    </aside>
  );
}
