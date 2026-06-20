'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Filter, Network, PanelRightOpen } from 'lucide-react';
import {
  buildGraphCenterPayload,
  type GraphCenterDomain,
  type GraphCenterPayload,
} from '@/lib/data-governance/graph-center';

interface GraphCenterClientProps {
  initialPayload: GraphCenterPayload;
}

export function GraphCenterClient({ initialPayload }: GraphCenterClientProps) {
  const [domain, setDomain] = useState<GraphCenterDomain>(initialPayload.activeDomain);
  const [objectiveId, setObjectiveId] = useState<string | null>(initialPayload.objectiveId);
  const [portraitDimension, setPortraitDimension] = useState<GraphCenterPayload['portraitDimension']>(
    initialPayload.portraitDimension,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialPayload.selectedNode?.node.id ?? null);
  const payload = useMemo(() => buildGraphCenterPayload({
    domain,
    objectiveId,
    portraitDimension,
    selectedNodeId,
  }), [domain, objectiveId, portraitDimension, selectedNodeId]);

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
