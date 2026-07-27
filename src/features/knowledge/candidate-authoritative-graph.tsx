'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  CircleHelp,
  Loader2,
  Network,
  RotateCcw,
  X,
} from 'lucide-react';

import type { PlatformRole } from '@/components/platform/platform-ui-contracts';
import { useGlobalAI } from '@/components/providers/global-ai-provider';
import type { CandidateNodeDetailResponse } from './candidate-graph-contracts';
import {
  CANDIDATE_RELEASE_SELECTOR,
  getCandidatePredicatePresentation,
  getCandidateDetailDirectionLabel,
  getCandidateTypePresentation,
  resolveCandidateRelationDirection,
  selectCandidateGraphView,
  type CandidateCanvasResponse,
  type CandidateGovernanceFilter,
} from './candidate-graph-contracts';

interface CandidateAuthoritativeGraphProps {
  viewerRole: PlatformRole;
  controlledVerification: boolean;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; projection: CandidateCanvasResponse }
  | { status: 'empty'; projection: CandidateCanvasResponse }
  | { status: 'error'; message: string };

const TYPE_TONE = {
  concept: 'border-cyan-400/45 bg-cyan-400/10 text-cyan-100',
  formula: 'border-violet-400/45 bg-violet-400/10 text-violet-100',
  statement: 'border-amber-400/45 bg-amber-400/10 text-amber-100',
  model: 'border-emerald-400/45 bg-emerald-400/10 text-emerald-100',
  generic: 'border-slate-400/45 bg-slate-400/10 text-slate-100',
} as const;

function errorMessage(status: number): string {
  if (status === 403) return '候选图谱尚未对当前身份开放。';
  if (status === 404) return '固定候选 Release 尚未导入。';
  if (status === 409) return '候选 Release 证据发生漂移，已停止显示。';
  return '候选图谱暂时无法加载。';
}

function useCandidateCanvas(retry: number): LoadState {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetch('/api/knowledge/graph/v2', {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(errorMessage(response.status));
        return response.json() as Promise<CandidateCanvasResponse>;
      })
      .then((projection) => {
        setState(projection.nodes.length === 0
          ? { status: 'empty', projection }
          : { status: 'ready', projection });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : '候选图谱暂时无法加载。',
        });
      });
    return () => controller.abort();
  }, [retry]);

  return state;
}

