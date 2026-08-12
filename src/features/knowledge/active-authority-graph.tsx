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

import type {
  ActiveCanvasResponse,
  ActiveNodeDetailResponse,
  ActiveCanvasNode,
} from './active-authority-graph-contracts';

interface ActiveAuthorityGraphProps {
  viewerRole: 'student' | 'teacher' | 'admin' | 'audit';
}

type CanvasState =
  | { status: 'loading' }
  | { status: 'ready'; projection: ActiveCanvasResponse }
  | { status: 'empty'; projection: ActiveCanvasResponse }
  | { status: 'error'; message: string };

function errorMessage(status: number): string {
  if (status === 401) return '请先登录后查看当前 Authority 图谱。';
  if (status === 403) return '当前身份无权查看知识图谱。';
  if (status === 409) return '当前 Authority 身份发生漂移，已停止显示。';
  return '当前 Authority 图谱暂时无法加载。';
}

function useActiveCanvas(retry: number): CanvasState {
  const [state, setState] = useState<CanvasState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetch('/api/knowledge/graph/active', {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(errorMessage(response.status));
        const projection = await response.json() as ActiveCanvasResponse;
        if (
          projection.source?.authorityState !== 'active'
          || !projection.provenance?.authority
          || projection.provenance.projection?.projectionId !== null
          || projection.provenance.projection?.projectionHash !== null
        ) {
          throw new Error('当前 Authority 响应身份校验失败，已停止显示。');
        }
        return projection;
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
          message: error instanceof Error ? error.message : '当前 Authority 图谱暂时无法加载。',
        });
      });
    return () => controller.abort();
  }, [retry]);

  return state;
}

