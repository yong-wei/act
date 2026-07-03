'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Filter, Network, PanelRightOpen, UserRound, UsersRound } from 'lucide-react';
import {
  buildGraphCenterPayload,
  type GraphCenterAction,
  type GraphCenterDomain,
  type GraphCenterLearnerOverlayReasonCode,
  type GraphCenterLearnerOverlayState,
  type GraphCenterOverlayStatus,
  type GraphCenterPayload,
  type GraphCenterSarResourceGapSuggestion,
  type GraphCenterSelectedNodeDetail,
  type GraphCenterResourceCoverageMissingType,
  type GraphCenterResourceCoverageState,
} from '@/lib/data-governance/graph-center';

type GraphCenterDisplayMode = 'resourceCoverage' | 'learner' | 'class';
type SarReviewDecision = NonNullable<GraphCenterSarResourceGapSuggestion['review']>['availableActions'][number];
type GraphCenterSarReviewRequest = {
  decision: SarReviewDecision;
  rationale: string;
  resourceNodeId: string | null;
  patch?: {
    planningMetadata: {
      knowledgeCoverage: string[];
      pathEligible?: boolean;
    };
  };
  candidate: {
    id: string;
    target: {
      graphNodeId: string;
      objectiveId: string | null;
    };
    candidate: {
      ref: string;
      refType: GraphCenterSarResourceGapSuggestion['refType'];
      resourceNodeId: string | null;
      sourceRefs: string[];
    };
    missingCoverageTypes: GraphCenterResourceCoverageMissingType[];
    provenance: {
      source: string;
      basisEventIds: string[];
      traceId: null;
    };
    traceSummary: {
      seedEntityIds: string[];
      expansionHopCount: number;
      selectedRefCount: number;
      rejectedRefCount: number;
      limitations: string[];
    };
    limitations: string[];
  };
};
type GraphCenterFieldCompletionSummary = NonNullable<
  NonNullable<GraphCenterPayload['selectedNode']>['resourceCoverage']['fieldCompletion']
>;

interface GraphCenterClientProps {
  initialPayload: GraphCenterPayload;
  rootPayloads?: Partial<Record<GraphCenterDomain, GraphCenterPayload>>;
  initialDisplayMode?: GraphCenterDisplayMode;
}

