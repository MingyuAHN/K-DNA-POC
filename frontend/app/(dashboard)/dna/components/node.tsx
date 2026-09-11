import {
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";

import type { KnowledgeGraphNode } from "@/services/knowledgeGraph";

import type { FlowKnowledgeNode } from "../types";

import {
  formatConfidence,
  knowledgeTypeStyleMap,
} from "../graph-utils";

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
          {formatConfidence(node.confidence_score)}
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

export default function KnowledgeFlowNode({
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
      {/* Incoming Handles */}
      {incomingEdgeIds.map((edgeId, index) => {
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
      })}

      <KnowledgeGraphCard
        node={knowledge}
        selected={selected}
      />

      {/* Outgoing Handles */}
      {outgoingEdgeIds.map((edgeId, index) => {
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
      })}
    </div>
  );
}