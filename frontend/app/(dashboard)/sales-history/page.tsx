"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Search,
  RotateCw,
  X,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  UserCheck,
  Filter,
  Users,
  BriefcaseBusiness,
  TrendingUp,
  Award,
  UserPlus,
  FileAudio,
  ExternalLink,
  Download,
} from "lucide-react";

// --- Interfaces ---
interface Customer {
  id: string;
  customer_name: string;
  company_name: string;
  mobile_phone: string;
  landline_phone: string;
  address: string;
  note: string;
  receipt_date: string;
  tm_id: string;
  consult_date: string;
  consult_status: string;
  consult_memo: string;
  sales_id: string;
  sales_date: string;
  sales_status: string;
  sales_memo: string;
  sales_commission: number;
  referral_yn: string;
}

interface UserInfo {
  id: string;
  name: string;
  role_name: string;
}

interface CommonCode {
  code_value: string;
  code_name: string;
}

interface RecordingItem {
  id: string;
  customer_id: string;
  file_name: string;
  file_url: string;
  created_at?: string;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

type FilterState = {
  date_from: string;
  date_to: string;
  search: string;
  sales_id: string;
  sales_status: string;
};

const formatLocalDate = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
};

const getTodayDate = () => formatLocalDate(new Date());

const getMonthStartDate = () => {
  const now = new Date();
  return formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
};

const getMonthEndDate = () => {
  const now = new Date();
  return formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
};

