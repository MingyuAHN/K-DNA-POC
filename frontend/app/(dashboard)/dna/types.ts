import type { Node } from "@xyflow/react";

import type { KnowledgeGraphNode } from "@/services/knowledgeGraph";

export type KnowledgeNodeData = {
  knowledge: KnowledgeGraphNode;
  incomingEdgeIds: string[];
  outgoingEdgeIds: string[];
};

export type FlowKnowledgeNode = Node<
  KnowledgeNodeData,
  "knowledgeNode"
>;