"use client";

import {
  BookOpenCheck,
  CheckCircle2,
  CircleX,
  FileText,
  PencilLine,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

import type { KnowledgeReviewCandidate } from "@/services/review";

import {
  formatConfidence,
  formatContext,
  formatDecisionRule,
  formatKnowledgeType,
  formatNullableText,
} from "../utils";

type ReviewAction =
  | "APPROVE"
  | "REJECT"
  | null;

type DetailProps = {
  candidate: KnowledgeReviewCandidate | null;

  processingAction: ReviewAction;

  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
};

export default function ReviewDetail({
  candidate,
  processingAction,
  onApprove,
  onEdit,
  onReject,
}: DetailProps) {
  if (!candidate) {
    return (
      <section className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-center">
          <p className="text-sm font-black text-slate-700">
            선택된 지식 후보가 없습니다.
          </p>

          <p className="mt-1 text-xs font-semibold text-slate-400">
            검토할 Candidate를 선택해 주세요.
          </p>
        </div>
      </section>
    );
  }

  const isProcessing =
    processingAction !== null;

  return (
    <section className="space-y-4">
      {/* 선택 Candidate */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-500">
              Selected Knowledge
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">
                {formatKnowledgeType(
                  candidate.knowledge_type
                )}
              </h2>

              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-700">
                검토 대기
              </span>
            </div>

            <p className="mt-2 break-all text-xs font-semibold text-slate-500">
              {candidate.candidate_id}
            </p>
          </div>

          <div className="shrink-0 rounded-2xl bg-blue-50 px-4 py-3 text-right">
            <p className="text-[11px] font-bold text-slate-400">
              AI Confidence
            </p>

            <p className="text-xl font-black text-blue-600">
              {formatConfidence(
                candidate.confidence_score
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 추출 지식 */}
      <ContentCard
        title="추출 지식"
        subtitle="Knowledge"
        icon={Sparkles}
        content={candidate.statement}
        highlight
      />

      {/* 구조화된 지식 */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ContentCard
          title="적용 맥락"
          subtitle="Context"
          icon={FileText}
          content={formatContext(
            candidate.context
          )}
        />

        <ContentCard
          title="판단 규칙"
          subtitle="Rule"
          icon={ShieldCheck}
          content={formatDecisionRule(
            candidate.decision_rule
          )}
        />

        <ContentCard
          title="판단 근거"
          subtitle="Rationale"
          icon={BookOpenCheck}
          content={formatNullableText(
            candidate.rationale
          )}
        />

        <ContentCard
          title="예외 조건"
          subtitle="Exception"
          icon={CircleX}
          content={formatNullableText(
            candidate.exception
          )}
        />
      </div>

      {/* Review / Synthesis 상태 */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-black text-slate-900">
            Review 분석
          </h3>

          <p className="mt-1 text-[11px] font-semibold text-slate-400">
            Review &amp; Synthesis
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <InfoItem
            label="Review 사유"
            value={
              candidate.review_reason ||
              "별도 Review 사유가 없습니다."
            }
          />

          <InfoItem
            label="Synthesis 상태"
            value={
              candidate.synthesis_status ||
              "아직 Synthesis가 생성되지 않았습니다."
            }
          />

          <InfoItem
            label="Synthesis Operation"
            value={
              candidate.synthesis_operation ||
              "-"
            }
          />

          <InfoItem
            label="Synthesis 사유"
            value={
              candidate.synthesis_reason ||
              "-"
            }
          />
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
            disabled={isProcessing}
            onClick={onApprove}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />

            {processingAction ===
            "APPROVE"
              ? "처리 중..."
              : "정확합니다"}
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={onEdit}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-600 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PencilLine className="h-4 w-4" />
            수정하기
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={onReject}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />

            {processingAction ===
            "REJECT"
              ? "처리 중..."
              : "거절하기"}
          </button>
        </div>
      </div>
    </section>
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

      <p className="whitespace-pre-line text-xs font-semibold leading-6 text-slate-700">
        {content}
      </p>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 whitespace-pre-line text-xs font-semibold leading-5 text-slate-700">
        {value}
      </p>
    </div>
  );
}