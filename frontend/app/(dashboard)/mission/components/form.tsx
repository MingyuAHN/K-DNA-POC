"use client";

import {
  useState,
  type FormEvent,
} from "react";

import {
  BriefcaseBusiness,
  ChevronDown,
} from "lucide-react";

import { missionMock } from "@/mocks/missionMock";

import ExpertFields from "./expert-fields";
import SeedUpload from "./seed-upload";

import {
  iconInputClass,
  inputClass,
  labelClass,
} from "../utils";

export type MissionFormValues = {
  missionName: string;
  domain: string;
  objective: string;

  expertName: string;
  organization: string;
  expertRole: string;
  experience: string;
  specialties: string;

  files: File[];
};

type MissionFormProps = {
  isSubmitting: boolean;
  errorMessage: string;
  successMessage: string;

  onSubmit: (
    values: MissionFormValues
  ) => void;

  onCancel: () => void;
};

export default function MissionForm({
  isSubmitting,
  errorMessage,
  successMessage,
  onSubmit,
  onCancel,
}: MissionFormProps) {
  const [
    missionName,
    setMissionName,
  ] = useState("");

  const [
    domain,
    setDomain,
  ] = useState("");

  const [
    objective,
    setObjective,
  ] = useState("");

  const [
    expertName,
    setExpertName,
  ] = useState("");

  const [
    organization,
    setOrganization,
  ] = useState("");

  const [
    expertRole,
    setExpertRole,
  ] = useState("");

  const [
    experience,
    setExperience,
  ] = useState("");

  const [
    specialties,
    setSpecialties,
  ] = useState("");

  const [
    files,
    setFiles,
  ] = useState<File[]>([]);

  const [
    localError,
    setLocalError,
  ] = useState("");

  const handleSubmit = (
    event: FormEvent
  ) => {
    event.preventDefault();

    if (files.length === 0) {
      setLocalError(
        "Seed 문서를 1개 이상 선택해주세요."
      );

      return;
    }

    setLocalError("");

    onSubmit({
      missionName,
      domain,
      objective,
      expertName,
      organization,
      expertRole,
      experience,
      specialties,
      files,
    });
  };

  const handleRemoveFile = (
    index: number
  ) => {
    setFiles((current) =>
      current.filter(
        (_, fileIndex) =>
          fileIndex !== index
      )
    );
  };

  const handleCancel = () => {
    setMissionName("");
    setDomain("");
    setObjective("");

    setExpertName("");
    setOrganization("");
    setExpertRole("");
    setExperience("");
    setSpecialties("");

    setFiles([]);
    setLocalError("");

    onCancel();
  };

  return (
    <>
      {/* 제목 */}
      <section className="px-1 pt-2">
        <h2 className="text-base font-extrabold text-slate-900">
          새 미션 생성
        </h2>

        <p className="mt-1 text-xs font-medium text-slate-500">
          새로운 전문가 인터뷰를 시작하기 위한 Mission을 생성합니다.
        </p>
      </section>

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
              미션 이름{" "}
              <span className="text-rose-500">
                *
              </span>
            </label>

            <input
              type="text"
              value={missionName}
              onChange={(event) =>
                setMissionName(
                  event.target.value
                )
              }
              maxLength={100}
              placeholder="예: MSA 서비스 분리 판단 노하우"
              className={inputClass}
              required
              disabled={isSubmitting}
            />

            <div className="flex justify-end">
              <span className="text-[11px] font-semibold text-slate-500">
                {missionName.length}
                /100
              </span>
            </div>
          </div>

          {/* 도메인 */}
          <div className="space-y-1.5">
            <label className={labelClass}>
              도메인{" "}
              <span className="text-rose-500">
                *
              </span>
            </label>

            <div className="relative">
              <BriefcaseBusiness className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />

              <select
                value={domain}
                onChange={(event) =>
                  setDomain(
                    event.target.value
                  )
                }
                className={`${iconInputClass} appearance-none`}
                required
                disabled={isSubmitting}
              >
                <option value="">
                  도메인을 선택하세요
                </option>

                {missionMock.domains.map(
                  (domainItem) => (
                    <option
                      key={domainItem}
                      value={domainItem}
                    >
                      {domainItem}
                    </option>
                  )
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          {/* 목표 */}
          <div className="space-y-1.5">
            <label className={labelClass}>
              목표{" "}
              <span className="text-rose-500">
                *
              </span>
            </label>

            <textarea
              value={objective}
              onChange={(event) =>
                setObjective(
                  event.target.value
                )
              }
              maxLength={200}
              placeholder="예: MSA 환경에서 서비스 분리 판단 기준과 예외 규칙을 추출"
              className="min-h-[82px] w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              required
              disabled={isSubmitting}
            />

            <div className="flex justify-end">
              <span className="text-[11px] font-semibold text-slate-500">
                {objective.length}
                /200
              </span>
            </div>
          </div>

          <div className="border-t border-slate-200" />

          {/* Expert */}
          <ExpertFields
            expertName={expertName}
            organization={organization}
            expertRole={expertRole}
            experience={experience}
            specialties={specialties}
            disabled={isSubmitting}
            onExpertNameChange={
              setExpertName
            }
            onOrganizationChange={
              setOrganization
            }
            onExpertRoleChange={
              setExpertRole
            }
            onExperienceChange={
              setExperience
            }
            onSpecialtiesChange={
              setSpecialties
            }
          />

          <div className="border-t border-slate-200" />

          {/* Seed 문서 */}
          <SeedUpload
            files={files}
            disabled={isSubmitting}
            onFilesChange={setFiles}
            onRemove={
              handleRemoveFile
            }
          />

          {/* 오류 */}
          {(localError ||
            errorMessage) && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
              {localError ||
                errorMessage}
            </p>
          )}

          {/* 성공 */}
          {successMessage && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {successMessage}
            </p>
          )}

          {/* 액션 */}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={
                handleCancel
              }
              disabled={
                isSubmitting
              }
              className="h-11 min-w-[110px] rounded-xl border border-slate-300 bg-white px-6 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              취소
            </button>

            <button
              type="submit"
              disabled={
                isSubmitting
              }
              className="h-11 min-w-[150px] rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {isSubmitting
                ? "생성 중..."
                : "미션 생성 →"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}