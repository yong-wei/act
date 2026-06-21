'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Filter, Network, PanelRightOpen } from 'lucide-react';
import {
  buildGraphCenterPayload,
  type GraphCenterDomain,
  type GraphCenterPayload,
  type GraphCenterResourceCoverageMissingType,
  type GraphCenterResourceCoverageState,
} from '@/lib/data-governance/graph-center';

interface GraphCenterClientProps {
  initialPayload: GraphCenterPayload;
  rootPayloads?: Partial<Record<GraphCenterDomain, GraphCenterPayload>>;
}

export function GraphCenterClient({ initialPayload, rootPayloads }: GraphCenterClientProps) {
  const [domain, setDomain] = useState<GraphCenterDomain>(initialPayload.activeDomain);
  const [objectiveId, setObjectiveId] = useState<string | null>(initialPayload.objectiveId);
  const [portraitDimension, setPortraitDimension] = useState<GraphCenterPayload['portraitDimension']>(
    initialPayload.portraitDimension,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialPayload.selectedNode?.node.id ?? null);
  const payload = useMemo(() => {
    const rootPayload = rootPayloads?.[domain] ?? (
      domain === initialPayload.activeDomain ? initialPayload : null
    );
    const canReuseInitialPayload = domain === initialPayload.activeDomain &&
      objectiveId === initialPayload.objectiveId &&
      portraitDimension === initialPayload.portraitDimension;
    const initialSelectedNodeId = initialPayload.selectedNode?.node.id ?? null;
    if (canReuseInitialPayload && selectedNodeId === initialSelectedNodeId) return initialPayload;
    if (rootPayload) {
      return filterGraphCenterPayload(rootPayload, {
        objectiveId,
        portraitDimension,
        selectedNodeId,
      });
    }
    return buildGraphCenterPayload({
      domain,
      objectiveId,
      portraitDimension,
      selectedNodeId,
    });
  }, [domain, initialPayload, objectiveId, portraitDimension, rootPayloads, selectedNodeId]);

  const handleDomainChange = (nextDomain: GraphCenterDomain) => {
    setDomain(nextDomain);
    setObjectiveId(null);
    setPortraitDimension(null);
    setSelectedNodeId(null);
  };

  return (
    <section
      className="space-y-4"
      data-graph-center-surface="read-only"
      data-graph-center-domain={payload.activeDomain}
    >
      <div className="flex flex-col gap-3 border-b border-platform-border pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="图谱域">
          {payload.domains.map((domainOption) => (
            <button
              key={domainOption.id}
              type="button"
              role="tab"
              aria-selected={payload.activeDomain === domainOption.id}
              onClick={() => handleDomainChange(domainOption.id)}
              className={[
                'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition',
                payload.activeDomain === domainOption.id
                  ? 'border-platform-action-primary bg-platform-action-subtle text-platform-fg-primary'
                  : 'border-platform-border bg-platform-canvas text-platform-fg-muted hover:text-platform-fg-primary',
              ].join(' ')}
            >
              <Network className="h-4 w-4" aria-hidden="true" />
              <span>{domainOption.label}</span>
              <span className="text-xs text-platform-fg-muted">{domainOption.nodeCount}</span>
            </button>
          ))}
        </div>
        <a
          href="/knowledge"
          className="inline-flex items-center justify-center rounded-md border border-platform-border px-3 py-2 text-sm font-medium text-platform-fg-muted hover:text-platform-fg-primary"
          data-graph-center-knowledge-compatibility-link="true"
        >
          知识图谱
        </a>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)_minmax(18rem,24rem)]">
        <aside className="space-y-3 rounded-md border border-platform-border bg-platform-canvas p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-platform-fg-primary">
            <Filter className="h-4 w-4" aria-hidden="true" />
            <span>筛选</span>
          </div>
          <label className="block text-xs font-medium text-platform-fg-muted" htmlFor="graph-center-objective">
            目标
          </label>
          <select
            id="graph-center-objective"
            value={payload.objectiveId ?? ''}
            onChange={(event) => {
              setObjectiveId(event.target.value || null);
              setSelectedNodeId(null);
            }}
            className="w-full rounded-md border border-platform-border bg-platform-canvas px-2 py-2 text-sm text-platform-fg-primary"
          >
            <option value="">全部目标</option>
            {payload.objectives.map((objective) => (
              <option key={objective.id} value={objective.id}>
                {objective.title} ({objective.nodeCount})
              </option>
            ))}
          </select>
          <label className="block text-xs font-medium text-platform-fg-muted" htmlFor="graph-center-portrait">
            画像维度
          </label>
          <select
            id="graph-center-portrait"
            value={payload.portraitDimension ?? ''}
            onChange={(event) => {
              setPortraitDimension((event.target.value || null) as GraphCenterPayload['portraitDimension']);
              setSelectedNodeId(null);
            }}
            className="w-full rounded-md border border-platform-border bg-platform-canvas px-2 py-2 text-sm text-platform-fg-primary"
          >
            <option value="">全部维度</option>
            {payload.portraitDimensions.map((dimension) => (
              <option key={dimension.id} value={dimension.id}>
                {dimension.label} ({dimension.nodeCount})
              </option>
            ))}
          </select>
          <div className="space-y-2" data-graph-center-limitations="true">
            {payload.limitations.slice(0, 4).map((limitation) => (
              <div
                key={`${limitation.code}:${limitation.nodeId ?? 'global'}`}
                className="flex gap-2 rounded-md border border-platform-border bg-platform-canvas-muted p-2 text-xs text-platform-fg-muted"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
                <span>{limitation.message}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="rounded-md border border-platform-border bg-platform-canvas p-3" data-graph-center-list-fallback="true">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-platform-fg-primary">节点</h2>
            <span className="text-xs text-platform-fg-muted">
              {payload.graph.nodes.length} / {payload.graph.edges.length}
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {payload.graph.nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedNodeId(node.id)}
                className={[
                  'min-h-28 rounded-md border p-3 text-left transition',
                  payload.selectedNode?.node.id === node.id
                    ? 'border-platform-action-primary bg-platform-action-subtle'
                    : 'border-platform-border bg-platform-canvas-muted hover:border-platform-action-primary/60',
                ].join(' ')}
              >
                <span className="block text-sm font-semibold text-platform-fg-primary">{node.title}</span>
                <span className="mt-1 line-clamp-3 block text-xs leading-5 text-platform-fg-muted">{node.description}</span>
                <span className="mt-2 flex flex-wrap gap-1">
                  {node.portraitDimensions.map((dimension) => (
                    <span
                      key={dimension}
                      className="rounded-sm bg-platform-canvas px-1.5 py-0.5 text-[11px] text-platform-fg-muted"
                    >
                      {dimension}
                    </span>
                  ))}
                  <span className="rounded-sm bg-platform-canvas px-1.5 py-0.5 text-[11px] text-platform-fg-muted">
                    {coverageStateLabel(payload.resourceCoverage[node.id].coverageState)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <aside className="rounded-md border border-platform-border bg-platform-canvas p-3" data-graph-center-detail="true">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-platform-fg-primary">
            <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
            <h2>详情</h2>
          </div>
          {payload.selectedNode ? (
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-platform-fg-primary">{payload.selectedNode.node.title}</h3>
                <p className="mt-1 text-sm leading-6 text-platform-fg-muted">{payload.selectedNode.node.description}</p>
              </div>
              <DetailGroup label="目标">
                {payload.selectedNode.objectives.map((objective) => (
                  <span key={objective.id}>{objective.title}</span>
                ))}
              </DetailGroup>
              <DetailGroup label="画像维度">
                {payload.selectedNode.node.portraitDimensions.map((dimension) => (
                  <span key={dimension}>{dimension}</span>
                ))}
              </DetailGroup>
              <DetailGroup label="关系">
                <span>入边 {payload.selectedNode.incomingEdges.length}</span>
                <span>出边 {payload.selectedNode.outgoingEdges.length}</span>
              </DetailGroup>
              <DetailGroup label="资源绑定">
                {payload.selectedNode.boundResourceRefs.length > 0
                  ? payload.selectedNode.boundResourceRefs.map((ref) => <span key={ref}>{ref}</span>)
                  : <span>未绑定运行态资源</span>}
              </DetailGroup>
              <DetailGroup label="资源覆盖">
                <span>{coverageStateLabel(payload.selectedNode.resourceCoverage.coverageState)}</span>
                <span>关联 {payload.selectedNode.resourceCoverage.linkedResourceCount}</span>
                <span>路径可用 {payload.selectedNode.resourceCoverage.pathEligibleResourceCount}</span>
                <span>RAG 索引 {payload.selectedNode.resourceCoverage.ragIndexedCount}</span>
                <span>可引用 {payload.selectedNode.resourceCoverage.citationReadyCount}</span>
                <span>已校验引用 {payload.selectedNode.resourceCoverage.verifiedCitationCount}</span>
              </DetailGroup>
              <DetailGroup label="资源类型">
                <span>测评 {payload.selectedNode.resourceCoverage.assessmentResourceCount}</span>
                <span>仿真 {payload.selectedNode.resourceCoverage.simulationResourceCount}</span>
                <span>Arena 预览 {payload.selectedNode.resourceCoverage.arenaPreviewResourceCount}</span>
                <span>Arena 官方 {payload.selectedNode.resourceCoverage.arenaOfficialResourceCount}</span>
                <span>终端验证 {payload.selectedNode.resourceCoverage.terminalValidationCapableResourceCount}</span>
              </DetailGroup>
              {payload.selectedNode.resourceCoverage.missingCoverageTypes.length > 0 && (
                <DetailGroup label="覆盖缺口">
                  {payload.selectedNode.resourceCoverage.missingCoverageTypes.map((type) => (
                    <span key={type}>{missingCoverageLabel(type)}</span>
                  ))}
                </DetailGroup>
              )}
              <DetailGroup label="校验">
                <span>{payload.validation.objectiveValidation.valid && payload.validation.graphValidation.valid ? '通过' : '存在问题'}</span>
              </DetailGroup>
              {payload.selectedNode.limitations.length > 0 && (
                <DetailGroup label="限制">
                  {payload.selectedNode.limitations.map((limitation) => (
                    <span key={limitation.message}>{limitation.message}</span>
                  ))}
                </DetailGroup>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-platform-border p-4 text-sm text-platform-fg-muted">
              无匹配节点
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function DetailGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-platform-fg-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5 text-xs text-platform-fg-primary">
        {children}
      </div>
    </div>
  );
}

export function selectGraphCenterPayloadNode(
  payload: GraphCenterPayload,
  selectedNodeId: string | null,
  options: { preserveEmptySelection?: boolean } = {},
): GraphCenterPayload {
  const selectedNode = selectedNodeId
    ? payload.graph.nodes.find((node) => node.id === selectedNodeId) ?? null
    : options.preserveEmptySelection
      ? null
      : payload.graph.nodes[0] ?? null;

  return {
    ...payload,
    selectedNode: selectedNode ? payload.nodeDetails[selectedNode.id] ?? null : null,
  };
}

export function filterGraphCenterPayload(
  payload: GraphCenterPayload,
  filters: {
    objectiveId: string | null;
    portraitDimension: GraphCenterPayload['portraitDimension'];
    selectedNodeId: string | null;
  },
): GraphCenterPayload {
  const objectiveId = payload.objectives.some((objective) => objective.id === filters.objectiveId)
    ? filters.objectiveId
    : null;
  const objectiveNodeIds = new Set(
    payload.objectives.find((objective) => objective.id === objectiveId)?.nodeIds ?? [],
  );
  const portraitDimension = payload.portraitDimensions.some((dimension) => dimension.id === filters.portraitDimension)
    ? filters.portraitDimension
    : null;
  const filteredNodes = payload.graph.nodes.filter((node) => (
    (!objectiveId || objectiveNodeIds.has(node.id)) &&
    (!portraitDimension || node.portraitDimensions.includes(portraitDimension))
  ));
  const filteredNodeIds = new Set(filteredNodes.map((node) => node.id));
  const filteredEdges = payload.graph.edges.filter((edge) => (
    filteredNodeIds.has(edge.sourceNodeId) &&
    filteredNodeIds.has(edge.targetNodeId)
  ));
  const filteredPayload: GraphCenterPayload = {
    ...payload,
    objectiveId,
    portraitDimension,
    objectives: payload.objectives.map((objective) => ({
      ...objective,
      nodeCount: objective.nodeIds.length,
    })),
    portraitDimensions: payload.portraitDimensions.map((dimension) => ({
      ...dimension,
      nodeCount: payload.graph.nodes.filter((node) => node.portraitDimensions.includes(dimension.id)).length,
    })),
    graph: {
      nodes: filteredNodes,
      edges: filteredEdges,
    },
    resourceCoverage: Object.fromEntries(
      filteredNodes.map((node) => [node.id, payload.resourceCoverage[node.id]]),
    ),
    nodeDetails: Object.fromEntries(
      filteredNodes.flatMap((node) => {
        const detail = payload.nodeDetails[node.id];
        return detail
          ? [[node.id, {
              ...detail,
              incomingEdges: filteredEdges.filter((edge) => edge.targetNodeId === node.id),
              outgoingEdges: filteredEdges.filter((edge) => edge.sourceNodeId === node.id),
            }]]
          : [];
      }),
    ),
    limitations: payload.limitations.filter((limitation) => (
      !limitation.nodeId || filteredNodeIds.has(limitation.nodeId)
    )),
    selectedNode: null,
  };
  return selectGraphCenterPayloadNode(filteredPayload, filters.selectedNodeId);
}

function coverageStateLabel(state: GraphCenterResourceCoverageState): string {
  const labels: Record<GraphCenterResourceCoverageState, string> = {
    sufficient: '覆盖充分',
    partial: '部分覆盖',
    missing: '缺少资源',
    'not-audited': '未审计',
  };
  return labels[state];
}

function missingCoverageLabel(type: GraphCenterResourceCoverageMissingType): string {
  const labels: Record<GraphCenterResourceCoverageMissingType, string> = {
    'linked-resource': '缺少关联资源',
    'path-eligible-resource': '缺少路径可用资源',
    'rag-indexed-resource': '缺少 RAG 索引',
    'citation-ready-resource': '缺少可引用目标',
    'verified-citation-resource': '缺少已校验引用',
    'assessment-resource': '缺少测评资源',
    'simulation-resource': '缺少仿真资源',
    'arena-preview-resource': '缺少 Arena 预览',
    'arena-official-resource': '缺少 Arena 官方验证',
    'terminal-validation-capable-resource': '缺少终端验证能力',
  };
  return labels[type];
}
