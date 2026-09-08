"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  FileText,
  Tags,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import { missionMock } from "@/mocks/missionMock";
import {
  createMission,
  uploadMissionDocument,
} from "@/services/mission";

export default function MissionPage() {
  const router = useRouter();

  // Seed 문서 업로드 input 제어
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Mission 사용자 입력 정보
  const [missionName, setMissionName] = useState("");
  const [domain, setDomain] = useState("");
  const [objective, setObjective] = useState("");

  // Expert 사용자 입력 정보
  const [expertRole, setExpertRole] = useState("");
  const [experience, setExperience] = useState("");
  const [specialties, setSpecialties] = useState("");

  // 업로드할 Seed 문서 목록
  const [files, setFiles] = useState<File[]>([]);

  // API 처리 상태
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");

  // 문서 선택 시 파일 목록에 추가
  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) return;

    setFiles((prev) => [...prev, ...selectedFiles]);
    event.target.value = "";
  };

  // 선택한 Seed 문서 삭제
  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 취소 버튼: 입력값 전체 초기화
  const handleCancel = () => {
    setMissionName("");
    setDomain("");
    setObjective("");
    setExpertRole("");
    setExperience("");
    setSpecialties("");
    setFiles([]);
    setSubmitError("");
    setSubmitMessage("");
  };

  // 미션 생성 → mission_id 기준 Seed 문서 업로드
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (files.length === 0) {
      setSubmitError("Seed 문서를 1개 이상 선택해주세요.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    setSubmitMessage("");

    // Mission 생성 API 입력값
    const missionPayload = {
      title: missionName,
      domain,
      objective,
    };

    // Expert API 구현 전까지 입력 구조만 유지
    const expertPayload = {
      role: expertRole,
      experience_years: Number(experience),
      specialties: specialties
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    try {
      // 1. Mission 생성
      const createdMission = await createMission(missionPayload);
      const missionId = createdMission.mission_id;

      // 2. 선택한 Seed 문서를 mission_id 기준으로 순차 업로드
      for (const file of files) {
        await uploadMissionDocument(missionId, file);
      }

      console.log("MISSION ID:", missionId);
      console.log("MISSION PAYLOAD:", missionPayload);
      console.log("EXPERT PAYLOAD:", expertPayload);
      console.log("SEED FILES:", files);

      setSubmitMessage(
        "미션 생성 및 Seed 문서 업로드가 완료되었습니다."
      );

      // 생성된 Mission ID를 Interview 화면으로 전달
      router.push(`/interview?missionId=${missionId}`);

      // TODO: Expert / Interview API 구현 후
      // 1. Expert 등록 → expert_id 수신
      // 2. Interview 생성 → interview_id 수신
      // 3. interview_id도 Interview 화면으로 전달
    } catch (error) {
      console.error("MISSION CREATE ERROR:", error);

      setSubmitError(
        error instanceof Error
          ? error.message
          : "미션 생성 중 오류가 발생했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // 일반 입력창 공통 스타일
  const inputClass =
    "h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

  // 아이콘 포함 입력창 공통 스타일
  const iconInputClass =
    "h-11 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

  const labelClass = "text-sm font-bold text-slate-800";

  return (
    <div>
      <div className="mx-auto max-w-[1180px] space-y-3 pb-3">
        {/* 화면 설명 */}
        <section className="px-1">
          <p className="text-sm font-medium text-slate-500">
            전문가의 경험을 체계적으로 수집하기 위한 미션을 설정하세요.
          </p>
        </section>

        {/* Mission 전체 입력 폼 */}
        <form
          onSubmit={handleSubmit}
          className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm lg:p-6"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />

          <div className="pointer-events-none absolute -right-28 -top-28 h-64 w-64 rounded-full bg-blue-100/50 blur-3xl" />

          <div className="relative space-y-4">
            {/* Mission 이름 */}
            <div className="space-y-1.5">
              <label className={labelClass}>
                미션 이름 <span className="text-rose-500">*</span>
              </label>

              <input
                type="text"
                value={missionName}
                onChange={(e) => setMissionName(e.target.value)}
                maxLength={100}
                placeholder="예: MSA 서비스 분리 판단 노하우"
                className={inputClass}
                required
                disabled={isSubmitting}
              />

              <div className="flex justify-end">
                <span className="text-[11px] font-semibold text-slate-500">
                  {missionName.length}/100
                </span>
              </div>
            </div>

            {/* Mission 도메인 */}
            <div className="space-y-1.5">
              <label className={labelClass}>
                도메인 <span className="text-rose-500">*</span>
              </label>

              <div className="relative">
                <BriefcaseBusiness className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />

                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className={`${iconInputClass} appearance-none`}
                  required
                  disabled={isSubmitting}
                >
                  <option value="">도메인을 선택하세요</option>

                  {missionMock.domains.map((domainItem) => (
                    <option key={domainItem} value={domainItem}>
                      {domainItem}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            {/* Mission 목표 */}
            <div className="space-y-1.5">
              <label className={labelClass}>
                목표 <span className="text-rose-500">*</span>
              </label>

              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                maxLength={200}
                placeholder="예: MSA 환경에서 서비스 분리 판단 기준과 예외 규칙을 추출"
                className="min-h-[82px] w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                required
                disabled={isSubmitting}
              />

              <div className="flex justify-end">
                <span className="text-[11px] font-semibold text-slate-500">
                  {objective.length}/200
                </span>
              </div>
            </div>

            <div className="border-t border-slate-200" />

            {/* Expert 정보 */}
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  전문가 정보
                </h2>

                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  인터뷰와 Knowledge Validation에 사용할 전문가 정보를
                  등록합니다.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {/* 전문가 역할 */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    전문가 역할 <span className="text-rose-500">*</span>
                  </label>

                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />

                    <input
                      type="text"
                      value={expertRole}
                      onChange={(e) => setExpertRole(e.target.value)}
                      placeholder="예: Senior MSA Consultant"
                      className={iconInputClass}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* 전문가 경력 */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    경력 <span className="text-rose-500">*</span>
                  </label>

                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />

                    <input
                      type="number"
                      min={0}
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      placeholder="15"
                      className={`${iconInputClass} pr-12`}
                      required
                      disabled={isSubmitting}
                    />

                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      년
                    </span>
                  </div>
                </div>

                {/* 전문가 전문 분야 */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    전문 분야 <span className="text-rose-500">*</span>
                  </label>

                  <div className="relative">
                    <Tags className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />

                    <input
                      type="text"
                      value={specialties}
                      onChange={(e) => setSpecialties(e.target.value)}
                      placeholder="예: DDD, Data Ownership, Transaction"
                      className={iconInputClass}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <p className="text-[11px] font-medium text-slate-400">
                    여러 분야는 쉼표(,)로 구분합니다.
                  </p>
                </div>
              </div>
            </section>

            <div className="border-t border-slate-200" />

            {/* Mission Seed 문서 */}
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  참고 문서 / Seed 문서{" "}
                  <span className="text-rose-500">*</span>
                </h2>

                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  전문가 답변과 비교할 Baseline Evidence 문서를 업로드합니다.
                </p>
              </div>

              {/* 실제 파일 선택 input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={handleFileChange}
                disabled={isSubmitting}
              />

              {/* 문서 선택 버튼 */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="group flex min-h-[80px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-3 transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 transition group-hover:-translate-y-0.5">
                  <UploadCloud className="h-5 w-5" />
                </div>

                <span className="text-sm font-extrabold text-slate-800">
                  문서 업로드
                </span>

                <span className="mt-0.5 text-[11px] font-medium text-slate-500">
                  PDF, DOCX, TXT, MD
                </span>
              </button>

              {/* 선택한 Seed 문서 목록 */}
              {files.length > 0 && (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                        <FileText className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {file.name}
                        </p>

                        <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>

                      {/* 선택한 문서 삭제 */}
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        disabled={isSubmitting}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`${file.name} 삭제`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* API 처리 결과 */}
            {submitError && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
                {submitError}
              </p>
            )}

            {submitMessage && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                {submitMessage}
              </p>
            )}

            {/* 하단 액션 */}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="h-11 min-w-[110px] rounded-xl border border-slate-300 bg-white px-6 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                취소
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-11 min-w-[150px] rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {isSubmitting ? "생성 중..." : "미션 생성 →"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}