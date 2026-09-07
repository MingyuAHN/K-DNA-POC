"use client";

import { useRef, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  FileText,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";

export default function MissionPage() {
  // Seed 문서 업로드 input 제어
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Mission 기본 정보
  const [missionName, setMissionName] = useState("");
  const [domain, setDomain] = useState("");
  const [project, setProject] = useState("");
  const [objective, setObjective] = useState("");

  // 전문가 정보
  const [expertName, setExpertName] = useState("");
  const [expertRole, setExpertRole] = useState("");
  const [experience, setExperience] = useState("");

  // 업로드할 Seed 문서 목록
  const [files, setFiles] = useState<File[]>([]);

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
    setProject("");
    setObjective("");
    setExpertName("");
    setExpertRole("");
    setExperience("");
    setFiles([]);
  };

  // 미션 생성 버튼: 추후 Mission 생성 API 연동 위치
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    // Mission API에 전달할 화면 입력값
    const payload = {
      missionName,
      domain,
      project,
      objective,
      expertName,
      expertRole,
      experience,
      files,
    };

    console.log("MISSION PAYLOAD:", payload);

    // TODO: 민규 API 스펙 확정 후 연결
    // 1. Mission 생성 API 호출
    // 2. 생성된 mission_id 응답 수신
    // 3. mission_id 기준으로 Seed 문서 업로드
  };

  // 일반 입력창 공통 스타일
  const inputClass =
    "h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

  // 아이콘이 포함된 입력창 공통 스타일
  const iconInputClass =
    "h-12 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

  const labelClass = "text-sm font-bold text-slate-800";

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[1180px] space-y-5 pb-8">
        {/* 화면 설명 */}
        <section className="px-1 pt-1">
          <p className="text-sm font-medium text-slate-500">
            전문가의 경험을 체계적으로 수집하기 위한 미션을 설정하세요.
          </p>
        </section>

        {/* Mission 전체 입력 폼 */}
        <form
          onSubmit={handleSubmit}
          className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />

          <div className="pointer-events-none absolute -right-28 -top-28 h-64 w-64 rounded-full bg-blue-100/50 blur-3xl" />

          <div className="relative space-y-6">
            {/* Mission 이름 입력 */}
            <div className="space-y-2">
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
              />

              <div className="flex justify-end">
                <span className="text-[11px] font-semibold text-slate-500">
                  {missionName.length}/100
                </span>
              </div>
            </div>

            {/* Mission 도메인 / 프로젝트 선택 */}
            <div className="grid gap-5 md:grid-cols-2">
              {/* 도메인 */}
              <div className="space-y-2">
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
                  >
                    <option value="">도메인을 선택하세요</option>
                    <option value="MSA Architecture">
                      MSA Architecture
                    </option>
                    <option value="Application Architecture">
                      Application Architecture
                    </option>
                    <option value="Enterprise Architecture">
                      Enterprise Architecture
                    </option>
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              {/* 프로젝트 */}
              <div className="space-y-2">
                <label className={labelClass}>
                  프로젝트 <span className="text-rose-500">*</span>
                </label>

                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />

                  <select
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    className={`${iconInputClass} appearance-none`}
                    required
                  >
                    <option value="">프로젝트를 선택하세요</option>
                    <option value="Project Alpha">Project Alpha</option>
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
            </div>

            {/* Mission 목표 입력 */}
            <div className="space-y-2">
              <label className={labelClass}>
                목표 <span className="text-rose-500">*</span>
              </label>

              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                maxLength={200}
                placeholder="예: MSA 환경에서 서비스 분리 판단 기준과 예외 규칙을 추출"
                className="min-h-[108px] w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                required
              />

              <div className="flex justify-end">
                <span className="text-[11px] font-semibold text-slate-500">
                  {objective.length}/200
                </span>
              </div>
            </div>

            <div className="border-t border-slate-200" />

            {/* Mission에 연결할 전문가 정보 */}
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  전문가 정보
                </h2>

                <p className="mt-1 text-xs font-medium text-slate-500">
                  인터뷰와 Knowledge Validation의 출처 정보로 사용됩니다.
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                {/* 전문가 이름 */}
                <div className="space-y-2">
                  <label className={labelClass}>
                    전문가 이름 <span className="text-rose-500">*</span>
                  </label>

                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />

                    <input
                      type="text"
                      value={expertName}
                      onChange={(e) => setExpertName(e.target.value)}
                      placeholder="예: 이수빈"
                      className={iconInputClass}
                      required
                    />
                  </div>
                </div>

                {/* 전문가 역할 */}
                <div className="space-y-2">
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
                    />
                  </div>
                </div>

                {/* 전문가 경력 */}
                <div className="space-y-2">
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
                      placeholder="18"
                      className={`${iconInputClass} pr-12`}
                      required
                    />

                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      년
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <div className="border-t border-slate-200" />

            {/* Mission에 연결할 Seed 문서 */}
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  참고 문서 / Seed 문서{" "}
                  <span className="text-rose-500">*</span>
                </h2>

                <p className="mt-1 text-xs font-medium text-slate-500">
                  전문가 답변과 비교할 Baseline Evidence 문서를 업로드합니다.
                </p>
              </div>

              {/* 실제 파일 선택 input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.md"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* 문서 업로드 버튼 */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group flex min-h-[104px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-5 transition hover:border-blue-400 hover:bg-blue-50"
              >
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 transition group-hover:-translate-y-0.5">
                  <UploadCloud className="h-5 w-5" />
                </div>

                <span className="text-sm font-extrabold text-slate-800">
                  문서 업로드
                </span>

                <span className="mt-1 text-[11px] font-medium text-slate-500">
                  PDF, DOC, DOCX, TXT, MD
                </span>
              </button>

              {/* 선택한 Seed 문서 목록 */}
              {files.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                        <FileText className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {file.name}
                        </p>

                        <p className="mt-1 text-[11px] font-medium text-slate-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>

                      {/* 선택한 문서 삭제 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                        aria-label={`${file.name} 삭제`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 하단 액션 버튼 */}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
              {/* 취소 버튼: 입력값 초기화 */}
              <button
                type="button"
                onClick={handleCancel}
                className="h-12 min-w-[110px] rounded-xl border border-slate-300 bg-white px-6 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
              >
                취소
              </button>

              {/* 미션 생성 버튼: Mission 생성 API 호출 */}
              <button
                type="submit"
                className="h-12 min-w-[150px] rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
              >
                미션 생성 →
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}