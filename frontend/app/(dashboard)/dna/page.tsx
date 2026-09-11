"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useSearchParams,
} from "next/navigation";

import {
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import {
  getKnowledgeGraph,
  type KnowledgeGraphResponse,
} from "@/services/knowledgeGraph";

import {
  getMission,
  type MissionResponse,
} from "@/services/mission";

import type {
  FlowKnowledgeNode,
} from "./types";

import {
  createElkLayout,
} from "./graph-utils";

import KnowledgeGraph from "./components/graph";
import KnowledgeDetailPanel from "./components/detail-panel";

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

  /* ============================================================
     Mission + Graph 조회
  ============================================================ */

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

  /* ============================================================
     선택 상태 갱신
  ============================================================ */

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

  /* ============================================================
     선택 노드
  ============================================================ */

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

  /* ============================================================
     선택 노드 관계
  ============================================================ */

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

        {/* Graph + Detail */}
        {!loading &&
          !error &&
          graph &&
          graph.nodes.length > 0 && (
            <>
              <KnowledgeGraph
                graph={graph}
                flowNodes={flowNodes}
                onNodeSelect={
                  setSelectedNodeId
                }
              />

              <KnowledgeDetailPanel
                graph={graph}
                selectedNode={selectedNode}
                selectedNodeId={
                  selectedNodeId
                }
                selectedRelations={
                  selectedRelations
                }
                onNodeSelect={
                  setSelectedNodeId
                }
              />
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