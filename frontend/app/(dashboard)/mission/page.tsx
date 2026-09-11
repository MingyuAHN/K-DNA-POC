"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

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

import MissionList from "./components/list";

import MissionForm, {
  type MissionFormValues,
} from "./components/form";

export default function MissionPage() {
  const router = useRouter();

  // Mission 목록
  const [
    missions,
    setMissions,
  ] = useState<MissionResponse[]>([]);

  const [
    missionsLoading,
    setMissionsLoading,
  ] = useState(true);

  const [
    missionsError,
    setMissionsError,
  ] = useState("");

  const [
    openingMissionId,
    setOpeningMissionId,
  ] = useState<string | null>(null);

  // 생성 상태
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

  // Mission 조회
  const fetchMissions = async () => {
    try {
      setMissionsLoading(true);
      setMissionsError("");

      const data =
        await getMissions();

      setMissions(
        data.missions
      );
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
    void fetchMissions();
  }, []);

  // Mission 재진입
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

  // Knowledge DNA 이동
  const handleOpenDna = (
    missionId: string
  ) => {
    router.push(
      `/dna?missionId=${encodeURIComponent(
        missionId
      )}`
    );
  };

  // Mission 생성
  const handleSubmit = async (
    values: MissionFormValues
  ) => {
    setIsSubmitting(true);
    setSubmitError("");
    setSubmitMessage("");

    const missionPayload = {
      title: values.missionName,
      domain: values.domain,
      objective: values.objective,
    };

    const expertPayload = {
      name: values.expertName,
      organization:
        values.organization,
      role: values.expertRole,

      metadata: {
        experience_years:
          Number(
            values.experience
          ),

        specialties:
          values.specialties
            .split(",")
            .map((item) =>
              item.trim()
            )
            .filter(Boolean),
      },
    };

    try {
      // Mission 생성
      const createdMission =
        await createMission(
          missionPayload
        );

      const missionId =
        createdMission.mission_id;

      // Seed 문서 업로드
      for (
        const file of values.files
      ) {
        await uploadMissionDocument(
          missionId,
          file
        );
      }

      // Expert 등록
      const createdExpert =
        await createExpert(
          expertPayload
        );

      const expertId =
        createdExpert.expert_id;

      // Interview 생성
      const createdInterview =
        await createInterview(
          missionId,
          {
            expert_id:
              expertId,

            title:
              `${createdMission.title} - ` +
              `${createdExpert.name} 인터뷰`,
          }
        );

      setSubmitMessage(
        "미션, 전문가 및 인터뷰 생성이 완료되었습니다."
      );

      router.push(
        `/interview?missionId=${encodeURIComponent(
          missionId
        )}&interviewId=${encodeURIComponent(
          createdInterview.interview_id
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

  // 입력 초기화
  const handleCancel = () => {
    setSubmitError("");
    setSubmitMessage("");
  };

  return (
    <div>
      <div className="mx-auto max-w-[1180px] space-y-4 pb-3">
        {/* 화면 설명 */}
        <section className="px-1">
          <p className="text-sm font-medium text-slate-500">
            전문가의 경험을 체계적으로 수집하기 위한 미션을 설정하세요.
          </p>
        </section>

        {/* 기존 Mission */}
        <MissionList
          missions={missions}
          loading={
            missionsLoading
          }
          errorMessage={
            missionsError
          }
          openingMissionId={
            openingMissionId
          }
          onRefresh={() =>
            void fetchMissions()
          }
          onOpenMission={
            handleOpenMission
          }
          onOpenDna={
            handleOpenDna
          }
        />

        {/* 신규 Mission */}
        <MissionForm
          isSubmitting={
            isSubmitting
          }
          errorMessage={
            submitError
          }
          successMessage={
            submitMessage
          }
          onSubmit={
            handleSubmit
          }
          onCancel={
            handleCancel
          }
        />
      </div>
    </div>
  );
}