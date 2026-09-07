"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminSidebar from "../components/layout/admin-sidebar";
import AdminHeader from "../components/layout/admin-header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isPermissionChecking, setIsPermissionChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  const checkPermission = useCallback(async () => {
    try {
      setIsPermissionChecking(true);
      setIsAllowed(false);

      const savedUser = localStorage.getItem("user");

      if (!savedUser) {
        router.replace("/login");
        return;
      }

      let user: any;

      try {
        user = JSON.parse(savedUser);
      } catch (error) {
        console.error("저장된 사용자 정보 파싱 오류:", error);
        localStorage.removeItem("user");
        router.replace("/login");
        return;
      }

      if (!user?.role_id) {
        localStorage.removeItem("user");
        router.replace("/login");
        return;
      }

      const menuRes = await fetch(`/api/menus?role_id=${user.role_id}`, {
        cache: "no-store",
      });

      if (!menuRes.ok) {
        throw new Error("메뉴 조회 실패");
      }

      const menus = await menuRes.json();

      if (!Array.isArray(menus) || menus.length === 0) {
        console.error("접근 가능한 메뉴가 없습니다.");
        localStorage.removeItem("user");
        router.replace("/login");
        return;
      }

      const normalizedPathname = pathname.endsWith("/")
        ? pathname.slice(0, -1)
        : pathname;

      const hasPermission = menus.some((menu: any) => {
        if (!menu?.path) return false;

        const menuPath = String(menu.path).endsWith("/")
          ? String(menu.path).slice(0, -1)
          : String(menu.path);

        return (
          normalizedPathname === menuPath ||
          normalizedPathname.startsWith(`${menuPath}/`)
        );
      });

      if (!hasPermission) {
        const firstMenuPath = menus[0]?.path;

        if (firstMenuPath) {
          router.replace(firstMenuPath);
        } else {
          router.replace("/login");
        }

        return;
      }

      setIsAllowed(true);
    } catch (error) {
      console.error("권한 확인 오류:", error);
      localStorage.removeItem("user");
      router.replace("/login");
    } finally {
      setIsPermissionChecking(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  useEffect(() => {
    document.body.style.overflow = isSidebarOpen ? "hidden" : "unset";

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isSidebarOpen]);

  const confirmLogout = () => {
    localStorage.removeItem("user");
    setIsLogoutModalOpen(false);
    router.push("/login");
  };

  if (isPermissionChecking || !isAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-4 rounded-[28px] border border-slate-200 bg-white px-10 py-8 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
          <div className="relative flex h-14 w-14 items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-600 border-r-violet-500" />
            <div className="h-5 w-5 rounded-full bg-gradient-to-r from-blue-600 to-violet-500" />
          </div>
          <div className="text-sm font-black text-slate-700">
            권한 확인 중입니다...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen overflow-hidden bg-[#F8FAFC]">
      {/* 데스크탑 고정 사이드바 */}
      <div className="hidden lg:block lg:w-72 lg:shrink-0">
        <div className="sticky top-0 h-[100dvh]">
          <AdminSidebar onLogoutOpen={() => setIsLogoutModalOpen(true)} />
        </div>
      </div>

      {/* 모바일 오버레이 */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 모바일 드로어 사이드바 */}
      <div
        className={`fixed inset-y-0 left-0 z-[70] h-[100dvh] w-72 transform transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] lg:hidden ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <AdminSidebar onLogoutOpen={() => setIsLogoutModalOpen(true)} />
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex min-w-0 flex-1 flex-col h-[100dvh] overflow-hidden">
        <div className="sticky top-0 z-50 shrink-0 bg-transparent px-3 pt-3 md:px-5 md:pt-4">
          <header className="relative overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,14,28,0.86)_0%,rgba(7,12,24,0.8)_100%)] shadow-[0_18px_40px_rgba(2,6,23,0.18)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_30%)]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <button
              onClick={() => setIsSidebarOpen(true)}
              className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-lg text-slate-300 shadow-[0_10px_24px_rgba(2,6,23,0.16)] backdrop-blur-xl transition-all hover:border-blue-400/20 hover:bg-blue-500/10 hover:text-white lg:hidden"
              aria-label="메뉴 열기"
              type="button"
            >
              ☰
            </button>

            <div className="min-w-0 pl-[58px] pr-4 lg:px-6">
              <div className="flex min-h-[84px] items-center">
                <AdminHeader />
              </div>
            </div>
          </header>
        </div>

        <main className="custom-scrollbar flex-1 overflow-y-auto">
          <div className="animate-in fade-in slide-in-from-bottom-2 px-3 pb-4 pt-3 duration-700 md:px-5 md:pb-6 md:pt-4">
            {children}
          </div>
        </main>
      </div>

      {/* 로그아웃 모달 */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-[calc(100%-2rem)] max-w-sm rounded-[2.5rem] border border-white/10 bg-[#0F172A] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-3xl shadow-inner">
                🚪
              </div>
              <h3 className="text-xl font-black tracking-tighter text-white">
                로그아웃 하시겠습니까?
              </h3>
              <p className="mt-2 text-sm font-medium text-slate-400">
                안전하게 세션을 종료하고
                <br />
                인증 화면으로 돌아갑니다.
              </p>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 rounded-2xl bg-white/5 py-4 text-sm font-bold text-slate-300 transition-all hover:bg-white/10"
                type="button"
              >
                취소
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 py-4 text-sm font-bold text-white shadow-lg shadow-rose-900/20 transition-all active:scale-95"
                type="button"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
}
