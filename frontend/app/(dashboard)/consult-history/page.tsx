"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Search,
  RotateCw,
  X,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  UserCheck,
  Upload,
  Filter,
  FileAudio,
  ExternalLink,
  Trash2,
  Clock,
  MapPin,
  UserPlus,
} from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const RECORDING_BUCKET_NAME = "recordings";

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
  sales_date: string;
}

interface UserData {
  id: string;
  name: string;
  role_id?: string;
  role_name: string;
}

interface CommonCode {
  code_value: string;
  code_name: string;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

interface RecordingItem {
  id: string;
  customer_id: string;
  file_name: string;
  file_url: string;
  duration?: string | null;
  created_at?: string;
}

type FilterState = {
  date_from: string;
  date_to: string;
  search: string;
  tm_id: string;
  consult_status: string;
};

export default function ConsultationPage() {
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);

  // --- States ---
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [consultCodes, setConsultCodes] = useState<CommonCode[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [filters, setFilters] = useState<FilterState>({
    date_from: "",
    date_to: "",
    search: "",
    tm_id: "all",
    consult_status: "대기",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Partial<Customer>>({});
  const [toast, setToast] = useState<Toast | null>(null);

  const [recordingDeleteTarget, setRecordingDeleteTarget] =
    useState<RecordingItem | null>(null);
  const [isRecordingDeleteModalOpen, setIsRecordingDeleteModalOpen] =
    useState(false);

  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [isRecordingsLoading, setIsRecordingsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingRecording, setIsDeletingRecording] = useState(false);

  const recordingInputRef = useRef<HTMLInputElement | null>(null);

  const hoursList = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, "0")
  );
  const minutesList = ["00", "10", "20", "30", "40", "50"];

  const isModalBusy = isUploading || isSaving || isDeletingRecording;

  const modalLoadingMessage = isSaving
    ? "저장 중입니다..."
    : isUploading
    ? "녹취 파일 업로드 중입니다..."
    : isDeletingRecording
    ? "녹취 파일 삭제 중입니다..."
    : "처리 중입니다...";

  const LoadingSpinner = ({ className = "h-4 w-4" }: { className?: string }) => (
    <RotateCw className={`${className} animate-spin`} />
  );

  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const normalizeDateValue = (value?: string | null) => {
    const v = String(value || "").trim();
    if (!v) return null;

    const datePart = v.replace("T", " ").split(" ")[0];
    return datePart ? v : null;
  };

  const getDatePart = (value?: string | null) => {
    if (!value || String(value) === "null") return "";
    return String(value).replace("T", " ").split(" ")[0] || "";
  };

  const getHourPart = (value?: string | null) => {
    if (!value || String(value) === "null") return "";
    return String(value).replace("T", " ").split(" ")[1]?.split(":")[0] || "";
  };

  const getMinutePart = (value?: string | null) => {
    if (!value || String(value) === "null") return "";
    return String(value).replace("T", " ").split(" ")[1]?.split(":")[1] || "";
  };

  const buildDateOnlyValue = (date: string) => {
    return date || "";
  };

  const buildSalesDateTime = (date: string, hour: string, minute: string) => {
    if (!date) return "";

    const normalizedHour = hour || "09";
    const normalizedMinute = minute || "00";

    return `${date} ${normalizedHour}:${normalizedMinute}:00`;
  };

  const formatConsultDate = (value?: string | null) => {
    if (!value || String(value) === "null") {
      return { date: "-", time: "" };
    }

    const normalized = String(value).replace("T", " ").trim();
    const [date = "", time = ""] = normalized.split(" ");

    return {
      date: date ? date.replace(/-/g, ".") : "-",
      time: time ? time.slice(0, 5) : "",
    };
  };

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      window.setTimeout(() => setToast(null), 3000);
    },
    []
  );

  // --- Data Fetching (원본 조회 로직 유지) ---
  const fetchData = useCallback(
    async (userOverride?: UserData) => {
      const activeUser = userOverride || currentUser;
      if (!activeUser) return;

      setIsLoading(true);
      try {
        const params: Record<string, string> = {
          date_type: "상담일",
          limit: String(itemsPerPage),
          offset: String((currentPage - 1) * itemsPerPage),
        };

        if (filters.date_from) params.date_from = filters.date_from;
        if (filters.date_to) params.date_to = filters.date_to;
        if (filters.search) params.search = filters.search;
        if (filters.consult_status && filters.consult_status !== "all") {
          params.consult_status = filters.consult_status;
        }

        const roleName = activeUser.role_name || (activeUser as any).role;
        if (roleName !== "관리자") {
          if (activeUser.id) params.tm_id = String(activeUser.id);
        } else {
          if (filters.tm_id && filters.tm_id !== "all") {
            params.tm_id = String(filters.tm_id);
          }
        }

        const queryParams = new URLSearchParams(params);
        const [cRes, uRes, codeRes] = await Promise.all([
          fetch(`/api/customers?${queryParams.toString()}`),
          fetch("/api/users"),
          fetch("/api/codes/details/by-group?group_code=CONSULT_STATUS"),
        ]);

        const cData = await cRes.json();
        const uData = await uRes.json();
        const codeData = await codeRes.json();

        const resultData = Array.isArray(cData) ? cData : cData.data || [];
        setCustomers(resultData);
        setTotalCount(cData.totalCount || resultData.length);
        setUsers(Array.isArray(uData) ? uData : []);
        setConsultCodes(
          Array.isArray(codeData)
            ? codeData.filter((c) => c.code_name !== "전체")
            : []
        );
      } catch (e) {
        console.error("데이터 로드 에러:", e);
        showToast("데이터 로드 실패", "error");
      } finally {
        setIsLoading(false);
      }
    },
    [filters, currentUser, currentPage, itemsPerPage, showToast]
  );

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setCurrentUser(parsedUser);
        const roleName = parsedUser.role_name || parsedUser.role;
        if (roleName !== "관리자" && parsedUser.id) {
          setFilters((prev) => ({ ...prev, tm_id: String(parsedUser.id) }));
        }
        fetchData(parsedUser);
      } catch {
        window.location.href = "/login";
      }
    } else {
      window.location.href = "/login";
    }
  }, []);

  useEffect(() => {
    if (currentUser) fetchData();
  }, [
    filters.date_from,
    filters.date_to,
    filters.search,
    filters.tm_id,
    filters.consult_status,
    currentPage,
    itemsPerPage,
    fetchData,
    currentUser,
  ]);

  const fetchRecordings = async (customerId: string) => {
    setIsRecordingsLoading(true);
    try {
      const res = await fetch(
        `/api/recordings/upload?customer_id=${encodeURIComponent(customerId)}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "녹취 목록 조회 실패");
      }

      setRecordings(Array.isArray(data) ? data : []);
    } catch (error) {
      setRecordings([]);
      showToast(error instanceof Error ? error.message : "녹취 목록 조회 실패", "error");
    } finally {
      setIsRecordingsLoading(false);
    }
  };

  const uploadRecordingFile = async (file: File, customerId: string) => {
    const safeFileName = file.name
      .normalize("NFKD")
      .replace(/[^\w.\-]/g, "_");

    const filePath = `${customerId}/${Date.now()}_${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from(RECORDING_BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(RECORDING_BUCKET_NAME).getPublicUrl(filePath);

    const res = await fetch("/api/recordings/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: customerId,
        file_name: file.name,
        file_url: publicUrl,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      await supabase.storage.from(RECORDING_BUCKET_NAME).remove([filePath]);
      throw new Error(data?.error || "녹취 정보 저장 실패");
    }

    return data;
  };

  const handleRecordingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!selectedCustomer?.id) {
      showToast("고객을 먼저 저장한 뒤 녹취 파일을 업로드할 수 있습니다.", "error");
      if (recordingInputRef.current) recordingInputRef.current.value = "";
      return;
    }

    try {
      setIsUploading(true);
      await uploadRecordingFile(file, selectedCustomer.id);
      await fetchRecordings(selectedCustomer.id);
      showToast("녹취 파일이 업로드되었습니다.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "녹취 업로드 실패", "error");
    } finally {
      setIsUploading(false);
      if (recordingInputRef.current) recordingInputRef.current.value = "";
    }
  };

  const confirmDeleteRecording = async () => {
    if (!recordingDeleteTarget) return;

    try {
      setIsDeletingRecording(true);
      const res = await fetch(`/api/recordings/upload`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recordingDeleteTarget.id }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "녹취 삭제 실패");
      }

      showToast("삭제되었습니다.");
      setIsRecordingDeleteModalOpen(false);
      setRecordingDeleteTarget(null);

      if (selectedCustomer) {
        await fetchRecordings(selectedCustomer.id);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "삭제 실패", "error");
    } finally {
      setIsDeletingRecording(false);
    }
  };

  const openModal = async (customer: Customer | null = null) => {
    setSelectedCustomer(customer);
    setRecordings([]);

    if (customer) {
      const cleanConsultDate =
        customer.consult_date && String(customer.consult_date).trim() !== ""
          ? String(customer.consult_date).replace("T", " ").split(" ")[0]
          : "";

      const cleanSalesDate =
        customer.sales_date && String(customer.sales_date).trim() !== ""
          ? String(customer.sales_date).replace("T", " ")
          : "";

      setFormData({
        ...customer,
        consult_date: cleanConsultDate,
        sales_date: cleanSalesDate,
        receipt_date: customer.receipt_date
          ? String(customer.receipt_date).split("T")[0]
          : getTodayDateString(),
      });

      setIsModalOpen(true);
      await fetchRecordings(customer.id);
      return;
    }

    setFormData({
      company_name: "",
      customer_name: "",
      landline_phone: "",
      mobile_phone: "",
      address: "",
      note: "",
      receipt_date: getTodayDateString(),
      tm_id: currentUser?.id || "",
      consult_date: getTodayDateString(),
      sales_date: "",
      consult_status: "대기",
      consult_memo: "",
    });

    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSaving) return;

    const companyName = String(formData.company_name || "").trim();

    if (!companyName) {
      showToast("업체명은 필수값입니다.", "error");
      return;
    }

    // 수정 사항: 신규 등록/수정 저장 시 상담일자는 화면 입력값이 아니라 저장하는 당일 날짜로 저장
    const saveDate = getTodayDateString();

    const payload = {
      ...formData,
      company_name: companyName,
      receipt_date: normalizeDateValue(formData.receipt_date),
      consult_date: saveDate,
      sales_date: normalizeDateValue(formData.sales_date),
      consult_status: String(formData.consult_status || "").trim() || "대기",
      tm_id: formData.tm_id ? formData.tm_id : null,
    };

    const url = selectedCustomer
      ? `/api/customers/${selectedCustomer.id}`
      : "/api/customers";

    try {
      setIsSaving(true);

      const res = await fetch(url, {
        method: selectedCustomer ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "저장 실패");
      }

      setIsModalOpen(false);
      setSelectedCustomer(null);
      showToast(selectedCustomer ? "정보가 저장되었습니다." : "신규 고객이 등록되었습니다.");
      await fetchData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "저장 실패", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetFilters = () => {
    if (!currentUser) return;
    const roleName = currentUser.role_name || (currentUser as any).role;
    setFilters({
      date_from: "",
      date_to: "",
      search: "",
      tm_id: roleName === "관리자" ? "all" : String(currentUser.id),
      consult_status: "대기",
    });
    setCurrentPage(1);
  };

  const paginatedData = useMemo(() => customers, [customers]);
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  if (!currentUser) return null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 md:space-y-8 pb-20 px-4 md:px-0 text-slate-900">
      <input
        ref={recordingInputRef}
        type="file"
        accept="*/*"
        className="hidden"
        onChange={handleRecordingUpload}
      />

      {toast && (
        <div
          className={`fixed right-6 top-6 z-[11000] flex items-center gap-3 rounded-[22px] border border-white/10 px-5 py-4 shadow-2xl backdrop-blur-2xl animate-in slide-in-from-right-8 ${
            toast.type === "success"
              ? "bg-slate-900/90 text-white"
              : "bg-rose-600/90 text-white"
          }`}
        >
          <p className="text-sm font-bold tracking-tight">{toast.message}</p>
        </div>
      )}

      {/* Header Area */}
      <section className="soft-scale-in">
        <div className="relative overflow-hidden rounded-[24px] md:rounded-[30px] border border-white/10 bg-slate-900 p-6 md:p-8 shadow-2xl">
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-400/15 bg-blue-500/10 px-3 py-1 text-[10px] font-bold text-blue-200 uppercase">
                <Layers className="h-3 w-3" /> 상담 통합 관리
              </div>
              <h1 className="text-2xl md:text-[2.4rem] font-black text-white leading-tight">
                상담 관리
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchData()}
                className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white/10 text-white hover:bg-white/20"
                type="button"
                aria-label="새로고침"
              >
                <RotateCw className={isLoading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={() => openModal()}
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-500 px-5 text-xs font-black text-white shadow-xl transition-all hover:-translate-y-0.5"
                type="button"
              >
                <UserPlus className="h-4 w-4" />
                신규 고객 추가
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Filter Area - Responsive Grid */}
      <section className="rounded-[24px] md:rounded-[28px] border border-white/60 bg-white/80 p-4 md:p-5 shadow-sm backdrop-blur-xl space-y-3">
        <div className="grid gap-3 md:grid-cols-[120px_1fr]">
          <div className="hidden md:flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-100 text-xs font-black text-slate-500">
            <Filter className="h-3.5 w-3.5" /> 상담일자
          </div>
          <div className="grid gap-2 grid-cols-2 md:grid-cols-[160px_auto_160px_1fr]">
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) =>
                setFilters((p) => ({ ...p, date_from: e.target.value }))
              }
              className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold"
            />
            <div className="hidden md:flex items-center justify-center text-slate-300">
              ~
            </div>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) =>
                setFilters((p) => ({ ...p, date_to: e.target.value }))
              }
              className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold"
            />
            <div className="relative col-span-2 md:col-span-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <input
                value={filters.search}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, search: e.target.value }))
                }
                placeholder="업체, 고객 검색"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-bold"
              />
            </div>
          </div>
        </div>
        <div className="grid gap-2 grid-cols-2 md:grid-cols-[1fr_1fr_100px_auto]">
          <select
            disabled={
              (currentUser.role_name || (currentUser as any).role) !== "관리자"
            }
            value={filters.tm_id}
            onChange={(e) =>
              setFilters((p) => ({ ...p, tm_id: e.target.value }))
            }
            className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none disabled:bg-slate-50"
          >
            {(currentUser.role_name || (currentUser as any).role) ===
            "관리자" ? (
              <>
                <option value="all">상담원 전체</option>
                {users
                  .filter((u) => u.role_name === "TM")
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </>
            ) : (
              <option value={currentUser.id}>{currentUser.name}</option>
            )}
          </select>
          <select
            value={filters.consult_status}
            onChange={(e) =>
              setFilters((p) => ({
                ...p,
                consult_status: e.target.value,
              }))
            }
            className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold"
          >
            {consultCodes.map((c) => (
              <option key={c.code_value} value={c.code_name}>
                {c.code_name}
              </option>
            ))}
          </select>
          <button
            onClick={handleResetFilters}
            className="h-12 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-500"
            type="button"
          >
            초기화
          </button>
          <div className="hidden md:flex h-12 items-center px-6 rounded-full bg-slate-900 text-xs font-bold text-white shadow-lg">
            <Sparkles className="h-3.5 w-3.5 text-blue-400 mr-2" />{" "}
            {totalCount}건
          </div>
        </div>
      </section>

      {/* Table Section - Responsive List/Table */}
      <section className="overflow-hidden rounded-[24px] md:rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-50 px-6 py-4">
          <h2 className="text-sm md:text-lg font-black text-slate-900">
            상담 레지스트리
          </h2>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-black outline-none"
          >
            <option value={10}>10개</option>
            <option value={50}>50개</option>
            <option value={100}>100개</option>
          </select>
        </div>

        {/* Desktop View (Table) */}
        <div className="hidden md:block overflow-x-auto p-8">
          <div className="min-w-[1400px] space-y-3">
            <div className="grid grid-cols-[150px_150px_180px_140px_150px_140px_1fr_120px] gap-6 px-8 py-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
              <span className="text-center">상담일자</span>
              <span className="text-center">영업일시</span>
              <span>업체명</span>
              <span className="text-center">대표자</span>
              <span className="text-center">연락처</span>
              <span className="text-center">담당자</span>
              <span>상담 메모</span>
              <span className="text-center">상태</span>
            </div>
            {isLoading
              ? [1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-[24px] bg-slate-50 animate-pulse"
                  />
                ))
              : paginatedData.map((c) => {
                  const consultDate = formatConsultDate(c.consult_date);
                  return (
                    <div
                      key={c.id}
                      onClick={() => openModal(c)}
                      className="group grid grid-cols-[150px_150px_180px_140px_150px_140px_1fr_120px] items-center gap-6 rounded-[24px] border border-slate-100 bg-white p-6 transition-all hover:border-blue-200 hover:shadow-xl cursor-pointer text-slate-900"
                    >
                      <div className="text-center flex flex-col text-[11px] font-black">
                        <span>{consultDate.date}</span>
                      </div>
                      <div className="text-center flex flex-col text-[11px] font-black">
                        {(() => {
                          const salesDate = formatConsultDate(c.sales_date);
                          return (
                            <>
                              <span>{salesDate.date}</span>
                              {salesDate.time && (
                                <span className="text-violet-500">{salesDate.time}</span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <div className="truncate text-sm font-black">
                        {c.company_name || "-"}
                      </div>
                      <div className="text-center text-xs font-bold text-slate-600">
                        {c.customer_name || "-"}
                      </div>
                      <div className="text-center text-xs font-bold text-slate-600">
                        {c.mobile_phone || c.landline_phone || "-"}
                      </div>
                      <div className="text-center text-xs font-black text-blue-600">
                        {users.find((u) => u.id === c.tm_id)?.name || "미배정"}
                      </div>
                      <div className="line-clamp-1 text-xs text-slate-500">
                        {c.consult_memo || "기록 없음"}
                      </div>
                      <div className="flex justify-center">
                        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-black text-blue-600">
                          {c.consult_status || "미지정"}
                        </span>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* Mobile View (Card List) */}
        <div className="md:hidden p-4 space-y-3">
          {isLoading
            ? [1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-32 rounded-2xl bg-slate-50 animate-pulse"
                />
              ))
            : paginatedData.map((c) => {
                const consultDate = formatConsultDate(c.consult_date);
                return (
                  <div
                    key={c.id}
                    onClick={() => openModal(c)}
                    className="p-4 rounded-2xl border border-slate-100 bg-white space-y-2 shadow-sm text-slate-900"
                  >
                    <div className="flex justify-between items-start">
                      <div className="text-sm font-black">{c.company_name || "-"}</div>
                      <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-[10px] font-black text-blue-600 border border-blue-100">
                        {c.consult_status || "미지정"}
                      </span>
                    </div>
                    <div className="flex gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                      <span>{c.customer_name || "-"}</span> |{" "}
                      <span>{c.mobile_phone || c.landline_phone || "-"}</span>
                    </div>
                    <div className="flex gap-2 text-[10px] font-black">
                      <span className="text-blue-500">
                        상담 {consultDate.date}
                      </span>
                      <span className="text-violet-500">
                        영업 {formatConsultDate(c.sales_date).date}
                        {formatConsultDate(c.sales_date).time ? ` ${formatConsultDate(c.sales_date).time}` : ""}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 line-clamp-1 bg-slate-50 p-2 rounded-lg">
                      {c.consult_memo || "메모 없음"}
                    </div>
                  </div>
                );
              })}
        </div>

        {/* Pagination Section */}
        <div className="flex items-center justify-between border-t border-slate-50 bg-slate-50/50 px-6 md:px-10 py-6 md:py-8">
          <p className="hidden md:block text-sm font-bold text-slate-400">
            Total {totalCount} 건
          </p>
          <div className="flex items-center justify-between w-full md:w-auto gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
              type="button"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="h-10 px-4 flex items-center rounded-xl bg-slate-900 text-xs font-black text-white">
              {currentPage} / {totalPages}
            </div>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
              type="button"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      {/* --- Detail Modal --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-end md:items-center justify-center bg-slate-950/60 p-0 md:p-4 backdrop-blur-sm">
          <div className="relative flex h-[94vh] md:h-auto md:max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[40px] md:rounded-[40px] bg-white shadow-2xl text-slate-900">
            {isModalBusy && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/75 backdrop-blur-sm">
                <div className="flex flex-col items-center rounded-[28px] border border-slate-100 bg-white px-8 py-7 shadow-2xl">
                  <div className="relative flex h-16 w-16 items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-600 border-r-violet-500" />
                    <div className="h-6 w-6 rounded-full bg-gradient-to-r from-blue-600 to-violet-500" />
                  </div>
                  <div className="mt-5 text-sm font-black text-slate-900">
                    처리 중
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-500">
                    {modalLoadingMessage}
                  </div>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                  <UserCheck className="h-4 w-4" />
                </div>
                <h2 className="text-base font-black tracking-tight">
                  {selectedCustomer ? "상담 상세 설정" : "신규 고객 등록"}
                </h2>
              </div>
              <button
                onClick={() => !isModalBusy && setIsModalOpen(false)}
                className="h-9 w-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 disabled:opacity-40"
                disabled={isModalBusy}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-hide"
            >
              <div className="grid grid-cols-2 gap-3 text-slate-900">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">
                    업체명 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={formData.company_name || ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        company_name: e.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 text-xs font-bold text-slate-900 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">
                    대표자
                  </label>
                  <input
                    value={formData.customer_name || ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        customer_name: e.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 text-xs font-bold text-slate-900 focus:border-blue-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-tight">
                    유선 번호
                  </label>
                  <input
                    value={formData.landline_phone || ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        landline_phone: e.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 text-xs font-bold text-slate-900 focus:border-blue-500 outline-none"
                    placeholder="유선 번호"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-tight">
                    핸드폰 번호
                  </label>
                  <input
                    value={formData.mobile_phone || ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        mobile_phone: e.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 text-xs font-bold text-slate-900 focus:border-blue-500 outline-none"
                    placeholder="핸드폰 번호"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-400 ml-1 uppercase flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> 상세 주소
                  </label>
                  <textarea
                    value={formData.address || ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        address: e.target.value,
                      }))
                    }
                    className="h-16 w-full rounded-xl border-2 border-slate-100 bg-slate-50 p-3 text-xs font-bold text-slate-900 outline-none resize-none shadow-inner"
                    placeholder="주소를 입력하세요."
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 text-[11px] font-black text-slate-800">
                  <Clock className="h-4 w-4 text-blue-500" /> 상담일자 및 상태
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={formData.consult_status || "대기"}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        consult_status: e.target.value,
                      }))
                    }
                    className="h-10 rounded-xl border-2 border-blue-100 bg-blue-50/30 px-3 text-xs font-black text-blue-600 outline-none"
                  >
                    {consultCodes.map((c) => (
                      <option key={c.code_value} value={c.code_name}>
                        {c.code_name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={getDatePart(formData.consult_date)}
                    onChange={(e) => {
                      setFormData((p) => ({
                        ...p,
                        consult_date: buildDateOnlyValue(e.target.value),
                      }));
                    }}
                    className="h-10 rounded-xl border-2 border-slate-100 bg-slate-50 px-3 text-[11px] font-bold text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 text-[11px] font-black text-slate-800">
                  <Clock className="h-4 w-4 text-violet-500" /> 영업 일시
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <input
                    type="date"
                    value={getDatePart(formData.sales_date)}
                    onChange={(e) => {
                      const hour = getHourPart(formData.sales_date);
                      const minute = getMinutePart(formData.sales_date);
                      setFormData((p) => ({
                        ...p,
                        sales_date: buildSalesDateTime(
                          e.target.value,
                          hour,
                          minute
                        ),
                      }));
                    }}
                    className="h-10 rounded-xl border-2 border-slate-100 bg-slate-50 px-3 text-[11px] font-bold text-slate-900 outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={getHourPart(formData.sales_date)}
                    onChange={(e) => {
                      const date = getDatePart(formData.sales_date);
                      const minute = getMinutePart(formData.sales_date);
                      setFormData((p) => ({
                        ...p,
                        sales_date: buildSalesDateTime(
                          date,
                          e.target.value,
                          minute
                        ),
                      }));
                    }}
                    className="h-9 flex-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-900 text-center"
                  >
                    <option value="">시</option>
                    {hoursList.map((h) => (
                      <option key={h} value={h}>
                        {h}시
                      </option>
                    ))}
                  </select>
                  <select
                    value={getMinutePart(formData.sales_date)}
                    onChange={(e) => {
                      const date = getDatePart(formData.sales_date);
                      const hour = getHourPart(formData.sales_date);
                      setFormData((p) => ({
                        ...p,
                        sales_date: buildSalesDateTime(
                          date,
                          hour,
                          e.target.value
                        ),
                      }));
                    }}
                    className="h-9 flex-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-900 text-center"
                  >
                    <option value="">분</option>
                    {minutesList.map((m) => (
                      <option key={m} value={m}>
                        {m}분
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">
                  상담 기록
                </label>
                <textarea
                  value={formData.consult_memo || ""}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      consult_memo: e.target.value,
                    }))
                  }
                  className="h-20 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 text-xs font-bold text-slate-900 outline-none resize-none"
                  placeholder="내용을 기록하세요."
                />
              </div>

              <div className="rounded-2xl border-2 border-dashed border-emerald-100 bg-emerald-50/20 p-4 text-slate-900">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-black text-emerald-700 flex items-center gap-1.5">
                    <FileAudio className="h-4 w-4" /> 녹취 파일
                  </span>
                  <button
                    type="button"
                    onClick={() => recordingInputRef.current?.click()}
                    disabled={!selectedCustomer || isUploading}
                    className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black hover:bg-emerald-700 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUploading ? (
                      <LoadingSpinner className="h-3.5 w-3.5" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {isUploading ? "업로드 중..." : "파일 추가"}
                  </button>
                </div>

                {!selectedCustomer && (
                  <div className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-700">
                    신규 고객은 저장 후 녹취 파일을 업로드할 수 있습니다.
                  </div>
                )}

                <div className="space-y-2 max-h-[80px] overflow-y-auto pr-1">
                  {isRecordingsLoading ? (
                    <div className="h-12 animate-pulse rounded-xl bg-white" />
                  ) : recordings.length === 0 ? (
                    <div className="text-center py-2 text-[10px] font-bold text-slate-300">
                      첨부 파일 없음
                    </div>
                  ) : (
                    recordings.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm transition-all hover:border-emerald-200"
                      >
                        <span className="text-[10px] font-bold text-slate-700 truncate flex-1 mr-2">
                          {r.file_name}
                        </span>
                        <div className="flex gap-1">
                          <a
                            href={r.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setRecordingDeleteTarget(r);
                              setIsRecordingDeleteModalOpen(true);
                            }}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-1 pb-4 bg-white">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isModalBusy}
                  className="h-12 flex-1 rounded-2xl border-2 border-slate-200 font-black text-slate-400 text-xs disabled:opacity-40"
                >
                  닫기
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-12 flex-[2] rounded-2xl bg-slate-900 font-black text-white text-xs shadow-xl disabled:opacity-60"
                >
                  {isSaving
                    ? "저장 중..."
                    : selectedCustomer
                    ? "변경 내용 저장"
                    : "신규 고객 저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recording Delete Modal */}
      {isRecordingDeleteModalOpen && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-6 text-slate-900">
          <div className="w-full max-w-[280px] rounded-[30px] bg-white p-6 text-center shadow-2xl border border-slate-100">
            <h3 className="text-sm font-black">파일을 삭제할까요?</h3>
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={confirmDeleteRecording}
                disabled={isDeletingRecording}
                className="h-11 rounded-xl bg-rose-600 text-xs font-black text-white disabled:opacity-60"
                type="button"
              >
                {isDeletingRecording ? "삭제 중..." : "삭제"}
              </button>
              <button
                onClick={() => {
                  setIsRecordingDeleteModalOpen(false);
                  setRecordingDeleteTarget(null);
                }}
                disabled={isDeletingRecording}
                className="h-11 rounded-xl font-bold text-slate-400 text-xs disabled:opacity-40"
                type="button"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