export default function SalesManagementPage() {
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allSalesDataForRank, setAllSalesDataForRank] = useState<Customer[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [salesCodes, setSalesCodes] = useState<CommonCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRankLoading, setIsRankLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [totalCompletedCount, setTotalCompletedCount] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [filters, setFilters] = useState<FilterState>({
    date_from: getMonthStartDate(),
    date_to: getMonthEndDate(),
    search: "",
    sales_id: "all",
    sales_status: "all",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(500);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRankModalOpen, setIsRankModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Partial<Customer>>({});
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [isRecordingsLoading, setIsRecordingsLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currentRole = currentUser?.role_name || (currentUser as any)?.role;
  const isAdmin = currentRole === "관리자";
  const isCreateMode = !selectedCustomer;

  const today = getTodayDate;

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const formatDateTime = useCallback((value?: string | null) => {
    if (!value || String(value) === "null") {
      return { date: "-", time: "" };
    }

    const normalized = String(value).replace("T", " ").trim();
    const [date = "", time = ""] = normalized.split(" ");

    return {
      date: date ? date.replace(/-/g, ".") : "-",
      time: time ? time.slice(0, 5) : "",
    };
  }, []);

  const getDateInputValue = useCallback((value?: string | null) => {
    if (!value || String(value) === "null") return "";
    return String(value).replace("T", " ").split(" ")[0] || "";
  }, []);

  const normalizeDateValue = useCallback((value?: string | null) => {
    const v = String(value || "").trim();
    return v === "" ? null : v;
  }, []);

  const buildCustomerParams = useCallback((activeUser: UserInfo, includePaging = true) => {
    const roleName = activeUser.role_name || (activeUser as any).role;
    const params = new URLSearchParams({ date_type: "영업일" });

    if (includePaging) {
      const offset = (currentPage - 1) * itemsPerPage;
      params.append("limit", String(itemsPerPage));
      params.append("offset", String(offset));
    }

    if (filters.date_from) params.append("date_from", filters.date_from);
    if (filters.date_to) params.append("date_to", filters.date_to);
    if (debouncedSearch.trim()) params.append("search", debouncedSearch.trim());
    if (filters.sales_status !== "all") params.append("sales_status", filters.sales_status);

    if (roleName !== "관리자") {
      params.append("sales_id", String(activeUser.id));
    } else if (filters.sales_id !== "all") {
      params.append("sales_id", filters.sales_id);
    }

    return params;
  }, [
    currentPage,
    itemsPerPage,
    filters.date_from,
    filters.date_to,
    filters.sales_id,
    filters.sales_status,
    debouncedSearch,
  ]);

  const fetchBaseData = useCallback(async () => {
    try {
      const [uRes, sCodeRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/codes/details/by-group?group_code=SALES_STATUS"),
      ]);

      if (!uRes.ok || !sCodeRes.ok) {
        throw new Error("기초 데이터 조회 실패");
      }

      setUsers(await uRes.json());
      setSalesCodes(await sCodeRes.json());
    } catch {
      showToast("기초 데이터 로드 실패", "error");
    }
  }, [showToast]);

  const fetchCompletedCount = useCallback(async (activeUser: UserInfo, filteredTotalCount: number) => {
    try {
      if (filters.sales_status !== "all") {
        setTotalCompletedCount(filters.sales_status.includes("완료") ? filteredTotalCount : 0);
        return;
      }

      const completedStatuses = ["계약 완료", "정산 완료"];

      const countResults = await Promise.all(
        completedStatuses.map(async status => {
          const params = buildCustomerParams(activeUser, false);
          params.append("limit", "1");
          params.append("offset", "0");
          params.set("sales_status", status);

          const res = await fetch(`/api/customers?${params.toString()}`);
          const data = await res.json();

          if (!res.ok) return 0;

          return Number(data?.count ?? (Array.isArray(data) ? data.length : data?.data?.length || 0));
        })
      );

      setTotalCompletedCount(countResults.reduce((sum, count) => sum + count, 0));
    } catch {
      setTotalCompletedCount(0);
    }
  }, [buildCustomerParams, filters.sales_status]);

  const fetchData = useCallback(async (userOverride?: UserInfo) => {
    const activeUser = userOverride || currentUser;
    if (!activeUser) return;

    setIsLoading(true);

    try {
      // 목록은 현재 페이지에 필요한 데이터만 조회합니다.
      const listParams = buildCustomerParams(activeUser, true);

      // 상단 건수/페이지 계산은 전체 조건 기준으로 별도 조회합니다.
      // API가 count를 내려주면 count를 사용하고, count가 없으면 응답 data.length로 보정합니다.
      // 이렇게 해야 현재 페이지 500건만 받아와도 전체 4,000건 기준으로 페이지가 생성됩니다.
      const countParams = buildCustomerParams(activeUser, false);
      countParams.append("limit", "10000");
      countParams.append("offset", "0");

      const [cRes, countRes] = await Promise.all([
        fetch(`/api/customers?${listParams.toString()}`),
        fetch(`/api/customers?${countParams.toString()}`),
      ]);

      const cData = await cRes.json();
      const countData = await countRes.json();

      if (!cRes.ok) {
        throw new Error(cData?.error || "데이터 조회 실패");
      }

      if (!countRes.ok) {
        throw new Error(countData?.error || "전체 건수 조회 실패");
      }

      const list = Array.isArray(cData) ? cData : cData?.data || [];
      const countList = Array.isArray(countData) ? countData : countData?.data || [];
      const count = Number(
        countData?.count ??
        cData?.count ??
        countList.length ??
        list.length
      );

      setCustomers(list);
      setTotalCount(count);
      await fetchCompletedCount(activeUser, count);
    } catch {
      showToast("데이터 로드 실패", "error");
      setCustomers([]);
      setTotalCount(0);
      setTotalCompletedCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, buildCustomerParams, fetchCompletedCount, showToast]);

  const loadRankData = useCallback(async (userOverride?: UserInfo) => {
    const activeUser = userOverride || currentUser;
    if (!activeUser) return;

    setIsRankLoading(true);

    try {
      const rankParams = new URLSearchParams({ date_type: "영업일" });

      // 랭킹은 전체 기간/조건 기준 집계가 필요하므로 모달을 열 때만 별도 조회합니다.
      // 초기 목록 조회에서는 제외해서 영업관리 화면 진입 속도를 우선 개선합니다.
      rankParams.append("limit", "10000");
      rankParams.append("offset", "0");

      if (filters.date_from) rankParams.append("date_from", filters.date_from);
      if (filters.date_to) rankParams.append("date_to", filters.date_to);

      const res = await fetch(`/api/customers?${rankParams.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "랭킹 데이터 조회 실패");
      }

      setAllSalesDataForRank(Array.isArray(data) ? data : data?.data || []);
    } catch {
      showToast("랭킹 데이터 로드 실패", "error");
      setAllSalesDataForRank([]);
    } finally {
      setIsRankLoading(false);
    }
  }, [currentUser, filters.date_from, filters.date_to, showToast]);

  const openRankModal = async () => {
    setIsRankModalOpen(true);
    await loadRankData();
  };

  const updateFilters = useCallback((patch: Partial<FilterState>) => {
    setCurrentPage(1);
    setFilters(prev => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setCurrentPage(1);
    setFilters({
      date_from: getMonthStartDate(),
      date_to: getMonthEndDate(),
      search: "",
      sales_id: isAdmin ? "all" : String(currentUser?.id || ""),
      sales_status: "all",
    });
  }, [isAdmin, currentUser]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(filters.search.trim());
    }, 400);

    return () => window.clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setCurrentUser(parsedUser);
        setFilters(prev => ({
          ...prev,
          sales_id: (parsedUser.role_name || parsedUser.role) === "관리자" ? prev.sales_id : String(parsedUser.id),
        }));
        fetchBaseData();
      } catch {
        window.location.href = "/login";
      }
    } else {
      window.location.href = "/login";
    }
  }, [fetchBaseData]);

  useEffect(() => {
    if (currentUser) fetchData();
  }, [
    currentUser,
    currentPage,
    itemsPerPage,
    filters.date_from,
    filters.date_to,
    filters.sales_id,
    filters.sales_status,
    debouncedSearch,
    fetchData,
  ]);

  const fetchRecordings = async (customerId: string) => {
    setIsRecordingsLoading(true);

    try {
      const res = await fetch(`/api/recordings/upload?customer_id=${encodeURIComponent(customerId)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "녹취 목록 조회 실패");
      }

      setRecordings(Array.isArray(data) ? data : []);
    } catch {
      setRecordings([]);
    } finally {
      setIsRecordingsLoading(false);
    }
  };

  const openCreateModal = () => {
    if (!currentUser) return;

    setSelectedCustomer(null);
    setRecordings([]);
    setFormData({
      company_name: "",
      customer_name: "",
      mobile_phone: "",
      landline_phone: "",
      address: "",
      note: "",
      receipt_date: today(),
      tm_id: "",
      consult_date: "",
      consult_status: "",
      consult_memo: "",
      sales_id: isAdmin ? "" : String(currentUser.id),
      sales_date: today(),
      sales_status: "",
      sales_memo: "",
      sales_commission: 0,
      referral_yn: "N",
    });
    setIsModalOpen(true);
  };

  const openModal = async (customer: Customer) => {
    setSelectedCustomer(customer);

    const formattedDate = customer.sales_date
      ? String(customer.sales_date).replace("T", " ")
      : "";

    setFormData({
      ...customer,
      sales_date: formattedDate,
      referral_yn: customer.referral_yn || "N",
    });

    setIsModalOpen(true);
    await fetchRecordings(customer.id);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || isSaving) return;

    const companyName = String(formData.company_name || "").trim();
    if (!companyName) {
      showToast("업체명을 입력해주세요.", "error");
      return;
    }

    try {
      setIsSaving(true);

      if (selectedCustomer) {
        const submissionData = {
          ...formData,
          company_name: companyName,
          sales_date: normalizeDateValue(formData.sales_date),
          sales_commission: isAdmin
            ? Number(formData.sales_commission || 0)
            : selectedCustomer.sales_commission,
          referral_yn: formData.referral_yn || "N",
        };

        const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submissionData),
        });

        if (res.ok) {
          setIsModalOpen(false);
          showToast("영업 실적이 반영되었습니다.", "success");
          await fetchData();
        } else {
          const err = await res.json().catch(() => null);
          showToast(err?.error || "반영 실패", "error");
        }

        return;
      }

      const createData = {
        ...formData,
        company_name: companyName,
        sales_id: String(formData.sales_id || currentUser.id),
        sales_date: normalizeDateValue(formData.sales_date),
        sales_commission: isAdmin ? Number(formData.sales_commission || 0) : 0,
        referral_yn: formData.referral_yn || "N",
      };

      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createData),
      });

      if (res.ok) {
        setIsModalOpen(false);
        showToast("신규 영업 고객이 추가되었습니다.", "success");
        await fetchData();
      } else {
        const err = await res.json().catch(() => null);
        showToast(err?.error || "추가 실패", "error");
      }
    } catch {
      showToast("네트워크 오류가 발생했습니다.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const salesRankings = useMemo(() => {
    const salesUsers = users.filter(u => u.role_name === "영업" || (u as any).role === "영업");

    return salesUsers
      .map(u => {
        const userSales = allSalesDataForRank.filter(c => String(c.sales_id) === String(u.id));
        const total = userSales.reduce((sum, c) => sum + Number(c.sales_commission || 0), 0);

        return {
          id: u.id,
          name: u.name,
          total,
          count: userSales.length,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [users, allSalesDataForRank]);

  const stats = useMemo(() => ({
    total: totalCount,
    completed: totalCompletedCount,
    totalCommission: customers.reduce((sum, c) => sum + Number(c.sales_commission || 0), 0),
  }), [customers, totalCount, totalCompletedCount]);

  const filteredSalesCodes = useMemo(() => {
    const role = currentUser?.role_name || (currentUser as any)?.role;

    if (role === "관리자") return salesCodes;

    return salesCodes.filter(c =>
      ["방문 전", "관리", "거절", "조회 요청", "방문 약속", "계약실패", "조회거절"].includes(c.code_name)
    );
  }, [salesCodes, currentUser]);


  const getSalesStatusTone = useCallback((value?: string | null) => {
    const status = String(value || "").trim();

    if (["승인", "계약 완료"].includes(status)) {
      return "border-red-200 bg-red-50 text-red-700 shadow-sm shadow-red-100";
    }

    if (["거절", "조회거절"].includes(status)) {
      return "border-slate-900 bg-slate-900 text-white font-black shadow-sm shadow-slate-200";
    }

    if (status === "관리") {
      return "border-sky-200 bg-sky-50 text-sky-700 shadow-sm shadow-sky-100";
    }

    if (status === "조회 요청") {
      return "border-amber-800/30 bg-amber-100 text-amber-900 shadow-sm shadow-amber-100";
    }

    if (status === "결제 대기") {
      return "border-blue-200 bg-blue-50 text-blue-700 shadow-sm shadow-blue-100";
    }

    if (status === "정산 완료") {
      return "border-lime-200 bg-lime-50 text-lime-700 shadow-sm shadow-lime-100";
    }

    if (status === "정산 대기") {
      return "border-yellow-200 bg-yellow-50 text-yellow-700 shadow-sm shadow-yellow-100";
    }

    if (["수금 대기", "분납"].includes(status)) {
      return "border-orange-200 bg-orange-50 text-orange-700 shadow-sm shadow-orange-100";
    }

    return "border-emerald-100 bg-emerald-50 text-emerald-600";
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  // API에서 이미 현재 페이지 데이터만 내려주므로 화면에서는 추가 slice를 하지 않습니다.
  const paginatedData = customers;

  const pageStartItem = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const pageEndItem = Math.min(currentPage * itemsPerPage, totalCount);

  const PaginationControls = () => (
    <div className="flex flex-wrap items-center gap-2">
      <button
        disabled={currentPage === 1 || totalPages <= 1}
        onClick={() => setCurrentPage(1)}
        className="h-11 rounded-xl border-2 border-slate-100 bg-white px-4 text-xs font-black text-slate-500 disabled:opacity-20 hover:bg-slate-50 transition-all"
        type="button"
      >
        처음
      </button>

      <button
        disabled={currentPage === 1 || totalPages <= 1}
        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
        className="p-3 rounded-xl border-2 border-slate-100 bg-white disabled:opacity-20 hover:bg-slate-50 transition-all"
        type="button"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="px-6 py-3 rounded-xl bg-[#1e232d] text-sm font-black text-white shadow-lg">
        {currentPage} / {totalPages}
      </div>

      <button
        disabled={currentPage === totalPages || totalPages <= 1}
        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
        className="p-3 rounded-xl border-2 border-slate-100 bg-white disabled:opacity-20 hover:bg-slate-50 transition-all"
        type="button"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <button
        disabled={currentPage === totalPages || totalPages <= 1}
        onClick={() => setCurrentPage(totalPages)}
        className="h-11 rounded-xl border-2 border-slate-100 bg-white px-4 text-xs font-black text-slate-500 disabled:opacity-20 hover:bg-slate-50 transition-all"
        type="button"
      >
        마지막
      </button>
    </div>
  );

  if (!currentUser) return null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-20 text-slate-900">
      {toast && (
        <div className={`fixed right-6 top-6 z-[11000] flex items-center gap-3 rounded-2xl px-6 py-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right-8 ${toast.type === "success" ? "bg-slate-900/90 text-white" : "bg-rose-600/90 text-white"}`}>
          <div className="h-2 w-2 rounded-full bg-current animate-pulse" />
          <p className="text-sm font-bold">{toast.message}</p>
        </div>
      )}

      <section>
        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#1e232d] px-10 py-8 shadow-xl">
          <div className="relative flex items-center justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-white/5">
                <Layers className="h-3.5 w-3.5" /> 영업 성과 통합 관리
              </div>
              <h1 className="text-[2.4rem] font-black leading-none tracking-tight text-white">영업 관리</h1>
              <p className="text-slate-400 text-[15px]">영업 활동 내역 및 수당 정산 현황을 실시간으로 관리합니다.</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={openCreateModal}
                className="h-14 flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-500 transition-all shadow-lg"
                type="button"
              >
                <UserPlus className="h-5 w-5" /> 고객 추가
              </button>

              <button
                onClick={() => fetchData()}
                className="h-14 w-14 flex items-center justify-center rounded-2xl bg-white/5 text-slate-400 hover:text-white transition-all shadow-inner"
                type="button"
              >
                <RotateCw className={`h-6 w-6 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: "담당 고객", value: stats.total, icon: Users, color: "text-blue-600 bg-blue-50" },
          { label: "계약 성공", value: stats.completed, icon: UserCheck, color: "text-emerald-600 bg-emerald-50" },
        ].map((stat, i) => (
          <div key={i} className="flex items-center justify-between rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="mt-2 text-[1.8rem] font-black text-slate-900">{stat.value}</p>
            </div>
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${stat.color}`}>
              <stat.icon className="h-7 w-7" />
            </div>
          </div>
        ))}

        <button
          onClick={openRankModal}
          className="flex items-center justify-between rounded-[28px] border border-rose-100 bg-rose-50/30 p-8 shadow-sm hover:bg-rose-50 transition-all group"
          type="button"
        >
          <div className="text-left">
            <p className="text-xs font-black text-rose-400 uppercase tracking-widest">매출 성과</p>
            <p className="mt-2 text-[1.8rem] font-black text-rose-600">실적 랭킹</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 group-hover:scale-110 transition-transform">
            <TrendingUp className="h-7 w-7" />
          </div>
        </button>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid items-start gap-4 xl:grid-cols-[140px_1fr]">
          <div className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-500">
            <Filter className="h-4 w-4" /> 영업일자
          </div>

          <div className="grid items-start gap-3 md:grid-cols-[160px_30px_160px_1fr]">
            <input
              type="date"
              value={filters.date_from}
              onChange={e => updateFilters({ date_from: e.target.value })}
              className="h-14 rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 focus:border-blue-500 outline-none shadow-inner"
            />

            <div className="flex h-14 items-center justify-center text-slate-400 font-black">~</div>

            <input
              type="date"
              value={filters.date_to}
              onChange={e => updateFilters({ date_to: e.target.value })}
              className="h-14 rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 focus:border-blue-500 outline-none shadow-inner"
            />

            <div className="relative">
              <Search className="absolute left-5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.search}
                onChange={e => updateFilters({ search: e.target.value })}
                placeholder="업체명 및 고객명 검색"
                className="h-14 w-full rounded-2xl border-2 border-slate-200 bg-white pl-12 pr-5 text-sm font-bold text-slate-900 focus:border-blue-500 outline-none shadow-inner"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr_auto_auto_auto]">
          <select
            disabled={!isAdmin}
            value={filters.sales_id || "all"}
            onChange={e => updateFilters({ sales_id: e.target.value })}
            className="h-14 rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 focus:border-blue-500 outline-none disabled:bg-slate-50 shadow-inner"
          >
            {isAdmin ? (
              <>
                <option value="all">담당 영업원 전체</option>
                {users
                  .filter(u => u.role_name === "영업")
                  .map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
              </>
            ) : (
              <option value={currentUser.id}>{currentUser.name}</option>
            )}
          </select>

          <select
            value={filters.sales_status}
            onChange={e => updateFilters({ sales_status: e.target.value })}
            className="h-14 rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 focus:border-blue-500 outline-none shadow-inner"
          >
            <option value="all">영업 상태 전체</option>
            {salesCodes.map(c => (
              <option key={c.code_value} value={c.code_name}>{c.code_name}</option>
            ))}
          </select>

          <select
            value={itemsPerPage}
            onChange={e => {
              setCurrentPage(1);
              setItemsPerPage(Number(e.target.value));
            }}
            className="h-14 rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-black text-slate-900 focus:border-blue-500 outline-none shadow-inner"
          >
            <option value={10}>10개씩 보기</option>
            <option value={50}>50개씩 보기</option>
            <option value={100}>100개씩 보기</option>
            <option value={500}>500개씩 보기</option>
          </select>

          <button
            onClick={resetFilters}
            className="h-14 px-8 border-2 border-slate-200 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition-all"
            type="button"
          >
            필터 초기화
          </button>

          <div className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[#1e232d] px-6 text-sm font-bold text-white shadow-lg">
            <Sparkles className="h-4 w-4 text-blue-400" /> 데이터 {totalCount}건
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-50 bg-slate-50/30 px-4 py-5 md:px-10 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              Total {totalCount} Items
            </p>
            <p className="text-xs font-bold text-slate-400">
              현재 {pageStartItem} - {pageEndItem}건 표시 / {itemsPerPage}개씩 보기
            </p>
          </div>
          <PaginationControls />
        </div>

        <div className="p-4 md:p-8 overflow-x-auto">
          <div className="min-w-[1500px] space-y-3">
            <div className="grid grid-cols-[130px_180px_110px_140px_90px_120px_110px_110px_minmax(200px,1fr)_110px] gap-6 px-8 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
              <span className="text-center">영업일자</span>
              <span>업체명</span>
              <span className="text-center">대표자</span>
              <span className="text-center">연락처</span>
              <span className="text-center">소개건</span>
              <span className="text-center">영업자</span>
              <span className="text-center">영업상태</span>
              <span className="text-center">상담상태</span>
              <span>영업 메모</span>
              <span className="text-right">수당</span>
            </div>

            {isLoading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-50" />
              ))
            ) : paginatedData.length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-2xl bg-slate-50 text-sm font-black text-slate-400">
                조회된 데이터가 없습니다.
              </div>
            ) : (
              paginatedData.map(c => {
                const salesDate = formatDateTime(c.sales_date);

                return (
                  <div
                    key={c.id}
                    onClick={() => openModal(c)}
                    className="group grid grid-cols-[130px_180px_110px_140px_90px_120px_110px_110px_minmax(200px,1fr)_110px] items-center gap-6 rounded-[24px] border border-slate-50 bg-white p-5 cursor-pointer hover:border-blue-200 hover:shadow-md transition-all"
                  >
                    <div className="text-center flex flex-col text-sm font-black text-slate-500">
                      <span>{salesDate.date}</span>
                      {salesDate.time && (
                        <span className="mt-0.5 text-[11px] text-violet-500">{salesDate.time}</span>
                      )}
                    </div>
                    <div className="font-black text-slate-900 text-base truncate">
                      {c.company_name}
                    </div>
                    <div className="text-center text-sm font-bold">
                      {c.customer_name || "-"}
                    </div>
                    <div className="text-center text-sm font-medium text-slate-500">
                      {c.mobile_phone || c.landline_phone || "-"}
                    </div>
                    <div className="flex justify-center">
                      <span className={`px-3 py-1.5 rounded-full border text-[10px] font-black ${
                        (c.referral_yn || "N") === "Y"
                          ? "bg-amber-50 text-amber-600 border-amber-100"
                          : "bg-slate-50 text-slate-400 border-slate-100"
                      }`}>
                        {(c.referral_yn || "N") === "Y" ? "소개" : "일반"}
                      </span>
                    </div>
                    <div className="text-center text-sm font-black text-blue-600">
                      {users.find(u => u.id === c.sales_id)?.name || "미배정"}
                    </div>
                    <div className="flex justify-center">
                      <span
                        className={`px-4 py-1.5 rounded-full border text-[10px] font-black ${getSalesStatusTone(c.sales_status)}`}
                      >
                        {c.sales_status || "진행중"}
                      </span>
                    </div>
                    <div className="flex justify-center">
                      <span className="px-4 py-1.5 rounded-full border text-[10px] font-black bg-blue-50 text-blue-600">
                        {c.consult_status || "상담완료"}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 truncate font-medium">
                      {c.sales_memo || "기록 없음"}
                    </div>
                    <div className="text-right text-sm font-black text-slate-900">
                      ₩{(c.sales_commission || 0).toLocaleString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="px-4 py-6 md:px-10 md:py-8 border-t border-slate-50 flex flex-col gap-4 bg-slate-50/30 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              Total {totalCount} Items
            </p>
            <p className="text-xs font-bold text-slate-400">
              현재 {pageStartItem} - {pageEndItem}건 표시 / {itemsPerPage}개씩 보기
            </p>
          </div>

          <PaginationControls />
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm md:items-center md:p-3">
          <div className="relative flex h-[96vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[26px] border border-slate-200 bg-white text-slate-900 shadow-2xl md:h-auto md:max-h-[88vh] md:rounded-[28px]">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 md:px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <BriefcaseBusiness className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-emerald-600">
                    {isCreateMode ? "신규 고객 추가" : "영업 상세"}
                  </div>
                  <h2 className="line-clamp-1 text-base font-black tracking-tight text-slate-900">
                    {isCreateMode ? "신규 영업 고객 추가" : selectedCustomer?.company_name}
                  </h2>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-all hover:text-slate-900"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-4 py-4 md:px-5">
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                <section className="space-y-3">
                  <div className="rounded-[20px] border border-slate-100 bg-slate-50/60 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                      <div className="h-4 w-1 rounded-full bg-slate-300" /> 업체 기본 정보
                    </h3>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        { label: "업체명", field: "company_name", required: true },
                        { label: "대표자명", field: "customer_name", required: false },
                        { label: "핸드폰 번호", field: "mobile_phone", required: false },
                        { label: "유선 번호", field: "landline_phone", required: false },
                      ].map(item => (
                        <div key={item.field} className="space-y-1">
                          <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {item.label} {item.required && <span className="text-rose-500">*</span>}
                          </label>
                          <input
                            value={(formData as any)[item.field] || ""}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                [item.field]: e.target.value,
                              })
                            }
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                          />
                        </div>
                      ))}

                      <div className="space-y-1 md:col-span-2">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          소개건 여부
                        </label>
                        <select
                          value={formData.referral_yn || "N"}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              referral_yn: e.target.value,
                            })
                          }
                          className="h-9 w-full rounded-lg border border-amber-100 bg-amber-50/30 px-3 text-xs font-black text-slate-900 outline-none focus:border-amber-400"
                        >
                          <option value="N">일반건</option>
                          <option value="Y">소개건</option>
                        </select>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          상세 주소
                        </label>
                        <textarea
                          value={formData.address || ""}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              address: e.target.value,
                            })
                          }
                          className="min-h-[48px] w-full resize-none rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          업체 비고
                        </label>
                        <textarea
                          value={formData.note || ""}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              note: e.target.value,
                            })
                          }
                          placeholder="업체 관련 비고를 입력하세요."
                          className="min-h-[48px] w-full resize-none rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-blue-100 bg-blue-50/20 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-blue-700">
                      <UserCheck className="h-4 w-4" /> 상담 정보
                    </h3>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          상담사
                        </label>
                        <div className="flex h-9 items-center rounded-lg border border-blue-100 bg-white px-3 text-xs font-black text-blue-700">
                          {users.find(u => u.id === formData.tm_id)?.name || "미배정"}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          상담 상태
                        </label>
                        <div className="flex h-9 items-center rounded-lg border border-blue-100 bg-white px-3 text-xs font-black text-slate-900">
                          {formData.consult_status || "미지정"}
                        </div>
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          상담 메모
                        </label>
                        <div className="min-h-[68px] rounded-lg border border-blue-100 bg-white p-2.5 text-xs font-bold leading-5 text-slate-700 whitespace-pre-wrap">
                          {formData.consult_memo || "기록 없음"}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="rounded-[20px] border border-emerald-100 bg-emerald-50/20 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-emerald-700">
                      <TrendingUp className="h-4 w-4" /> 영업 성과 업데이트
                    </h3>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="ml-1 text-[10px] font-black uppercase text-slate-400">
                            영업자
                          </label>
                          <select
                            disabled={!isAdmin}
                            value={formData.sales_id || ""}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                sales_id: e.target.value,
                              })
                            }
                            className="h-9 w-full rounded-lg border border-emerald-200 bg-white px-3 text-xs font-black text-slate-900 outline-none disabled:bg-slate-50"
                          >
                            {isAdmin ? (
                              <>
                                <option value="">영업자 선택</option>
                                {users
                                  .filter(u => u.role_name === "영업")
                                  .map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                  ))}
                              </>
                            ) : (
                              <option value={currentUser.id}>{currentUser.name}</option>
                            )}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="ml-1 text-[10px] font-black uppercase text-slate-400">
                            영업 상태
                          </label>
                          <select
                            value={formData.sales_status || ""}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                sales_status: e.target.value,
                              })
                            }
                            className="h-9 w-full rounded-lg border border-emerald-200 bg-white px-3 text-xs font-black text-slate-900 outline-none"
                          >
                            <option value="">상태 선택</option>
                            {filteredSalesCodes.map(c => (
                              <option key={c.code_value} value={c.code_name}>
                                {c.code_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1 col-span-2">
                          <label className="ml-1 text-[10px] font-black uppercase text-slate-400">
                            영업 실행 일자
                          </label>
                          <input
                            type="date"
                            value={getDateInputValue(formData.sales_date)}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                sales_date: e.target.value,
                              })
                            }
                            className="h-9 w-full rounded-lg border border-emerald-200 bg-white px-3 text-xs font-black text-slate-900 outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="ml-1 text-[10px] font-black uppercase text-slate-400">
                          매출 (₩)
                          {!isAdmin && (
                            <span className="ml-2 text-[10px] font-black text-slate-400">
                              관리자만 수정 가능
                            </span>
                          )}
                        </label>

                        <div className="relative">
                          <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-black text-sm ${isAdmin ? "text-emerald-600" : "text-slate-400"}`}>
                            ₩
                          </span>
                          <input
                            type="number"
                            disabled={!isAdmin}
                            value={formData.sales_commission ?? ""}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                sales_commission: Number(e.target.value),
                              })
                            }
                            placeholder={isAdmin ? "매출액을 숫자로만 입력" : "관리자만 수정 가능"}
                            className={`h-10 w-full rounded-lg border pl-8 pr-3 text-sm font-black outline-none ${
                              isAdmin
                                ? "border-emerald-200 bg-white text-emerald-600"
                                : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                            }`}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="ml-1 text-[10px] font-black uppercase text-slate-400">
                          영업 메모
                        </label>
                        <textarea
                          value={formData.sales_memo || ""}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              sales_memo: e.target.value,
                            })
                          }
                          placeholder="상세한 영업 활동 내역을 기록하세요."
                          className="min-h-[68px] w-full rounded-lg border border-emerald-200 bg-white p-2.5 text-xs font-bold text-slate-900 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-violet-100 bg-violet-50/20 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-violet-700">
                        <FileAudio className="h-4 w-4" /> 업로드 파일 목록
                      </h3>
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-violet-600">
                        {recordings.length}개
                      </span>
                    </div>

                    {isRecordingsLoading ? (
                      <div className="h-16 animate-pulse rounded-xl bg-white" />
                    ) : recordings.length === 0 ? (
                      <div className="rounded-xl bg-white px-4 py-5 text-center text-xs font-bold text-slate-400">
                        업로드된 파일이 없습니다.
                      </div>
                    ) : (
                      <div className="max-h-[118px] space-y-1.5 overflow-y-auto pr-1">
                        {recordings.map((recording) => (
                          <div
                            key={recording.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-violet-100 bg-white px-2.5 py-1.5"
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              <FileAudio className="h-4 w-4 flex-none text-violet-500" />
                              <span className="truncate text-xs font-bold text-slate-700">
                                {recording.file_name}
                              </span>
                            </div>

                            <div className="flex flex-none items-center gap-1">
                              <a
                                href={recording.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex h-7 w-7 items-center justify-center rounded-md text-blue-500 hover:bg-blue-50"
                                title="파일 보기"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                              <a
                                href={recording.file_url}
                                download={recording.file_name}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50"
                                title="파일 다운로드"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div className="sticky bottom-0 mt-4 flex gap-2 border-t border-slate-100 bg-white pt-3 pb-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="h-11 flex-1 rounded-xl border border-slate-200 text-xs font-black text-slate-400 transition-all hover:bg-slate-50 disabled:opacity-50"
                >
                  닫기
                </button>

                <button
                  type="submit"
                  disabled={isSaving || !String(formData.company_name || "").trim()}
                  className="flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-[#1e232d] text-xs font-black text-white shadow-xl transition-all hover:bg-black disabled:opacity-50"
                >
                  {isSaving ? "저장 중..." : isCreateMode ? "신규 영업 고객 추가" : "영업 실적 저장"}
                  {!isSaving && <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isRankModalOpen && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/60 p-6 backdrop-blur-md">
          <div className="relative w-full max-w-2xl rounded-[40px] bg-white shadow-2xl p-12 animate-in zoom-in-95">
            <div className="flex justify-between items-start mb-10">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-1.5 text-[10px] font-black text-rose-600 border border-rose-100 uppercase tracking-widest mb-3">
                  <Award className="h-4 w-4" /> Performance Rankings
                </div>
                <h2 className="text-3xl font-black text-slate-900">영업자 실적 랭킹</h2>
              </div>

              <button
                onClick={() => setIsRankModalOpen(false)}
                className="p-3 hover:bg-slate-100 rounded-full text-slate-400 transition-all"
                type="button"
              >
                <X />
              </button>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {isRankLoading ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="h-24 animate-pulse rounded-[24px] bg-slate-50" />
                ))
              ) : salesRankings.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-[24px] bg-slate-50 text-sm font-black text-slate-400">
                  집계할 영업 실적이 없습니다.
                </div>
              ) : (
                salesRankings.map((r, i) => (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between p-6 rounded-[24px] border-2 transition-all ${
                      r.id === currentUser?.id
                        ? "bg-rose-50 border-rose-200 ring-1 ring-rose-100"
                        : "bg-slate-50 border-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-5">
                      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-lg font-black ${i === 0 ? "bg-amber-100 text-amber-600" : "bg-white text-slate-400"}`}>
                        {i + 1}
                      </div>
                      <div>
                        <div className="font-black text-slate-900 text-lg">
                          {r.name}
                          {r.id === currentUser?.id && (
                            <span className="ml-2 px-2 py-0.5 bg-rose-600 text-white text-[9px] rounded-md uppercase">
                              You
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-black text-slate-900">
                        ₩{r.total.toLocaleString()}
                      </div>
                      <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
                        Commission
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setIsRankModalOpen(false)}
              className="w-full h-16 mt-10 bg-[#1e232d] text-white font-black rounded-2xl hover:bg-black transition-all shadow-xl"
              type="button"
            >
              실적 창 닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
