"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  Check,
  CheckCircle2,
  ChevronDown,
  CircleX,
  FileSearch,
  FileText,
  PencilLine,
  Save,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";

import type {
  KnowledgeCandidateEditRequest,
  KnowledgeReviewCandidate,
  KnowledgeType,
  ReviewEvidence,
} from "@/services/review";

import {
  formatConfidence,
  formatKnowledgeType,
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

const inputClass =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

const textareaClass =
  "w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

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

  // Context
  const [domain, setDomain] =
    useState("");

  const [scope, setScope] =
    useState("");

  const [phase, setPhase] =
    useState("");

  const [constraints, setConstraints] =
    useState("");

  // Decision Rule
  const [ifConditions, setIfConditions] =
    useState("");

  const [thenRule, setThenRule] =
    useState("");

  const [
    unlessConditions,
    setUnlessConditions,
  ] = useState("");

  const [exception, setException] =
    useState("");

  const [editReason, setEditReason] =
    useState("");

  const [editError, setEditError] =
    useState("");

  // Candidate 초기화
  useEffect(() => {
    if (!candidate) {
      return;
    }

    resetEditValues(candidate);
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
            검토할 지식 후보를 선택해 주세요.
          </p>
        </div>
      </section>
    );
  }

  const isProcessing =
    processingAction !== null;

  // 편집값 초기화
  function resetEditValues(
    target: KnowledgeReviewCandidate
  ) {
    const context =
      target.context ?? {};

    const rule =
      target.decision_rule;

    setStatement(target.statement);

    setKnowledgeType(
      toKnowledgeType(
        target.knowledge_type
      )
    );

    setDomain(
      getStringValue(context.domain)
    );

    setScope(
      getStringValue(context.scope)
    );

    setPhase(
      getStringValue(context.phase)
    );

    setConstraints(
      getStringArray(
        context.constraints
      ).join(", ")
    );

    setIfConditions(
      getRuleArray(
        rule,
        "if_conditions",
        "if"
      ).join("\n")
    );

    setThenRule(
      getRuleString(rule, "then")
    );

    setUnlessConditions(
      getRuleArray(
        rule,
        "unless"
      ).join("\n")
    );

    setException(
      target.exception ?? ""
    );

    setEditReason("");
    setEditError("");
  }

  const handleStartEdit = () => {
    setEditError("");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    resetEditValues(candidate);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (!statement.trim()) {
      setEditError(
        "추출 지식을 입력해주세요."
      );
      return;
    }

    const parsedIfConditions =
      splitLines(ifConditions);

    const parsedUnless =
      splitLines(unlessConditions);

    const hasDecisionRule =
      parsedIfConditions.length > 0 ||
      Boolean(thenRule.trim()) ||
      parsedUnless.length > 0;

    if (
      hasDecisionRule &&
      !thenRule.trim()
    ) {
      setEditError(
        "판단 규칙을 입력한 경우 THEN 값이 필요합니다."
      );
      return;
    }

    setEditError("");

    onSaveEdit({
      statement: statement.trim(),

      knowledge_type: knowledgeType,

      context: {
        ...candidate.context,

        domain:
          domain.trim() || null,

        scope:
          scope.trim() || null,

        phase:
          phase.trim() || null,

        constraints:
          splitCommaValues(
            constraints
          ),
      },

      decision_rule:
        hasDecisionRule
          ? {
              if_conditions:
                parsedIfConditions,
              then: thenRule.trim(),
              unless: parsedUnless,
            }
          : null,

      exception:
        exception.trim() || null,

      edit_reason:
        editReason.trim() || null,
    });
  };

  return (
    <section className="space-y-4">
      {/* 선택한 지식 후보 요약 */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black text-blue-500">
              선택한 지식 후보
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
          </div>

          {/* Candidate Confidence */}
          <div
            className="shrink-0 rounded-2xl bg-blue-50 px-4 py-3"
            title="AI가 추출한 지식 후보의 신뢰도입니다. 최종 확정 여부는 전문가 검토로 결정됩니다."
          >
            <p className="text-[10px] font-bold text-slate-400">
              후보 신뢰도
            </p>

            <p className="mt-0.5 text-lg font-black text-blue-600">
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
          domain={domain}
          scope={scope}
          phase={phase}
          constraints={constraints}
          ifConditions={ifConditions}
          thenRule={thenRule}
          unlessConditions={
            unlessConditions
          }
          exception={exception}
          editReason={editReason}
          editError={editError}
          evidence={candidate.evidence}
          isSaving={
            processingAction === "EDIT"
          }
          onStatementChange={
            setStatement
          }
          onKnowledgeTypeChange={
            setKnowledgeType
          }
          onDomainChange={setDomain}
          onScopeChange={setScope}
          onPhaseChange={setPhase}
          onConstraintsChange={
            setConstraints
          }
          onIfConditionsChange={
            setIfConditions
          }
          onThenRuleChange={
            setThenRule
          }
          onUnlessConditionsChange={
            setUnlessConditions
          }
          onExceptionChange={
            setException
          }
          onEditReasonChange={
            setEditReason
          }
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      ) : (
        <>
          {/* Knowledge */}
          <ContentCard
            title="지식 내용"
            icon={Sparkles}
            content={candidate.statement}
            highlight
          />

          {/* Context */}
          <ContextCard
            context={
              candidate.context
            }
          />

          {/* Rule */}
          <DecisionRuleCard
            rule={
              candidate.decision_rule
            }
          />

          {/* Exception */}
          <CompactContentCard
            title="예외 조건"
            icon={CircleX}
            content={
              candidate.exception?.trim() ||
              "없음"
            }
          />

          {/* Evidence */}
          <EvidenceCard
            evidence={candidate.evidence}
          />
        </>
      )}

      {/* 전문가 검토 */}
      {!isEditing && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-black text-slate-900">
              전문가 검토
            </h3>

            <p className="mt-1 text-xs font-semibold text-slate-400">
              지식 후보의 최종 반영 여부를 결정합니다.
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

/* -------------------------------------------------------------------------- */
/*                               표시용 컴포넌트                                */
/* -------------------------------------------------------------------------- */

function ContextCard({
  context,
}: {
  context: Record<string, unknown>;
}) {
  const rows = buildContextRows(
    context
  );

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
      <SectionHeader
        icon={FileText}
        title="적용 맥락"
      />

      {rows.length === 0 ? (
        <p className="text-sm font-semibold text-slate-400">
          등록된 적용 맥락이 없습니다.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-100">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid gap-1 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:grid-cols-[110px_minmax(0,1fr)]"
            >
              <p className="text-xs font-black text-slate-400">
                {row.label}
              </p>

              <p className="text-sm font-semibold leading-6 text-slate-700">
                {row.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DecisionRuleCard({
  rule,
}: {
  rule:
    | Record<string, unknown>
    | null;
}) {
  const ifConditions =
    getRuleArray(
      rule,
      "if_conditions",
      "if"
    );

  const thenRule =
    getRuleString(rule, "then");

  const unlessConditions =
    getRuleArray(
      rule,
      "unless"
    );

  const hasRule =
    ifConditions.length > 0 ||
    Boolean(thenRule) ||
    unlessConditions.length > 0;

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
      <SectionHeader
        icon={ShieldCheck}
        title="판단 규칙"
      />

      {!hasRule ? (
        <p className="text-sm font-semibold text-slate-400">
          없음
        </p>
      ) : (
        <div className="space-y-3">
          {ifConditions.length > 0 && (
            <RuleRow
              label="IF"
              content={ifConditions.join(
                "\n"
              )}
            />
          )}

          {thenRule && (
            <RuleRow
              label="THEN"
              content={thenRule}
            />
          )}

          {unlessConditions.length >
            0 && (
            <RuleRow
              label="UNLESS"
              content={unlessConditions.join(
                "\n"
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}

function RuleRow({
  label,
  content,
}: {
  label: string;
  content: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
      <span className="w-14 shrink-0 text-xs font-black text-blue-600">
        {label}
      </span>

      <p className="whitespace-pre-line text-sm font-semibold leading-6 text-slate-700">
        {content}
      </p>
    </div>
  );
}

function EvidenceCard({
  evidence,
}: {
  evidence:
    | ReviewEvidence
    | null;
}) {
  const sourceLabel =
    getEvidenceSourceLabel(
      evidence?.source_type
    );

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
      <SectionHeader
        icon={FileSearch}
        title="근거"
      />

      {!evidence ? (
        <p className="text-sm font-semibold text-slate-400">
          근거 정보가 없습니다.
        </p>
      ) : (
        <>
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
            {sourceLabel}
          </span>

          <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-7 text-slate-700">
            {evidence.source_text ||
              "근거 내용이 없습니다."}
          </p>
        </>
      )}
    </div>
  );
}

function CompactContentCard({
  title,
  icon: Icon,
  content,
}: {
  title: string;
  icon: typeof CircleX;
  content: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
      <SectionHeader
        icon={Icon}
        title={title}
      />

      <p
        className={`text-sm font-semibold leading-6 ${
          content === "없음"
            ? "text-slate-400"
            : "text-slate-700"
        }`}
      >
        {content}
      </p>
    </div>
  );
}

function ContentCard({
  title,
  icon: Icon,
  content,
  highlight = false,
}: {
  title: string;
  icon: typeof Sparkles;
  content: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-[22px] border p-5 shadow-sm ${
        highlight
          ? "border-blue-100 bg-blue-50/50"
          : "border-slate-200 bg-white"
      }`}
    >
      <SectionHeader
        icon={Icon}
        title={title}
        highlight={highlight}
      />

      <p className="whitespace-pre-line break-words text-sm font-semibold leading-7 text-slate-700">
        {content}
      </p>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  highlight = false,
}: {
  icon: typeof Sparkles;
  title: string;
  highlight?: boolean;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
          highlight
            ? "bg-blue-100 text-blue-600"
            : "bg-slate-100 text-slate-600"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <p className="text-sm font-black text-slate-900">
        {title}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  편집 폼                                   */
/* -------------------------------------------------------------------------- */

type EditFormProps = {
  statement: string;
  knowledgeType: KnowledgeType;

  domain: string;
  scope: string;
  phase: string;
  constraints: string;

  ifConditions: string;
  thenRule: string;
  unlessConditions: string;

  exception: string;
  editReason: string;
  editError: string;

  evidence: ReviewEvidence | null;

  isSaving: boolean;

  onStatementChange: (
    value: string
  ) => void;

  onKnowledgeTypeChange: (
    value: KnowledgeType
  ) => void;

  onDomainChange: (
    value: string
  ) => void;

  onScopeChange: (
    value: string
  ) => void;

  onPhaseChange: (
    value: string
  ) => void;

  onConstraintsChange: (
    value: string
  ) => void;

  onIfConditionsChange: (
    value: string
  ) => void;

  onThenRuleChange: (
    value: string
  ) => void;

  onUnlessConditionsChange: (
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
  domain,
  scope,
  phase,
  constraints,
  ifConditions,
  thenRule,
  unlessConditions,
  exception,
  editReason,
  editError,
  evidence,
  isSaving,
  onStatementChange,
  onKnowledgeTypeChange,
  onDomainChange,
  onScopeChange,
  onPhaseChange,
  onConstraintsChange,
  onIfConditionsChange,
  onThenRuleChange,
  onUnlessConditionsChange,
  onExceptionChange,
  onEditReasonChange,
  onSave,
  onCancel,
}: EditFormProps) {
  return (
    <div className="rounded-[24px] border border-blue-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <PencilLine className="h-4 w-4 text-blue-600" />

          <h3 className="text-sm font-black text-slate-900">
            지식 후보 수정
          </h3>
        </div>
      </div>

      <div className="space-y-5">
        <EditField label="지식 내용">
          <textarea
            value={statement}
            onChange={(event) =>
              onStatementChange(
                event.target.value
              )
            }
            rows={3}
            className={textareaClass}
          />
        </EditField>

        <EditField label="지식 유형">
          <KnowledgeTypeDropdown
            value={knowledgeType}
            disabled={isSaving}
            onChange={
              onKnowledgeTypeChange
            }
          />
        </EditField>

        {/* Context */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <SectionTitle
            icon={FileText}
            title="적용 맥락"
          />

          <div className="grid gap-4 md:grid-cols-2">
            <EditField label="도메인">
              <input
                value={domain}
                onChange={(event) =>
                  onDomainChange(
                    event.target.value
                  )
                }
                placeholder="예: MSA Architecture"
                className={inputClass}
              />
            </EditField>

            <EditField label="적용 범위">
              <input
                value={scope}
                onChange={(event) =>
                  onScopeChange(
                    event.target.value
                  )
                }
                placeholder="예: 서비스 DB 분리"
                className={inputClass}
              />
            </EditField>

            <EditField label="단계">
              <input
                value={phase}
                onChange={(event) =>
                  onPhaseChange(
                    event.target.value
                  )
                }
                placeholder="예: 전환 단계"
                className={inputClass}
              />
            </EditField>

            <EditField label="제약 조건">
              <input
                value={constraints}
                onChange={(event) =>
                  onConstraintsChange(
                    event.target.value
                  )
                }
                placeholder="여러 개면 쉼표로 구분"
                className={inputClass}
              />
            </EditField>
          </div>
        </div>

        {/* Rule */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <SectionTitle
            icon={ShieldCheck}
            title="판단 규칙"
          />

          <div className="space-y-4">
            <EditField
              label="IF"
              description="여러 조건은 줄바꿈으로 구분합니다."
            >
              <textarea
                value={ifConditions}
                onChange={(event) =>
                  onIfConditionsChange(
                    event.target.value
                  )
                }
                rows={2}
                placeholder="판단 조건"
                className={textareaClass}
              />
            </EditField>

            <EditField label="THEN">
              <textarea
                value={thenRule}
                onChange={(event) =>
                  onThenRuleChange(
                    event.target.value
                  )
                }
                rows={2}
                placeholder="조건 충족 시 판단"
                className={textareaClass}
              />
            </EditField>

            <EditField
              label="UNLESS"
              description="예외가 없으면 비워두세요."
            >
              <textarea
                value={
                  unlessConditions
                }
                onChange={(event) =>
                  onUnlessConditionsChange(
                    event.target.value
                  )
                }
                rows={2}
                placeholder="판단 규칙의 예외"
                className={textareaClass}
              />
            </EditField>
          </div>
        </div>

        <EditField label="예외 조건">
          <textarea
            value={exception}
            onChange={(event) =>
              onExceptionChange(
                event.target.value
              )
            }
            rows={3}
            placeholder="지식 자체의 예외 조건"
            className={textareaClass}
          />
        </EditField>

        <EvidenceCard
          evidence={evidence}
        />

        <EditField label="수정 사유">
          <input
            value={editReason}
            onChange={(event) =>
              onEditReasonChange(
                event.target.value
              )
            }
            placeholder="예: 전문가 검토 후 표현 보완"
            className={inputClass}
          />
        </EditField>

        {editError && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600">
            {editError}
          </p>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={onCancel}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
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
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:bg-blue-300"
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

function KnowledgeTypeDropdown({
  value,
  disabled,
  onChange,
}: {
  value: KnowledgeType;
  disabled: boolean;
  onChange: (
    value: KnowledgeType
  ) => void;
}) {
  const [isOpen, setIsOpen] =
    useState(false);

  const containerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  useEffect(() => {
    const handleMouseDown = (
      event: MouseEvent
    ) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleMouseDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleMouseDown
      );
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          setIsOpen(
            (current) => !current
          )
        }
        className={`flex min-h-[46px] w-full items-center justify-between rounded-xl border bg-white px-4 py-2.5 text-left transition ${
          isOpen
            ? "border-blue-400 ring-4 ring-blue-100"
            : "border-slate-300 hover:border-slate-400"
        }`}
      >
        <span className="text-sm font-black text-slate-800">
          {formatKnowledgeType(
            value
          )}
        </span>

        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition ${
            isOpen
              ? "rotate-180"
              : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {knowledgeTypes.map(
            (type) => {
              const isSelected =
                type === value;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    onChange(type);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 ${
                    isSelected
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-sm font-bold">
                    {formatKnowledgeType(
                      type
                    )}
                  </span>

                  {isSelected && (
                    <Check className="h-4 w-4" />
                  )}
                </button>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function buildContextRows(
  context: Record<string, unknown>
) {
  const orderedKeys = [
    "time",
    "phase",
    "scope",
    "domain",
    "system",
    "project",
    "constraints",
    "tags",
  ];

  const labelMap: Record<
    string,
    string
  > = {
    time: "적용 시점",
    phase: "적용 단계",
    scope: "적용 범위",
    domain: "도메인",
    system: "시스템",
    project: "프로젝트",
    constraints: "제약 조건",
    tags: "관련 태그",
  };

  return orderedKeys
    .map((key) => {
      const value = context?.[key];

      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return null;
      }

      if (
        Array.isArray(value) &&
        value.length === 0
      ) {
        return null;
      }

      let displayValue = "";

      if (Array.isArray(value)) {
        displayValue = value
          .map(String)
          .join(", ");
      } else if (
        typeof value === "object"
      ) {
        displayValue =
          JSON.stringify(value);
      } else {
        displayValue =
          String(value);
      }

      return {
        label: labelMap[key] ?? key,
        value: displayValue,
      };
    })
    .filter(
      (
        row
      ): row is {
        label: string;
        value: string;
      } => row !== null
    );
}

function getEvidenceSourceLabel(
  sourceType:
    | string
    | undefined
) {
  const labelMap: Record<
    string,
    string
  > = {
    INTERVIEW_MESSAGE:
      "전문가 인터뷰",
    DOCUMENT:
      "참고 문서",
    DOCUMENT_CHUNK:
      "문서 근거",
    BASELINE_CLAIM:
      "기존 지식",
    KNOWLEDGE_UNIT:
      "검증된 지식",
  };

  if (!sourceType) {
    return "근거";
  }

  return (
    labelMap[sourceType] ??
    sourceType
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: typeof FileText;
  title: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Icon className="h-4 w-4 text-blue-600" />

      <p className="text-xs font-black text-slate-800">
        {title}
      </p>
    </div>
  );
}

function EditField({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-black text-slate-600">
        {label}
      </label>

      {description && (
        <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
          {description}
        </p>
      )}

      <div className="mt-2">
        {children}
      </div>
    </div>
  );
}

function toKnowledgeType(
  value: string
): KnowledgeType {
  const type =
    value as KnowledgeType;

  return knowledgeTypes.includes(
    type
  )
    ? type
    : "FACT";
}

function getStringValue(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
    : "";
}

function getStringArray(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item
    ): item is string =>
      typeof item ===
      "string"
  );
}

function getRuleString(
  rule:
    | Record<string, unknown>
    | null,
  key: string
) {
  if (!rule) {
    return "";
  }

  return getStringValue(rule[key]);
}

function getRuleArray(
  rule:
    | Record<string, unknown>
    | null,
  key: string,
  fallbackKey?: string
) {
  if (!rule) {
    return [];
  }

  const primary =
    getStringArray(rule[key]);

  if (primary.length > 0) {
    return primary;
  }

  if (!fallbackKey) {
    return [];
  }

  return getStringArray(
    rule[fallbackKey]
  );
}

function splitCommaValues(
  value: string
) {
  return value
    .split(",")
    .map((item) =>
      item.trim()
    )
    .filter(Boolean);
}

function splitLines(
  value: string
) {
  return value
    .split("\n")
    .map((item) =>
      item.trim()
    )
    .filter(Boolean);
}