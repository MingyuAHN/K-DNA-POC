"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";

import ELK from "elkjs/lib/elk.bundled.js";

import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
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
   ELK
============================================================ */

const elk = new ELK();

const NODE_WIDTH = 280;
const NODE_HEIGHT = 170;


/* ============================================================
   React Flow Node 타입
============================================================ */

type KnowledgeNodeData = {
  knowledge: KnowledgeGraphNode;
  incomingEdgeIds: string[];
  outgoingEdgeIds: string[];
};

type FlowKnowledgeNode = Node<
  KnowledgeNodeData,
  "knowledgeNode"
>;


/* ============================================================
   Knowledge Type 스타일
============================================================ */

const knowledgeTypeStyleMap: Record<string, string> = {
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

const relationStyleMap: Record<string, string> = {
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
   Relation 색상
============================================================ */

function getRelationColor(
  relationType: string
) {
  switch (relationType) {
    case "REFINES":
      return "#7C3AED";

    case "SUPERSEDES":
      return "#94A3B8";

    case "HAS_EXCEPTION":
      return "#D97706";

    case "SUPPORTS":
      return "#2563EB";

    case "CONTRADICTS":
      return "#E11D48";

    case "CONTEXT_DIFFERS":
      return "#0891B2";

    default:
      return "#64748B";
  }
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
    knowledgeTypeStyleMap[node.knowledge_type] ??
    "border-slate-200 bg-slate-50 text-slate-600";

  const isSuperseded =
    node.status === "SUPERSEDED";

  return (
    <div
      className={`
        flex h-[170px] w-[280px] flex-col
        rounded-2xl border p-4 text-left
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
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
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

      <div className="mt-auto flex shrink-0 items-center justify-between gap-2 pt-3">
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
   Custom Knowledge Node

   Relation별 별도 Handle 생성
============================================================ */

function KnowledgeFlowNode({
  data,
  selected,
}: NodeProps<FlowKnowledgeNode>) {
  const {
    knowledge,
    incomingEdgeIds,
    outgoingEdgeIds,
  } = data;

  return (
    <div className="relative">
      {/* Incoming */}
      {incomingEdgeIds.map(
        (edgeId, index) => {
          const top =
            ((index + 1) /
              (incomingEdgeIds.length + 1)) *
            100;

          return (
            <Handle
              key={`target-${edgeId}`}
              id={`target-${edgeId}`}
              type="target"
              position={Position.Left}
              style={{
                top: `${top}%`,
                width: 9,
                height: 9,
                background: "#FFFFFF",
                border: "2px solid #94A3B8",
                zIndex: 20,
              }}
            />
          );
        }
      )}

      <KnowledgeGraphCard
        node={knowledge}
        selected={selected}
      />

      {/* Outgoing */}
      {outgoingEdgeIds.map(
        (edgeId, index) => {
          const top =
            ((index + 1) /
              (outgoingEdgeIds.length + 1)) *
            100;

          return (
            <Handle
              key={`source-${edgeId}`}
              id={`source-${edgeId}`}
              type="source"
              position={Position.Right}
              style={{
                top: `${top}%`,
                width: 9,
                height: 9,
                background: "#FFFFFF",
                border: "2px solid #64748B",
                zIndex: 20,
              }}
            />
          );
        }
      )}
    </div>
  );
}


/* ============================================================
   Custom Relation Edge

   - 동일 source → target 복수 관계 분리
   - 역방향 관계는 위쪽 corridor로 우회
   - Relation Label은 해당 선 위에 표시
============================================================ */

function KnowledgeRelationEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  data,
}: EdgeProps) {
  const edgeData =
    data as
      | {
          relationType?: string;
          parallelIndex?: number;
          parallelCount?: number;
        }
      | undefined;

  const relationType =
    edgeData?.relationType ?? "";

  const parallelIndex =
    edgeData?.parallelIndex ?? 0;

  const parallelCount =
    edgeData?.parallelCount ?? 1;

  const color =
    getRelationColor(
      relationType
    );

  const isSupersedes =
    relationType === "SUPERSEDES";

  /*
   * 동일 source → target 간 여러 관계가 있을 때
   * 중앙을 기준으로 서로 다른 lane을 사용
   */
  const lane =
    parallelIndex -
    (parallelCount - 1) / 2;

  const laneOffset =
    lane * 60;

  /*
   * ELK 배치에서 Source가 Target보다 오른쪽에 있으면
   * 역방향 관계로 판단
   */
  const isReverse =
    sourceX > targetX;

  let edgePath = "";
  let labelX = 0;
  let labelY = 0;


  /* ==========================================================
     역방향 Edge

     일반 선들과 섞이지 않도록 위쪽으로 우회
  ========================================================== */

  if (isReverse) {
    const sourceExitX =
      sourceX + 42;

    const targetEntryX =
      targetX - 42;

    const corridorY =
      Math.min(
        sourceY,
        targetY
      ) -
      120 -
      Math.abs(laneOffset);

    edgePath = `
      M ${sourceX} ${sourceY}
      L ${sourceExitX} ${sourceY}
      L ${sourceExitX} ${corridorY}
      L ${targetEntryX} ${corridorY}
      L ${targetEntryX} ${targetY}
      L ${targetX} ${targetY}
    `;

    labelX =
      (sourceExitX +
        targetEntryX) /
      2;

    labelY =
      corridorY;
  }


  /* ==========================================================
     정상 좌 → 우 Edge
  ========================================================== */

  else {
    const centerX =
      (sourceX + targetX) /
        2 +
      laneOffset;

    const [
      normalPath,
      normalLabelX,
      normalLabelY,
    ] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,

      centerX,

      borderRadius: 12,
      offset: 30,
    });

    edgePath =
      normalPath;

    labelX =
      normalLabelX;

    labelY =
      normalLabelY +
      lane * 22;
  }


  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color,

          strokeWidth:
            relationType ===
            "REFINES"
              ? 2.2
              : 1.8,

          strokeDasharray:
            isSupersedes
              ? "7 5"
              : undefined,

          opacity:
            isSupersedes
              ? 0.76
              : 0.92,
        }}
      />

      <EdgeLabelRenderer>
        <div
          className={`
            pointer-events-none
            absolute
            whitespace-nowrap
            rounded-md
            border
            bg-white
            px-2
            py-1
            text-[9px]
            font-black
            shadow-[0_2px_8px_rgba(15,23,42,0.10)]

            ${
              relationType === "REFINES"
                ? "border-violet-200 text-violet-700"
                : relationType === "SUPERSEDES"
                  ? "border-slate-200 text-slate-600"
                  : relationType === "HAS_EXCEPTION"
                    ? "border-amber-200 text-amber-700"
                    : relationType === "SUPPORTS"
                      ? "border-blue-200 text-blue-700"
                      : relationType === "CONTRADICTS"
                        ? "border-rose-200 text-rose-700"
                        : relationType === "CONTEXT_DIFFERS"
                          ? "border-cyan-200 text-cyan-700"
                          : "border-slate-200 text-slate-600"
            }
          `}
          style={{
            zIndex: 30,

            transform: `
              translate(-50%, -50%)
              translate(
                ${labelX}px,
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


/* ============================================================
   Custom Node / Edge 등록
============================================================ */

const nodeTypes = {
  knowledgeNode:
    KnowledgeFlowNode,
};

const edgeTypes = {
  knowledgeRelation:
    KnowledgeRelationEdge,
};


/* ============================================================
   ELK Layout

   Graph 관계 기준 좌 → 우 계층형 배치
============================================================ */

async function createElkLayout(
  graph: KnowledgeGraphResponse,
  selectedNodeId: string | null
): Promise<FlowKnowledgeNode[]> {
  const children =
    graph.nodes.map((node) => ({
      id: node.knowledge_id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }));

  const edges =
    graph.edges.map((edge) => ({
      id: edge.relation_id,

      sources: [
        edge.source,
      ],

      targets: [
        edge.target,
      ],
    }));

  const elkGraph = {
    id: "knowledge-dna-root",

    layoutOptions: {
      "elk.algorithm":
        "layered",

      "elk.direction":
        "RIGHT",

      "elk.edgeRouting":
        "ORTHOGONAL",

      "elk.layered.spacing.nodeNodeBetweenLayers":
        "230",

      "elk.spacing.nodeNode":
        "120",

      "elk.spacing.edgeNode":
        "85",

      "elk.spacing.edgeEdge":
        "55",

      "elk.layered.spacing.edgeNodeBetweenLayers":
        "80",

      "elk.layered.spacing.edgeEdgeBetweenLayers":
        "45",

      "elk.layered.nodePlacement.strategy":
        "NETWORK_SIMPLEX",

      "elk.layered.crossingMinimization.strategy":
        "LAYER_SWEEP",

      "elk.layered.considerModelOrder.strategy":
        "NODES_AND_EDGES",
    },

    children,
    edges,
  };

  const result =
    await elk.layout(
      elkGraph
    );

  return graph.nodes.map(
    (node) => {
      const layoutNode =
        result.children?.find(
          (item) =>
            item.id ===
            node.knowledge_id
        );

      const incomingEdgeIds =
        graph.edges
          .filter(
            (edge) =>
              edge.target ===
              node.knowledge_id
          )
          .map(
            (edge) =>
              edge.relation_id
          );

      const outgoingEdgeIds =
        graph.edges
          .filter(
            (edge) =>
              edge.source ===
              node.knowledge_id
          )
          .map(
            (edge) =>
              edge.relation_id
          );

      return {
        id:
          node.knowledge_id,

        type:
          "knowledgeNode",

        position: {
          x:
            layoutNode?.x ?? 0,

          y:
            layoutNode?.y ?? 0,
        },

        selected:
          selectedNodeId ===
          node.knowledge_id,

        data: {
          knowledge:
            node,

          incomingEdgeIds,

          outgoingEdgeIds,
        },
      };
    }
  );
}


/* ============================================================
   DNA 실제 화면
============================================================ */

function DnaPageContent() {
  const searchParams =
    useSearchParams();

  const missionId =
    searchParams.get(
      "missionId"
    );

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
  ] = useState<string | null>(
    null
  );

  const [
    flowNodes,
    setFlowNodes,
  ] = useState<
    FlowKnowledgeNode[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(
      null
    );


  /* ==========================================================
     Mission + Graph 조회
  ========================================================== */

  const loadData =
    useCallback(
      async () => {
        try {
          setLoading(true);
          setError(null);

          if (!missionId) {
            setMission(null);
            setGraph(null);
            setFlowNodes([]);
            setSelectedNodeId(
              null
            );

            setError(
              "Mission ID가 전달되지 않았습니다."
            );

            return;
          }

          const [
            missionResult,
            graphResult,
          ] = await Promise.all([
            getMission(
              missionId
            ),

            getKnowledgeGraph(
              missionId
            ),
          ]);

          setMission(
            missionResult
          );

          setGraph(
            graphResult
          );

          sessionStorage.removeItem(
            `knowledge-graph-dirty:${missionId}`
          );

          const firstVerified =
            graphResult.nodes.find(
              (node) =>
                node.status ===
                "VERIFIED"
            );

          const initialNodeId =
            firstVerified
              ?.knowledge_id ??
            graphResult.nodes[0]
              ?.knowledge_id ??
            null;

          setSelectedNodeId(
            initialNodeId
          );

          const layoutNodes =
            await createElkLayout(
              graphResult,
              initialNodeId
            );

          setFlowNodes(
            layoutNodes
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
     선택 상태 갱신
  ========================================================== */

  useEffect(() => {
    setFlowNodes(
      (current) =>
        current.map(
          (node) => ({
            ...node,

            selected:
              node.id ===
              selectedNodeId,
          })
        )
    );
  }, [selectedNodeId]);


  /* ==========================================================
     선택 노드
  ========================================================== */

  const selectedNode =
    useMemo(
      () =>
        graph?.nodes.find(
          (node) =>
            node.knowledge_id ===
            selectedNodeId
        ) ?? null,
      [
        graph,
        selectedNodeId,
      ]
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
      [
        graph,
        selectedNodeId,
      ]
    );


  /* ==========================================================
     React Flow Edges

     동일 Source → Target 관계를 그룹화해서
     parallelIndex / parallelCount 전달
  ========================================================== */

  const flowEdges =
    useMemo<Edge[]>(
      () => {
        if (!graph) {
          return [];
        }

        const edgeGroups =
          new Map<
            string,
            KnowledgeGraphEdge[]
          >();

        graph.edges.forEach(
          (edge) => {
            const groupKey =
              `${edge.source}→${edge.target}`;

            const current =
              edgeGroups.get(
                groupKey
              ) ?? [];

            current.push(
              edge
            );

            edgeGroups.set(
              groupKey,
              current
            );
          }
        );


        return graph.edges.map(
          (edge) => {
            const color =
              getRelationColor(
                edge.relation_type
              );

            const groupKey =
              `${edge.source}→${edge.target}`;

            const group =
              edgeGroups.get(
                groupKey
              ) ?? [edge];

            const parallelIndex =
              group.findIndex(
                (item) =>
                  item.relation_id ===
                  edge.relation_id
              );

            return {
              id:
                edge.relation_id,

              source:
                edge.source,

              target:
                edge.target,

              sourceHandle:
                `source-${edge.relation_id}`,

              targetHandle:
                `target-${edge.relation_id}`,

              type:
                "knowledgeRelation",

              markerEnd: {
                type:
                  MarkerType.ArrowClosed,

                color,

                width: 20,
                height: 20,
              },

              data: {
                relationType:
                  edge.relation_type,

                parallelIndex,

                parallelCount:
                  group.length,
              },
            };
          }
        );
      },
      [graph]
    );


  /* ==========================================================
     관계 상대 노드 조회
  ========================================================== */

  const getOtherNode = (
    relation:
      KnowledgeGraphEdge
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
            검증된 지식 간의 관계와 버전 변화를 Knowledge Graph로 확인합니다.
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
                {mission?.title ?? "-"}
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
              Knowledge Graph를 불러오는 중입니다.
            </p>

          </section>
        )}


        {/* Error */}
        {!loading &&
          error && (
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
          graph.nodes.length === 0 && (
            <section className="rounded-[24px] border border-slate-200 bg-white p-10 text-center shadow-sm">

              <p className="text-sm font-semibold text-slate-400">
                표시할 Knowledge Unit이 없습니다.
              </p>

            </section>
          )}


        {!loading &&
          !error &&
          graph &&
          graph.nodes.length > 0 && (
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
                        {graph.node_count} Nodes ·{" "}
                        {graph.edge_count} Relations
                      </p>

                    </div>

                  </div>

                </div>


                {/* React Flow */}
                <div className="knowledge-dna-flow h-[540px] overflow-hidden rounded-[22px] border border-slate-100 bg-slate-50/70">

                  <ReactFlow
                    nodes={flowNodes}
                    edges={flowEdges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}

                    fitView

                    fitViewOptions={{
                      padding: 0.2,
                      maxZoom: 1,
                    }}

                    minZoom={0.35}
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

                    {graph.nodes.length > 6 && (
                      <MiniMap />
                    )}

                  </ReactFlow>

                </div>


                {/* Legend */}
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

                  <Legend
                    className="bg-amber-400"
                    label="HAS_EXCEPTION"
                  />

                  <Legend
                    className="bg-blue-500"
                    label="SUPPORTS"
                  />

                </div>

              </section>


              {/* 상세 */}
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
                        연결된 관계가 없습니다.
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
   Page
============================================================ */

export default function DnaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] p-3 text-slate-900 sm:p-4 lg:p-6">

          <div className="mx-auto max-w-[1500px]">

            <section className="rounded-[24px] border border-slate-200 bg-white p-10 text-center shadow-sm">

              <p className="text-sm font-semibold text-slate-400">
                Knowledge DNA를 불러오는 중입니다.
              </p>

            </section>

          </div>

        </div>
      }
    >
      <DnaPageContent />
    </Suspense>
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
        content={
          node.statement
        }
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
          content={
            node.status
          }
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
  relation:
    KnowledgeGraphEdge;

  otherNode:
    KnowledgeGraphNode;

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


/* ============================================================
   Legend
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