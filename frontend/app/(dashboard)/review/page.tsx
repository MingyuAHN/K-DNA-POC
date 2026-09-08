"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  CircleX,
  FileText,
  PencilLine,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { reviewMock } from "@/mocks/reviewMock";

type KnowledgeUnit = (typeof reviewMock.knowledgeUnits)[number];

type KnowledgeStatus = "CANDIDATE" | "VERIFIED" | "REJECTED";

const statusLabelMap: Record<KnowledgeStatus, string> = {
  CANDIDATE: "검토 대기",
  VERIFIED: "승인 완료",
  REJECTED: "거절",
};

const sourceTypeLabelMap: Record<string, string> = {
  ADR: "ADR",
  EXPERT: "전문가 인터뷰",
  GUIDELINE: "가이드라인",
  INCIDENT: "장애 사례",
};

export default function ReviewPage() {
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState(
    reviewMock.knowledgeUnits[0].id
  );

  const [knowledgeUnits, setKnowledgeUnits] = useState(
    reviewMock.knowledgeUnits
  );

  const selectedKnowledge = useMemo(
    () =>
      knowledgeUnits.find(
        (knowledge) => knowledge.id === selectedKnowledgeId
      ) ?? knowledgeUnits[0],
    [knowledgeUnits, selectedKnowledgeId]
  );

  const updateStatus = (
    knowledgeId: string,
    status: KnowledgeStatus
  ) => {
    setKnowledgeUnits((prev) =>
      prev.map((item) =>
        item.id === knowledgeId
          ? {
              ...item,
              status,
            }
          : item
      )
    );
  };

  const handleVerify = () => {
    updateStatus(selectedKnowledge.id, "VERIFIED");
  };

  const handleReject = () => {
    updateStatus(selectedKnowledge.id, "REJECTED");
  };

  const handleEdit = () => {
    alert(
      "수정 기능은 Validation API 연동 시 구현할 예정입니다."
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-3 text-slate-900 sm:p-4 lg:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        {/* 화면 제목 */}
        <header className="px-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Knowledge Review
          </h1>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            AI가 추출한 지식 후보를 검토하고 승인 여부를 결정합니다.
          </p>
        </header>

        {/* Mission */}
        <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="shrink-0">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                선택한 미션
              </p>
            </div>

            <div className="relative min-w-0 flex-1">
              <select
                value={reviewMock.mission.missionId}
                onChange={() => {}}
                className="h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 pr-10 text-sm font-bold text-slate-800 outline-none"
              >
                <option value={reviewMock.mission.missionId}>
                  {reviewMock.mission.title}
                </option>
              </select>

              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>
        </section>

        {/* Main */}
        <div className="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
          {/* 좌측 목록 */}
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-sm font-black text-slate-900">
                지식 후보 목록
              </h2>

              <p className="mt-1 text-[11px] font-semibold text-slate-400">
                Knowledge Unit Candidates
              </p>
            </div>

            <div className="space-y-3">
              {knowledgeUnits.map((knowledge) => {
                const isSelected =
                  knowledge.id === selectedKnowledgeId;

                const status =
                  knowledge.status as KnowledgeStatus;

                return (
                  <button
                    key={knowledge.id}
                    type="button"
                    onClick={() =>
                      setSelectedKnowledgeId(knowledge.id)
                    }
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? "border-blue-300 bg-blue-50 shadow-sm"
                        : "border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-[11px] font-black text-slate-400">
                        {knowledge.id}
                      </span>

                      <StatusBadge status={status} />
                    </div>

                    <p className="line-clamp-2 text-sm font-black leading-5 text-slate-900">
                      {knowledge.knowledge}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                        {knowledge.typeLabel}
                      </span>

                      <span className="text-[11px] font-black text-blue-600">
                        신뢰도 {knowledge.confidence}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 우측 상세 */}
          <section className="space-y-4">
            {/* 상단 정보 */}
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-500">
                    Selected Knowledge
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black text-slate-900">
                      {selectedKnowledge.typeLabel}
                    </h2>

                    <StatusBadge
                      status={
                        selectedKnowledge.status as KnowledgeStatus
                      }
                    />
                  </div>

                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {selectedKnowledge.id} ·{" "}
                    {selectedKnowledge.type}
                  </p>
                </div>

                <div className="rounded-2xl bg-blue-50 px-4 py-3 text-right">
                  <p className="text-[11px] font-bold text-slate-400">
                    AI Confidence
                  </p>

                  <p className="text-xl font-black text-blue-600">
                    {selectedKnowledge.confidence}%
                  </p>
                </div>
              </div>
            </div>

            {/* Knowledge */}
            <ContentCard
              title="추출 지식"
              subtitle="Knowledge"
              icon={Sparkles}
              content={selectedKnowledge.knowledge}
              highlight
            />

            {/* Context / Rule / Rationale / Exception */}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ContentCard
                title="적용 맥락"
                subtitle="Context"
                icon={FileText}
                content={selectedKnowledge.context}
            />

            <ContentCard
                title="판단 규칙"
                subtitle="Rule"
                icon={ShieldCheck}
                content={selectedKnowledge.rule}
            />

            <ContentCard
                title="판단 근거"
                subtitle="Rationale"
                icon={BookOpenCheck}
                content={selectedKnowledge.rationale}
            />

            <ContentCard
                title="예외 조건"
                subtitle="Exception"
                icon={CircleX}
                content={selectedKnowledge.exception}
            />
            </div>

            {/* Evidence */}
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-sm font-black text-slate-900">
                  근거
                </h3>

                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Evidence
                </p>
              </div>

              <div className="space-y-3">
                {selectedKnowledge.evidence.map((evidence) => (
                  <div
                    key={evidence.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-black text-blue-600">
                          {sourceTypeLabelMap[
                            evidence.sourceType
                          ] ?? evidence.sourceType}
                        </span>

                        <span className="text-xs font-black text-slate-800">
                          {evidence.title}
                        </span>
                      </div>

                      <span className="text-[10px] font-bold text-slate-400">
                        {evidence.id}
                      </span>
                    </div>

                    <p className="mt-3 text-xs font-semibold leading-6 text-slate-700">
                      {evidence.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 검토 액션 */}
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-sm font-black text-slate-900">
                  전문가 검토
                </h3>

                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Validation
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={handleVerify}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  정확합니다
                </button>

                <button
                  type="button"
                  onClick={handleEdit}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-600 transition hover:bg-blue-100"
                >
                  <PencilLine className="h-4 w-4" />
                  수정하기
                </button>

                <button
                  type="button"
                  onClick={handleReject}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-600 transition hover:bg-rose-100"
                >
                  <XCircle className="h-4 w-4" />
                  거절하기
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: KnowledgeStatus;
}) {
  const styleMap: Record<KnowledgeStatus, string> = {
    CANDIDATE: "bg-amber-100 text-amber-700",
    VERIFIED: "bg-emerald-100 text-emerald-700",
    REJECTED: "bg-rose-100 text-rose-600",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black ${styleMap[status]}`}
    >
      {statusLabelMap[status]}
    </span>
  );
}

function ContentCard({
  title,
  subtitle,
  icon: Icon,
  content,
  highlight = false,
}: {
  title: string;
  subtitle: string;
  icon: typeof Sparkles;
  content: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-[22px] border p-4 shadow-sm ${
        highlight
          ? "border-blue-100 bg-blue-50/50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="mb-3 flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            highlight
              ? "bg-blue-100 text-blue-600"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div>
          <p className="text-xs font-black text-slate-900">
            {title}
          </p>

          <p className="text-[10px] font-semibold text-slate-400">
            {subtitle}
          </p>
        </div>
      </div>

      <p className="text-xs font-semibold leading-6 text-slate-700">
        {content}
      </p>
    </div>
  );
}