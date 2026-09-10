"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Plus,
  RotateCw,
  Settings2,
  Trash2,
  Database,
  X,
  ChevronRight,
  Hash,
  Layers,
  LayoutGrid,
  Terminal,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  CircleOff,
  FolderKanban,
  ListOrdered,
  Search,
  Filter,
  AlertTriangle,
} from "lucide-react";

// --- Interfaces ---
interface CodeGroup {
  id: string;
  group_code: string;
  group_name: string;
}

interface CodeDetail {
  id: string;
  group_id: string;
  code_value: string;
  code_name: string;
  sort_order: number;
  is_use: boolean;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

// 커스텀 컨펌 설정을 위한 인터페이스
interface ConfirmConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  isDestructive?: boolean;
}

export default function CodesPage() {
  // 1. Data States
  const [groups, setGroups] = useState<CodeGroup[]>([]);
  const [details, setDetails] = useState<CodeDetail[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 2. Modal States
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // 3. Edit Mode States (수정 시 데이터 보관)
  const [editingGroup, setEditingGroup] = useState<CodeGroup | null>(null);
  const [editingDetail, setEditingDetail] = useState<CodeDetail | null>(null);

  // 4. Form States
  const [groupForm, setGroupForm] = useState({
    group_code: "",
    group_name: "",
  });

  const [detailForm, setDetailForm] = useState({
    code_value: "",
    code_name: "",
    sort_order: 1,
    is_use: true,
  });

  // 5. Filter & UI States
  const [detailSearchQuery, setDetailSearchQuery] = useState("");
  const [detailStatusFilter, setDetailStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [toast, setToast] = useState<Toast | null>(null);

  // 커스텀 컨펌 상태
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // --- UI Feedback Handlers ---
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const openConfirm = (title: string, message: string, onConfirm: () => void, isDestructive = false) => {
    setConfirmConfig({ isOpen: true, title, message, onConfirm, isDestructive });
  };

  // --- API Handlers: Fetching ---
  const fetchGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/codes/groups");
      const data = await res.json();
      const nextGroups = Array.isArray(data) ? data : [];
      setGroups(nextGroups);

      setSelectedGroupId((prev) => {
        if (!nextGroups.length) return null;
        if (prev && nextGroups.some((group) => group.id === prev)) return prev;
        return nextGroups[0].id;
      });
    } catch (error) {
      showToast("코드 그룹을 불러오지 못했습니다.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const fetchDetails = useCallback(async (groupId: string) => {
    try {
      const res = await fetch(`/api/codes/details?group_id=${groupId}`);
      const data = await res.json();
      setDetails(Array.isArray(data) ? data : []);
    } catch (error) {
      setDetails([]);
      showToast("세부 코드를 불러오지 못했습니다.", "error");
    }
  }, [showToast]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);
  useEffect(() => {
    if (selectedGroupId) fetchDetails(selectedGroupId);
    else setDetails([]);
  }, [selectedGroupId, fetchDetails]);

  // --- Modal Open Helpers ---
  const openGroupModal = (group?: CodeGroup) => {
    if (group) {
      setEditingGroup(group);
      setGroupForm({ group_code: group.group_code, group_name: group.group_name });
    } else {
      setEditingGroup(null);
      setGroupForm({ group_code: "", group_name: "" });
    }
    setIsGroupModalOpen(true);
  };

  const openDetailModal = (detail?: CodeDetail) => {
    if (detail) {
      setEditingDetail(detail);
      setDetailForm({
        code_value: detail.code_value,
        code_name: detail.code_name,
        sort_order: detail.sort_order,
        is_use: detail.is_use,
      });
    } else {
      setEditingDetail(null);
      setDetailForm({
        code_value: "",
        code_name: "",
        sort_order: details.length + 1,
        is_use: true,
      });
    }
    setIsDetailModalOpen(true);
  };

  // --- API Handlers: Save (Insert & Update) ---
  const handleGroupSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingGroup ? "PATCH" : "POST";
    const payload = editingGroup ? { ...groupForm, id: editingGroup.id } : groupForm;

    try {
      const res = await fetch("/api/codes/groups", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsGroupModalOpen(false);
        showToast(editingGroup ? "그룹 정보가 수정되었습니다." : "코드 그룹이 등록되었습니다.");
        fetchGroups();
      } else {
        showToast("코드 그룹 저장에 실패했습니다.", "error");
      }
    } catch (error) {
      showToast("코드 그룹 저장 중 오류가 발생했습니다.", "error");
    }
  };

  const handleDetailSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingDetail ? "PATCH" : "POST";
    const payload = editingDetail 
      ? { ...detailForm, id: editingDetail.id } 
      : { ...detailForm, group_id: selectedGroupId };

    try {
      const res = await fetch("/api/codes/details", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsDetailModalOpen(false);
        showToast(editingDetail ? "세부 코드가 수정되었습니다." : "세부 코드가 등록되었습니다.");
        if (selectedGroupId) fetchDetails(selectedGroupId);
      } else {
        showToast("세부 코드 저장에 실패했습니다.", "error");
      }
    } catch (error) {
      showToast("세부 코드 저장 중 오류가 발생했습니다.", "error");
    }
  };

  // --- API Handlers: Delete ---
  const handleGroupDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    openConfirm("코드 그룹 삭제", "그룹을 삭제하시겠습니까? 해당 그룹의 모든 세부 코드가 함께 삭제됩니다.", async () => {
      try {
        const res = await fetch(`/api/codes/groups?id=${id}`, { method: "DELETE" });
        if (res.ok) {
          showToast("코드 그룹이 삭제되었습니다.");
          if (selectedGroupId === id) setSelectedGroupId(null);
          fetchGroups();
        } else {
          showToast("그룹 삭제에 실패했습니다.", "error");
        }
      } catch (error) {
        showToast("삭제 중 오류가 발생했습니다.", "error");
      }
    }, true);
  };

  const handleDetailDelete = (id: string) => {
    openConfirm("세부 코드 삭제", "이 코드를 영구 삭제하시겠습니까?", async () => {
      try {
        const res = await fetch(`/api/codes/details?id=${id}`, { method: "DELETE" });
        if (res.ok) {
          showToast("세부 코드가 삭제되었습니다.");
          setDetails((prev) => prev.filter((d) => d.id !== id));
        } else {
          showToast("코드 삭제에 실패했습니다.", "error");
        }
      } catch (error) {
        showToast("삭제 중 오류가 발생했습니다.", "error");
      }
    }, true);
  };

  // --- Memos: Filter & Summary ---
  const selectedGroup = useMemo(() => {
    return groups.find((group) => group.id === selectedGroupId) ?? null;
  }, [groups, selectedGroupId]);

  const usedDetailsCount = useMemo(() => {
    return details.filter((detail) => detail.is_use).length;
  }, [details]);

  const filteredDetails = useMemo(() => {
    return details.filter((detail) => {
      const query = detailSearchQuery.trim().toLowerCase();

      const matchesSearch =
        !query ||
        detail.code_value.toLowerCase().includes(query) ||
        detail.code_name.toLowerCase().includes(query);

      const matchesStatus =
        detailStatusFilter === "all" ||
        (detailStatusFilter === "active" && detail.is_use) ||
        (detailStatusFilter === "inactive" && !detail.is_use);

      return matchesSearch && matchesStatus;
    });
  }, [details, detailSearchQuery, detailStatusFilter]);

  const detailSummaryText = useMemo(() => {
    const parts: string[] = [];

    if (detailStatusFilter === "active") parts.push("사용 필터");
    if (detailStatusFilter === "inactive") parts.push("미사용 필터");

    if (detailSearchQuery) {
      parts.push(`검색 결과 ${filteredDetails.length}개`);
    } else if (detailStatusFilter !== "all") {
      parts.push(`결과 ${filteredDetails.length}개`);
    } else {
      parts.push(`총 ${details.length}개 코드`);
    }

    return parts.join(" · ");
  }, [detailSearchQuery, detailStatusFilter, filteredDetails.length, details.length]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 pb-20">
      {/* 1. Toast Notification - 원본 디자인 그대로 */}
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

      {/* 2. Custom Confirm Modal - 원본 모달 디자인 컨셉 유지 */}
      {confirmConfig.isOpen && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-950/65 backdrop-blur-md p-6 animate-in fade-in duration-300">
          <div className="relative w-full max-w-md overflow-hidden rounded-[38px] border border-white/10 bg-white shadow-[0_40px_100px_rgba(15,23,42,0.3)] animate-in zoom-in-95 p-8 md:p-10 text-center">
            <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] ${confirmConfig.isDestructive ? "bg-rose-50 text-rose-500" : "bg-blue-50 text-blue-500"}`}>
              <AlertTriangle size={40} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-3">{confirmConfig.title}</h3>
            <p className="text-slate-500 text-[15px] leading-relaxed mb-10">{confirmConfig.message}</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmConfig({ ...confirmConfig, isOpen: false })} className="flex-1 py-4 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all">취소</button>
              <button onClick={() => { confirmConfig.onConfirm(); setConfirmConfig({ ...confirmConfig, isOpen: false }); }} className={`flex-[1.6] py-4 rounded-2xl font-black text-white shadow-xl transition-all active:scale-95 ${confirmConfig.isDestructive ? "bg-rose-500 shadow-rose-500/25" : "bg-slate-900 shadow-slate-900/25"}`}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. 상단 히어로 - 원본 디자인 100% 복원 */}
      <section className="soft-scale-in">
        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,15,30,0.96),rgba(11,18,36,0.88))] p-6 shadow-[0_28px_70px_rgba(2,6,23,0.18)] backdrop-blur-2xl md:p-8">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),transparent_34%,transparent_72%,rgba(59,130,246,0.06))]" />
          <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-blue-500/12 blur-3xl" />
          <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-400/15 bg-blue-500/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-blue-200 uppercase">
                <Database className="h-3.5 w-3.5" />
                코드 사전 관리
              </div>
              <h1 className="text-[1.9rem] font-black leading-[1.02] tracking-[-0.05em] text-white md:text-[2.4rem]">
                코드 관리
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-[15px]">
                시스템 전반에서 사용하는 코드 그룹과 세부 코드를 중앙에서
                관리합니다. 업무 상태값과 분류 기준, 마스터 데이터를 일관된
                구조로 운영할 수 있도록 구성했습니다.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={fetchGroups}
                className="group inline-flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.06] text-slate-200 shadow-[0_14px_28px_rgba(2,6,23,0.18)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-400/20 hover:bg-blue-500/10 hover:text-white"
                aria-label="새로고침"
              >
                <RotateCw
                  className={`h-5 w-5 transition-transform duration-500 ${
                    isLoading ? "animate-spin" : "group-hover:rotate-180"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. 요약 카드 - 원본 디자인 100% */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "전체 그룹",
            value: groups.length.toString().padStart(2, "0"),
            icon: Layers,
            tone: "bg-blue-500/10 text-blue-600 ring-blue-500/15",
          },
          {
            label: "선택 그룹 코드 수",
            value: details.length.toString().padStart(2, "0"),
            icon: LayoutGrid,
            tone: "bg-violet-500/10 text-violet-600 ring-violet-500/15",
          },
          {
            label: "사용 코드",
            value: usedDetailsCount.toString().padStart(2, "0"),
            icon: CheckCircle2,
            tone: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/15",
          },
          {
            label: "현재 선택 그룹",
            value: selectedGroup?.group_name || "-",
            icon: Hash,
            tone: "bg-slate-900/10 text-slate-700 ring-slate-300/40",
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
                  <p className="mt-3 truncate text-[2rem] font-black leading-none tracking-[-0.05em] text-slate-900">
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
                {stat.label} 현황 요약
              </p>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* 5-1. 좌측 그룹 패널 - 원본 디자인 100% */}
        <div className="fade-up overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/95 shadow-[0_16px_36px_rgba(15,23,42,0.06)] flex flex-col h-[750px]">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[1.15rem] font-bold tracking-[-0.03em] text-slate-900">
                  코드 그룹
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  전체 그룹 {groups.length}개
                </p>
              </div>
              <button
                onClick={() => openGroupModal()}
                className="group inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-[0_12px_24px_rgba(15,23,42,0.16)] transition-all hover:bg-blue-600 active:scale-95"
              >
                <Plus className="h-4.5 w-4.5 transition-transform duration-300 group-hover:rotate-90" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3 overflow-y-auto scrollbar-hide flex-1">
            {groups.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <FolderKanban className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-500">
                  등록된 코드 그룹이 없습니다.
                </p>
              </div>
            ) : (
              groups.map((group, index) => {
                const isSelected = selectedGroupId === group.id;
                return (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`fade-up group relative w-full overflow-hidden rounded-[24px] border p-5 text-left transition-all duration-300 ${
                      isSelected
                        ? "border-slate-900 bg-[linear-gradient(135deg,#111827_0%,#0F172A_100%)] shadow-[0_18px_40px_rgba(15,23,42,0.22)]"
                        : "border-slate-200/80 bg-gradient-to-br from-white to-slate-50/90 hover:border-blue-200 hover:-translate-y-0.5"
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className={`absolute -right-5 -bottom-5 h-24 w-24 rounded-full blur-2xl ${isSelected ? "bg-blue-500/15" : "bg-slate-100"}`} />
                    <div className="relative flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black tracking-[0.12em] ${isSelected ? "bg-blue-500/15 text-blue-200" : "bg-slate-100 text-slate-500"}`}>{group.group_code}</div>
                        <p className={`mt-3 truncate text-[1.15rem] font-black tracking-[-0.04em] ${isSelected ? "text-white" : "text-slate-900"}`}>{group.group_name}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div onClick={(e) => { e.stopPropagation(); openGroupModal(group); }} className={`h-8 w-8 flex items-center justify-center rounded-xl transition-all ${isSelected ? "bg-white/10 text-white hover:bg-white/20" : "bg-slate-50 text-slate-400 hover:text-blue-600 shadow-sm"}`}><Settings2 size={14} /></div>
                        <div onClick={(e) => handleGroupDelete(group.id, e)} className={`h-8 w-8 flex items-center justify-center rounded-xl transition-all ${isSelected ? "bg-white/10 text-rose-300 hover:bg-rose-500/20" : "bg-rose-50 text-rose-300 hover:text-rose-600 shadow-sm"}`}><Trash2 size={14} /></div>
                      </div>
                    </div>
                    {isSelected && <div className="absolute right-4 bottom-4 h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 5-2. 우측 세부 코드 패널 - 원본 디자인 100% 복원 */}
        <div className="fade-up overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/95 shadow-[0_16px_36px_rgba(15,23,42,0.06)] flex flex-col h-[750px]">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500"><ArrowUpRight className="h-3.5 w-3.5" />{selectedGroup ? `${selectedGroup.group_code} · ${selectedGroup.group_name}` : "그룹 미선택"}</div>
                  <h2 className="mt-3 text-[1.15rem] font-bold tracking-[-0.03em] text-slate-900">세부 코드</h2>
                  <p className="mt-1 text-sm text-slate-500">선택한 그룹의 코드값과 상태를 관리합니다.</p>
                </div>
                <button disabled={!selectedGroupId} onClick={() => openDetailModal()} className="group relative inline-flex items-center gap-3 overflow-hidden rounded-[22px] bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500 px-6 py-4 text-sm font-extrabold tracking-[-0.02em] text-white shadow-xl transition-all hover:-translate-y-0.5 disabled:opacity-40">
                  <span className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.16)_20%,transparent_42%)] [animation:shimmer-x_2.8s_linear_infinite]" />
                  <Plus className="relative z-10 h-4.5 w-4.5" /><span className="relative z-10">세부 코드 추가</span>
                </button>
              </div>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="grid flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                  <div className="relative group">
                    <Search className="absolute left-5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-blue-600" />
                    <input type="text" placeholder="코드값 또는 코드명 검색" value={detailSearchQuery} onChange={(e) => setDetailSearchQuery(e.target.value)} className="w-full rounded-[20px] border border-slate-200 bg-slate-50/80 py-4 pl-12 pr-5 text-sm font-semibold text-slate-900 outline-none transition-all focus:bg-white focus:ring-4 focus:ring-blue-500/10" />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-300" />
                    <select value={detailStatusFilter} onChange={(e) => setDetailStatusFilter(e.target.value as any)} className="w-full appearance-none rounded-[20px] border border-slate-200 bg-slate-50/80 py-4 pl-12 pr-12 text-sm font-semibold outline-none focus:bg-white">
                      <option value="all">전체 상태</option><option value="active">사용</option><option value="inactive">미사용</option>
                    </select>
                    <ChevronRight className="pointer-events-none absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-slate-300" />
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600"><Sparkles className="h-4 w-4" />{detailSummaryText}</div>
              </div>
            </div>
          </div>
          <div className="px-4 py-4 md:px-6 md:py-5 overflow-y-auto scrollbar-hide flex-1">
            <div className="hidden rounded-2xl bg-slate-50 px-5 py-3 text-[11px] font-bold tracking-[0.12em] text-slate-400 md:grid md:grid-cols-[100px_180px_minmax(0,1fr)_140px_140px] md:items-center md:gap-4 uppercase">
              <span>우선순위</span><span>코드값</span><span>코드명</span><span>사용 상태</span><span className="text-right">작업</span>
            </div>
            <div className="mt-3 space-y-3">
              {selectedGroupId && filteredDetails.length > 0 ? filteredDetails.map((detail, index) => (
                <div key={detail.id} className="fade-up grid gap-4 rounded-[24px] border border-slate-100 bg-white px-5 py-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 md:grid-cols-[100px_180px_minmax(0,1fr)_140px_140px] md:items-center" style={{ animationDelay: `${index * 40}ms` }}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><ListOrdered className="h-4.5 w-4.5" /></div>
                    <p className="text-[1.1rem] font-black text-slate-900">{detail.sort_order.toString().padStart(2, "0")}</p>
                  </div>
                  <div className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 tracking-tight"><Hash className="h-3.5 w-3.5 text-slate-400" />{detail.code_value}</div>
                  <div className="min-w-0"><p className="truncate text-[1rem] font-bold text-slate-900">{detail.code_name}</p></div>
                  <div><div className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-black tracking-widest ${detail.is_use ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}><div className={`h-1.5 w-1.5 rounded-full ${detail.is_use ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />{detail.is_use ? "사용" : "미사용"}</div></div>
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openDetailModal(detail)} className="h-11 w-11 flex items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 hover:text-blue-600 shadow-sm active:scale-90 transition-all"><Settings2 size={16} /></button>
                    <button onClick={() => handleDetailDelete(detail.id)} className="h-11 w-11 flex items-center justify-center rounded-2xl border border-rose-100 bg-white text-rose-300 hover:text-rose-600 shadow-sm active:scale-90 transition-all"><Trash2 size={16} /></button>
                  </div>
                </div>
              )) : (
                <div className="rounded-[26px] border border-dashed border-slate-200 bg-slate-50/80 px-6 py-32 text-center text-slate-400">
                  <Terminal className="mx-auto mb-4" size={40} /><p className="font-bold text-lg">{!selectedGroupId ? "코드 그룹을 선택해 주세요" : "등록된 데이터가 없습니다"}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 6. Modals - 원본 디자인 100% 복원 */}
      {/* 그룹 모달 */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 p-6 backdrop-blur-xl animate-in fade-in">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-[38px] border border-white/10 bg-white shadow-2xl animate-in zoom-in-95 p-8 md:p-10">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />
            <button onClick={() => setIsGroupModalOpen(false)} className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-full text-slate-300 hover:bg-slate-100 hover:text-slate-900 transition-all"><X size={20} /></button>
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500 tracking-widest uppercase"><Layers size={14} /> Group Definition</div>
              <h3 className="mt-4 text-[2.2rem] font-black tracking-tighter text-slate-900">{editingGroup ? "그룹 정보 수정" : "그룹 추가"}</h3>
            </div>
            <form onSubmit={handleGroupSave} className="space-y-6">
              <div><label className="mb-2 block text-xs font-black text-slate-400 uppercase tracking-widest">Group Code</label>
              <input required value={groupForm.group_code} onChange={e => setGroupForm({...groupForm, group_code: e.target.value.toUpperCase()})} className="h-15 w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 text-[15px] font-black text-blue-600 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 uppercase" placeholder="ex) AUTH_TYPE" /></div>
              <div><label className="mb-2 block text-xs font-black text-slate-400 uppercase tracking-widest">Group Name</label>
              <input required value={groupForm.group_name} onChange={e => setGroupForm({...groupForm, group_name: e.target.value})} className="h-15 w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 font-bold text-slate-900 outline-none focus:bg-white transition-all" placeholder="ex) 사용자 권한 분류" /></div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsGroupModalOpen(false)} className="flex-1 py-4.5 rounded-2xl font-bold text-slate-400 hover:bg-slate-50">취소</button>
                <button type="submit" className="flex-[2] py-4.5 rounded-2xl bg-slate-900 text-white font-black text-lg active:scale-95 transition-all">저장하기</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 상세 모달 - 정렬 순서 버그 수정 */}
      {isDetailModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 p-6 backdrop-blur-xl animate-in fade-in">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-[38px] border border-white/10 bg-white shadow-2xl animate-in zoom-in-95 p-8 md:p-10">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-blue-500" />
            <button onClick={() => setIsDetailModalOpen(false)} className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-full text-slate-300 hover:bg-slate-100 hover:text-slate-900 transition-all"><X size={20} /></button>
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500 tracking-widest uppercase"><LayoutGrid size={14} /> Master Detail</div>
              <h3 className="mt-4 text-[2.2rem] font-black tracking-tighter text-slate-900">{editingDetail ? "세부 코드 수정" : "코드 추가"}</h3>
            </div>
            <form onSubmit={handleDetailSave} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div><label className="mb-2 block text-xs font-black text-slate-400 uppercase tracking-widest">Code Value</label>
                <input required value={detailForm.code_value} onChange={e => setDetailForm({...detailForm, code_value: e.target.value.toUpperCase()})} className="h-15 w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 font-black text-emerald-600 outline-none uppercase" placeholder="ex) ADM" /></div>
                <div><label className="mb-2 block text-xs font-black text-slate-400 uppercase tracking-widest">Display Order</label>
                <input type="number" required value={detailForm.sort_order} onChange={e => setDetailForm({...detailForm, sort_order: Number(e.target.value)})} className="h-15 w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 font-black text-slate-900 outline-none focus:bg-white" placeholder="ex) 1" /></div>
              </div>
              <div><label className="mb-2 block text-xs font-black text-slate-400 uppercase tracking-widest">Label Name</label>
              <input required value={detailForm.code_name} onChange={e => setDetailForm({...detailForm, code_name: e.target.value})} className="h-15 w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 font-bold text-slate-900 outline-none focus:bg-white transition-all" placeholder="ex) 시스템 관리자" /></div>
              <button type="button" onClick={() => setDetailForm({...detailForm, is_use: !detailForm.is_use})} className={`w-full h-18 flex items-center justify-between px-8 rounded-3xl border-2 transition-all ${detailForm.is_use ? "bg-emerald-50/50 border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-100" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                <span className="font-black text-lg">{detailForm.is_use ? "현재 서비스 사용 중" : "사용 중단 상태"}</span>
                <div className={`h-8 w-14 rounded-full relative p-1.5 transition-colors ${detailForm.is_use ? "bg-emerald-500" : "bg-slate-300"}`}><div className={`h-5 w-5 bg-white rounded-full shadow-sm transition-all ${detailForm.is_use ? "translate-x-6" : "translate-x-0"}`} /></div>
              </button>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsDetailModalOpen(false)} className="flex-1 py-4.5 font-bold text-slate-400">취소</button>
                <button type="submit" className="flex-[1.8] py-4.5 rounded-2xl bg-blue-600 text-white font-black text-lg shadow-xl active:scale-95 transition-all">설정 완료</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes soft-scale-in { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .soft-scale-in { animation: soft-scale-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .h-15 { height: 3.75rem; }
        .h-18 { height: 4.5rem; }
      `}</style>
    </div>
  );
}