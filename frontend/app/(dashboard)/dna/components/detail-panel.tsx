import {
  BookOpenCheck,
  CircleDot,
  GitBranch,
  Network,
} from "lucide-react";

import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphResponse,
} from "@/services/knowledgeGraph";

import {
  formatConfidence,
  formatContext,
  knowledgeTypeStyleMap,
  relationStyleMap,
} from "../graph-utils";

type KnowledgeDetailPanelProps = {
  graph: KnowledgeGraphResponse;
  selectedNode: KnowledgeGraphNode | null;
  selectedNodeId: string | null;
  selectedRelations: KnowledgeGraphEdge[];
  onNodeSelect: (nodeId: string) => void;
};

export default function KnowledgeDetailPanel({
  graph,
  selectedNode,
  selectedNodeId,
  selectedRelations,
  onNodeSelect,
}: KnowledgeDetailPanelProps) {
  const getOtherNode = (
    relation: KnowledgeGraphEdge
  ) => {
    if (!selectedNodeId) {
      return null;
    }

    const otherNodeId =
      relation.source ===
      selectedNodeId
        ? relation.target
        : relation.source;

    return (
      graph.nodes.find(
        (node) =>
          node.knowledge_id ===
          otherNodeId
      ) ?? null
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      {/* Selected Node */}
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-500">
            Selected Node
          </p>

          <h2 className="mt-1 text-xl font-black text-slate-900">
            선택 노드 상세
          </h2>
        </div>

        {selectedNode && (
          <KnowledgeDetail
            node={selectedNode}
          />
        )}
      </section>

      {/* 관계 상세 */}
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <GitBranch className="h-4 w-4" />
          </div>

          <div>
            <h2 className="text-sm font-black text-slate-900">
              연결 관계
            </h2>

            <p className="text-[11px] font-semibold text-slate-400">
              Knowledge Relations
            </p>
          </div>
        </div>

        {selectedRelations.length > 0 ? (
          <div className="space-y-3">
            {selectedRelations.map(
              (relation) => {
                const otherNode =
                  getOtherNode(
                    relation
                  );

                if (!otherNode) {
                  return null;
                }

                return (
                  <RelationCard
                    key={
                      relation.relation_id
                    }
                    relation={relation}
                    otherNode={otherNode}
                    onClick={() =>
                      onNodeSelect(
                        otherNode.knowledge_id
                      )
                    }
                  />
                );
              }
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-50 p-5 text-center">
            <p className="text-xs font-semibold text-slate-400">
              연결된 관계가 없습니다.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

/* ============================================================
   Knowledge Detail
============================================================ */

function KnowledgeDetail({
  node,
}: {
  node: KnowledgeGraphNode;
}) {
  const style =
    knowledgeTypeStyleMap[
      node.knowledge_type
    ] ??
    "border-slate-200 bg-slate-50 text-slate-600";

  const isSuperseded =
    node.status === "SUPERSEDED";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${style}`}
            >
              {node.knowledge_type}
            </span>

            <span className="text-xs font-bold text-slate-400">
              v{node.version}
            </span>

            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                isSuperseded
                  ? "bg-slate-100 text-slate-500"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {node.status}
            </span>
          </div>

          <h3 className="mt-3 text-xl font-black leading-8 text-slate-900">
            {node.statement}
          </h3>
        </div>

        <div className="shrink-0 rounded-2xl bg-blue-50 px-4 py-3 text-right">
          <p className="text-[10px] font-bold text-slate-400">
            Confidence
          </p>

          <p className="text-xl font-black text-blue-600">
            {formatConfidence(
              node.confidence_score
            )}
          </p>
        </div>
      </div>

      <DetailCard
        title="추출 지식"
        subtitle="Statement"
        content={node.statement}
        highlight
      />

      <div className="grid gap-3 md:grid-cols-2">
        <DetailCard
          title="지식 유형"
          subtitle="Knowledge Type"
          content={node.knowledge_type}
        />

        <DetailCard
          title="상태"
          subtitle="Status"
          content={node.status}
        />

        <DetailCard
          title="버전"
          subtitle="Version"
          content={`v${node.version}`}
        />

        <DetailCard
          title="적용 맥락"
          subtitle="Context"
          content={formatContext(
            node.context
          )}
        />
      </div>

      {(node.root_knowledge_id ||
        node.supersedes_id) && (
        <div className="grid gap-3 md:grid-cols-2">
          {node.root_knowledge_id && (
            <DetailCard
              title="Root Knowledge"
              subtitle="Root Knowledge ID"
              content={
                node.root_knowledge_id
              }
            />
          )}

          {node.supersedes_id && (
            <DetailCard
              title="대체 이전 지식"
              subtitle="Supersedes ID"
              content={
                node.supersedes_id
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Relation Card
============================================================ */

function RelationCard({
  relation,
  otherNode,
  onClick,
}: {
  relation: KnowledgeGraphEdge;
  otherNode: KnowledgeGraphNode;
  onClick: () => void;
}) {
  const style =
    relationStyleMap[
      relation.relation_type
    ] ??
    "bg-slate-100 text-slate-600";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600">
          <CircleDot className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-black ${style}`}
            >
              {relation.relation_type}
            </span>

            <span className="ml-auto text-[10px] font-black text-blue-600">
              {formatConfidence(
                relation.confidence_score
              )}
            </span>
          </div>

          <p className="mt-2 line-clamp-2 text-xs font-black leading-5 text-slate-800">
            {otherNode.statement}
          </p>

          <p className="mt-1 text-[10px] font-bold text-slate-400">
            v{otherNode.version} ·{" "}
            {otherNode.status}
          </p>
        </div>
      </div>
    </button>
  );
}

/* ============================================================
   Detail Card
============================================================ */

function DetailCard({
  title,
  subtitle,
  content,
  highlight = false,
}: {
  title: string;
  subtitle: string;
  content: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? "border-blue-100 bg-blue-50/50"
          : "border-slate-100 bg-slate-50/70"
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        {highlight ? (
          <BookOpenCheck className="h-4 w-4 text-blue-600" />
        ) : (
          <Network className="h-4 w-4 text-slate-500" />
        )}

        <div>
          <p className="text-xs font-black text-slate-900">
            {title}
          </p>

          <p className="text-[10px] font-semibold text-slate-400">
            {subtitle}
          </p>
        </div>
      </div>

      <p className="whitespace-pre-wrap break-all text-xs font-semibold leading-6 text-slate-700">
        {content || "-"}
      </p>
    </div>
  );
}