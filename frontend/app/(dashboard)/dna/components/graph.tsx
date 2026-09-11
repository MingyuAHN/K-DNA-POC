import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  MarkerType,
  MiniMap,
  ReactFlow,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { Network } from "lucide-react";

import type {
  KnowledgeGraphEdge,
  KnowledgeGraphResponse,
} from "@/services/knowledgeGraph";

import type { FlowKnowledgeNode } from "../types";

import {
  getRelationColor,
} from "../graph-utils";

import KnowledgeFlowNode from "./node";

/* ============================================================
   Custom Relation Edge
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
    getRelationColor(relationType);

  const isSupersedes =
    relationType === "SUPERSEDES";

  const lane =
    parallelIndex -
    (parallelCount - 1) / 2;

  const laneOffset =
    lane * 60;

  const isReverse =
    sourceX > targetX;

  let edgePath = "";
  let labelX = 0;
  let labelY = 0;

  /* 역방향 Edge */
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
  } else {
    /* 일반 좌 → 우 Edge */

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
            relationType === "REFINES"
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

const nodeTypes = {
  knowledgeNode:
    KnowledgeFlowNode,
};

const edgeTypes = {
  knowledgeRelation:
    KnowledgeRelationEdge,
};

type KnowledgeGraphProps = {
  graph: KnowledgeGraphResponse;
  flowNodes: FlowKnowledgeNode[];
  onNodeSelect: (nodeId: string) => void;
};

export default function KnowledgeGraph({
  graph,
  flowNodes,
  onNodeSelect,
}: KnowledgeGraphProps) {
  const edgeGroups =
    new Map<
      string,
      KnowledgeGraphEdge[]
    >();

  graph.edges.forEach((edge) => {
    const groupKey =
      `${edge.source}→${edge.target}`;

    const current =
      edgeGroups.get(groupKey) ?? [];

    current.push(edge);

    edgeGroups.set(
      groupKey,
      current
    );
  });

  const flowEdges: Edge[] =
    graph.edges.map((edge) => {
      const color =
        getRelationColor(
          edge.relation_type
        );

      const groupKey =
        `${edge.source}→${edge.target}`;

      const group =
        edgeGroups.get(groupKey) ??
        [edge];

      const parallelIndex =
        group.findIndex(
          (item) =>
            item.relation_id ===
            edge.relation_id
        );

      return {
        id: edge.relation_id,

        source: edge.source,
        target: edge.target,

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
    });

  return (
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
            onNodeSelect(node.id)
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