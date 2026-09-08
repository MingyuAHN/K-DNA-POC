"use client";

import { useMemo, useState } from "react";
import {
  BookOpenCheck,
  CircleDot,
  FileText,
  GitBranch,
  Network,
} from "lucide-react";
import { dnaMock } from "@/mocks/dnaMock";

type GraphNode = (typeof dnaMock.graph.nodes)[number];
type GraphRelation = (typeof dnaMock.graph.relations)[number];

/**
 * 그래프 전체 좌표계
 * SVG와 노드가 같은 px 좌표를 사용하도록 고정
 */
const GRAPH_WIDTH = 1200;
const GRAPH_HEIGHT = 700;

/**
 * 그래프 노드 크기
 * 실제 카드 width가 210px이므로 절반은 105px
 */
const NODE_HALF_WIDTH = 105;
const NODE_HALF_HEIGHT = 70;

/**
 * 노드 배치
 *
 *        KU-001
 *           |
 *        KU-002  ← EV-002
 *           |
 *        KU-003  ← EV-001
 *
 * 선이 최대한 수평/수직으로만 연결되도록 배치
 */
const nodePositions: Record<
  string,
  {
    x: number;
    y: number;
  }
> = {
  "KU-001": { x: 600, y: 110 },
  "KU-002": { x: 600, y: 330 },
  "KU-003": { x: 600, y: 550 },

  "EV-002": { x: 200, y: 330 },
  "EV-001": { x: 1000, y: 550 },
};

const knowledgeTypeStyleMap: Record<
  string,
  {
    className: string;
  }