export function GraphCenterClient({ initialPayload, rootPayloads, initialDisplayMode }: GraphCenterClientProps) {
  const [displayMode, setDisplayMode] = useState<GraphCenterDisplayMode>(initialDisplayMode ?? 'resourceCoverage');
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

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="图谱覆盖模式">
        <OverlayModeButton
          active={displayMode === 'resourceCoverage'}
          icon={<Network className="h-4 w-4" aria-hidden="true" />}
          label="资源"
          status={payload.overlays.resourceCoverage}
          onClick={() => setDisplayMode('resourceCoverage')}
        />
        <OverlayModeButton
          active={displayMode === 'learner'}
          icon={<UserRound className="h-4 w-4" aria-hidden="true" />}
          label="学习者"
          status={payload.overlays.learner}
          onClick={() => setDisplayMode('learner')}
        />
        <OverlayModeButton
          active={displayMode === 'class'}
          icon={<UsersRound className="h-4 w-4" aria-hidden="true" />}
          label="班级"
          status={payload.overlays.class}
          onClick={() => setDisplayMode('class')}
        />
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
            {payload.graph.nodes.map((node) => {
              const nodeActions = payload.nodeDetails[node.id]?.actions ?? [];
              return (
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
                    {displayMode === 'learner' && payload.learnerOverlay.items[node.id] && (
                      <span className="rounded-sm bg-platform-canvas px-1.5 py-0.5 text-[11px] text-platform-fg-muted">
                        {learnerStateLabel(payload.learnerOverlay.items[node.id].state)}
                      </span>
                    )}
                    {displayMode === 'class' && payload.classOverlay.items[node.id] && (
                      <span className="rounded-sm bg-platform-canvas px-1.5 py-0.5 text-[11px] text-platform-fg-muted">
                        {classHeatLabel(payload.classOverlay.items[node.id].suppressionReason)}
                      </span>
                    )}
                  </span>
                  {nodeActions.length > 0 && (
                    <span
                      className="mt-2 grid gap-1"
                      data-graph-center-node-actions={node.id}
                    >
                      {nodeActions.map((action) => (
                        <span
                          key={action.id}
                          className="rounded-sm bg-platform-canvas px-1.5 py-1 text-[11px] leading-4 text-platform-fg-muted"
                          data-action-status={action.status}
                          data-action-reason={action.reasonCode}
                        >
                          <span className="font-medium text-platform-fg-primary">{action.label}</span>
                          <span> · {actionStatusLabel(action.status)}</span>
                          {action.reason && <span> · {action.reason}</span>}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
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
              <GraphCenterActionGroup nodeId={payload.selectedNode.node.id} actions={payload.selectedNode.actions} />
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
              {payload.selectedNode.resourceCoverage.fieldCompletion && (
                <FieldCompletionDetail summary={payload.selectedNode.resourceCoverage.fieldCompletion} />
              )}
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
              {payload.selectedNode.associatedEvidence && (
                <AssociatedEvidenceDetail selectedNode={payload.selectedNode} />
              )}
              {displayMode === 'learner' && (
                <LearnerOverlayDetail payload={payload} nodeId={payload.selectedNode.node.id} />
              )}
              {displayMode === 'class' && (
                <ClassOverlayDetail payload={payload} nodeId={payload.selectedNode.node.id} />
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

function AssociatedEvidenceDetail({ selectedNode }: { selectedNode: GraphCenterSelectedNodeDetail }) {
  const associated = selectedNode.associatedEvidence;
  const [reviewStates, setReviewStates] = useState<Record<string, string>>({});
  const [reviewRationales, setReviewRationales] = useState<Record<string, string>>({});
  if (!associated) return null;
  const hasDraftCandidates = associated.resourceGapSuggestions.length > 0;

  async function submitReview(candidate: GraphCenterSarResourceGapSuggestion, decision: SarReviewDecision) {
    const key = graphCenterSarCandidateKey(candidate);
    const requestBody = buildGraphCenterSarReviewRequest(
      selectedNode,
      candidate,
      decision,
      reviewRationales[key],
    );
    if (!requestBody) return;
    setReviewStates((state) => ({ ...state, [key]: 'submitting' }));
    const response = await fetch('/api/teacher/sar-suggested-bindings/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    setReviewStates((state) => ({
      ...state,
      [key]: response.ok ? 'reviewed' : 'failed',
    }));
  }

  return (
    <div
      className="space-y-2 rounded-md border border-platform-border bg-platform-canvas-muted p-2"
      data-graph-center-sar-association="true"
      data-graph-center-sar-status={associated.status}
    >
      <DetailGroup label="关联证据">
        <span>事件 {associated.eventCount}</span>
        <span>候选 {associated.resourceGapSuggestions.length}</span>
        <span>选中引用 {associated.traceSummary.selectedRefCount}</span>
      </DetailGroup>
      {associated.topEvents.length > 0 && (
        <DetailGroup label="证据摘要">
          {associated.topEvents.map((event) => (
            <span key={event.id}>{event.safeSummary}</span>
          ))}
        </DetailGroup>
      )}
      {hasDraftCandidates && (
        <DetailGroup label="候选资源缺口">
          {associated.resourceGapSuggestions.slice(0, 4).map((candidate) => {
            const key = graphCenterSarCandidateKey(candidate);
            const state = reviewStates[key];
            const reviewableActions = candidate.review?.availableActions ?? [];
            const auditPayload = candidate.review?.auditPayload;
            return (
              <span
                key={key}
                className="space-y-1 rounded border border-platform-border bg-platform-canvas px-2 py-1"
                data-graph-center-sar-candidate="suggested"
                data-graph-center-sar-candidate-type={candidate.refType}
                data-graph-center-sar-candidate-id={auditPayload?.candidateId ?? candidate.id}
              >
                <span className="block font-medium">{formatGraphCenterSarCandidateTitle(candidate)}</span>
                <span className="block text-[11px] text-platform-fg-muted">
                  缺口 {candidate.suggestedForMissingCoverageTypes.map(missingCoverageLabel).join('、') || '未声明'}
                </span>
                <span className="block text-[11px] text-platform-fg-muted">
                  来源 {(auditPayload?.sourceRefs ?? []).join('、') || candidate.rationale.basisEventIds.join('、') || '无'}
                </span>
                <span className="block text-[11px] text-platform-fg-muted">
                  trace hops {auditPayload?.traceSummary.traceHopCount ?? candidate.rationale.traceHopCount}
                  {auditPayload?.traceSummary.limitations.length
                    ? ` · ${auditPayload.traceSummary.limitations.slice(0, 2).join('、')}`
                    : ''}
                </span>
                {reviewableActions.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    <label className="min-w-[12rem] flex-1 text-[11px] text-platform-fg-muted">
                      <span className="sr-only">审查理由</span>
                      <input
                        type="text"
                        value={reviewRationales[key] ?? ''}
                        onChange={(event) => setReviewRationales((state) => ({
                          ...state,
                          [key]: event.target.value,
                        }))}
                        placeholder="审查理由"
                        className="w-full rounded border border-platform-border bg-platform-canvas px-1.5 py-0.5 text-[11px] text-platform-fg-primary"
                        data-graph-center-sar-review-rationale={key}
                      />
                    </label>
                    {reviewableActions.map((action) => (
                      <button
                        key={action}
                        type="button"
                        className="rounded border border-platform-border px-1.5 py-0.5 text-[11px] text-platform-fg-secondary hover:border-platform-accent hover:text-platform-accent"
                        onClick={() => void submitReview(candidate, action)}
                        disabled={state === 'submitting'}
                        data-graph-center-sar-review-action={action}
                      >
                        {action}
                      </button>
                    ))}
                    {state && (
                      <span data-graph-center-sar-review-state={state}>{state}</span>
                    )}
                  </span>
                )}
              </span>
            );
          })}
        </DetailGroup>
      )}
      {(associated.traceSummary.expansionHopCount > 0 || associated.limitations.length > 0) && (
        <DetailGroup label="关联依据">
          <span>trace hops {associated.traceSummary.expansionHopCount}</span>
          <span>rejected refs {associated.traceSummary.rejectedRefCount}</span>
          {associated.limitations.slice(0, 3).map((limitation) => (
            <span key={limitation}>{limitation}</span>
          ))}
        </DetailGroup>
      )}
    </div>
  );
}

export function buildGraphCenterSarReviewRequest(
  selectedNode: GraphCenterSelectedNodeDetail,
  candidate: GraphCenterSarResourceGapSuggestion,
  decision: SarReviewDecision,
  rationale?: string,
): GraphCenterSarReviewRequest | null {
  if (!candidate.review) return null;
  const resourceNodeId = resolveGraphCenterSarResourceNodeId(candidate);
  const patch = decision === 'accept'
    ? buildGraphCenterSarAcceptPatch(selectedNode, candidate)
    : null;
  if (decision === 'accept' && !patch) return null;
  return {
    decision,
    rationale: buildGraphCenterSarReviewRationale(candidate, decision, rationale),
    resourceNodeId,
    ...(patch ? { patch } : {}),
    candidate: {
      id: candidate.review.auditPayload.candidateId,
      target: {
        graphNodeId: selectedNode.node.id,
        objectiveId: selectedNode.objectives[0]?.id ?? null,
      },
      candidate: {
        ref: candidate.review.auditPayload.candidateRef,
        refType: candidate.review.auditPayload.candidateRefType,
        resourceNodeId,
        sourceRefs: candidate.review.auditPayload.sourceRefs,
      },
      missingCoverageTypes: candidate.review.auditPayload.missingCoverageTypes,
      provenance: {
        source: candidate.review.auditPayload.provenance.source,
        basisEventIds: candidate.review.auditPayload.provenance.basisEventIds,
        traceId: null,
      },
      traceSummary: {
        seedEntityIds: selectedNode.associatedEvidence?.traceSummary.seedEntityIds ?? [],
        expansionHopCount: candidate.review.auditPayload.traceSummary.traceHopCount,
        selectedRefCount: selectedNode.associatedEvidence?.traceSummary.selectedRefCount ?? 0,
        rejectedRefCount: selectedNode.associatedEvidence?.traceSummary.rejectedRefCount ?? 0,
        limitations: candidate.review.auditPayload.traceSummary.limitations,
      },
      limitations: selectedNode.associatedEvidence?.limitations ?? [],
    },
  };
}

function graphCenterSarCandidateKey(candidate: GraphCenterSarResourceGapSuggestion): string {
  return candidate.review?.auditPayload.candidateId ?? `${candidate.refType}:${candidate.ref}`;
}

function formatGraphCenterSarCandidateTitle(candidate: GraphCenterSarResourceGapSuggestion): string {
  return [
    candidate.refType,
    candidate.review?.auditPayload.candidateRef ?? candidate.ref,
    '建议/草稿',
  ].join(' · ');
}

function buildGraphCenterSarReviewRationale(
  candidate: GraphCenterSarResourceGapSuggestion,
  decision: SarReviewDecision,
  rationale?: string,
): string {
  const trimmed = rationale?.trim();
  if (trimmed) return trimmed;
  const auditPayload = candidate.review?.auditPayload;
  const missingTypes = auditPayload?.missingCoverageTypes ?? candidate.suggestedForMissingCoverageTypes;
  const basisEventIds = auditPayload?.provenance.basisEventIds ?? candidate.rationale.basisEventIds;
  return [
    `Graph Center SAR ${decision}`,
    `${candidate.refType}:${auditPayload?.candidateRef ?? candidate.ref}`,
    `missing:${missingTypes.join(',') || 'none'}`,
    `source:${(auditPayload?.sourceRefs ?? []).join(',') || 'none'}`,
    `basis:${basisEventIds.join(',') || 'none'}`,
  ].join('; ');
}

function resolveGraphCenterSarResourceNodeId(
  candidate: GraphCenterSarResourceGapSuggestion,
): string | null {
  if (candidate.refType !== 'resource-node') return null;
  if (candidate.ref.startsWith('teaching-resource:')) return candidate.ref;
  if (candidate.review?.auditPayload.sourceRefs.includes(candidate.ref)) {
    return `teaching-resource:${candidate.ref}`;
  }
  return candidate.ref;
}

function buildGraphCenterSarAcceptPatch(
  selectedNode: GraphCenterSelectedNodeDetail,
  candidate: GraphCenterSarResourceGapSuggestion,
): GraphCenterSarReviewRequest['patch'] | null {
  if (candidate.refType !== 'resource-node') return null;
  return {
    planningMetadata: {
      knowledgeCoverage: [selectedNode.node.id],
      ...(candidate.review?.auditPayload.missingCoverageTypes.includes('path-eligible-resource')
        ? { pathEligible: true }
        : {}),
    },
  };
}

function GraphCenterActionGroup({ nodeId, actions }: { nodeId: string; actions: GraphCenterAction[] }) {
  return (
    <div
      className="space-y-2"
      data-graph-center-actions="true"
      data-graph-center-node-actions={nodeId}
    >
      <div className="text-xs font-medium text-platform-fg-muted">可执行动作</div>
      <div className="grid gap-2">
        {actions.map((action) => (
          <GraphCenterActionItem key={action.id} action={action} />
        ))}
      </div>
    </div>
  );
}

function GraphCenterActionItem({ action }: { action: GraphCenterAction }) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium">{action.label}</span>
        <span className="text-[11px] text-platform-fg-muted">{actionStatusLabel(action.status)}</span>
      </span>
      <span className="mt-1 block text-xs leading-5 text-platform-fg-muted">
        {action.reason ?? action.description}
      </span>
    </>
  );
  const className = [
    'block rounded-md border px-3 py-2 text-left text-xs transition',
    action.status === 'available'
      ? 'border-platform-action-primary/45 bg-platform-action-subtle/70 text-platform-fg-primary hover:border-platform-action-primary'
      : 'border-platform-border bg-platform-canvas-muted text-platform-fg-primary',
  ].join(' ');

  if (action.target && isGraphCenterActionLinkable(action)) {
    return (
      <a
        href={action.target.href}
        className={className}
        data-action-status={action.status}
        data-graph-center-action-id={action.id}
      >
        {body}
      </a>
    );
  }

  return (
    <div
      className={className}
      data-action-status={action.status}
      data-action-reason={action.reasonCode}
      data-graph-center-action-id={action.id}
      aria-disabled="true"
    >
      {body}
    </div>
  );
}

function isGraphCenterActionLinkable(action: GraphCenterAction): boolean {
  if (action.status === 'available') return true;
  if (action.status === 'disabled') return false;
  return action.reasonCode === 'missing-resource-context' ||
    action.reasonCode === 'missing-citation-context' ||
    action.reasonCode === 'missing-overlay-context';
}

function OverlayModeButton({
  active,
  icon,
  label,
  status,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  status: GraphCenterOverlayStatus;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition',
        active
          ? 'border-platform-action-primary bg-platform-action-subtle text-platform-fg-primary'
          : 'border-platform-border bg-platform-canvas text-platform-fg-muted hover:text-platform-fg-primary',
      ].join(' ')}
    >
      {icon}
      <span>{label}</span>
      <span className="text-xs text-platform-fg-muted">{overlayStatusLabel(status)}</span>
    </button>
  );
}

function FieldCompletionDetail({ summary }: { summary: GraphCenterFieldCompletionSummary }) {
  return (
    <>
      <DetailGroup label="字段完成">
        <span>完整 {summary.complete}</span>
        <span>缺字段 {summary.missingField}</span>
        <span>暂定 {summary.provisional}</span>
        <span>人审 {summary.humanConfirmed}</span>
        <span>可引用 {summary.citationReady}</span>
        <span>路径可用 {summary.pathEligible}</span>
        <span>总数 {summary.denominator}</span>
      </DetailGroup>
      {summary.missingFieldCodes.length > 0 && (
        <DetailGroup label="字段缺口">
          {summary.missingFieldCodes.slice(0, 6).map((code) => (
            <span key={code}>{missingFieldCodeLabel(code)}</span>
          ))}
        </DetailGroup>
      )}
      {summary.sampleLimitations.length > 0 && (
        <DetailGroup label="诊断样例">
          {summary.sampleLimitations.slice(0, 3).map((limitation) => (
            <span key={limitation}>{limitation}</span>
          ))}
        </DetailGroup>
      )}
    </>
  );
}

function LearnerOverlayDetail({ payload, nodeId }: { payload: GraphCenterPayload; nodeId: string }) {
  const item = payload.learnerOverlay.items[nodeId];
  if (!item) {
    return (
      <DetailGroup label="学习者 overlay">
        <span>{overlayStatusLabel(payload.learnerOverlay.status)}</span>
      </DetailGroup>
    );
  }

  return (
    <>
      <DetailGroup label="学习者 overlay">
        <span>{learnerStateLabel(item.state)}</span>
        <span>分数 {item.score === null ? '无' : `${Math.round(item.score * 100)}%`}</span>
        <span>置信度 {Math.round(item.confidence * 100)}%</span>
        <span>证据 {item.evidenceCount}</span>
      </DetailGroup>
      <DetailGroup label="建议依据">
        <span>{reasonCodeLabel(item.reasonCode)}</span>
        <span>{item.recommendation.rationale.observedMastery}</span>
        <span>{item.recommendation.rationale.resourceCoverage}</span>
      </DetailGroup>
      <DetailGroup label="证据窗口">
        <span>{item.evidenceWindow.freshness}</span>
        <span>{item.evidenceWindow.from ?? '无起点'} - {item.evidenceWindow.to ?? '无终点'}</span>
        <span>已校验引用 {item.verifiedCitationRefs.length}</span>
      </DetailGroup>
    </>
  );
}

function ClassOverlayDetail({ payload, nodeId }: { payload: GraphCenterPayload; nodeId: string }) {
  const item = payload.classOverlay.items[nodeId];
  if (!item) {
    return (
      <DetailGroup label="班级 overlay">
        <span>{overlayStatusLabel(payload.classOverlay.status)}</span>
      </DetailGroup>
    );
  }

  return (
    <>
      <DetailGroup label="班级 overlay">
        <span>{classHeatLabel(item.suppressionReason)}</span>
        <span>分母 {item.denominator}</span>
        <span>纳入 {item.includedPopulation}</span>
        <span>排除 {item.excludedPopulation}</span>
      </DetailGroup>
      <DetailGroup label="班级分布">
        <span>掌握 {item.distribution.mastered}</span>
        <span>发展中 {item.distribution.developing}</span>
        <span>薄弱 {item.distribution.weak}</span>
        <span>未开始 {item.distribution['not-started']}</span>
        <span>需补证 {item.distribution['evidence-needed']}</span>
      </DetailGroup>
      <DetailGroup label="班级规则">
        <span>平均 {item.averageScore === null ? '无' : `${Math.round(item.averageScore * 100)}%`}</span>
        <span>置信度 {Math.round(item.confidence * 100)}%</span>
        <span>最小分母 {item.roundingPolicy.minimumDenominator}</span>
        <span>取整 {item.roundingPolicy.increment}</span>
      </DetailGroup>
    </>
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
  const learnerOverlay = filterLearnerOverlay(payload, filteredNodes, filteredNodeIds);
  const classOverlay = filterClassOverlay(payload, filteredNodes, filteredNodeIds);
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
    learnerOverlay,
    classOverlay,
    overlays: {
      ...payload.overlays,
      learner: learnerOverlay.status,
      class: classOverlay.status,
    },
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
    limitations: uniqueLimitations([
      ...payload.limitations.filter((limitation) => (
        (!limitation.nodeId || filteredNodeIds.has(limitation.nodeId)) &&
        !isOverlayLimitation(limitation.code)
      )),
      ...learnerOverlay.limitations,
      ...classOverlay.limitations,
    ]),
    selectedNode: null,
  };
  return selectGraphCenterPayloadNode(filteredPayload, filters.selectedNodeId);
}

function isOverlayLimitation(code: string): boolean {
  return code.startsWith('learner-overlay-') || code.startsWith('class-overlay-');
}

function uniqueLimitations(limitations: GraphCenterPayload['limitations']): GraphCenterPayload['limitations'] {
  const seen = new Set<string>();
  return limitations.filter((limitation) => {
    const key = `${limitation.code}:${limitation.nodeId ?? 'global'}:${limitation.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterLearnerOverlay(
  payload: GraphCenterPayload,
  filteredNodes: GraphCenterPayload['graph']['nodes'],
  filteredNodeIds: Set<string>,
): GraphCenterPayload['learnerOverlay'] {
  const items = Object.fromEntries(
    filteredNodes.flatMap((node) => {
      const item = payload.learnerOverlay.items[node.id];
      return item ? [[node.id, item]] : [];
    }),
  );
  if (payload.learnerOverlay.status === 'unavailable' || payload.learnerOverlay.status === 'unauthorized') {
    return {
      ...payload.learnerOverlay,
      items,
      limitations: payload.learnerOverlay.limitations.filter((limitation) => (
        !limitation.nodeId || filteredNodeIds.has(limitation.nodeId)
      )),
    };
  }
  const itemValues = Object.values(items);
  const status: GraphCenterOverlayStatus = itemValues.length === 0
    ? 'empty'
    : itemValues.every((item) => item.confidence < 0.35 || item.state === 'evidence-needed')
      ? 'low-confidence'
      : 'available';
  return {
    ...payload.learnerOverlay,
    status,
    items,
    limitations: status === 'empty'
      ? [{
          code: 'learner-overlay-empty',
          message: '当前筛选条件下没有可展示的学习者图谱 overlay。',
        }]
      : status === 'low-confidence'
        ? [{
            code: 'learner-overlay-low-confidence',
            message: '当前学习者图谱 overlay 证据不足，仅可作为补证提示。',
          }]
        : [],
  };
}

function filterClassOverlay(
  payload: GraphCenterPayload,
  filteredNodes: GraphCenterPayload['graph']['nodes'],
  filteredNodeIds: Set<string>,
): GraphCenterPayload['classOverlay'] {
  const items = Object.fromEntries(
    filteredNodes.flatMap((node) => {
      const item = payload.classOverlay.items[node.id];
      return item ? [[node.id, item]] : [];
    }),
  );
  if (payload.classOverlay.status === 'unavailable' || payload.classOverlay.status === 'unauthorized') {
    return {
      ...payload.classOverlay,
      items,
      limitations: payload.classOverlay.limitations.filter((limitation) => (
        !limitation.nodeId || filteredNodeIds.has(limitation.nodeId)
      )),
    };
  }
  const itemValues = Object.values(items);
  const status: GraphCenterOverlayStatus = itemValues.length === 0
    ? 'empty'
    : itemValues.every((item) => item.suppressionReason !== 'none')
      ? 'suppressed'
      : 'available';
  return {
    ...payload.classOverlay,
    status,
    items,
    limitations: status === 'empty'
      ? [{
          code: 'class-overlay-empty',
          message: '当前筛选条件下没有可展示的班级图谱 overlay。',
        }]
      : status === 'suppressed'
        ? [{
            code: 'class-overlay-suppressed',
            message: '当前筛选条件下的班级图谱热力因样本量过低已抑制。',
          }]
        : [],
  };
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

function actionStatusLabel(status: GraphCenterAction['status']): string {
  const labels: Record<GraphCenterAction['status'], string> = {
    available: '可用',
    degraded: '降级',
    disabled: '不可用',
  };
  return labels[status];
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

function missingFieldCodeLabel(code: string): string {
  const labels: Record<string, string> = {
    'missing-capability-target': '缺少能力目标',
    'missing-citation-target': '缺少引用目标',
    'missing-content-hash': '缺少内容哈希',
    'missing-evidence-contract': '缺少证据契约',
    'missing-evidence-instrumentation': '缺少证据埋点',
    'missing-human-review': '缺少人工复核',
    'missing-knowledge-binding': '缺少知识绑定',
    'missing-path-profile': '缺少路径画像',
    'missing-path-target': '缺少路径目标',
    'missing-segment-ref': '缺少片段引用',
    'provisional-metadata': '暂定元数据',
  };
  return labels[code] ?? code;
}

function overlayStatusLabel(status: GraphCenterOverlayStatus): string {
  const labels: Record<GraphCenterOverlayStatus, string> = {
    available: '可用',
    unavailable: '未接入',
    empty: '无数据',
    'low-confidence': '低置信',
    suppressed: '已抑制',
    unauthorized: '无权限',
  };
  return labels[status];
}

function learnerStateLabel(state: GraphCenterLearnerOverlayState): string {
  const labels: Record<GraphCenterLearnerOverlayState, string> = {
    mastered: '已掌握',
    developing: '发展中',
    weak: '薄弱',
    'not-started': '未开始',
    locked: '路径锁定',
    'evidence-needed': '需补证',
  };
  return labels[state];
}

function reasonCodeLabel(reasonCode: GraphCenterLearnerOverlayReasonCode): string {
  const labels: Record<GraphCenterLearnerOverlayReasonCode, string> = {
    advance: '进入下一目标',
    'targeted-practice': '针对练习',
    'confirm-with-evidence': '补充证据确认',
    'collect-evidence': '采集证据',
    'resource-coverage-needed': '补齐资源覆盖',
    'locked-path': '路径锁定',
  };
  return labels[reasonCode];
}

function classHeatLabel(suppressionReason: 'low-denominator' | 'empty-class' | 'none'): string {
  const labels: Record<'low-denominator' | 'empty-class' | 'none', string> = {
    'low-denominator': '小样本抑制',
    'empty-class': '班级无数据',
    none: '热力可用',
  };
  return labels[suppressionReason];
}