function CandidateNodeDetail({
  governance,
  nodeId,
  onClose,
}: {
  governance: CandidateGovernanceFilter;
  nodeId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<CandidateNodeDetailResponse | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setDetail(null);
    setFailure(null);
    fetch(`/api/knowledge/nodes/v2/${encodeURIComponent(nodeId)}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(errorMessage(response.status));
        return response.json() as Promise<CandidateNodeDetailResponse>;
      })
      .then(setDetail)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setFailure(error instanceof Error ? error.message : '节点详情暂时无法加载。');
        }
      });
    return () => controller.abort();
  }, [nodeId]);

  const visibleAdjacency = detail?.node.adjacency.filter((relation) => (
    governance === 'EXTENSION' || relation.qualityTier === 'GOLD'
  )) ?? [];

  return (
    <aside
      className="min-h-0 overflow-y-auto border-l border-platform-border bg-platform-surface/95 p-4 max-lg:border-l-0 max-lg:border-t"
      aria-label="候选权威节点详情"
      data-candidate-node-detail={nodeId}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-platform-fg-muted">权威对象详情</div>
          <div className="mt-1 break-all text-sm text-platform-fg-secondary">{nodeId}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭候选节点详情"
          className="rounded-md border border-platform-border p-2 text-platform-fg-secondary hover:bg-platform-action-subtle"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {!detail && !failure ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-platform-fg-secondary" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          正在加载独立 V2 详情…
        </div>
      ) : failure ? (
        <div className="mt-6 rounded-lg border border-red-400/35 bg-red-400/10 p-3 text-sm text-red-100" role="alert">
          {failure}
        </div>
      ) : detail ? (
        <div className="mt-5 space-y-5">
          <div>
            <div className="text-lg font-semibold text-platform-fg-primary">{detail.node.label}</div>
            <div className="mt-1 text-xs text-platform-fg-muted">
              {getCandidateTypePresentation(detail.node.canonicalType).label}
            </div>
            <p className="mt-3 text-sm leading-6 text-platform-fg-secondary">
              {detail.node.description ?? '该对象暂无公开说明。'}
            </p>
          </div>

          <section aria-labelledby="candidate-detail-relations">
            <h3 id="candidate-detail-relations" className="text-sm font-semibold text-platform-fg-primary">
              一跳关系
            </h3>
            <div className="mt-2 space-y-2">
              {visibleAdjacency.length === 0 ? (
                <p className="text-sm text-platform-fg-muted">当前筛选下无相邻关系。</p>
              ) : visibleAdjacency.map((relation) => {
                const predicate = getCandidatePredicatePresentation(relation.predicate);
                const direction = resolveCandidateRelationDirection(
                  predicate,
                  relation.direction,
                );
                return (
                  <div
                    key={relation.relationId}
                    className="rounded-md border border-platform-border bg-platform-canvas-muted p-2 text-xs"
                    data-candidate-detail-direction={direction.kind}
                    data-candidate-detail-quality-tier={relation.qualityTier}
                  >
                    <span className="font-medium text-platform-fg-primary">
                      {predicate.label}
                    </span>
                    <span className="ml-2 text-platform-fg-muted">
                      {getCandidateDetailDirectionLabel({
                        direction,
                        traversal: relation.traversal,
                      })} · {relation.neighborId}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="candidate-detail-sources">
            <h3 id="candidate-detail-sources" className="text-sm font-semibold text-platform-fg-primary">
              可访问来源
            </h3>
            <div className="mt-2 space-y-1 text-xs text-platform-fg-secondary">
              {detail.node.sources.length === 0
                ? <p>当前对象未附公开来源定位。</p>
                : detail.node.sources.map((source) => (
                    <p key={`${source.sourceEditionId}:${source.sectionId}`}>
                      {source.sourceEditionId} · {source.sectionId}
                    </p>
                  ))}
            </div>
          </section>

          {detail.role !== 'STUDENT' ? (
            <section className="rounded-lg border border-platform-border bg-platform-canvas-muted p-3 text-xs text-platform-fg-secondary">
              <h3 className="font-semibold text-platform-fg-primary">教师治理信息</h3>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt>Release</dt><dd>{detail.source.releaseId}</dd>
                <dt>层级</dt><dd>{detail.node.governanceTier === 'CORE' ? '核心' : detail.node.governanceTier === 'EXTENSION' ? '扩展' : '未分类'}</dd>
                <dt>审核</dt><dd>{detail.node.governance.reviewStatus ?? '未知'}</dd>
                <dt>来源映射</dt><dd>{detail.node.coverage.sourceMappingCount}</dd>
                <dt>证据片段</dt><dd>{detail.node.coverage.evidenceCount}</dd>
              </dl>
            </section>
          ) : null}

          {detail.role === 'ADMIN' ? (
            <section className="rounded-lg border border-amber-400/35 bg-amber-400/10 p-3 text-xs text-amber-50">
              <h3 className="font-semibold">受控迁移诊断</h3>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 break-all">
                <dt>受控路径</dt><dd>{detail.source.controlledPath}</dd>
                <dt>重绑定</dt><dd>{detail.activeConsumerRebinding}</dd>
                <dt>捕获修订</dt><dd>{detail.receipt?.captureRevision ?? '不可用'}</dd>
                <dt>漂移项</dt><dd>{detail.diagnostics.length}</dd>
              </dl>
            </section>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

export function CandidateAuthoritativeGraph({
  viewerRole: _viewerRole,
  controlledVerification,
}: CandidateAuthoritativeGraphProps) {
  const [retry, setRetry] = useState(0);
  const state = useCandidateCanvas(retry);
  const [canonicalType, setCanonicalType] = useState<string | null>(null);
  const [governance, setGovernance] = useState<CandidateGovernanceFilter>('EXTENSION');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { updatePageContext, clearDynamicPageContext } = useGlobalAI();

  const projection = state.status === 'ready' || state.status === 'empty'
    ? state.projection
    : null;
  const canonicalTypes = useMemo(() => (
    projection
      ? [...new Set(projection.nodes.map((node) => node.canonicalType))].sort()
      : []
  ), [projection]);
  const graph = useMemo(() => (
    projection
      ? selectCandidateGraphView(projection, { canonicalType, governance })
      : { nodes: [], relations: [] }
  ), [canonicalType, governance, projection]);
  const centerIds = useMemo(() => new Set(
    canonicalType
      ? graph.nodes.filter((node) => node.canonicalType === canonicalType).map((node) => node.id)
      : graph.nodes.map((node) => node.id),
  ), [canonicalType, graph.nodes]);

  const selectedNode = projection?.nodes.find((node) => node.id === selectedNodeId) ?? null;
  useEffect(() => {
    updatePageContext({
      candidateGraph: {
        ...CANDIDATE_RELEASE_SELECTOR,
        selectedCanonicalId: selectedNode?.id ?? null,
        selectedCanonicalType: selectedNode?.canonicalType ?? null,
        governanceFilter: governance,
        canonicalTypeFilter: canonicalType,
        coverageStatus: state.status,
        objectCount: projection?.coverage.objectCount ?? null,
        relationCount: projection?.coverage.relationCount ?? null,
      },
      tools: [],
      systemPromptExtension: '当前为固定 ReleaseSet 的候选权威图谱。只能使用候选 Canonical 只读工具，不得推断 Legacy 对应项或产生学习状态副作用。',
    });
  }, [
    canonicalType,
    governance,
    projection?.coverage.objectCount,
    projection?.coverage.relationCount,
    selectedNode?.canonicalType,
    selectedNode?.id,
    state.status,
    updatePageContext,
  ]);

  useEffect(() => () => clearDynamicPageContext(), [clearDynamicPageContext]);

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-platform-page text-platform-fg-primary"
      data-candidate-authoritative-graph="true"
      data-candidate-controlled-verification={controlledVerification ? 'true' : 'false'}
    >
      <header className="border-b border-platform-border bg-platform-surface/95 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">
                {projection?.release.label ?? '根轨迹局部发布版'}
              </h2>
              <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-100">
                候选只读
              </span>
              {controlledVerification ? (
                <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2 py-0.5 text-[11px] text-cyan-100">
                  管理员受控验证
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-platform-fg-secondary">
              {projection
                ? `${projection.source.releaseSetId} · ${projection.source.releaseId} · ${projection.projectionVersion}`
                : '固定 ReleaseSet 与 Release，由服务端选择。'}
            </p>
          </div>
          {projection ? (
            <div className="text-right text-xs text-platform-fg-secondary">
              <div>真实覆盖：{projection.coverage.objectCount} 对象 · {projection.coverage.relationCount} 关系</div>
              <div className="mt-1 text-amber-200">{projection.teachingSemantics.message}</div>
            </div>
          ) : null}
        </div>
      </header>

      {state.status === 'loading' ? (
        <div className="flex flex-1 items-center justify-center" role="status">
          <div className="text-center text-sm text-platform-fg-secondary">
            <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-platform-action-primary" aria-hidden="true" />
            正在加载候选权威投影…
          </div>
        </div>
      ) : state.status === 'error' ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-xl border border-red-400/35 bg-red-400/10 p-5 text-center" role="alert">
            <AlertTriangle className="mx-auto h-6 w-6 text-red-200" aria-hidden="true" />
            <p className="mt-3 text-sm text-red-50">{state.message}</p>
            <p className="mt-2 text-xs text-red-100/75">未请求 Legacy API，也未用旧图补齐。</p>
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-200/40 px-3 py-2 text-sm text-red-50 hover:bg-red-100/10"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              重试候选 V2
            </button>
          </div>
        </div>
      ) : state.status === 'empty' ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div>
            <Network className="mx-auto h-7 w-7 text-platform-fg-muted" aria-hidden="true" />
            <p className="mt-3 text-sm text-platform-fg-secondary">固定候选 Release 当前没有对象。</p>
            <p className="mt-1 text-xs text-platform-fg-muted">未请求 Legacy API。</p>
          </div>
        </div>
      ) : projection ? (
        <>
          <nav className="border-b border-platform-border bg-platform-canvas-muted px-4 py-2" aria-label="候选图谱类型与治理筛选">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={canonicalType === null}
                onClick={() => setCanonicalType(null)}
                className={`rounded-md border px-2.5 py-1.5 text-xs ${canonicalType === null ? 'border-platform-action-primary bg-platform-action-subtle' : 'border-platform-border'}`}
              >
                全部类型
              </button>
              {canonicalTypes.map((type) => {
                const presentation = getCandidateTypePresentation(type);
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={canonicalType === type}
                    onClick={() => setCanonicalType(type)}
                    className={`rounded-md border px-2.5 py-1.5 text-xs ${canonicalType === type ? TYPE_TONE[presentation.tone] : 'border-platform-border text-platform-fg-secondary'}`}
                  >
                    {presentation.label}
                  </button>
                );
              })}
              <span className="mx-1 h-5 w-px bg-platform-border" aria-hidden="true" />
              {([
                ['CORE', '核心'],
                ['EXTENSION', '扩展'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={governance === value}
                  onClick={() => setGovernance(value)}
                  className={`rounded-md border px-2.5 py-1.5 text-xs ${governance === value ? 'border-amber-400/50 bg-amber-400/10 text-amber-100' : 'border-platform-border text-platform-fg-secondary'}`}
                >
                  {label}
                  {value === 'EXTENSION' ? '（含核心）' : ''}
                </button>
              ))}
            </div>
          </nav>

          <div className={`grid min-h-0 flex-1 ${selectedNodeId ? 'grid-cols-[minmax(0,1fr)_minmax(19rem,27rem)] max-lg:grid-cols-1' : 'grid-cols-1'}`}>
            <main className="min-h-0 overflow-y-auto p-4" aria-label="候选权威知识图谱">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-platform-fg-muted">
                <span>{graph.nodes.length} 对象 · {graph.relations.length} 关系</span>
                {canonicalType ? <span>当前类型及一跳异质邻居；异质对象以弱视觉显示</span> : null}
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3" data-candidate-graph-stage="typed-one-hop">
                {graph.nodes.map((node) => {
                  const presentation = getCandidateTypePresentation(node.canonicalType);
                  const centered = centerIds.has(node.id);
                  const relations = graph.relations.filter((relation) => (
                    relation.sourceId === node.id || relation.targetId === node.id
                  ));
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedNodeId(node.id)}
                      aria-pressed={selectedNodeId === node.id}
                      className={`min-h-32 rounded-xl border p-3 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-platform-action-primary ${TYPE_TONE[presentation.tone]} ${centered ? 'opacity-100' : 'opacity-55 hover:opacity-85'} ${selectedNodeId === node.id ? 'ring-2 ring-platform-action-primary' : ''}`}
                      data-candidate-canonical-type={node.canonicalType}
                      data-candidate-context={centered ? 'center' : 'one-hop'}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-medium">{presentation.label}</span>
                        <span className="text-[10px] opacity-75">{relations.length} 关系</span>
                      </div>
                      <div className="mt-3 line-clamp-2 text-sm font-semibold">{node.label}</div>
                      <div className="mt-2 line-clamp-2 text-xs opacity-75">{node.description ?? node.id}</div>
                    </button>
                  );
                })}
              </div>

              <section
                className="mt-5 rounded-xl border border-platform-border bg-platform-surface/80 p-4"
                aria-labelledby="candidate-relation-map"
                data-candidate-relation-map="exact-predicates"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 id="candidate-relation-map" className="text-sm font-semibold">方向关系</h3>
                  <span className="text-xs text-platform-fg-muted">Gold 核心 · Silver 扩展</span>
                </div>
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {graph.relations.map((relation) => {
                    const presentation = getCandidatePredicatePresentation(relation.predicate);
                    const direction = resolveCandidateRelationDirection(
                      presentation,
                      relation.direction,
                    );
                    const source = projection.nodes.find((node) => node.id === relation.sourceId);
                    const target = projection.nodes.find((node) => node.id === relation.targetId);
                    return (
                      <div
                        key={relation.id}
                        className={`rounded-lg border p-3 text-xs ${
                          relation.qualityTier === 'GOLD'
                            ? 'border-amber-400/35 bg-amber-400/10'
                            : 'border-slate-400/30 bg-slate-400/5'
                        }`}
                        data-candidate-governance-tier={relation.qualityTier}
                        data-candidate-relation-direction={direction.kind}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-platform-fg-primary">
                            {source?.label ?? relation.sourceId}
                          </span>
                          <span
                            className={`w-10 shrink-0 border-t-2 ${
                              presentation.lineStyle === 'dashed'
                                ? 'border-dashed'
                                : presentation.lineStyle === 'dotted'
                                  ? 'border-dotted'
                                  : 'border-solid'
                            } ${relation.qualityTier === 'GOLD' ? 'border-amber-300' : 'border-slate-400'}`}
                            aria-hidden="true"
                          />
                          {direction.kind === 'undirected' ? (
                            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" aria-label="无向或双向关系" />
                          ) : direction.kind === 'directed' ? (
                            <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-label="来源指向目标" />
                          ) : (
                            <CircleHelp className="h-3.5 w-3.5 shrink-0" aria-label="原始方向未解释" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-platform-fg-primary">
                            {target?.label ?? relation.targetId}
                          </span>
                        </div>
                        <div className="mt-2 text-platform-fg-secondary">
                          {presentation.label} · {relation.qualityTier === 'GOLD' ? '核心' : '扩展'}
                          {' · '}{direction.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="mt-5 rounded-xl border border-platform-border bg-platform-surface/80 p-4" aria-labelledby="candidate-predicate-legend">
                <h3 id="candidate-predicate-legend" className="text-sm font-semibold">关系图例</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {[...new Set(graph.relations.map((relation) => relation.predicate))].map((predicate) => {
                    const presentation = getCandidatePredicatePresentation(predicate);
                    const rawDirection = graph.relations.find(
                      (relation) => relation.predicate === predicate,
                    )?.direction;
                    const direction = resolveCandidateRelationDirection(
                      presentation,
                      rawDirection,
                    );
                    return (
                      <div key={predicate} className="rounded-lg border border-platform-border bg-platform-canvas-muted p-3 text-xs">
                        <div className="flex items-center gap-2 font-medium text-platform-fg-primary">
                          <span>{presentation.label}</span>
                          {direction.kind === 'directed' ? (
                            <ArrowRight className="h-3.5 w-3.5" aria-label="来源指向目标" />
                          ) : direction.kind === 'undirected' ? (
                            <ArrowLeftRight className="h-3.5 w-3.5" aria-label="无向或双向关系" />
                          ) : (
                            <CircleHelp className="h-3.5 w-3.5" aria-label="原始方向未解释" />
                          )}
                        </div>
                        <div className="mt-1 text-platform-fg-muted">
                          {predicate} · {presentation.lineStyle === 'solid' ? '实线' : presentation.lineStyle === 'dashed' ? '虚线' : '点线'} · {direction.label}
                        </div>
                        <p className="mt-2 leading-5 text-platform-fg-secondary">{presentation.explanation}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </main>
            {selectedNodeId ? (
              <CandidateNodeDetail
                key={selectedNodeId}
                governance={governance}
                nodeId={selectedNodeId}
                onClose={() => setSelectedNodeId(null)}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
