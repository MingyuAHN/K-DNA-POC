"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useSearchParams,
} from "next/navigation";

import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import {
  BookOpenCheck,
  CircleDot,
  GitBranch,
  Network,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import {
  getKnowledgeGraph,
  type KnowledgeGraphEdge,
  type KnowledgeGraphNode,
  type KnowledgeGraphResponse,
} from "@/services/knowledgeGraph";

import {
  getMission,
  type MissionResponse,
} from "@/services/mission";


/* ============================================================
   React Flow Node 타입
============================================================ */

type FlowKnowledgeNode = Node<{
  knowledge: KnowledgeGraphNode;
  label: React.ReactNode;
}>;


/* ============================================================
   Knowledge Type 스타일
============================================================ */

const knowledgeTypeStyleMap: Record<
  string,
  string
> = {
  FACT:
    "border-slate-200 bg-slate-50 text-slate-700",

  PRINCIPLE:
    "border-blue-200 bg-blue-50 text-blue-700",

  DECISION_RULE:
    "border-violet-200 bg-violet-50 text-violet-700",

  HEURISTIC:
    "border-cyan-200 bg-cyan-50 text-cyan-700",

  EXCEPTION:
    "border-amber-200 bg-amber-50 text-amber-700",

  FAILURE_LESSON:
    "border-rose-200 bg-rose-50 text-rose-700",

  TRADE_OFF:
    "border-orange-200 bg-orange-50 text-orange-700",

  EXPERT_OPINION:
    "border-slate-200 bg-slate-100 text-slate-600",
};


/* ============================================================
   Relation 스타일
============================================================ */

const relationStyleMap: Record<
  string,
  string
> = {
  SUPPORTS:
    "bg-blue-100 text-blue-700",

  REFINES:
    "bg-violet-100 text-violet-700",

  HAS_EXCEPTION:
    "bg-amber-100 text-amber-700",

  CONTRADICTS:
    "bg-rose-100 text-rose-700",

  CONTEXT_DIFFERS:
    "bg-cyan-100 text-cyan-700",

  SUPERSEDES:
    "bg-slate-200 text-slate-700",

  UNRELATED:
    "bg-slate-100 text-slate-500",
};


/* ============================================================
   Graph 노드 자동 배치
============================================================ */

function createNodePosition(
  index: number,
  total: number
) {
  const columns =
    total <= 3
      ? Math.max(total, 1)
      : Math.ceil(Math.sqrt(total));

  return {
    x: (index % columns) * 420,
    y:
      Math.floor(index / columns) *
      230,
  };
}


/* ============================================================
   Confidence 표시
============================================================ */

function formatConfidence(
  value: number | null
) {
  if (value === null) {
    return "-";
  }

  return `${Math.round(value * 100)}%`;
}


/* ============================================================
   Context 표시
============================================================ */

function formatContext(
  context: Record<string, unknown>
) {
  const entries =
    Object.entries(context).filter(
      ([, value]) =>
        value !== null &&
        value !== "" &&
        !(
          Array.isArray(value) &&
          value.length === 0
        )
    );

  if (entries.length === 0) {
    return "-";
  }

  return entries
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${value.join(", ")}`;
      }

      return `${key}: ${String(value)}`;
    })
    .join("\n");
}


/* ============================================================
   Graph Node Card
============================================================ */

function KnowledgeGraphCard({
  node,
  selected,
}: {
  node: KnowledgeGraphNode;
  selected: boolean;
}) {
  const typeStyle =
    knowledgeTypeStyleMap[
      node.knowledge_type
    ] ??
    "border-slate-200 bg-slate-50 text-slate-600";

  const isSuperseded =
    node.status === "SUPERSEDED";

  return (
    <div
      className={`
        w-[280px] rounded-2xl border p-4 text-left
        transition-all duration-200
        ${
          isSuperseded
            ? "border-dashed border-slate-300 bg-slate-50 text-slate-500"
            : "border-slate-200 bg-white text-slate-900"
        }
        ${
          selected
            ? "ring-4 ring-blue-100 shadow-md"
            : "shadow-sm hover:shadow-md"
        }
      `}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${typeStyle}`}
        >
          {node.knowledge_type}
        </span>

        <span
          className={`text-xs font-black ${
            isSuperseded
              ? "text-slate-400"
              : "text-blue-600"
          }`}
        >
          {formatConfidence(
            node.confidence_score
          )}
        </span>
      </div>

      <p
        className={`line-clamp-3 text-sm font-black leading-6 ${
          isSuperseded
            ? "text-slate-500"
            : "text-slate-800"
        }`}
      >
        {node.statement}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span
          className={`text-[10px] font-black ${
            isSuperseded
              ? "text-slate-400"
              : "text-emerald-600"
          }`}
        >
          {node.status}
        </span>

        <span className="text-[10px] font-bold text-slate-400">
          v{node.version}
        </span>
      </div>
    </div>
  );
}


