"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Plus,
  RotateCw,
  Trash2,
  CheckCircle2,
  X,
  Link2,
  Layers3,
  ListOrdered,
  FolderKanban,
  Settings2,
  ArrowUpRight,
  Sparkles,
  Navigation,
  AlertTriangle,
} from "lucide-react";

interface Menu {
  id: string;
  title: string;
  path: string;
  icon: string;
  sort_order: number;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

interface ConfirmConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  isDestructive?: boolean;
}

export default function MenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  
  // UI 피드백 상태
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig>({
    isOpen: false, title: "", message: "", onConfirm: () => {},
  });

  const [formData, setFormData] = useState({
    title: "",
    path: "",
    icon: "📁",
    sort_order: 1,
  });

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const openConfirm = (title: string, message: string, onConfirm: () => void, isDestructive = false) => {
    setConfirmConfig({ isOpen: true, title, message, onConfirm, isDestructive });
  };

  const fetchMenus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/menus?all=true");
      const data = await res.json();
      if (Array.isArray(data)) {
        setMenus(data.sort((a: Menu, b: Menu) => a.sort_order - b.sort_order));
      }
    } catch (error) {
      showToast("데이터 로드 실패", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMenus();
  }, []);

  const openModal = (menu: Menu | null = null) => {
    if (menu) {
      setSelectedMenu(menu);
      setFormData({
        title: menu.title,
        path: menu.path,
        icon: menu.icon,
        sort_order: menu.sort_order,
      });
    } else {
      setSelectedMenu(null);
      setFormData({
        title: "",
        path: "/",
        icon: "📁",
        sort_order: menus.length + 1,
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = !!selectedMenu;
    
    // 수정: [id] 라우트 구조에 맞춰 URL 설정
    const url = isEdit ? `/api/menus/${selectedMenu.id}` : "/api/menus";
    const method = isEdit ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsModalOpen(false);
        showToast(isEdit ? "메뉴가 수정되었습니다." : "새 메뉴가 등록되었습니다.");
        fetchMenus();
      } else {
        showToast("저장에 실패했습니다.", "error");
      }
    } catch (error) {
      showToast("오류가 발생했습니다.", "error");
    }
  };

  // 삭제 처리 함수
  const handleDeleteAction = async (id: string) => {
    try {
      const res = await fetch(`/api/menus/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("삭제되었습니다.");
        fetchMenus();
      } else {
        showToast("삭제 실패", "error");
      }
    } catch (error) {
      showToast("오류 발생", "error");
    }
  };

  const lastSortOrder = useMemo(() => {
    if (!menus.length) return 0;
    return Math.max(...menus.map((menu) => menu.sort_order));
  }, [menus]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 pb-20">
      {/* 토스트 알림 */}
      {toast && (
        <div className={`fixed right-6 top-6 z-[11000] flex items-center gap-3 rounded-[22px] border border-white/10 px-5 py-4 shadow-2xl backdrop-blur-2xl animate-in slide-in-from-right-8 duration-300 ${toast.type === "success" ? "bg-slate-900/90 text-white" : "bg-rose-600/90 text-white"}`}>
          <div className="h-2.5 w-2.5 rounded-full bg-current animate-pulse" />
          <p className="text-sm font-bold tracking-tight">{toast.message}</p>
        </div>
      )}

      {/* 커스텀 컨펌 모달 */}
      {confirmConfig.isOpen && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[38px] p-10 shadow-2xl animate-in zoom-in-95 text-center">
            <AlertTriangle size={40} className="mx-auto mb-6 text-rose-500" />
            <h3 className="text-2xl font-black text-slate-900 mb-2">{confirmConfig.title}</h3>
            <p className="text-slate-500 mb-10 leading-relaxed">{confirmConfig.message}</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmConfig({ ...confirmConfig, isOpen: false })} className="flex-1 py-4 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition-all">취소</button>
              <button onClick={() => { confirmConfig.onConfirm(); setConfirmConfig({ ...confirmConfig, isOpen: false }); }} className={`flex-[1.6] py-4 rounded-2xl font-black text-white bg-slate-900 shadow-xl active:scale-95`}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 상단 히어로 */}
      <section className="soft-scale-in">
        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,15,30,0.96),rgba(11,18,36,0.88))] p-6 shadow-[0_28px_70px_rgba(2,6,23,0.18)] backdrop-blur-2xl md:p-8">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),transparent_34%,transparent_72%,rgba(59,130,246,0.06))]" />
          <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-blue-500/12 blur-3xl" />
          <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl text-white">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-400/15 bg-blue-500/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-blue-200 uppercase">
                <Layers3 className="h-3.5 w-3.5" /> 내비게이션 관리
              </div>
              <h1 className="text-[1.9rem] font-black leading-[1.02] tracking-[-0.05em] md:text-[2.4rem]">메뉴 관리</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-[15px]">
                사이드바 메뉴 구조와 경로, 아이콘을 통합 관리합니다.
                사용자 접근 흐름과 화면 이동 체계를 일관된 구조로 정리하고,
                운영 환경에 맞는 내비게이션 구성을 효율저긍로 유지할 수 있도록 설계헀습니다.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={fetchMenus} className="group inline-flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.06] text-slate-200 shadow-xl backdrop-blur-xl transition-all hover:bg-blue-500/10">
                <RotateCw className={`h-5 w-5 ${isLoading ? "animate-spin" : "group-hover:rotate-180"}`} />
              </button>
              <button onClick={() => openModal()} className="group relative inline-flex items-center gap-3 overflow-hidden rounded-[22px] bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500 px-6 py-4 text-sm font-extrabold text-white shadow-xl active:scale-95">
                <span className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.16)_20%,transparent_42%)] [animation:shimmer-x_2.8s_linear_infinite]" /><Plus className="relative z-10 h-4.5 w-4.5" /><span className="relative z-10">새 메뉴 추가</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 요약 카드 */}
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: "전체 메뉴", val: menus.length, icon: Navigation, tone: "bg-blue-500/10 text-blue-600" },
          { label: "마지막 순번", val: lastSortOrder, icon: ListOrdered, tone: "bg-violet-500/10 text-violet-600" },
          { label: "운영 상태", val: "정상", icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-600", pulse: true }
        ].map((item, i) => (
          <div key={i} className="fade-up group rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/95 p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
            <div className="flex items-start justify-between">
              <div><p className="text-sm font-medium text-slate-500">{item.label}</p><p className="mt-3 text-[2rem] font-black text-slate-900 tracking-tighter">{typeof item.val === 'number' ? item.val.toString().padStart(2, "0") : item.val}</p></div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.tone}`}><item.icon className={`h-5 w-5 ${item.pulse ? 'animate-pulse' : ''}`} /></div>
            </div>
          </div>
        ))}
      </section>

      {/* 메뉴 리스트 리스트 */}
      <section className="fade-up overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/95 shadow-[0_16px_36px_rgba(15,23,42,0.06)] flex flex-col h-[750px]">
        <div className="border-b border-slate-100 px-6 py-5 flex items-center justify-between">
          <div><h2 className="text-[1.2rem] font-bold text-slate-900 tracking-tight">메뉴 레지스트리</h2><p className="text-sm text-slate-500 mt-1">내비게이션 구조를 관리합니다.</p></div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600"><Sparkles size={14} className="text-blue-500" /> 실시간 반영</div>
        </div>

        <div className="px-4 py-4 md:px-6 md:py-5 overflow-y-auto scrollbar-hide flex-1">
          <div className="hidden rounded-2xl bg-slate-50 px-5 py-3 text-[11px] font-bold tracking-[0.12em] text-slate-400 md:grid md:grid-cols-[120px_minmax(0,1fr)_120px_220px] md:items-center md:gap-4 uppercase">
            <span>아이콘</span><span>메뉴 정보</span><span>정렬 순서</span><span className="text-right">작업</span>
          </div>
          <div className="mt-3 space-y-3">
            {isLoading ? [1,2,3].map(i => <div key={i} className="h-28 rounded-[24px] bg-slate-50 animate-pulse" />) : menus.map((menu) => (
              <div key={menu.id} className="group rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:-translate-y-0.5 relative">
                <div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)_120px_220px] md:items-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-blue-50 text-3xl group-hover:bg-slate-900 group-hover:text-white transition-all shadow-inner">{menu.icon}</div>
                  <div className="min-w-0">
                    <h3 className="truncate text-[1.2rem] font-black text-slate-900 group-hover:text-blue-600 transition-colors tracking-tight">{menu.title}</h3>
                    <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600"><Link2 size={14} /><span className="truncate">{menu.path}</span></div>
                  </div>
                  <div className="hidden md:flex justify-center"><div className="bg-slate-100 px-4 py-2 rounded-full text-sm font-black text-slate-700 tracking-tighter">Order {menu.sort_order.toString().padStart(2, "0")}</div></div>
                  <div className="flex items-center justify-end gap-2 relative z-50">
                    <button onClick={(e) => { e.stopPropagation(); openModal(menu); }} className="h-11 px-4 rounded-2xl bg-slate-900 text-white font-bold text-sm flex items-center gap-2 shadow-lg active:scale-95 transition-all"><Settings2 size={16} /> 수정</button>
                    <button onClick={(e) => { e.stopPropagation(); openConfirm("삭제 확인", `[${menu.title}] 메뉴를 삭제할까요?`, () => handleDeleteAction(menu.id), true); }} className="h-11 w-11 rounded-2xl border border-rose-100 bg-white text-rose-300 hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center"><Trash2 size={18} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 p-6 backdrop-blur-xl animate-in fade-in">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-[34px] border border-white/10 bg-white shadow-2xl animate-in zoom-in-95">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
            <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
              <div className="p-8 md:p-10 border-b lg:border-b-0 lg:border-r border-slate-100">
                <button onClick={() => setIsModalOpen(false)} className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-full text-slate-300 hover:bg-slate-100 transition-all"><X size={24} /></button>
                <div className="mb-8">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-widest"><Navigation size={12} /> Menu Config</div>
                  <h3 className="mt-4 text-[2rem] font-black tracking-tighter text-slate-900">{selectedMenu ? "메뉴 수정" : "새 메뉴 등록"}</h3>
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                  <div className="grid gap-5 md:grid-cols-[1fr_120px]">
                    <div><label className="text-sm font-bold text-slate-600 mb-2 block">메뉴명 (Label)</label>
                    <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 font-bold text-slate-900 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" placeholder="ex) 고객 관리" /></div>
                    <div><label className="text-sm font-bold text-slate-600 mb-2 block text-center">아이콘</label>
                    <input required value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})} className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 text-center text-2xl text-slate-900 outline-none" /></div>
                  </div>
                  <div><label className="text-sm font-bold text-slate-600 mb-2 block">접속 경로 (Path)</label>
                  <div className="relative"><Link2 className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input required value={formData.path} onChange={e => setFormData({...formData, path: e.target.value})} className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-14 pr-6 font-mono font-bold text-blue-600 focus:bg-white" placeholder="ex) /dashboard" /></div></div>
                  <div><label className="text-sm font-bold text-slate-600 mb-2 block">정렬 순서</label>
                  <div className="relative"><ListOrdered className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="number" required value={formData.sort_order} onChange={e => setFormData({...formData, sort_order: Number(e.target.value)})} className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-14 pr-6 font-black text-slate-900 focus:bg-white" placeholder="ex) 1" /></div></div>
                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4.5 rounded-2xl font-bold text-slate-400 hover:bg-slate-50">취소</button>
                    <button type="submit" className="flex-[2] py-4.5 rounded-2xl bg-slate-900 text-white font-black text-lg active:scale-95 transition-all">저장 완료</button>
                  </div>
                </form>
              </div>

              {/* 미리보기 (원본 그대로) */}
              <div className="bg-slate-50/50 p-8 lg:p-10 flex flex-col justify-center items-center text-center">
                <div className="w-full space-y-6">
                  <div className="inline-flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest"><Sparkles size={14} className="text-blue-500" /> Live Preview</div>
                  <div className="bg-white border border-slate-200 rounded-[30px] p-6 shadow-xl text-left">
                    <div className="flex items-center gap-5">
                      <div className="h-20 w-20 flex items-center justify-center bg-slate-900 text-white text-4xl rounded-[26px] shadow-2xl animate-pulse">{formData.icon || "📁"}</div>
                      <div className="min-w-0 flex-1"><p className="text-2xl font-black text-slate-900 truncate">{formData.title || "메뉴명"}</p><p className="text-sm font-bold text-blue-500 mt-1">{formData.path || "/path"}</p></div>
                    </div>
                    <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <span>Priority Order</span><span className="text-slate-900 text-lg">#{String(formData.sort_order).padStart(2, '0')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
      `}</style>
    </div>
  );
}