function useActiveNodeDetail(nodeId: string | null): {
  detail: ActiveNodeDetailResponse | null;
  failure: string | null;
  loading: boolean;
} {
  const [detail, setDetail] = useState<ActiveNodeDetailResponse | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!nodeId) {
      setDetail(null);
      setFailure(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setDetail(null);
    setFailure(null);
    setLoading(true);
    fetch(`/api/knowledge/nodes/active/${encodeURIComponent(nodeId)}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(errorMessage(response.status));
        return response.json() as Promise<ActiveNodeDetailResponse>;
      })
      .then(setDetail)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setFailure(error instanceof Error ? error.message : '节点详情暂时无法加载。');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [nodeId]);

  return { detail, failure, loading };
}

function typeLabel(canonicalType: string): string {
  return {
    DomainConcept: '领域概念',
    Formula: '公式',
    KnowledgeStatement: '知识陈述',
    SystemModel: '系统模型',
    ModelRepresentation: '模型表示',
  }[canonicalType] ?? canonicalType;
}

function relationLabel(predicate: string): string {
  return {
    association: '关联',
    applies_to: '适用于',
    derived_from: '推导自',
    has_component: '包含组成部分',
    has_formula: '具有公式',
    has_representation: '具有表示',
    is_a: '属于',
    part_of: '组成部分',
    used_to_analyze: '用于分析',
  }[predicate] ?? predicate;
}

function directionLabel(direction: string | null): {
  label: string;
  kind: 'undirected' | 'directed' | 'unknown';
} {
  if (direction === 'unordered' || direction === 'undirected') {
    return { label: '无向/双向', kind: 'undirected' };
  }
  if (direction === 'source_to_target' || direction === 'source-to-target' || direction === 'directed') {
    return { label: '来源→目标', kind: 'directed' };
  }
  return { label: direction ? `原始方向：${direction}` : '原始方向未声明', kind: 'unknown' };
}

function nodeTone(node: ActiveCanvasNode): string {
  switch (node.canonicalType) {
    case 'Formula': return 'border-violet-400/45 bg-violet-400/10 text-violet-100';
    case 'KnowledgeStatement': return 'border-amber-400/45 bg-amber-400/10 text-amber-100';
    case 'SystemModel':
    case 'ModelRepresentation': return 'border-emerald-400/45 bg-emerald-400/10 text-emerald-100';
    default: return 'border-cyan-400/45 bg-cyan-400/10 text-cyan-100';
  }
}

function ActiveNodeDetail({
  nodeId,
  onClose,
}: {
  nodeId: string;
  onClose: () => void;
}) {
  const { detail, failure, loading } = useActiveNodeDetail(nodeId);
  return (
    <aside
      className="min-h-0 overflow-y-auto border-l border-platform-border bg-platform-surface/95 p-4 max-lg:border-l-0 max-lg:border-t"
      aria-label="当前 Authority 节点详情"
      data-active-node-detail={nodeId}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-platform-fg-muted">当前 Authority 节点详情</div>
          <div className="mt-1 break-all text-sm text-platform-fg-secondary">{nodeId}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭当前 Authority 节点详情"
          className="rounded-md border border-platform-border p-2 text-platform-fg-secondary hover:bg-platform-action-subtle"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-platform-fg-secondary" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          正在加载当前 Authority 详情…
        </div>
      ) : failure ? (
        <div className="mt-6 rounded-lg border border-red-400/35 bg-red-400/10 p-3 text-sm text-red-100" role="alert">
          {failure}
        </div>
      ) : detail ? (
        <div className="mt-5 space-y-5">
          <div>
            <div className="text-lg font-semibold text-platform-fg-primary">{detail.node.label}</div>
            <div className="mt-1 text-xs text-platform-fg-muted">{typeLabel(detail.node.canonicalType)}</div>
            <p className="mt-3 text-sm leading-6 text-platform-fg-secondary">
              {detail.node.description ?? '该对象暂无公开说明。'}
            </p>
          </div>
          <section aria-labelledby="active-detail-relations">
            <h3 id="active-detail-relations" className="text-sm font-semibold text-platform-fg-primary">一跳关系</h3>
            <div className="mt-2 space-y-2">
              {detail.node.adjacency.length === 0 ? (
                <p className="text-sm text-platform-fg-muted">当前对象暂无一跳关系。</p>
              ) : detail.node.adjacency.slice(0, 20).map((relation) => {
                const direction = directionLabel(relation.direction);
                return (
                  <div key={relation.relationId} className="rounded-md border border-platform-border bg-platform-canvas-muted p-2 text-xs">
                    <span className="font-medium text-platform-fg-primary">{relationLabel(relation.predicate)}</span>
                    <span className="ml-2 text-platform-fg-muted">
                      {relation.traversal === 'outgoing' ? '出向' : '入向'} · {direction.label} · {relation.neighborId}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
          <section aria-labelledby="active-detail-sources">
            <h3 id="active-detail-sources" className="text-sm font-semibold text-platform-fg-primary">可访问来源</h3>
            <div className="mt-2 space-y-1 text-xs text-platform-fg-secondary">
              {detail.node.sources.length === 0
                ? <p>当前对象未附公开来源定位。</p>
                : detail.node.sources.map((source) => <p key={`${source.sourceEditionId}:${source.sectionId}`}>{source.sourceEditionId} · {source.sectionId}</p>)}
            </div>
          </section>
          {detail.role !== 'STUDENT' && detail.node.governance ? (
            <section className="rounded-lg border border-platform-border bg-platform-canvas-muted p-3 text-xs text-platform-fg-secondary">
              <h3 className="font-semibold text-platform-fg-primary">治理信息</h3>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt>审核</dt><dd>{detail.node.governance.reviewStatus ?? '未知'}</dd>
                <dt>发布</dt><dd>{detail.node.governance.publicationStatus ?? '未知'}</dd>
                <dt>层级</dt><dd>{detail.node.governanceTier ?? '未分类'}</dd>
              </dl>
            </section>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

export function ActiveAuthorityGraph({ viewerRole: _viewerRole }: ActiveAuthorityGraphProps) {
  const [retry, setRetry] = useState(0);
  const state = useActiveCanvas(retry);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const projection = state.status === 'ready' || state.status === 'empty' ? state.projection : null;
  const nodeById = useMemo(() => new Map(projection?.nodes.map((node) => [node.id, node]) ?? []), [projection]);

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-platform-page text-platform-fg-primary"
      data-active-authority-graph="true"
      data-active-authority-consumer="engineering-graph"
    >
      <header className="border-b border-platform-border bg-platform-surface/95 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">当前 Engineering Authority</h2>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-100">当前 Authority</span>
            </div>
            {projection ? (
              <>
                <p className="mt-1 text-xs text-platform-fg-secondary">
                  {projection.provenance.authority.releaseSetId} · {projection.provenance.authority.releaseId}
                </p>
                <p className="mt-1 break-all text-[11px] text-platform-fg-muted">
                  Snapshot {projection.provenance.authority.snapshotId} · Activation {projection.provenance.activation.activationId}
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-platform-fg-secondary">由服务端 committed engineering-graph selection 解析。</p>
            )}
          </div>
          {projection ? (
            <div className="text-right text-xs text-platform-fg-secondary">
              <div>覆盖：{projection.coverage.objectCount} 对象 · {projection.coverage.relationCount} 关系</div>
              <div className="mt-1 text-emerald-200">Projection：不适用（null）</div>
            </div>
          ) : null}
        </div>
      </header>

      {state.status === 'loading' ? (
        <div className="flex flex-1 items-center justify-center" role="status">
          <div className="text-center text-sm text-platform-fg-secondary">
            <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-platform-action-primary" aria-hidden="true" />
            正在加载当前 Authority 图谱…
          </div>
        </div>
      ) : state.status === 'error' ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-xl border border-red-400/35 bg-red-400/10 p-5 text-center" role="alert">
            <AlertTriangle className="mx-auto h-6 w-6 text-red-200" aria-hidden="true" />
            <p className="mt-3 text-sm text-red-50">{state.message}</p>
            <p className="mt-2 text-xs text-red-100/75">当前 Authority 不可用；未请求 Legacy API，也未自动补齐。</p>
            <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-200/40 px-3 py-2 text-sm text-red-50 hover:bg-red-100/10">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              重试当前 Authority
            </button>
          </div>
        </div>
      ) : state.status === 'empty' ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div>
            <Network className="mx-auto h-7 w-7 text-platform-fg-muted" aria-hidden="true" />
            <p className="mt-3 text-sm text-platform-fg-secondary">当前 Authority 暂无可显示对象。</p>
            <p className="mt-1 text-xs text-platform-fg-muted">未请求 Legacy API。</p>
          </div>
        </div>
      ) : projection ? (
        <div className={`grid min-h-0 flex-1 ${selectedNodeId ? 'grid-cols-[minmax(0,1fr)_minmax(19rem,27rem)] max-lg:grid-cols-1' : 'grid-cols-1'}`}>
          <main className="min-h-0 overflow-y-auto p-4" aria-label="当前 Authority 知识图谱">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-platform-fg-muted">
              <span>{projection.nodes.length} 对象 · {projection.relations.length} 关系</span>
              <span>{projection.teachingSemantics.message} · Projection 不适用</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3" data-active-graph-stage="authority">
              {projection.nodes.map((node) => {
                const relations = projection.relations.filter((relation) => relation.sourceId === node.id || relation.targetId === node.id);
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedNodeId(node.id)}
                    aria-pressed={selectedNodeId === node.id}
                    className={`min-h-32 rounded-xl border p-3 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-platform-action-primary ${nodeTone(node)} ${selectedNodeId === node.id ? 'ring-2 ring-platform-action-primary' : ''}`}
                    data-active-authority-node={node.id}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-medium">{typeLabel(node.canonicalType)}</span>
                      <span className="text-[10px] opacity-75">{relations.length} 关系</span>
                    </div>
                    <div className="mt-3 line-clamp-2 text-sm font-semibold">{node.label}</div>
                    <div className="mt-2 line-clamp-2 text-xs opacity-75">{node.description ?? node.id}</div>
                  </button>
                );
              })}
            </div>
            <section className="mt-5 rounded-xl border border-platform-border bg-platform-surface/80 p-4" aria-labelledby="active-relation-map">
              <div className="flex items-center justify-between gap-3">
                <h3 id="active-relation-map" className="text-sm font-semibold">关系路径</h3>
                <span className="text-xs text-platform-fg-muted">当前 Authority · 只读</span>
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {projection.relations.map((relation) => {
                  const source = nodeById.get(relation.sourceId);
                  const target = nodeById.get(relation.targetId);
                  const direction = directionLabel(relation.direction);
                  return (
                    <div key={relation.id} className="rounded-lg border border-platform-border bg-platform-canvas-muted p-3 text-xs" data-active-authority-relation={relation.id}>
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-platform-fg-primary">{source?.label ?? relation.sourceId}</span>
                        <span className="w-10 shrink-0 border-t border-platform-action-primary" aria-hidden="true" />
                        {direction.kind === 'undirected' ? <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" aria-label="无向或双向关系" /> : direction.kind === 'directed' ? <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-label="来源指向目标" /> : <CircleHelp className="h-3.5 w-3.5 shrink-0" aria-label="原始方向未解释" />}
                        <span className="min-w-0 flex-1 truncate text-platform-fg-primary">{target?.label ?? relation.targetId}</span>
                      </div>
                      <div className="mt-2 text-platform-fg-secondary">{relationLabel(relation.predicate)} · {direction.label}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          </main>
          {selectedNodeId ? <ActiveNodeDetail nodeId={selectedNodeId} onClose={() => setSelectedNodeId(null)} /> : null}
        </div>
      ) : null}
    </div>
  );
}
