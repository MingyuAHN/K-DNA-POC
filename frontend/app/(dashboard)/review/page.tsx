"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import MissionSelector from "@/app/components/common/mission-selector";

import {
  getMissions,
  type MissionResponse,
} from "@/services/mission";

import {
  editKnowledgeCandidate,
  getMissionReviewCandidates,
  synthesizeKnowledgeCandidate,
  validateKnowledgeSynthesis,
  type KnowledgeCandidateEditRequest,
  type KnowledgeReviewCandidate,
} from "@/services/review";

import CandidateList from "./components/candidate-list";
import ReviewDetail from "./components/detail";

type ReviewAction =
  | "APPROVE"
  | "EDIT"
  | "REJECT"
  | null;

export default function ReviewPage() {
  // Mission
  const [
    missions,
    setMissions,
  ] = useState<MissionResponse[]>([]);

  const [
    selectedMissionId,
    setSelectedMissionId,
  ] = useState("");

  // Review Candidate
  const [
    candidates,
    setCandidates,
  ] = useState<KnowledgeReviewCandidate[]>([]);

  const [
    selectedCandidateId,
    setSelectedCandidateId,
  ] = useState("");

  // 화면 상태
  const [
    isMissionLoading,
    setIsMissionLoading,
  ] = useState(true);

  const [
    isReviewLoading,
    setIsReviewLoading,
  ] = useState(false);

  const [
    processingAction,
    setProcessingAction,
  ] = useState<ReviewAction>(null);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    infoMessage,
    setInfoMessage,
  ] = useState("");

  // Mission 조회
  useEffect(() => {
    let isMounted = true;

    const loadMissions = async () => {
      try {
        setIsMissionLoading(true);
        setErrorMessage("");

        const data = await getMissions();

        if (!isMounted) {
          return;
        }

        setMissions(data.missions);

        if (data.missions.length > 0) {
          setSelectedMissionId(
            (current) =>
              current ||
              data.missions[0].mission_id
          );
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Mission 목록 조회에 실패했습니다."
        );
      } finally {
        if (isMounted) {
          setIsMissionLoading(false);
        }
      }
    };

    void loadMissions();

    return () => {
      isMounted = false;
    };
  }, []);

  // Review Candidate 조회
  const loadReviewCandidates =
    useCallback(
      async (
        missionId: string,
        preferredCandidateId?: string
      ) => {
        if (!missionId) {
          setCandidates([]);
          setSelectedCandidateId("");
          return;
        }

        try {
          setIsReviewLoading(true);
          setErrorMessage("");

          const data =
            await getMissionReviewCandidates(
              missionId
            );

          setCandidates(data.candidates);

          const preferredCandidate =
            preferredCandidateId
              ? data.candidates.find(
                  (candidate) =>
                    candidate.candidate_id ===
                    preferredCandidateId
                )
              : null;

          setSelectedCandidateId(
            preferredCandidate?.candidate_id ??
              data.candidates[0]?.candidate_id ??
              ""
          );
        } catch (error) {
          setCandidates([]);
          setSelectedCandidateId("");

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Review Candidate 조회에 실패했습니다."
          );
        } finally {
          setIsReviewLoading(false);
        }
      },
      []
    );

  // Mission 변경
  useEffect(() => {
    if (!selectedMissionId) {
      setCandidates([]);
      setSelectedCandidateId("");
      return;
    }

    setInfoMessage("");

    void loadReviewCandidates(
      selectedMissionId
    );
  }, [
    selectedMissionId,
    loadReviewCandidates,
  ]);

  // 선택 Candidate
  const selectedCandidate =
    useMemo(() => {
      return (
        candidates.find(
          (candidate) =>
            candidate.candidate_id ===
            selectedCandidateId
        ) ??
        candidates[0] ??
        null
      );
    }, [
      candidates,
      selectedCandidateId,
    ]);

  // Synthesis 조회 또는 생성
  const getOrCreateSynthesisId =
    async (
      candidate: KnowledgeReviewCandidate
    ) => {
      if (
        candidate.synthesis_id &&
        candidate.synthesis_status ===
          "PENDING"
      ) {
        return candidate.synthesis_id;
      }

      const synthesis =
        await synthesizeKnowledgeCandidate(
          candidate.candidate_id
        );

      return synthesis.synthesis_id;
    };

  // 승인
  const handleApprove = async () => {
    if (
      !selectedCandidate ||
      processingAction
    ) {
      return;
    }

    try {
      setProcessingAction(
        "APPROVE"
      );

      setErrorMessage("");
      setInfoMessage("");

      const synthesisId =
        await getOrCreateSynthesisId(
          selectedCandidate
        );

      await validateKnowledgeSynthesis(
        synthesisId,
        {
          decision: "APPROVE",
          reason: "전문가 검토 승인",
          validated_by: "changtest",
        }
      );

      setInfoMessage(
        "지식 후보가 승인되었습니다."
      );

      await loadReviewCandidates(
        selectedMissionId
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Knowledge 승인에 실패했습니다."
      );
    } finally {
      setProcessingAction(null);
    }
  };

  // 수정
  const handleSaveEdit = async (
    payload: KnowledgeCandidateEditRequest
  ) => {
    if (
      !selectedCandidate ||
      processingAction
    ) {
      return;
    }

    const candidateId =
      selectedCandidate.candidate_id;

    try {
      setProcessingAction("EDIT");
      setErrorMessage("");
      setInfoMessage("");

      // Candidate 수정
      await editKnowledgeCandidate(
        candidateId,
        payload
      );

      // 수정 내용으로 재-Synthesis
      await synthesizeKnowledgeCandidate(
        candidateId
      );

      setInfoMessage(
        "지식 후보가 수정되었으며 Synthesis가 다시 생성되었습니다."
      );

      // 같은 Candidate 유지
      await loadReviewCandidates(
        selectedMissionId,
        candidateId
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Knowledge Candidate 수정에 실패했습니다."
      );
    } finally {
      setProcessingAction(null);
    }
  };

  // 거절
  const handleReject = async () => {
    if (
      !selectedCandidate ||
      processingAction
    ) {
      return;
    }

    try {
      setProcessingAction(
        "REJECT"
      );

      setErrorMessage("");
      setInfoMessage("");

      const synthesisId =
        await getOrCreateSynthesisId(
          selectedCandidate
        );

      await validateKnowledgeSynthesis(
        synthesisId,
        {
          decision: "REJECT",
          reason: "전문가 검토 거절",
          validated_by: "changtest",
        }
      );

      setInfoMessage(
        "지식 후보가 거절되었습니다."
      );

      await loadReviewCandidates(
        selectedMissionId
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Knowledge 거절에 실패했습니다."
      );
    } finally {
      setProcessingAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-3 text-slate-900 sm:p-4 lg:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        {/* 제목 */}
        <header className="px-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Knowledge Review
          </h1>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            AI가 추출한 지식 후보를 검토하고 승인 여부를 결정합니다.
          </p>
        </header>

        {/* Mission */}
        <MissionSelector
          missions={missions}
          selectedMissionId={
            selectedMissionId
          }
          onChange={
            setSelectedMissionId
          }
          loading={
            isMissionLoading
          }
        />

        {/* 오류 */}
        {errorMessage && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {errorMessage}
          </div>
        )}

        {/* 처리 결과 */}
        {infoMessage && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
            {infoMessage}
          </div>
        )}

        {/* Review */}
        <div className="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
          <CandidateList
            candidates={candidates}
            selectedCandidateId={
              selectedCandidateId
            }
            loading={
              isReviewLoading
            }
            onSelect={
              setSelectedCandidateId
            }
          />

          <ReviewDetail
            candidate={
              selectedCandidate
            }
            processingAction={
              processingAction
            }
            onApprove={
              handleApprove
            }
            onSaveEdit={
              handleSaveEdit
            }
            onReject={
              handleReject
            }
          />
        </div>
      </div>
    </div>
  );
}