/* ============================================================
   Custom Relation Edge

   - REFINES: 보라색 직선
   - SUPERSEDES: 회색 점선 곡선
   - Relation Label은 노드보다 위에 표시
============================================================ */

function KnowledgeRelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  data,
}: EdgeProps) {
  const relationType = String(
    (
      data as {
        relationType?: string;
      } | undefined
    )?.relationType ?? ""
  );

  const isSupersedes =
    relationType === "SUPERSEDES";

  const isRefines =
    relationType === "REFINES";

  /* 두 노드 사이 중앙 좌표 */
  const middleX =
    (sourceX + targetX) / 2;

  const middleY =
    (sourceY + targetY) / 2;

  /*
   * REFINES는 가운데 직선
   * SUPERSEDES는 아래쪽 곡선으로 분리
   */
  const edgePath =
    isSupersedes
      ? `M ${sourceX} ${sourceY}
         C ${sourceX + 80} ${sourceY + 55},
           ${targetX - 80} ${targetY + 55},
           ${targetX} ${targetY}`
      : `M ${sourceX} ${sourceY}
         L ${targetX} ${targetY}`;

  /* 관계별 선 색상 */
  const stroke =
    isRefines
      ? "#7C3AED"
      : isSupersedes
        ? "#94A3B8"
        : "#CBD5E1";

  /*
   * 관계명 위치
   * REFINES는 직선 위
   * SUPERSEDES는 곡선 아래
   */
  const labelY =
    isSupersedes
      ? middleY + 42
      : middleY - 22;

  return (
    <>
      {/* 관계선 */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke,
          strokeWidth: 2.4,

          strokeDasharray:
            isSupersedes
              ? "7 5"
              : undefined,
        }}
      />

      {/* 관계명 */}
      <EdgeLabelRenderer>
        <div
          className={`
            pointer-events-none
            absolute
            rounded-lg
            border
            bg-white
            px-2.5
            py-1
            text-[10px]
            font-black
            shadow-sm

            ${
              isRefines
                ? "border-violet-200 text-violet-700"
                : "border-slate-200 text-slate-600"
            }
          `}
          style={{
            /*
             * 중요:
             * Relation Label이 Node 카드 뒤로
             * 들어가지 않도록 위쪽 Layer 사용
             */
            zIndex: 1000,

            transform: `
              translate(-50%, -50%)
              translate(
                ${middleX}px,
                ${labelY}px
              )
            `,
          }}
        >
          {relationType}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}


/* Custom Edge 등록 */
const edgeTypes = {
  knowledgeRelation:
    KnowledgeRelationEdge,
};


/* ============================================================
   Page
============================================================ */

