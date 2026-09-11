import ELK from "elkjs/lib/elk.bundled.js";

import type { KnowledgeGraphResponse } from "@/services/knowledgeGraph";

import type { FlowKnowledgeNode } from "./types";

const elk = new ELK();

export const NODE_WIDTH = 280;
export const NODE_HEIGHT = 170;

export const knowledgeTypeStyleMap: Record<string, string> = {
  FACT: "border-slate-200 bg-slate-50 text-slate-700",
  PRINCIPLE: "border-blue-200 bg-blue-50 text-blue-700",
  DECISION_RULE: "border-violet-200 bg-violet-50 text-violet-700",
  HEURISTIC: "border-cyan-200 bg-cyan-50 text-cyan-700",
  EXCEPTION: "border-amber-200 bg-amber-50 text-amber-700",
  FAILURE_LESSON: "border-rose-200 bg-rose-50 text-rose-700",
  TRADE_OFF: "border-orange-200 bg-orange-50 text-orange-700",
  EXPERT_OPINION: "border-slate-200 bg-slate-100 text-slate-600",
};

export const relationStyleMap: Record<string, string> = {
  SUPPORTS: "bg-blue-100 text-blue-700",
  REFINES: "bg-violet-100 text-violet-700",
  HAS_EXCEPTION: "bg-amber-100 text-amber-700",
  CONTRADICTS: "bg-rose-100 text-rose-700",
  CONTEXT_DIFFERS: "bg-cyan-100 text-cyan-700",
  SUPERSEDES: "bg-slate-200 text-slate-700",
  UNRELATED: "bg-slate-100 text-slate-500",
};

export function getRelationColor(relationType: string) {
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

export function formatConfidence(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${Math.round(value * 100)}%`;
}

export function formatContext(context: Record<string, unknown>) {
  const entries = Object.entries(context).filter(
    ([, value]) =>
      value !== null &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0)
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

export async function createElkLayout(
  graph: KnowledgeGraphResponse,
  selectedNodeId: string | null
): Promise<FlowKnowledgeNode[]> {
  const children = graph.nodes.map((node) => ({
    id: node.knowledge_id,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  }));

  const edges = graph.edges.map((edge) => ({
    id: edge.relation_id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const elkGraph = {
    id: "knowledge-dna-root",

    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",

      "elk.layered.spacing.nodeNodeBetweenLayers": "230",
      "elk.spacing.nodeNode": "120",
      "elk.spacing.edgeNode": "85",
      "elk.spacing.edgeEdge": "55",
      "elk.layered.spacing.edgeNodeBetweenLayers": "80",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "45",

      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    },

    children,
    edges,
  };

  const result = await elk.layout(elkGraph);

  return graph.nodes.map((node) => {
    const layoutNode = result.children?.find(
      (item) => item.id === node.knowledge_id
    );

    const incomingEdgeIds = graph.edges
      .filter((edge) => edge.target === node.knowledge_id)
      .map((edge) => edge.relation_id);

    const outgoingEdgeIds = graph.edges
      .filter((edge) => edge.source === node.knowledge_id)
      .map((edge) => edge.relation_id);

    return {
      id: node.knowledge_id,
      type: "knowledgeNode",

      position: {
        x: layoutNode?.x ?? 0,
        y: layoutNode?.y ?? 0,
      },

      selected: selectedNodeId === node.knowledge_id,

      data: {
        knowledge: node,
        incomingEdgeIds,
        outgoingEdgeIds,
      },
    };
  });
}