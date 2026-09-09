"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock3,
  FileText,
  Loader2,
  Network,
  RotateCcw,
  Tags,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";

import { missionMock } from "@/mocks/missionMock";

import {
  createMission,
  getMissions,
  uploadMissionDocument,
  type MissionResponse,
} from "@/services/mission";

import {
  createExpert,
  createInterview,
  getMissionInterviews,
} from "@/services/interview";

export default function MissionPage() {
  const router = useRouter();

  // Seed 문서 업로드 input 제어
  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  // ============================================================
  // 기존 Mission 목록
  // ============================================================

  const [missions, setMissions] =
    useState<MissionResponse[]>([]);

  const [
    missionsLoading,
    setMissionsLoading,
  ] = useState(true);

  const [
    missionsError,
    setMissionsError,
  ] = useState("");

  // 어떤 Mission의 Interview를 조회 중인지 저장
  const [
    openingMissionId,
    setOpeningMissionId,
  ] = useState<string | null>(null);

  // ============================================================
  // 신규 Mission 입력
  // ============================================================

  const [missionName, setMissionName] =
    useState("");

  const [domain, setDomain] =
    useState("");

  const [objective, setObjective] =
    useState("");

  // Expert 사용자 입력 정보
  const [expertName, setExpertName] =
    useState("");

  const [
    organization,
    setOrganization,
  ] = useState("");

  const [expertRole, setExpertRole] =
    useState("");

  const [experience, setExperience] =
    useState("");

  const [specialties, setSpecialties] =
    useState("");

  // 업로드할 Seed 문서 목록
  const [files, setFiles] =
    useState<File[]>([]);

  // API 처리 상태
  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    submitError,
    setSubmitError,
  ] = useState("");

  const [
    submitMessage,
    setSubmitMessage,
  ] = useState("");

  // ============================================================
  // 기존 Mission 목록 조회
  // ============================================================

  const fetchMissions = async () => {
    try {
      setMissionsLoading(true);
      setMissionsError("");

      const data =
        await getMissions();

      setMissions(data.missions);
    } catch (error) {
      console.error(
        "MISSION LIST FETCH ERROR:",
        error
      );

      setMissionsError(
        error instanceof Error
          ? error.message
          : "Mission 목록을 불러오는 중 오류가 발생했습니다."
      );
    } finally {
      setMissionsLoading(false);
    }
  };

  useEffect(() => {
    fetchMissions();
  }, []);

  // ============================================================
  // Mission 재진입
  //
  // 우선순위:
  // 1. IN_PROGRESS
  // 2. CREATED
  // 3. 가장 최근 COMPLETED
  //
  // CANCELLED는 재진입 대상에서 제외
  // ============================================================

  const handleOpenMission = async (
    mission: MissionResponse
  ) => {
    if (openingMissionId) {
      return;
    }

    try {
      setOpeningMissionId(
        mission.mission_id
      );

      setMissionsError("");

      const data =
        await getMissionInterviews(
          mission.mission_id
        );

      const sortedInterviews = [
        ...data.interviews,
      ].sort(
        (a, b) =>
          new Date(
            b.created_at
          ).getTime() -
          new Date(
            a.created_at
          ).getTime()
      );

      const selectedInterview =
        sortedInterviews.find(
          (interview) =>
            interview.status ===
            "IN_PROGRESS"
        ) ??
        sortedInterviews.find(
          (interview) =>
            interview.status ===
            "CREATED"
        ) ??
        sortedInterviews.find(
          (interview) =>
            interview.status ===
            "COMPLETED"
        ) ??
        null;

      if (!selectedInterview) {
        setMissionsError(
          `"${mission.title}" 미션에 재진입할 수 있는 Interview가 없습니다.`
        );

        return;
      }

      router.push(
        `/interview?missionId=${encodeURIComponent(
          mission.mission_id
        )}&interviewId=${encodeURIComponent(
          selectedInterview.interview_id
        )}&interviewStatus=${encodeURIComponent(
          selectedInterview.status
        )}`
      );
    } catch (error) {
      console.error(
        "MISSION INTERVIEW OPEN ERROR:",
        error
      );

      setMissionsError(
        error instanceof Error
          ? error.message
          : "Mission의 Interview를 불러오는 중 오류가 발생했습니다."
      );
    } finally {
      setOpeningMissionId(null);
    }
  };

  // ============================================================
  // Knowledge DNA 이동
  //
  // 선택한 Mission ID를 QueryString으로 DNA 화면에 전달
  // 예: /dna?missionId=...
  // ============================================================

  const handleOpenDna = (
    missionId: string
  ) => {
    router.push(
      `/dna?missionId=${encodeURIComponent(
        missionId
      )}`
    );
  };

  // ============================================================
  // 파일
  // ============================================================

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFiles =
      Array.from(
        event.target.files ?? []
      );

    if (
      selectedFiles.length === 0
    ) {
      return;
    }

    setFiles((prev) => [
      ...prev,
      ...selectedFiles,
    ]);

    event.target.value = "";
  };

  const handleRemoveFile = (
    index: number
  ) => {
    setFiles((prev) =>
      prev.filter(
        (_, i) => i !== index
      )
    );
  };

  // ============================================================
  // 신규 Mission 입력 초기화
  // ============================================================

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

    setSubmitError("");
    setSubmitMessage("");
  };

  // ============================================================
  // Mission 생성
  //
  // Mission 생성
  // → Seed 문서 업로드
  // → Expert 등록
  // → Interview 생성
  // → Interview 화면 이동
  // ============================================================

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (files.length === 0) {
      setSubmitError(
        "Seed 문서를 1개 이상 선택해주세요."
      );

      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    setSubmitMessage("");

    const missionPayload = {
      title: missionName,
      domain,
      objective,
    };

    const expertPayload = {
      name: expertName,
      organization,
      role: expertRole,

      metadata: {
        experience_years:
          Number(experience),

        specialties:
          specialties
            .split(",")
            .map((item) =>
              item.trim()
            )
            .filter(Boolean),
      },
    };

    try {
      // 1. Mission 생성
      const createdMission =
        await createMission(
          missionPayload
        );

      const missionId =
        createdMission.mission_id;

      // 2. Seed 문서 업로드
      for (const file of files) {
        await uploadMissionDocument(
          missionId,
          file
        );
      }

      // 3. Expert 등록
      const createdExpert =
        await createExpert(
          expertPayload
        );

      const expertId =
        createdExpert.expert_id;

      // 4. Interview 생성
      const createdInterview =
        await createInterview(
          missionId,
          {
            expert_id: expertId,

            title:
              `${createdMission.title} - ` +
              `${createdExpert.name} 인터뷰`,
          }
        );

      const interviewId =
        createdInterview.interview_id;

      console.log(
        "MISSION ID:",
        missionId
      );

      console.log(
        "EXPERT ID:",
        expertId
      );

      console.log(
        "INTERVIEW ID:",
        interviewId
      );

      setSubmitMessage(
        "미션, 전문가 및 인터뷰 생성이 완료되었습니다."
      );

      // 신규 생성된 Mission도 CREATED 상태 Interview이므로
      // status까지 함께 전달
      router.push(
        `/interview?missionId=${encodeURIComponent(
          missionId
        )}&interviewId=${encodeURIComponent(
          interviewId
        )}&interviewStatus=${encodeURIComponent(
          createdInterview.status
        )}`
      );
    } catch (error) {
      console.error(
        "MISSION CREATE ERROR:",
        error
      );

      setSubmitError(
        error instanceof Error
          ? error.message
          : "미션 생성 중 오류가 발생했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================
  // 표시용 함수
  // ============================================================

  const formatMissionDate = (
    createdAt: string
  ) => {
    const date =
      new Date(createdAt);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    return date.toLocaleDateString(
      "ko-KR",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    );
  };

  const getMissionStatusLabel = (
    status: string
  ) => {
    switch (status) {
      case "CREATED":
        return "생성됨";

      case "IN_PROGRESS":
        return "진행 중";

      case "COMPLETED":
        return "완료";

      case "CANCELLED":
        return "취소";

      default:
        return status;
    }
  };

  // ============================================================
  // 공통 스타일
  // ============================================================

  const inputClass =
    "h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

  const iconInputClass =
    "h-11 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

  const labelClass =
    "text-sm font-bold text-slate-800";

  return (
    <div>
      <div className="mx-auto max-w-[1180px] space-y-4 pb-3">
        {/* 화면 설명 */}
        <section className="px-1">
          <p className="text-sm font-medium text-slate-500">
            전문가의 경험을
            체계적으로 수집하기 위한
            미션을 설정하세요.
          </p>
        </section>

        {/* ====================================================
            기존 Mission 목록
        ==================================================== */}

        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                기존 미션
              </h2>

              <p className="mt-1 text-xs font-medium text-slate-500">
                이전에 생성한 미션의
                인터뷰 또는 Knowledge
                DNA를 확인할 수
                있습니다.
              </p>
            </div>

            <button
              type="button"
              onClick={
                fetchMissions
              }
              disabled={
                missionsLoading ||
                Boolean(
                  openingMissionId
                )
              }
              className="flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw
                className={`h-4 w-4 ${
                  missionsLoading
                    ? "animate-spin"
                    : ""
                }`}
              />

              새로고침
            </button>
          </div>

          {missionsError && (
            <div className="border-b border-rose-100 bg-rose-50 px-5 py-3">
              <p className="text-sm font-semibold text-rose-600">
                {missionsError}
              </p>
            </div>
          )}

          {missionsLoading ? (
            <div className="flex min-h-[150px] items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />

              <p className="text-sm font-semibold text-slate-400">
                Mission 목록을
                불러오는 중입니다.
              </p>
            </div>
          ) : missions.length ===
            0 ? (
            <div className="flex min-h-[150px] items-center justify-center">
              <div className="text-center">
                <BriefcaseBusiness className="mx-auto h-7 w-7 text-slate-300" />

                <p className="mt-2 text-sm font-bold text-slate-500">
                  생성된 Mission이
                  없습니다.
                </p>

                <p className="mt-1 text-xs font-medium text-slate-400">
                  아래에서 새로운
                  Mission을
                  생성해주세요.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {missions.map(
                (mission) => {
                  const isOpening =
                    openingMissionId ===
                    mission.mission_id;

                  return (
                    <div
                      key={
                        mission.mission_id
                      }
                      className="group flex min-h-[170px] flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          <BriefcaseBusiness className="h-5 w-5" />
                        </div>

                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
                          {getMissionStatusLabel(
                            mission.status
                          )}
                        </span>
                      </div>

                      <h3 className="mt-3 line-clamp-2 text-sm font-black leading-5 text-slate-900">
                        {
                          mission.title
                        }
                      </h3>

                      <p className="mt-1 text-xs font-semibold text-blue-600">
                        {
                          mission.domain
                        }
                      </p>

                      {mission.objective && (
                        <p className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-slate-500">
                          {
                            mission.objective
                          }
                        </p>
                      )}

                      <div className="mt-auto pt-4">
                        <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                          <Clock3 className="h-3.5 w-3.5" />

                          {formatMissionDate(
                            mission.created_at
                          )}
                        </div>

                        {/* Mission별 이동 버튼 */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenMission(
                                mission
                              )
                            }
                            disabled={Boolean(
                              openingMissionId
                            )}
                            className="flex h-9 items-center justify-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-600 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isOpening ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                조회 중
                              </>
                            ) : (
                              <>
                                인터뷰
                                <ArrowRight className="h-4 w-4" />
                              </>
                            )}
                          </button>

                          {/* 선택 Mission ID를 DNA 화면으로 전달 */}
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenDna(
                                mission.mission_id
                              )
                            }
                            disabled={Boolean(
                              openingMissionId
                            )}
                            className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 text-xs font-black text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Network className="h-4 w-4" />
                            Knowledge DNA
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* ====================================================
            신규 Mission 생성
        ==================================================== */}

        <section className="px-1 pt-2">
          <h2 className="text-base font-extrabold text-slate-900">
            새 미션 생성
          </h2>

          <p className="mt-1 text-xs font-medium text-slate-500">
            새로운 전문가 인터뷰를
            시작하기 위한 Mission을
            생성합니다.
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
              <label
                className={
                  labelClass
                }
              >
                미션 이름{" "}
                <span className="text-rose-500">
                  *
                </span>
              </label>

              <input
                type="text"
                value={missionName}
                onChange={(e) =>
                  setMissionName(
                    e.target.value
                  )
                }
                maxLength={100}
                placeholder="예: MSA 서비스 분리 판단 노하우"
                className={
                  inputClass
                }
                required
                disabled={
                  isSubmitting
                }
              />

              <div className="flex justify-end">
                <span className="text-[11px] font-semibold text-slate-500">
                  {
                    missionName.length
                  }
                  /100
                </span>
              </div>
            </div>

            {/* Mission 도메인 */}
            <div className="space-y-1.5">
              <label
                className={
                  labelClass
                }
              >
                도메인{" "}
                <span className="text-rose-500">
                  *
                </span>
              </label>

              <div className="relative">
                <BriefcaseBusiness className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />

                <select
                  value={domain}
                  onChange={(e) =>
                    setDomain(
                      e.target.value
                    )
                  }
                  className={`${iconInputClass} appearance-none`}
                  required
                  disabled={
                    isSubmitting
                  }
                >
                  <option value="">
                    도메인을
                    선택하세요
                  </option>

                  {missionMock.domains.map(
                    (
                      domainItem
                    ) => (
                      <option
                        key={
                          domainItem
                        }
                        value={
                          domainItem
                        }
                      >
                        {
                          domainItem
                        }
                      </option>
                    )
                  )}
                </select>

                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            {/* Mission 목표 */}
            <div className="space-y-1.5">
              <label
                className={
                  labelClass
                }
              >
                목표{" "}
                <span className="text-rose-500">
                  *
                </span>
              </label>

              <textarea
                value={objective}
                onChange={(e) =>
                  setObjective(
                    e.target.value
                  )
                }
                maxLength={200}
                placeholder="예: MSA 환경에서 서비스 분리 판단 기준과 예외 규칙을 추출"
                className="min-h-[82px] w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                required
                disabled={
                  isSubmitting
                }
              />

              <div className="flex justify-end">
                <span className="text-[11px] font-semibold text-slate-500">
                  {
                    objective.length
                  }
                  /200
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
                  인터뷰와 Knowledge
                  Validation에 사용할
                  전문가 정보를
                  등록합니다.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* 전문가 이름 */}
                <div className="space-y-1.5">
                  <label
                    className={
                      labelClass
                    }
                  >
                    전문가 이름{" "}
                    <span className="text-rose-500">
                      *
                    </span>
                  </label>

                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />

                    <input
                      type="text"
                      value={
                        expertName
                      }
                      onChange={(
                        e
                      ) =>
                        setExpertName(
                          e.target
                            .value
                        )
                      }
                      placeholder="예: 홍길동"
                      className={
                        iconInputClass
                      }
                      required
                      disabled={
                        isSubmitting
                      }
                    />
                  </div>
                </div>

                {/* 전문가 소속 */}
                <div className="space-y-1.5">
                  <label
                    className={
                      labelClass
                    }
                  >
                    소속{" "}
                    <span className="text-rose-500">
                      *
                    </span>
                  </label>

                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />

                    <input
                      type="text"
                      value={
                        organization
                      }
                      onChange={(
                        e
                      ) =>
                        setOrganization(
                          e.target
                            .value
                        )
                      }
                      placeholder="예: Platform Engineering Team"
                      className={
                        iconInputClass
                      }
                      required
                      disabled={
                        isSubmitting
                      }
                    />
                  </div>
                </div>

                {/* 전문가 역할 */}
                <div className="space-y-1.5">
                  <label
                    className={
                      labelClass
                    }
                  >
                    전문가 역할{" "}
                    <span className="text-rose-500">
                      *
                    </span>
                  </label>

                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />

                    <input
                      type="text"
                      value={
                        expertRole
                      }
                      onChange={(
                        e
                      ) =>
                        setExpertRole(
                          e.target
                            .value
                        )
                      }
                      placeholder="예: Senior MSA Consultant"
                      className={
                        iconInputClass
                      }
                      required
                      disabled={
                        isSubmitting
                      }
                    />
                  </div>
                </div>

                {/* 전문가 경력 */}
                <div className="space-y-1.5">
                  <label
                    className={
                      labelClass
                    }
                  >
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
                      value={
                        experience
                      }
                      onChange={(
                        e
                      ) =>
                        setExperience(
                          e.target
                            .value
                        )
                      }
                      placeholder="15"
                      className={`${iconInputClass} pr-12`}
                      required
                      disabled={
                        isSubmitting
                      }
                    />

                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      년
                    </span>
                  </div>
                </div>

                {/* 전문가 전문 분야 */}
                <div className="space-y-1.5 md:col-span-2">
                  <label
                    className={
                      labelClass
                    }
                  >
                    전문 분야{" "}
                    <span className="text-rose-500">
                      *
                    </span>
                  </label>

                  <div className="relative">
                    <Tags className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />

                    <input
                      type="text"
                      value={
                        specialties
                      }
                      onChange={(
                        e
                      ) =>
                        setSpecialties(
                          e.target
                            .value
                        )
                      }
                      placeholder="예: DDD, Data Ownership, Transaction"
                      className={
                        iconInputClass
                      }
                      required
                      disabled={
                        isSubmitting
                      }
                    />
                  </div>

                  <p className="text-[11px] font-medium text-slate-400">
                    여러 분야는
                    쉼표(,)로
                    구분합니다.
                  </p>
                </div>
              </div>
            </section>

            <div className="border-t border-slate-200" />

            {/* Mission Seed 문서 */}
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  참고 문서 /
                  Seed 문서{" "}
                  <span className="text-rose-500">
                    *
                  </span>
                </h2>

                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  전문가 답변과
                  비교할 Baseline
                  Evidence 문서를
                  업로드합니다.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={
                  handleFileChange
                }
                disabled={
                  isSubmitting
                }
              />

              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                disabled={
                  isSubmitting
                }
                className="group flex min-h-[80px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-3 transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 transition group-hover:-translate-y-0.5">
                  <UploadCloud className="h-5 w-5" />
                </div>

                <span className="text-sm font-extrabold text-slate-800">
                  문서 업로드
                </span>

                <span className="mt-0.5 text-[11px] font-medium text-slate-500">
                  PDF, DOCX, TXT,
                  MD
                </span>
              </button>

              {files.length > 0 && (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {files.map(
                    (
                      file,
                      index
                    ) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                          <FileText className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-800">
                            {
                              file.name
                            }
                          </p>

                          <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                            {(
                              file.size /
                              1024 /
                              1024
                            ).toFixed(
                              2
                            )}{" "}
                            MB
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveFile(
                              index
                            )
                          }
                          disabled={
                            isSubmitting
                          }
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`${file.name} 삭제`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  )}
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
      </div>
    </div>
  );
}