> = {
  PRINCIPLE: {
    className:
      "border-blue-200 bg-blue-50 text-blue-700",
  },

  DECISION_RULE: {
    className:
      "border-violet-200 bg-violet-50 text-violet-700",
  },

  EXCEPTION: {
    className:
      "border-amber-200 bg-amber-50 text-amber-700",
  },

  FAILURE_LESSON: {
    className:
      "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const relationStyleMap: Record<
  string,
  {
    className: string;
  }
> = {
  RELATED: {
    className:
      "bg-slate-100 text-slate-600",
  },

  HAS_EXCEPTION: {
    className:
      "bg-amber-100 text-amber-700",
  },

  SUPPORTS: {
    className:
      "bg-blue-100 text-blue-700",
  },

  CONTRADICTS: {
    className:
      "bg-rose-100 text-rose-700",
  },
};

function isKnowledgeNode(
  node: GraphNode
): node is Extract<
  GraphNode,
  { nodeType: "KNOWLEDGE" }
> {
  return node.nodeType === "KNOWLEDGE";
}

/**
 * 카드 중심끼리 선을 연결하지 않고,
 * 실제 카드 테두리에서 선이 시작/종료되도록 계산
 */
function getEdgePoints(
  from: {
    x: number;
    y: number;
  },
  to: {
    x: number;
    y: number;
  }
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  /*
   * 세로 연결
   */
  if (dx === 0) {
    const direction = dy > 0 ? 1 : -1;

    return {
      startX: from.x,
      startY:
        from.y +
        NODE_HALF_HEIGHT * direction,

      endX: to.x,
      endY:
        to.y -
        NODE_HALF_HEIGHT * direction,
    };
  }

  /*
   * 가로 연결
   */
  if (dy === 0) {
    const direction = dx > 0 ? 1 : -1;

    return {
      startX:
        from.x +
        NODE_HALF_WIDTH * direction,

      startY: from.y,

      endX:
        to.x -
        NODE_HALF_WIDTH * direction,

      endY: to.y,
    };
  }

  /*
   * 대각선 관계가 추가될 경우
   */
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  const startScale = Math.min(
    NODE_HALF_WIDTH / absDx,
    NODE_HALF_HEIGHT / absDy
  );

  const endScale = startScale;

  return {
    startX: from.x + dx * startScale,
    startY: from.y + dy * startScale,

    endX: to.x - dx * endScale,
    endY: to.y - dy * endScale,
  };
}

/**
 * 관계 텍스트 위치
 *
 * 세로선 → 선 오른쪽
 * 가로선 → 선 위쪽
 */
function getRelationLabelPosition(
  startX: number,
  startY: number,
  endX: number,
  endY: number
) {
  const middleX = (startX + endX) / 2;
  const middleY = (startY + endY) / 2;

  const isVertical =
    Math.abs(startX - endX) < 1;

  if (isVertical) {
    return {
      x: middleX + 22,
      y: middleY,
    };
  }

  return {
    x: middleX,
    y: middleY - 16,
  };
}

export default function DnaPage() {
  const [selectedNodeId, setSelectedNodeId] =
    useState("KU-001");

  const selectedNode = useMemo(
    () =>
      dnaMock.graph.nodes.find(
        (node) =>
          node.id === selectedNodeId
      ) ?? dnaMock.graph.nodes[0],
    [selectedNodeId]
  );

  const selectedRelations = useMemo(
    () =>
      dnaMock.graph.relations.filter(
        (relation) =>
          relation.source ===
            selectedNode.id ||
          relation.target ===
            selectedNode.id
      ),
    [selectedNode]
  );

  const getNode = (
    nodeId: string
  ) =>
    dnaMock.graph.nodes.find(
      (node) => node.id === nodeId
    );

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-3 text-slate-900 sm:p-4 lg:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        {/* 화면 제목 */}
        <header className="px-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Knowledge DNA
          </h1>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            검증된 지식과 근거의 관계를
            Knowledge Graph로 확인합니다.
          </p>
        </header>

        {/* Mission */}
        <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="shrink-0 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              선택한 미션
            </p>

            <div className="min-w-0 flex-1">
              <div className="flex h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800">
                {dnaMock.mission.title}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 px-4 py-2.5">
              <p className="text-[10px] font-bold text-slate-400">
                Expert
              </p>

              <p className="mt-0.5 text-xs font-black text-slate-700">
                {dnaMock.mission.expert}
              </p>
            </div>
          </div>
        </section>

        {/* Knowledge Graph */}
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <Network className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-sm font-black text-slate-900">
                Knowledge DNA Graph
              </h2>

              <p className="text-[11px] font-semibold text-slate-400">
                Verified Knowledge &amp;
                Evidence Relations
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {/* 그래프 고정 좌표 영역 */}
            <div
              className="relative mx-auto overflow-hidden rounded-[22px] border border-slate-100 bg-slate-50/70"
              style={{
                width: `${GRAPH_WIDTH}px`,
                height: `${GRAPH_HEIGHT}px`,
                minWidth: `${GRAPH_WIDTH}px`,
              }}
            >
              {/* 관계선 */}
              <svg
                width={GRAPH_WIDTH}
                height={GRAPH_HEIGHT}
                viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                className="pointer-events-none absolute left-0 top-0"
              >
                {dnaMock.graph.relations.map(
                  (relation) => {
                    const from =
                      nodePositions[
                        relation.source
                      ];

                    const to =
                      nodePositions[
                        relation.target
                      ];

                    if (!from || !to) {
                      return null;
                    }

                    const {
                      startX,
                      startY,
                      endX,
                      endY,
                    } =
                      getEdgePoints(
                        from,
                        to
                      );

                    const labelPosition =
                      getRelationLabelPosition(
                        startX,
                        startY,
                        endX,
                        endY
                      );

                    return (
                      <g key={relation.id}>
                        {/* 선 */}
                        <line
                          x1={startX}
                          y1={startY}
                          x2={endX}
                          y2={endY}
                          stroke="#CBD5E1"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />

                        {/* 관계명 */}
                        <text
                          x={
                            labelPosition.x
                          }
                          y={
                            labelPosition.y
                          }
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="11"
                          fontWeight="700"
                          fill="#64748B"
                          stroke="#F8FAFC"
                          strokeWidth="6"
                          paintOrder="stroke"
                          strokeLinejoin="round"
                        >
                          {
                            relation.relationLabel
                          }
                        </text>
                      </g>
                    );
                  }
                )}
              </svg>

              {/* 그래프 노드 */}
              {dnaMock.graph.nodes.map(
                (node) => {
                  const position =
                    nodePositions[node.id];

                  if (!position) {
                    return null;
                  }

                  const isSelected =
                    node.id ===
                    selectedNodeId;

                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() =>
                        setSelectedNodeId(
                          node.id
                        )
                      }
                      style={{
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        transform:
                          "translate(-50%, -50%)",
                      }}
                      className={`absolute z-10 w-[210px] rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
                        isSelected
                          ? "border-blue-400 ring-4 ring-blue-100"
                          : "border-slate-200 hover:border-blue-300 hover:shadow-md"
                      }`}
                    >
                      {isKnowledgeNode(
                        node
                      ) ? (
                        <KnowledgeGraphNode
                          node={node}
                        />
                      ) : (
                        <EvidenceGraphNode
                          node={node}
                        />
                      )}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Graph Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-[11px] font-bold text-slate-500">
            <Legend
              className="bg-blue-100"
              label="원칙"
            />

            <Legend
              className="bg-violet-100"
              label="판단 규칙"
            />

            <Legend
              className="bg-amber-100"
              label="예외"
            />

            <Legend
              className="bg-slate-200"
              label="근거"
            />
          </div>
        </section>

        {/* 선택 노드 상세 + 관계 */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* Selected Node Detail */}
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-500">
                Selected Node
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-900">
                선택 노드 상세
              </h2>
            </div>

            {isKnowledgeNode(
              selectedNode
            ) ? (
              <KnowledgeDetail
                node={selectedNode}
              />
            ) : (
              <EvidenceDetail
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

            {selectedRelations.length >
            0 ? (
              <div className="space-y-3">
                {selectedRelations.map(
                  (relation) => {
                    const otherNodeId =
                      relation.source ===
                      selectedNode.id
                        ? relation.target
                        : relation.source;

                    const otherNode =
                      getNode(
                        otherNodeId
                      );

                    if (!otherNode) {
                      return null;
                    }

                    return (
                      <RelationCard
                        key={
                          relation.id
                        }
                        relation={
                          relation
                        }
                        otherNode={
                          otherNode
                        }
                        onClick={() =>
                          setSelectedNodeId(
                            otherNode.id
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
                  연결된 관계가
                  없습니다.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function KnowledgeGraphNode({
  node,
}: {
  node: Extract<
    GraphNode,
    {
      nodeType: "KNOWLEDGE";
    }
  >;
}) {
  const style =
    knowledgeTypeStyleMap[
      node.knowledgeType
    ] ?? {
      className:
        "border-slate-200 bg-slate-50 text-slate-600",
    };

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${style.className}`}
        >
          {node.typeLabel}
        </span>

        <span className="text-[10px] font-black text-blue-600">
          {node.confidence}%
        </span>
      </div>

      <p className="line-clamp-2 text-xs font-black leading-5 text-slate-800">
        {node.title}
      </p>

      <p className="mt-2 text-[10px] font-bold text-slate-400">
        {node.id} ·{" "}
        {node.status ===
        "VERIFIED"
          ? "검증 완료"
          : node.status}
      </p>
    </>
  );
}

function EvidenceGraphNode({
  node,
}: {
  node: Extract<
    GraphNode,
    {
      nodeType: "EVIDENCE";
    }
  >;
}) {
  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
          근거
        </span>

        <span className="text-[10px] font-black text-blue-600">
          관련도{" "}
          {Math.round(
            node.relevance * 100
          )}
          %
        </span>
      </div>

      <p className="line-clamp-2 text-xs font-black leading-5 text-slate-800">
        {node.title}
      </p>

      <p className="mt-2 text-[10px] font-bold text-slate-400">
        {node.sourceType} ·{" "}
        {node.sourceId}
      </p>
    </>
  );
}

function KnowledgeDetail({
  node,
}: {
  node: Extract<
    GraphNode,
    {
      nodeType: "KNOWLEDGE";
    }
  >;
}) {
  const style =
    knowledgeTypeStyleMap[
      node.knowledgeType
    ] ?? {
      className:
        "border-slate-200 bg-slate-50 text-slate-600",
    };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${style.className}`}
            >
              {node.typeLabel}
            </span>

            <span className="text-xs font-bold text-slate-400">
              {node.id}
            </span>

            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-700">
              {node.status ===
              "VERIFIED"
                ? "검증 완료"
                : node.status}
            </span>
          </div>

          <h3 className="mt-3 text-xl font-black leading-8 text-slate-900">
            {node.title}
          </h3>
        </div>

        <div className="shrink-0 rounded-2xl bg-blue-50 px-4 py-3 text-right">
          <p className="text-[10px] font-bold text-slate-400">
            Confidence
          </p>

          <p className="text-xl font-black text-blue-600">
            {node.confidence}%
          </p>
        </div>
      </div>

      <DetailCard
        title="추출 지식"
        subtitle="Knowledge"
        content={node.statement}
        highlight
      />

      <div className="grid gap-3 md:grid-cols-2">
        <DetailCard
          title="적용 맥락"
          subtitle="Context"
          content={node.context}
        />

        <DetailCard
          title="판단 규칙"
          subtitle="Rule"
          content={node.rule}
        />

        <DetailCard
          title="판단 근거"
          subtitle="Rationale"
          content={node.rationale}
        />

        <DetailCard
          title="예외 조건"
          subtitle="Exception"
          content={node.exception}
        />
      </div>
    </div>
  );
}

function EvidenceDetail({
  node,
}: {
  node: Extract<
    GraphNode,
    {
      nodeType: "EVIDENCE";
    }
  >;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
              Evidence
            </span>

            <span className="text-xs font-bold text-slate-400">
              {node.id}
            </span>
          </div>

          <h3 className="mt-3 text-xl font-black text-slate-900">
            {node.title}
          </h3>
        </div>

        <div className="shrink-0 rounded-2xl bg-blue-50 px-4 py-3 text-right">
          <p className="text-[10px] font-bold text-slate-400">
            관련도
          </p>

          <p className="text-xl font-black text-blue-600">
            {Math.round(
              node.relevance * 100
            )}
            %
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <DetailCard
          title="근거 유형"
          subtitle="Source Type"
          content={node.sourceType}
        />

        <DetailCard
          title="원본 식별자"
          subtitle="Source ID"
          content={node.sourceId}
        />
      </div>

      <DetailCard
        title="근거 내용"
        subtitle="Evidence Content"
        content={node.content}
        highlight
      />

      <DetailCard
        title="근거 방향"
        subtitle="Support Direction"
        content={
          node.supportDirection
        }
      />
    </div>
  );
}

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
          <FileText className="h-4 w-4 text-slate-500" />
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

      <p className="text-xs font-semibold leading-6 text-slate-700">
        {content}
      </p>
    </div>
  );
}

function RelationCard({
  relation,
  otherNode,
  onClick,
}: {
  relation: GraphRelation;
  otherNode: GraphNode;
  onClick: () => void;
}) {
  const style =
    relationStyleMap[
      relation.relationType
    ] ?? {
      className:
        "bg-slate-100 text-slate-600",
    };

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
              className={`rounded-full px-2.5 py-1 text-[10px] font-black ${style.className}`}
            >
              {
                relation.relationLabel
              }
            </span>

            <span className="text-[10px] font-bold text-slate-400">
              {
                relation.relationType
              }
            </span>

            <span className="ml-auto text-[10px] font-black text-blue-600">
              {Math.round(
                relation.confidence *
                  100
              )}
              %
            </span>
          </div>

          <p className="mt-2 line-clamp-2 text-xs font-black leading-5 text-slate-800">
            {otherNode.title}
          </p>

          <p className="mt-1 text-[10px] font-bold text-slate-400">
            {otherNode.id}
          </p>
        </div>
      </div>
    </button>
  );
}

function Legend({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${className}`}
      />

      {label}
    </div>
  );
}