"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ShieldCheck,
  RotateCw,
  Key,
  LayoutGrid,
  Search,
  Trash2,
  Edit3,
  Check,
  Fingerprint,
  Plus,
  X,
  Lock,
  Sparkles,
  CalendarDays,
  ArrowUpRight,
  UserCog,
} from "lucide-react";

interface Role {
  id: string;
  name: string;
  created_at: string;
}

interface Menu {
  id: string;
  title: string;
  icon: string;
  path: string;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [allMenus, setAllMenus] = useState<Menu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedMenuIds, setSelectedMenuIds] = useState<string[]>([]);
  const [isAccessLoading, setIsAccessLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "" });

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rRes, mRes] = await Promise.all([
        fetch("/api/roles"),
        fetch("/api/menus?all=true"),
      ]);

      const rData = await rRes.json();
      const mData = await mRes.json();

      setRoles(Array.isArray(rData) ? rData : []);
      setAllMenus(Array.isArray(mData) ? mData : []);
    } catch (error) {
      showToast("데이터 동기화 실패", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRoles = useMemo(() => {
    return roles.filter((role) =>
      role.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [roles, searchQuery]);

  const adminRoleCount = useMemo(() => {
    return roles.filter((role) => role.name.includes("관리자")).length;
  }, [roles]);

  const selectedMenusPreview = useMemo(() => {
    return allMenus.filter((menu) => selectedMenuIds.includes(menu.id));
  }, [allMenus, selectedMenuIds]);

  const openModal = async (role: Role | null = null) => {
    if (role) {
      setSelectedRole(role);
      setFormData({ name: role.name });
      setSelectedMenuIds([]);
      setIsAccessLoading(true);

      try {
        const res = await fetch(`/api/roles/access?role_id=${role.id}`);
        const accessData = await res.json();

        if (Array.isArray(accessData)) {
          setSelectedMenuIds(accessData.map((item: any) => item.menu_id));
        } else {
          setSelectedMenuIds([]);
        }
      } catch (e) {
        setSelectedMenuIds([]);
      } finally {
        setIsAccessLoading(false);
      }
    } else {
      setSelectedRole(null);
      setFormData({ name: "" });
      setSelectedMenuIds([]);
      setIsAccessLoading(false);
    }

    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = !!selectedRole;

    try {
      const res = await fetch(
        isEdit ? `/api/roles/${selectedRole?.id}` : "/api/roles",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, menu_ids: selectedMenuIds }),
        }
      );

      if (res.ok) {
        showToast(
          isEdit ? "역할 설정이 변경되었습니다." : "새 역할이 등록되었습니다."
        );
        setIsModalOpen(false);
        fetchData();
      } else {
        showToast("처리 중 오류 발생", "error");
      }
    } catch (error) {
      showToast("처리 중 오류 발생", "error");
    }
  };

  const confirmDelete = async () => {
    if (!selectedRole) return;

    try {
      const res = await fetch(`/api/roles/${selectedRole.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        showToast("역할이 삭제되었습니다.");
        setIsDeleteModalOpen(false);
        fetchData();
      } else {
        showToast("삭제 실패", "error");
      }
    } catch (error) {
      showToast("삭제 실패", "error");
    }
  };

  const toggleMenuSelection = (menuId: string) => {
    setSelectedMenuIds((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [...prev, menuId]
    );
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 pb-20">
      {toast && (
        <div
          className={`fixed right-6 top-6 z-[11000] flex items-center gap-3 rounded-[22px] border border-white/10 px-5 py-4 shadow-[0_24px_50px_rgba(15,23,42,0.2)] backdrop-blur-2xl animate-in slide-in-from-right-8 duration-300 ${
            toast.type === "success"
              ? "bg-slate-900/90 text-white"
              : "bg-rose-600/90 text-white"
          }`}
        >
          <div className="h-2.5 w-2.5 rounded-full bg-current animate-pulse" />
          <p className="text-sm font-bold tracking-[-0.02em]">{toast.message}</p>
        </div>
      )}

      <section className="soft-scale-in">
        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,15,30,0.96),rgba(11,18,36,0.88))] p-6 shadow-[0_28px_70px_rgba(2,6,23,0.18)] backdrop-blur-2xl md:p-8">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),transparent_34%,transparent_72%,rgba(139,92,246,0.06))]" />
          <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-violet-500/12 blur-3xl" />
          <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-400/15 bg-blue-500/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-blue-200">
                <Lock className="h-3.5 w-3.5" />
                권한 제어
              </div>

              <h1 className="text-[1.9rem] font-black leading-[1.02] tracking-[-0.05em] text-white md:text-[2.4rem]">
                역할 관리
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-[15px]">
                직무별 역할을 정의하고 메뉴 접근 권한을 정밀하게 제어합니다.
                시스템 운영 권한을 구조적으로 관리할 수 있도록 정돈된 화면으로
                구성했습니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={fetchData}
                className="group inline-flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.06] text-slate-200 shadow-[0_14px_28px_rgba(2,6,23,0.18)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-400/20 hover:bg-violet-500/10 hover:text-white"
                aria-label="새로고침"
              >
                <RotateCw
                  className={`h-5 w-5 transition-transform duration-500 ${
                    isLoading ? "animate-spin" : "group-hover:rotate-180"
                  }`}
                />
              </button>

              <button
                onClick={() => openModal()}
                className="group relative inline-flex items-center gap-3 overflow-hidden rounded-[22px] bg-gradient-to-r from-slate-900 via-violet-600 to-indigo-600 px-6 py-4 text-sm font-extrabold tracking-[-0.02em] text-white shadow-[0_18px_36px_rgba(99,102,241,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_42px_rgba(99,102,241,0.28)] active:scale-[0.98]"
              >
                <span className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.16)_20%,transparent_42%)] [animation:shimmer-x_2.8s_linear_infinite]" />
                <Plus className="relative z-10 h-4.5 w-4.5" />
                <span className="relative z-10">새 역할 추가</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "전체 역할",
            value: roles.length.toString().padStart(2, "0"),
            icon: ShieldCheck,
            tone: "bg-violet-500/10 text-violet-600 ring-violet-500/15",
          },
          {
            label: "전체 메뉴",
            value: allMenus.length.toString().padStart(2, "0"),
            icon: LayoutGrid,
            tone: "bg-blue-500/10 text-blue-600 ring-blue-500/15",
          },
          {
            label: "관리자 포함 역할",
            value: adminRoleCount.toString().padStart(2, "0"),
            icon: Key,
            tone: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/15",
          },
          {
            label: "운영 상태",
            value: "정상",
            icon: Fingerprint,
            tone: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/15",
          },
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="fade-up group rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/95 p-6 shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(15,23,42,0.1)]"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {stat.label}
                  </p>
                  <p className="mt-3 text-[2rem] font-black leading-none tracking-[-0.05em] text-slate-900">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${stat.tone}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-slate-400">
                {stat.label === "운영 상태"
                  ? "권한 제어 시스템 동작 상태"
                  : `${stat.label} 현황 요약`}
              </p>
            </div>
          );
        })}
      </section>

      <section className="fade-up rounded-[28px] border border-white/60 bg-white/80 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative group flex-1">
            <Search className="absolute left-6 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-violet-600" />
            <input
              type="text"
              placeholder="검색할 역할 이름을 입력하세요"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-[20px] border border-slate-200/80 bg-slate-50/80 py-4 pl-14 pr-5 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
            />
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
            <Sparkles className="h-4 w-4" />
            {searchQuery ? `검색 결과 ${filteredRoles.length}개` : `총 ${roles.length}개 역할`}
          </div>
        </div>
      </section>

      <section className="fade-up overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/95 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-[1.2rem] font-bold tracking-[-0.03em] text-slate-900">
                역할 레지스트리
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                역할 이름과 기본 정보, 수정/삭제 작업을 빠르게 관리할 수
                있습니다.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
              <Sparkles className="h-3.5 w-3.5" />
              실시간 반영
            </div>
          </div>
        </div>

        <div className="px-4 py-4 md:px-6 md:py-5">
          <div className="hidden rounded-2xl bg-slate-50 px-5 py-3 text-[11px] font-bold tracking-[0.12em] text-slate-400 md:grid md:grid-cols-[110px_minmax(0,1fr)_180px_220px] md:items-center md:gap-4">
            <span>역할 표시</span>
            <span>역할 정보</span>
            <span>생성일 / ID</span>
            <span className="text-right">작업</span>
          </div>

          <div className="mt-3 space-y-3">
            {isLoading ? (
              [1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-[24px] border border-slate-100 bg-slate-50/80 animate-pulse"
                />
              ))
            ) : filteredRoles.length === 0 ? (
              <div className="rounded-[26px] border border-dashed border-slate-200 bg-slate-50/80 px-6 py-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <UserCog className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold tracking-[-0.03em] text-slate-800">
                  표시할 역할이 없습니다
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  검색 조건을 변경하거나 새 역할을 추가해보세요.
                </p>
                <button
                  onClick={() => openModal()}
                  className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-violet-600"
                >
                  <Plus className="h-4 w-4" />
                  새 역할 추가
                </button>
              </div>
            ) : (
              filteredRoles.map((role, index) => (
                <div
                  key={role.id}
                  className="group rounded-[24px] border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 px-5 py-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)]"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="grid gap-4 md:grid-cols-[110px_minmax(0,1fr)_180px_220px] md:items-center">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#1E1B4B_0%,#312E81_45%,#6D28D9_100%)] text-2xl font-black text-white shadow-[0_12px_28px_rgba(109,40,217,0.18)]">
                        {role.name[0]}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate text-[1.2rem] font-black tracking-[-0.04em] text-slate-900 transition-colors group-hover:text-violet-600">
                        {role.name}
                      </h3>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-600">
                          <Lock className="h-3.5 w-3.5" />
                          권한 역할
                        </span>

                        <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                          내부 식별자 {role.id.split("-")[0]}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 md:justify-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <CalendarDays className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-400">
                          생성일
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-700">
                          {new Date(role.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openModal(role)}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white transition-all hover:bg-violet-600 active:scale-[0.98]"
                      >
                        <Edit3 className="h-4 w-4" />
                        <span>수정</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedRole(role);
                          setIsDeleteModalOpen(true);
                        }}
                        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-100 bg-white text-rose-300 transition-all hover:bg-rose-50 hover:text-rose-600 active:scale-95"
                        aria-label={`${role.name} 삭제`}
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 p-6 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[34px] border border-white/10 bg-white shadow-[0_40px_90px_rgba(15,23,42,0.25)] animate-in zoom-in-95 duration-300">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />

            <div className="grid max-h-[90vh] overflow-hidden lg:grid-cols-[1.05fr_0.95fr]">
              <div className="custom-scrollbar overflow-y-auto p-8 md:p-10">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-full text-slate-300 transition-all hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="mb-8">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    접근 권한 설정
                  </div>

                  <h3 className="mt-4 text-[2rem] font-black tracking-[-0.05em] text-slate-900">
                    {selectedRole ? "역할 수정" : "역할 추가"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    역할명과 접근 가능한 메뉴를 설정해 시스템 권한 범위를
                    관리합니다.
                  </p>
                </div>

                <form onSubmit={handleSave} className="space-y-8">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-600">
                      역할명
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ name: e.target.value })}
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                      placeholder="예: 운영 관리자"
                    />
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <label className="text-sm font-semibold text-slate-600">
                        접근 가능한 메뉴
                      </label>
                      <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-600">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        {selectedMenuIds.length}개 선택됨
                      </span>
                    </div>

                    {isAccessLoading ? (
                      <div className="grid gap-3 rounded-[28px] border border-slate-200 bg-slate-50/90 p-5 sm:grid-cols-2">
                        {[1, 2, 3, 4].map((item) => (
                          <div
                            key={item}
                            className="h-[84px] rounded-[22px] border border-slate-200 bg-white animate-pulse"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="grid gap-3 rounded-[28px] border border-slate-200 bg-slate-50/90 p-5 sm:grid-cols-2">
                        {allMenus.map((menu) => {
                          const isSelected = selectedMenuIds.includes(menu.id);

                          return (
                            <div key={menu.id} className="relative">
                              <input
                                type="checkbox"
                                id={`menu-${menu.id}`}
                                checked={isSelected}
                                onChange={() => toggleMenuSelection(menu.id)}
                                className="peer hidden"
                              />
                              <label
                                htmlFor={`menu-${menu.id}`}
                                className={`group flex cursor-pointer items-center gap-4 rounded-[22px] border-2 p-4 transition-all duration-300 active:scale-[0.98] ${
                                  isSelected
                                    ? "border-violet-500 bg-white shadow-[0_14px_28px_rgba(109,40,217,0.08)]"
                                    : "border-transparent bg-white/70 hover:border-slate-200"
                                }`}
                              >
                                <div
                                  className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition-all ${
                                    isSelected
                                      ? "bg-[linear-gradient(135deg,#1E1B4B_0%,#312E81_45%,#6D28D9_100%)] text-white shadow-[0_10px_24px_rgba(109,40,217,0.16)]"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {menu.icon}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`truncate text-sm font-black tracking-[-0.03em] ${
                                      isSelected ? "text-slate-900" : "text-slate-700"
                                    }`}
                                  >
                                    {menu.title}
                                  </p>
                                  <p className="mt-1 truncate text-xs font-medium text-slate-400">
                                    {menu.path}
                                  </p>
                                </div>

                                {isSelected && (
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white animate-in zoom-in duration-200">
                                    <Check className="h-3 w-3 stroke-[3px]" />
                                  </div>
                                )}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 rounded-2xl border border-slate-200 bg-white py-4 text-sm font-bold text-slate-500 transition-all hover:bg-slate-50"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="flex-[1.3] rounded-2xl bg-gradient-to-r from-slate-900 to-violet-600 py-4 text-sm font-black text-white shadow-[0_18px_36px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                    >
                      저장
                    </button>
                  </div>
                </form>
              </div>

              <div className="custom-scrollbar overflow-y-auto border-t border-slate-100 bg-gradient-to-br from-slate-50 to-white p-8 lg:border-l lg:border-t-0 lg:p-10">
                <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-violet-600">
                    <Sparkles className="h-3.5 w-3.5" />
                    역할 미리보기
                  </div>

                  <div className="rounded-[26px] border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 px-5 py-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#1E1B4B_0%,#312E81_45%,#6D28D9_100%)] text-2xl font-black text-white shadow-[0_12px_28px_rgba(109,40,217,0.18)]">
                        {(formData.name || "역").slice(0, 1)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[1.15rem] font-black tracking-[-0.04em] text-slate-900">
                          {formData.name || "역할명"}
                        </p>
                        <p className="mt-2 inline-flex rounded-xl bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-600">
                          선택 메뉴 {selectedMenuIds.length}개
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3">
                      {isAccessLoading ? (
                        [1, 2, 3].map((item) => (
                          <div
                            key={item}
                            className="h-[58px] rounded-2xl bg-slate-100 animate-pulse"
                          />
                        ))
                      ) : selectedMenuIds.length === 0 ? (
                        <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-400">
                          아직 선택된 메뉴가 없습니다.
                        </div>
                      ) : (
                        <>
                          {selectedMenusPreview.slice(0, 6).map((menu) => (
                            <div
                              key={menu.id}
                              className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                            >
                              <span className="text-lg">{menu.icon}</span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-800">
                                  {menu.title}
                                </p>
                                <p className="truncate text-xs text-slate-400">
                                  {menu.path}
                                </p>
                              </div>
                            </div>
                          ))}

                          {selectedMenusPreview.length > 6 && (
                            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-500">
                              외 {selectedMenusPreview.length - 6}개 메뉴 선택됨
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/45 p-6 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-white p-10 shadow-[0_40px_90px_rgba(15,23,42,0.25)] text-center animate-in zoom-in-95 duration-300">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[26px] bg-rose-50 text-rose-500 shadow-inner">
              <Trash2 className="h-9 w-9" />
            </div>

            <h3 className="text-[1.8rem] font-black tracking-[-0.05em] text-slate-900">
              역할 삭제
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              <span className="font-bold text-slate-800">
                {selectedRole?.name || "선택된 역할"}
              </span>{" "}
              역할을 시스템에서 삭제하시겠습니까?
              <br />
              삭제 후에는 복구할 수 없습니다.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={confirmDelete}
                className="w-full rounded-2xl bg-rose-600 py-4 text-sm font-black text-white shadow-[0_16px_32px_rgba(225,29,72,0.18)] transition-all hover:bg-rose-700 active:scale-[0.98]"
              >
                삭제
              </button>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="w-full rounded-2xl border border-slate-200 bg-white py-4 text-sm font-bold text-slate-500 transition-all hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(15, 23, 42, 0.08);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
}
