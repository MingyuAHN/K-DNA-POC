"use client";

import {
  BookOpenCheck,
  CheckCircle2,
  CircleX,
  FileText,
  PencilLine,
  Save,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import type {
  KnowledgeCandidateEditRequest,
  KnowledgeReviewCandidate,
  KnowledgeType,
} from "@/services/review";

import {
  formatConfidence,
  formatContext,
  formatDecisionRule,
  formatKnowledgeType,
  formatNullableText,
} from "../utils";

type ReviewAction =
  | "APPROVE"
  | "EDIT"
  | "REJECT"
  | null;

type DetailProps = {
  candidate: KnowledgeReviewCandidate | null;
  processingAction: ReviewAction;

  onApprove: () => void;
  onSaveEdit: (
    payload: KnowledgeCandidateEditRequest
  ) => void;
  onReject: () => void;
};

const knowledgeTypes: KnowledgeType[] = [
  "FACT",
  "PRINCIPLE",
  "DECISION_RULE",
  "HEURISTIC",
  "EXCEPTION",
  "FAILURE_LESSON",
  "TRADE_OFF",
  "EXPERT_OPINION",
];

export default function ReviewDetail({
  candidate,
  processingAction,
  onApprove,
  onSaveEdit,
  onReject,
}: DetailProps) {
  const [isEditing, setIsEditing] =
    useState(false);

  const [statement, setStatement] =
    useState("");

  const [knowledgeType, setKnowledgeType] =
    useState<KnowledgeType>("FACT");

  const [contextText, setContextText] =
    useState("{}");

  const [
    decisionRuleText,
    setDecisionRuleText,
  ] = useState("");

  const [rationale, setRationale] =
    useState("");

  const [exception, setException] =
    useState("");

  const [editReason, setEditReason] =
    useState("");

  const [
    editError,
    setEditError,
  ] = useState("");

  // Candidate 변경 시 편집값 초기화
  useEffect(() => {
    if (!candidate) {
      return;
    }

    setStatement(
      candidate.statement
    );

    setKnowledgeType(
      candidate.knowledge_type as KnowledgeType
    );

    setContextText(
      JSON.stringify(
        candidate.context ?? {},
        null,
        2
      )
    );

    setDecisionRuleText(
      candidate.decision_rule
        ? JSON.stringify(
            candidate.decision_rule,
            null,
            2
          )
        : ""
    );

    setRationale(
      candidate.rationale ?? ""
    );

    setException(
      candidate.exception ?? ""
    );

    setEditReason("");
    setEditError("");
    setIsEditing(false);
  }, [candidate]);

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

  // 편집 시작
  const handleStartEdit = () => {
    setEditError("");
    setIsEditing(true);
  };

  // 편집 취소
  const handleCancelEdit = () => {
    setStatement(
      candidate.statement
    );

    setKnowledgeType(
      candidate.knowledge_type as KnowledgeType
    );

    setContextText(
      JSON.stringify(
        candidate.context ?? {},
        null,
        2
      )
    );

    setDecisionRuleText(
      candidate.decision_rule
        ? JSON.stringify(
            candidate.decision_rule,
            null,
            2
          )
        : ""
    );

    setRationale(
      candidate.rationale ?? ""
    );

    setException(
      candidate.exception ?? ""
    );

    setEditReason("");
    setEditError("");
    setIsEditing(false);
  };

  // 수정 저장
  const handleSaveEdit = () => {
    if (!statement.trim()) {
      setEditError(
        "추출 지식을 입력해주세요."
      );
      return;
    }

    try {
      const parsedContext =
        contextText.trim()
          ? JSON.parse(contextText)
          : {};

      const parsedDecisionRule =
        decisionRuleText.trim()
          ? JSON.parse(
              decisionRuleText
            )
          : null;

      if (
        parsedDecisionRule &&
        typeof parsedDecisionRule.then !==
          "string"
      ) {
        setEditError(
          "판단 규칙의 then 값은 문자열이어야 합니다."
        );
        return;
      }

      setEditError("");

      onSaveEdit({
        statement:
          statement.trim(),
        knowledge_type:
          knowledgeType,
        context:
          parsedContext,
        decision_rule:
          parsedDecisionRule,
        rationale:
          rationale.trim() ||
          null,
        exception:
          exception.trim() ||
          null,
        edit_reason:
          editReason.trim() ||
          null,
      });
    } catch {
      setEditError(
        "Context 또는 Decision Rule의 JSON 형식을 확인해주세요."
      );
    }
  };

  return (
    <section className="space-y-4">
      {/* 기본 정보 */}
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

      {isEditing ? (
        <EditForm
          statement={statement}
          knowledgeType={knowledgeType}
          contextText={contextText}
          decisionRuleText={decisionRuleText}
          rationale={rationale}
          exception={exception}
          editReason={editReason}
          editError={editError}
          isSaving={
            processingAction === "EDIT"
          }
          onStatementChange={
            setStatement
          }
          onKnowledgeTypeChange={
            setKnowledgeType
          }
          onContextChange={
            setContextText
          }
          onDecisionRuleChange={
            setDecisionRuleText
          }
          onRationaleChange={
            setRationale
          }
          onExceptionChange={
            setException
          }
          onEditReasonChange={
            setEditReason
          }
          onSave={
            handleSaveEdit
          }
          onCancel={
            handleCancelEdit
          }
        />
      ) : (
        <>
          {/* 추출 지식 */}
          <ContentCard
            title="추출 지식"
            subtitle="Knowledge"
            icon={Sparkles}
            content={
              candidate.statement
            }
            highlight
          />

          {/* 지식 상세 */}
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
        </>
      )}

      {/* Review 상태 */}
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
      {!isEditing && (
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
              onClick={
                handleStartEdit
              }
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
      )}
    </section>
  );
}

type EditFormProps = {
  statement: string;
  knowledgeType: KnowledgeType;
  contextText: string;
  decisionRuleText: string;
  rationale: string;
  exception: string;
  editReason: string;
  editError: string;
  isSaving: boolean;

  onStatementChange: (
    value: string
  ) => void;

  onKnowledgeTypeChange: (
    value: KnowledgeType
  ) => void;

  onContextChange: (
    value: string
  ) => void;

  onDecisionRuleChange: (
    value: string
  ) => void;

  onRationaleChange: (
    value: string
  ) => void;

  onExceptionChange: (
    value: string
  ) => void;

  onEditReasonChange: (
    value: string
  ) => void;

  onSave: () => void;
  onCancel: () => void;
};

function EditForm({
  statement,
  knowledgeType,
  contextText,
  decisionRuleText,
  rationale,
  exception,
  editReason,
  editError,
  isSaving,
  onStatementChange,
  onKnowledgeTypeChange,
  onContextChange,
  onDecisionRuleChange,
  onRationaleChange,
  onExceptionChange,
  onEditReasonChange,
  onSave,
  onCancel,
}: EditFormProps) {
  return (
    <div className="rounded-[24px] border border-blue-200 bg-white p-5 shadow-sm">
      {/* 제목 */}
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <PencilLine className="h-4 w-4 text-blue-600" />

          <h3 className="text-sm font-black text-slate-900">
            지식 후보 수정
          </h3>
        </div>

        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          Candidate Edit
        </p>
      </div>

      <div className="space-y-4">
        {/* Knowledge */}
        <EditField label="추출 지식">
          <textarea
            value={statement}
            onChange={(event) =>
              onStatementChange(
                event.target.value
              )
            }
            rows={3}
            className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </EditField>

        {/* Type */}
        <EditField label="Knowledge Type">
          <select
            value={knowledgeType}
            onChange={(event) =>
              onKnowledgeTypeChange(
                event.target
                  .value as KnowledgeType
              )
            }
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {knowledgeTypes.map(
              (type) => (
                <option
                  key={type}
                  value={type}
                >
                  {formatKnowledgeType(
                    type
                  )}
                </option>
              )
            )}
          </select>
        </EditField>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Context */}
          <EditField label="적용 맥락">
            <textarea
              value={contextText}
              onChange={(event) =>
                onContextChange(
                  event.target.value
                )
              }
              rows={8}
              spellCheck={false}
              className="w-full resize-y rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-xs leading-5 text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </EditField>

          {/* Rule */}
          <EditField label="판단 규칙">
            <textarea
              value={decisionRuleText}
              onChange={(event) =>
                onDecisionRuleChange(
                  event.target.value
                )
              }
              rows={8}
              spellCheck={false}
              placeholder="판단 규칙이 없으면 비워두세요."
              className="w-full resize-y rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-xs leading-5 text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </EditField>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Rationale */}
          <EditField label="판단 근거">
            <textarea
              value={rationale}
              onChange={(event) =>
                onRationaleChange(
                  event.target.value
                )
              }
              rows={4}
              placeholder="판단 근거"
              className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </EditField>

          {/* Exception */}
          <EditField label="예외 조건">
            <textarea
              value={exception}
              onChange={(event) =>
                onExceptionChange(
                  event.target.value
                )
              }
              rows={4}
              placeholder="예외 조건"
              className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </EditField>
        </div>

        {/* 수정 사유 */}
        <EditField label="수정 사유">
          <input
            type="text"
            value={editReason}
            onChange={(event) =>
              onEditReasonChange(
                event.target.value
              )
            }
            placeholder="예: 전문가 검토 후 표현 보완"
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </EditField>

        {editError && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600">
            {editError}
          </p>
        )}
      </div>

      {/* 저장 / 취소 */}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={onCancel}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          취소
        </button>

        <button
          type="button"
          disabled={
            isSaving ||
            !statement.trim()
          }
          onClick={onSave}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          <Save className="h-4 w-4" />

          {isSaving
            ? "저장 중..."
            : "수정 저장"}
        </button>
      </div>
    </div>
  );
}

function EditField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black text-slate-600">
        {label}
      </label>

      {children}
    </div>
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