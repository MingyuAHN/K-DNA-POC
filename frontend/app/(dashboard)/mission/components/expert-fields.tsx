"use client";

import {
  Building2,
  CalendarDays,
  Tags,
  UserRound,
} from "lucide-react";

import {
  iconInputClass,
  labelClass,
} from "../utils";

type ExpertFieldsProps = {
  expertName: string;
  organization: string;
  expertRole: string;
  experience: string;
  specialties: string;

  disabled: boolean;

  onExpertNameChange: (
    value: string
  ) => void;

  onOrganizationChange: (
    value: string
  ) => void;

  onExpertRoleChange: (
    value: string
  ) => void;

  onExperienceChange: (
    value: string
  ) => void;

  onSpecialtiesChange: (
    value: string
  ) => void;
};

export default function ExpertFields({
  expertName,
  organization,
  expertRole,
  experience,
  specialties,
  disabled,
  onExpertNameChange,
  onOrganizationChange,
  onExpertRoleChange,
  onExperienceChange,
  onSpecialtiesChange,
}: ExpertFieldsProps) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-extrabold text-slate-900">
          전문가 정보
        </h2>

        <p className="mt-0.5 text-xs font-medium text-slate-500">
          인터뷰와 Knowledge Validation에 사용할 전문가 정보를 등록합니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* 이름 */}
        <div className="space-y-1.5">
          <label className={labelClass}>
            전문가 이름{" "}
            <span className="text-rose-500">
              *
            </span>
          </label>

          <div className="relative">
            <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />

            <input
              type="text"
              value={expertName}
              onChange={(event) =>
                onExpertNameChange(
                  event.target.value
                )
              }
              placeholder="예: 홍길동"
              className={iconInputClass}
              required
              disabled={disabled}
            />
          </div>
        </div>

        {/* 소속 */}
        <div className="space-y-1.5">
          <label className={labelClass}>
            소속{" "}
            <span className="text-rose-500">
              *
            </span>
          </label>

          <div className="relative">
            <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />

            <input
              type="text"
              value={organization}
              onChange={(event) =>
                onOrganizationChange(
                  event.target.value
                )
              }
              placeholder="예: Platform Engineering Team"
              className={iconInputClass}
              required
              disabled={disabled}
            />
          </div>
        </div>

        {/* 역할 */}
        <div className="space-y-1.5">
          <label className={labelClass}>
            전문가 역할{" "}
            <span className="text-rose-500">
              *
            </span>
          </label>

          <div className="relative">
            <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />

            <input
              type="text"
              value={expertRole}
              onChange={(event) =>
                onExpertRoleChange(
                  event.target.value
                )
              }
              placeholder="예: Senior MSA Consultant"
              className={iconInputClass}
              required
              disabled={disabled}
            />
          </div>
        </div>

        {/* 경력 */}
        <div className="space-y-1.5">
          <label className={labelClass}>
            경력{" "}
            <span className="text-rose-500">
              *
            </span>
          </label>

          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />

            <input
              type="number"
              min={0}
              value={experience}
              onChange={(event) =>
                onExperienceChange(
                  event.target.value
                )
              }
              placeholder="15"
              className={`${iconInputClass} pr-12`}
              required
              disabled={disabled}
            />

            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
              년
            </span>
          </div>
        </div>

        {/* 전문 분야 */}
        <div className="space-y-1.5 md:col-span-2">
          <label className={labelClass}>
            전문 분야{" "}
            <span className="text-rose-500">
              *
            </span>
          </label>

          <div className="relative">
            <Tags className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />

            <input
              type="text"
              value={specialties}
              onChange={(event) =>
                onSpecialtiesChange(
                  event.target.value
                )
              }
              placeholder="예: DDD, Data Ownership, Transaction"
              className={iconInputClass}
              required
              disabled={disabled}
            />
          </div>

          <p className="text-[11px] font-medium text-slate-400">
            여러 분야는 쉼표(,)로 구분합니다.
          </p>
        </div>
      </div>
    </section>
  );
}