export default function DnaPage() {
  /* Mission 페이지에서 전달된 Mission ID */
  const searchParams =
    useSearchParams();

  const missionId =
    searchParams.get("missionId");


  const [mission, setMission] =
    useState<MissionResponse | null>(
      null
    );

  const [graph, setGraph] =
    useState<KnowledgeGraphResponse | null>(
      null
    );

  const [
    selectedNodeId,
    setSelectedNodeId,
  ] = useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);


  /* ==========================================================
     Mission + Graph 조회
  ========================================================== */

  const loadData = useCallback(
    async () => {
      try {
        setLoading(true);
        setError(null);

        if (!missionId) {
          setMission(null);
          setGraph(null);
          setSelectedNodeId(null);

          setError(
            "Mission ID가 전달되지 않았습니다."
          );

          return;
        }

        const [
          missionResult,
          graphResult,
        ] = await Promise.all([
          getMission(missionId),
          getKnowledgeGraph(
            missionId
          ),
        ]);

        setMission(missionResult);
        setGraph(graphResult);

        /* VERIFIED 노드 우선 선택 */
        const firstVerified =
          graphResult.nodes.find(
            (node) =>
              node.status ===
              "VERIFIED"
          );

        setSelectedNodeId(
          firstVerified?.knowledge_id ??
            graphResult.nodes[0]
              ?.knowledge_id ??
            null
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Knowledge Graph 조회 중 오류가 발생했습니다."
        );
      } finally {
        setLoading(false);
      }
    },
    [missionId]
  );


  useEffect(() => {
    void loadData();
  }, [loadData]);


  /* ==========================================================
     선택 노드
  ========================================================== */

  const selectedNode = useMemo(
    () =>
      graph?.nodes.find(
        (node) =>
          node.knowledge_id ===
          selectedNodeId
      ) ?? null,
    [graph, selectedNodeId]
  );


  /* ==========================================================
     선택 노드 관계
  ========================================================== */

  const selectedRelations =
    useMemo(
      () =>
        graph?.edges.filter(
          (edge) =>
            edge.source ===
              selectedNodeId ||
            edge.target ===
              selectedNodeId
        ) ?? [],
      [graph, selectedNodeId]
    );


  /* ==========================================================
     React Flow Nodes
  ========================================================== */

  const flowNodes =
    useMemo<FlowKnowledgeNode[]>(
      () => {
        if (!graph) {
          return [];
        }

        return graph.nodes.map(
          (node, index) => ({
            id: node.knowledge_id,

            position:
              createNodePosition(
                index,
                graph.nodes.length
              ),

            sourcePosition:
              Position.Right,

            targetPosition:
              Position.Left,

            data: {
              knowledge: node,

              label: (
                <KnowledgeGraphCard
                  node={node}
                  selected={
                    selectedNodeId ===
                    node.knowledge_id
                  }
                />
              ),
            },

            style: {
              padding: 0,
              border: "none",
              outline: "none",
              boxShadow: "none",
              background:
                "transparent",
            },
          })
        );
      },
      [
        graph,
        selectedNodeId,
      ]
    );


  /* ==========================================================
     React Flow Edges
  ========================================================== */

  const flowEdges = useMemo<Edge[]>(
    () => {
      if (!graph) {
        return [];
      }

      return graph.edges.map(
        (edge) => ({
          id: edge.relation_id,

          source: edge.source,
          target: edge.target,

          type:
            "knowledgeRelation",

          markerEnd: {
            type:
              MarkerType.ArrowClosed,

            color:
              edge.relation_type ===
              "REFINES"
                ? "#7C3AED"
                : "#94A3B8",
          },

          data: {
            relationType:
              edge.relation_type,
          },
        })
      );
    },
    [graph]
  );


  /* ==========================================================
     관계 상대 노드 조회
  ========================================================== */

  const getOtherNode = (
    relation: KnowledgeGraphEdge
  ) => {
    if (
      !graph ||
      !selectedNodeId
    ) {
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
    <div className="min-h-screen bg-[#F8FAFC] p-3 text-slate-900 sm:p-4 lg:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">

        {/* 화면 제목 */}
        <header className="px-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Knowledge DNA
          </h1>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            검증된 지식 간의 관계와
            버전 변화를 Knowledge
            Graph로 확인합니다.
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
                {mission?.title ??
                  "-"}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadData()
              }
              className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
            >
              <RefreshCw className="h-4 w-4" />
              새로고침
            </button>

          </div>
        </section>


        {/* Loading */}
        {loading && (
          <section className="rounded-[24px] border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-400">
              Knowledge Graph를
              불러오는 중입니다.
            </p>
          </section>
        )}


        {/* Error */}
        {!loading && error && (
          <section className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 shadow-sm">

            <div className="flex items-center gap-3">
              <TriangleAlert className="h-5 w-5 text-rose-500" />

              <p className="text-sm font-bold text-rose-700">
                {error}
              </p>
            </div>

          </section>
        )}


        {/* Empty */}
        {!loading &&
          !error &&
          graph &&
          graph.nodes.length ===
            0 && (
            <section className="rounded-[24px] border border-slate-200 bg-white p-10 text-center shadow-sm">

              <p className="text-sm font-semibold text-slate-400">
                표시할 Knowledge
                Unit이 없습니다.
              </p>

            </section>
          )}


        {!loading &&
          !error &&
          graph &&
          graph.nodes.length >
            0 && (
            <>
              {/* Knowledge Graph */}
              <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">

                <div className="mb-5 flex items-center justify-between gap-3">

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                      <Network className="h-5 w-5" />
                    </div>

                    <div>
                      <h2 className="text-sm font-black text-slate-900">
                        Knowledge DNA Graph
                      </h2>

                      <p className="text-[11px] font-semibold text-slate-400">
                        {graph.node_count}{" "}
                        Nodes ·{" "}
                        {graph.edge_count}{" "}
                        Relations
                      </p>
                    </div>

                  </div>

                </div>


                {/* React Flow */}
                <div className="knowledge-dna-flow h-[540px] overflow-hidden rounded-[22px] border border-slate-100 bg-slate-50/70">

                  <ReactFlow
                    nodes={flowNodes}
                    edges={flowEdges}
                    edgeTypes={edgeTypes}

                    fitView
                    fitViewOptions={{
                      padding: 0.3,
                      maxZoom: 1.05,
                    }}

                    minZoom={0.4}
                    maxZoom={1.5}

                    nodesFocusable={false}

                    onNodeClick={(
                      _event,
                      node
                    ) =>
                      setSelectedNodeId(
                        node.id
                      )
                    }
                  >
                    <Background
                      gap={22}
                      size={1}
                      color="#CBD5E1"
                    />

                    <Controls />

                    {/* 노드가 많을 때만 MiniMap 표시 */}
                    {graph.nodes.length >
                      6 && (
                      <MiniMap />
                    )}

                  </ReactFlow>

                </div>


                {/* Graph Legend */}
                <div className="mt-4 flex flex-wrap gap-4 text-[11px] font-bold text-slate-500">

                  <Legend
                    className="bg-emerald-400"
                    label="VERIFIED"
                  />

                  <Legend
                    className="bg-slate-300"
                    label="SUPERSEDED"
                  />

                  <Legend
                    className="bg-violet-400"
                    label="REFINES"
                  />

                  <Legend
                    className="bg-slate-400"
                    label="SUPERSEDES"
                  />

                </div>

              </section>


              {/* 선택 노드 상세 + 관계 */}
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
                      node={
                        selectedNode
                      }
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
                              relation={
                                relation
                              }
                              otherNode={
                                otherNode
                              }
                              onClick={() =>
                                setSelectedNodeId(
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
                        연결된 관계가
                        없습니다.
                      </p>

                    </div>
                  )}

                </section>

              </div>
            </>
          )}

      </div>
    </div>
  );
}


/* ============================================================
   선택 Knowledge 상세
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
          content={
            node.knowledge_type
          }
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


      {/* Version 정보 */}
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
   연결 관계 카드
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
              {
                relation.relation_type
              }
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
   상세 공통 카드
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


/* ============================================================
   Graph Legend
============================================================ */

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