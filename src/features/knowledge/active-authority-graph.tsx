'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  CircleHelp,
  Crosshair,
  Loader2,
  Minus,
  Network,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';

import type {
  ActiveCanvasResponse,
  ActiveNodeDetailResponse,
} from './active-authority-graph-contracts';
import {
  activeNodeRelationSummaries,
  activeNodeSearch,
  createActiveAuthorityGraphModel,
  expandActiveAuthorityOneHop,
  materializeActiveNodeScope,
  presentActiveNodeType,
  presentActiveHumanText,
  presentGovernanceLabel,
  presentSourceCitation,
  selectInitialScope,
  visibleActiveGraph,
  ACTIVE_GRAPH_NODE_LIMIT,
  type ActiveAuthorityGraphModel,
  type ActiveNodePresentation,
} from './active-authority-presentation';

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

function isActiveCanvasResponse(value: unknown): value is ActiveCanvasResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ActiveCanvasResponse>;
  return candidate.projectionVersion === 'act.canvas.v2'
    && candidate.source?.authorityState === 'active'
    && Array.isArray(candidate.nodes)
    && Array.isArray(candidate.relations)
    && candidate.provenance?.projection?.projectionId === null
    && candidate.provenance?.projection?.projectionHash === null;
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
        const projection: unknown = await response.json();
        if (!isActiveCanvasResponse(projection)) {
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
        const candidate: unknown = await response.json();
        if (!candidate || typeof candidate !== 'object' || !('node' in candidate)) {
          throw new Error('节点详情暂时无法加载。');
        }
        return candidate as ActiveNodeDetailResponse;
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

function nodeFill(node: ActiveNodePresentation, selected: boolean): string {
  const colors: Record<string, string> = {
    cyan: selected ? '#155e75' : '#083344',
    violet: selected ? '#6d28d9' : '#312e81',
    amber: selected ? '#92400e' : '#451a03',
    emerald: selected ? '#047857' : '#064e3b',
    blue: selected ? '#1d4ed8' : '#172554',
    muted: '#334155',
  };
  return colors[node.type.tone] ?? colors.muted;
}

function nodeStroke(node: ActiveNodePresentation, selected: boolean): string {
  if (selected) return '#f8fafc';
  const colors: Record<string, string> = {
    cyan: '#22d3ee',
    violet: '#a78bfa',
    amber: '#fbbf24',
    emerald: '#34d399',
    blue: '#60a5fa',
    muted: '#94a3b8',
  };
  return colors[node.type.tone] ?? colors.muted;
}

interface Point {
  x: number;
  y: number;
}

const ACTIVE_MOBILE_NODE_LIMIT = 6;
const ACTIVE_MOBILE_VIEWBOX = '0 0 320 520';
const ACTIVE_DESKTOP_VIEWBOX = '0 0 960 520';

export function layoutActiveAuthorityNodes(
  nodes: readonly Pick<ActiveNodePresentation, 'key'>[],
  compact = false,
): ReadonlyMap<string, Point> {
  const columns = compact
    ? Math.max(1, Math.min(2, nodes.length))
    : Math.max(1, Math.min(6, Math.max(Math.ceil(Math.sqrt(nodes.length)), Math.ceil(nodes.length / 4))));
  const columnGap = compact
    ? 164
    : columns === 6 ? 156 : columns === 5 ? 180 : 220;
  const rowGap = compact ? 112 : 120;
  const startX = compact
    ? (columns === 1 ? 160 : 78)
    : columns === 6 ? 88 : columns === 5 ? 120 : 130;
  const startY = compact ? 72 : 84;
  return new Map(nodes.map((node, index) => [node.key, {
    x: startX + (index % columns) * columnGap,
    y: startY + Math.floor(index / columns) * rowGap,
  }]));
}

function nodePolygon(shape: ActiveNodePresentation['type']['shape'], x: number, y: number): string | null {
  if (shape === 'diamond') return `${x},${y - 28} ${x + 42},${y} ${x},${y + 28} ${x - 42},${y}`;
  if (shape === 'hexagon') return `${x - 42},${y - 20} ${x - 21},${y - 30} ${x + 21},${y - 30} ${x + 42},${y - 20} ${x + 42},${y + 20} ${x + 21},${y + 30} ${x - 21},${y + 30} ${x - 42},${y + 20}`;
  return null;
}

function GraphNode({
  node,
  point,
  selected,
  onSelect,
  compact,
}: {
  node: ActiveNodePresentation;
  point: Point;
  selected: boolean;
  onSelect: (key: string, target: SVGGElement) => void;
  compact: boolean;
}) {
  const polygon = nodePolygon(node.type.shape, point.x, point.y);
  const label = `${node.label}，${node.type.label}`;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      data-active-authority-node={node.key}
      data-active-authority-node-shape={node.type.shape}
      onClick={(event) => onSelect(node.key, event.currentTarget)}
      onKeyDown={(event: KeyboardEvent<SVGGElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(node.key, event.currentTarget);
        }
      }}
      className="cursor-pointer outline-none focus-visible:ring-2"
    >
      <title>{label}</title>
      {polygon ? (
        <polygon points={polygon} fill={nodeFill(node, selected)} stroke={nodeStroke(node, selected)} strokeWidth={selected ? 3 : 2} />
      ) : node.type.shape === 'circle' ? (
        <circle cx={point.x} cy={point.y} r={30} fill={nodeFill(node, selected)} stroke={nodeStroke(node, selected)} strokeWidth={selected ? 3 : 2} />
      ) : (
        <rect x={point.x - 44} y={point.y - 27} width={88} height={54} rx={node.type.shape === 'rounded' ? 18 : 7} fill={nodeFill(node, selected)} stroke={nodeStroke(node, selected)} strokeWidth={selected ? 3 : 2} />
      )}
      <text data-active-authority-node-label="true" x={point.x} y={point.y - 3} textAnchor="middle" fill="#f8fafc" fontSize={compact ? 13 : 12} fontWeight="600">
        {node.label.slice(0, 14)}
      </text>
      <text data-active-authority-node-type-label="true" x={point.x} y={point.y + 15} textAnchor="middle" fill="#cbd5e1" fontSize={compact ? 11 : 10}>
        {node.type.label}
      </text>
    </g>
  );
}

function GraphEdge({
  relation,
  source,
  target,
  sourceLabel,
  targetLabel,
  compact,
}: {
  relation: ActiveAuthorityGraphModel['relations'][number];
  source: Point;
  target: Point;
  sourceLabel: string;
  targetLabel: string;
  compact: boolean;
}) {
  const label = `${sourceLabel}，${relation.semantic.label}，${targetLabel}，${relation.semantic.directionLabel}`;
  return (
    <g
      data-active-authority-relation={relation.key}
      data-active-authority-relation-source={relation.sourceKey}
      data-active-authority-relation-target={relation.targetKey}
      aria-label={label}
    >
      <title>{label}</title>
      {source.x === target.x && source.y === target.y ? (
        <path
          d={`M ${source.x} ${source.y - 24} C ${source.x + 50} ${source.y - 72}, ${source.x + 72} ${source.y + 24}, ${source.x + 24} ${source.y + 24}`}
          fill="none"
          stroke="#64748b"
          strokeWidth="2"
          markerEnd={relation.semantic.kind === 'directed' ? 'url(#active-authority-arrow)' : undefined}
        />
      ) : (
        <line
          x1={source.x}
          y1={source.y}
          x2={target.x}
          y2={target.y}
          stroke="#64748b"
          strokeWidth="2"
          markerEnd={relation.semantic.kind === 'directed' ? 'url(#active-authority-arrow)' : undefined}
        />
      )}
      <text
        data-active-authority-relation-label="true"
        x={(source.x + target.x) / 2}
        y={(source.y + target.y) / 2 - 6}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize={compact ? 11 : 10}
      >
        {relation.semantic.label}
      </text>
    </g>
  );
}

function ActiveNodeDetail({
  nodeKey,
  fallbackNode,
  model,
  onClose,
}: {
  nodeKey: string;
  fallbackNode: ActiveNodePresentation | undefined;
  model: ActiveAuthorityGraphModel;
  onClose: () => void;
}) {
  const { detail, failure, loading } = useActiveNodeDetail(nodeKey);
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    panelRef.current?.focus();
  }, []);
  const node = detail?.node;
  const type = presentActiveNodeType(node?.canonicalType ?? fallbackNode?.type.canonicalType ?? '');
  const summaries = node ? activeNodeRelationSummaries(node, model) : [];
  const detailLabel = presentActiveHumanText(
    node && node.label !== nodeKey ? node.label : fallbackNode?.label,
    '名称暂不可用',
  );
  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      className="min-h-0 overflow-y-auto border-l border-platform-border bg-platform-surface/95 p-4 outline-none max-lg:border-l-0 max-lg:border-t"
      aria-label="当前 Authority 节点详情"
      data-active-node-detail={nodeKey}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-platform-fg-muted">当前 Authority 节点详情</div>
          <div className="mt-1 text-sm text-platform-fg-secondary">语义对象信息</div>
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
            <div className="text-lg font-semibold text-platform-fg-primary">{detailLabel}</div>
            <div className="mt-1 text-xs text-platform-fg-muted">{type.label}</div>
            <p className="mt-3 text-sm leading-6 text-platform-fg-secondary">
              {presentActiveHumanText(node?.description ?? fallbackNode?.description, '该对象暂无公开说明。')}
            </p>
          </div>
          <section aria-labelledby="active-detail-relations">
            <h3 id="active-detail-relations" className="text-sm font-semibold text-platform-fg-primary">一跳关系</h3>
            <div className="mt-2 space-y-2">
              {summaries.length === 0 ? (
                <p className="text-sm text-platform-fg-muted">{node?.adjacency.length ? '部分关系暂不可解释，已隐藏。' : '暂无已发布关系。'}</p>
              ) : summaries.slice(0, 20).map((relation) => (
                <div key={relation.key} className="rounded-md border border-platform-border bg-platform-canvas-muted p-2 text-xs">
                  <span className="font-medium text-platform-fg-primary">{relation.relationLabel}</span>
                  <span className="ml-2 text-platform-fg-muted">
                    {relation.traversal === 'outgoing' ? '出向' : '入向'} · {relation.directionLabel} · {relation.neighborLabel}
                  </span>
                </div>
              ))}
              {node && node.adjacency.length > summaries.length ? <p className="text-xs text-platform-fg-muted">部分关系暂不可解释，已隐藏。</p> : null}
            </div>
          </section>
          <section aria-labelledby="active-detail-sources">
            <h3 id="active-detail-sources" className="text-sm font-semibold text-platform-fg-primary">参考来源</h3>
            <p className="mt-2 text-xs text-platform-fg-secondary">{presentSourceCitation(node?.sources)}</p>
          </section>
          {node?.governance ? (
            <section className="rounded-lg border border-platform-border bg-platform-canvas-muted p-3 text-xs text-platform-fg-secondary">
              <h3 className="font-semibold text-platform-fg-primary">内容状态</h3>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt>审核</dt><dd>{presentGovernanceLabel(node.governance.reviewStatus)}</dd>
                <dt>发布</dt><dd>{presentGovernanceLabel(node.governance.publicationStatus)}</dd>
              </dl>
            </section>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

function SearchResults({
  results,
  onSelect,
}: {
  results: readonly ActiveNodePresentation[];
  onSelect: (key: string) => void;
}) {
  if (results.length === 0) return null;
  return (
    <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-platform-border bg-platform-surface" data-active-search-results>
      {results.map((node) => (
        <button
          key={node.key}
          type="button"
          onClick={() => onSelect(node.key)}
          aria-label={`定位${node.label}`}
          data-active-authority-search-result={node.key}
          className="flex w-full items-center justify-between gap-2 border-b border-platform-border px-3 py-2 text-left text-xs last:border-b-0 hover:bg-platform-action-subtle"
        >
          <span className="truncate text-platform-fg-primary">{node.label}</span>
          <span className="shrink-0 text-platform-fg-muted">{node.type.label}</span>
        </button>
      ))}
    </div>
  );
}

export function ActiveAuthorityGraph({ viewerRole: _viewerRole }: ActiveAuthorityGraphProps) {
  const [retry, setRetry] = useState(0);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const state = useActiveCanvas(retry);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<SVGGElement | null>(null);
  const draggingRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const isCompactViewport = viewportWidth !== null && viewportWidth < 640;
  const visibleNodeLimit = isCompactViewport ? ACTIVE_MOBILE_NODE_LIMIT : ACTIVE_GRAPH_NODE_LIMIT;

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  const model = useMemo(
    () => state.status === 'ready' || state.status === 'empty'
      ? createActiveAuthorityGraphModel(state.projection)
      : null,
    [state],
  );
  const projection = state.status === 'ready' || state.status === 'empty' ? state.projection : null;

  useEffect(() => {
    if (!model) return;
    setVisibleKeys(selectInitialScope(model, visibleNodeLimit));
    setSelectedNodeKey(null);
    setQuery('');
    setTypeFilter('');
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [model, visibleNodeLimit]);

  useEffect(() => {
    if (!selectedNodeKey) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const key = selectedNodeKey;
      setSelectedNodeKey(null);
      window.setTimeout(() => restoreFocus(key), 0);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedNodeKey]);

  const searchResults = useMemo(
    () => model ? activeNodeSearch(model, query, typeFilter || undefined) : [],
    [model, query, typeFilter],
  );
  const scopedGraph = useMemo(() => {
    if (!model) return null;
    const scoped = visibleActiveGraph(model, visibleKeys);
    if (!typeFilter) return scoped;
    const filteredKeys = new Set(scoped.nodes.filter((node) => node.type.canonicalType === typeFilter).map((node) => node.key));
    return visibleActiveGraph(model, filteredKeys);
  }, [model, typeFilter, visibleKeys]);
  const layout = useMemo(
    () => layoutActiveAuthorityNodes(scopedGraph?.nodes ?? [], isCompactViewport),
    [isCompactViewport, scopedGraph],
  );
  const selectedNode = selectedNodeKey && model ? model.nodeByKey.get(selectedNodeKey) : undefined;

  function selectNode(key: string, target?: SVGGElement) {
    if (!model) return;
    triggerRef.current = target ?? null;
    setVisibleKeys((current) => expandActiveAuthorityOneHop(model, current, key, visibleNodeLimit));
    setSelectedNodeKey(key);
  }

  function focusSearchResult(key: string) {
    if (!model) return;
    // The result button is removed when the query is cleared; restore focus
    // to the newly materialized semantic node or the canvas instead.
    triggerRef.current = null;
    setVisibleKeys(materializeActiveNodeScope(model, key, visibleNodeLimit));
    setSelectedNodeKey(key);
    setQuery('');
    setTypeFilter('');
  }

  function resetOverview() {
    if (!model) return;
    setVisibleKeys(selectInitialScope(model, visibleNodeLimit));
    setSelectedNodeKey(null);
    setQuery('');
    setTypeFilter('');
    triggerRef.current = null;
    window.setTimeout(() => document.querySelector<SVGElement>('[data-active-graph-stage]')?.focus(), 0);
  }

  function closeDetail() {
    const key = selectedNodeKey;
    setSelectedNodeKey(null);
    window.setTimeout(() => restoreFocus(key), 0);
  }

  function restoreFocus(nodeKey: string | null) {
    if (triggerRef.current?.isConnected) {
      triggerRef.current.focus();
      return;
    }
    if (nodeKey) {
      for (const node of document.querySelectorAll<SVGGElement>('[data-active-authority-node]')) {
        if (node.dataset.activeAuthorityNode === nodeKey) {
          node.focus();
          return;
        }
      }
    }
    document.querySelector<HTMLElement>('[data-active-graph-stage]')?.focus();
  }

  function onStagePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.target instanceof Element && event.target.closest('[data-active-authority-node]')) {
      draggingRef.current = null;
      return;
    }
    draggingRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onStagePointerMove(event: PointerEvent<SVGSVGElement>) {
    const drag = draggingRef.current;
    if (!drag) return;
    setPan({ x: drag.panX + (event.clientX - drag.x), y: drag.panY + (event.clientY - drag.y) });
  }

  function onStagePointerUp() {
    draggingRef.current = null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-platform-page text-platform-fg-primary" data-active-authority-graph="true" data-active-authority-consumer="engineering-graph">
      <header className="border-b border-platform-border bg-platform-surface/95 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">当前 Engineering Authority</h2>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-100">当前 Authority</span>
            </div>
            <p className="mt-1 text-xs text-platform-fg-secondary">以语义对象和已发布工程关系呈现，可搜索并逐步探索。</p>
          </div>
          {projection ? (
            <div className="text-right text-xs text-platform-fg-secondary">
              <div>覆盖：{projection.coverage.objectCount} 个对象 · {projection.coverage.relationCount} 条关系</div>
              <div className="mt-1 text-emerald-200">教学关系尚未发布</div>
            </div>
          ) : null}
        </div>
      </header>

      {state.status === 'loading' ? (
        <div className="flex flex-1 items-center justify-center" role="status">
          <div className="text-center text-sm text-platform-fg-secondary"><Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-platform-action-primary" aria-hidden="true" />正在加载当前 Authority 图谱…</div>
        </div>
      ) : state.status === 'error' ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-xl border border-red-400/35 bg-red-400/10 p-5 text-center" role="alert">
            <AlertTriangle className="mx-auto h-6 w-6 text-red-200" aria-hidden="true" />
            <p className="mt-3 text-sm text-red-50">{state.message}</p>
            <p className="mt-2 text-xs text-red-100/75">当前 Authority 不可用；未请求 Legacy API，也未自动补齐。</p>
            <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-200/40 px-3 py-2 text-sm text-red-50 hover:bg-red-100/10"><RotateCcw className="h-4 w-4" aria-hidden="true" />重试当前 Authority</button>
          </div>
        </div>
      ) : state.status === 'empty' || !model || !scopedGraph ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div><Network className="mx-auto h-7 w-7 text-platform-fg-muted" aria-hidden="true" /><p className="mt-3 text-sm text-platform-fg-secondary">当前 Authority 暂无可显示对象。</p><p className="mt-1 text-xs text-platform-fg-muted">未请求 Legacy API。</p></div>
        </div>
      ) : (
        <div className={`grid min-h-0 flex-1 ${selectedNodeKey ? 'grid-cols-[minmax(0,1fr)_minmax(19rem,27rem)] max-lg:grid-cols-1' : 'grid-cols-1'}`}>
          <main className="min-h-0 overflow-y-auto p-4" aria-label="当前 Authority 知识图谱">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-[15rem] flex-1">
                <label className="sr-only" htmlFor="active-authority-search">搜索当前 Authority 对象</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-platform-fg-muted" aria-hidden="true" />
                  <input id="active-authority-search" value={query} onChange={(event) => setQuery(event.target.value)} onInput={(event) => setQuery(event.currentTarget.value)} placeholder="搜索对象名称或类型" className="w-full rounded-md border border-platform-border bg-platform-canvas-muted py-2 pl-9 pr-3 text-sm text-platform-fg-primary outline-none focus:ring-2 focus:ring-platform-action-primary" />
                </div>
                {query || typeFilter ? <SearchResults results={searchResults} onSelect={focusSearchResult} /> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="active-authority-type-filter">按对象类型筛选</label>
                <div className="relative">
                  <select id="active-authority-type-filter" aria-label="按对象类型筛选" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="appearance-none rounded-md border border-platform-border bg-platform-canvas-muted py-2 pl-3 pr-8 text-xs text-platform-fg-secondary">
                    <option value="">全部类型</option>
                    {model.nodes.reduce<string[]>((types, node) => types.includes(node.type.canonicalType) ? types : [...types, node.type.canonicalType], []).sort().map((canonicalType) => <option key={canonicalType} value={canonicalType}>{presentActiveNodeType(canonicalType).label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3.5 w-3.5 text-platform-fg-muted" aria-hidden="true" />
                </div>
                <button type="button" onClick={resetOverview} className="inline-flex items-center gap-1 rounded-md border border-platform-border px-2.5 py-2 text-xs text-platform-fg-secondary hover:bg-platform-action-subtle"><Crosshair className="h-3.5 w-3.5" aria-hidden="true" />返回总览</button>
              </div>
            </div>

            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-platform-fg-muted">
              <span>{scopedGraph.nodes.length} 个对象 · {scopedGraph.relations.length} 条关系 · 可见范围</span>
              <span>总覆盖 {model.totalNodeCount} 个对象 · {model.totalRelationCount} 条关系</span>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-platform-border bg-[#07111f]" data-active-graph-stage="authority" tabIndex={-1}>
              <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md border border-platform-border bg-platform-surface/90 p-1">
                <button type="button" aria-label="缩小图谱" onClick={() => setZoom((value) => Math.max(0.65, Number((value - 0.15).toFixed(2))))} className="rounded p-1.5 text-platform-fg-secondary hover:bg-platform-action-subtle"><Minus className="h-3.5 w-3.5" aria-hidden="true" /></button>
                <span className="min-w-10 text-center text-[10px] text-platform-fg-muted">{Math.round(zoom * 100)}%</span>
                <button type="button" aria-label="放大图谱" onClick={() => setZoom((value) => Math.min(1.75, Number((value + 0.15).toFixed(2))))} className="rounded p-1.5 text-platform-fg-secondary hover:bg-platform-action-subtle"><Plus className="h-3.5 w-3.5" aria-hidden="true" /></button>
                <button type="button" aria-label="重置图谱视图" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="rounded p-1.5 text-platform-fg-secondary hover:bg-platform-action-subtle"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /></button>
              </div>
              <svg
                data-active-authority-svg="true"
                data-active-authority-viewport={isCompactViewport ? 'compact' : 'default'}
                data-active-authority-node-limit={visibleNodeLimit}
                viewBox={isCompactViewport ? ACTIVE_MOBILE_VIEWBOX : ACTIVE_DESKTOP_VIEWBOX}
                className="h-[min(60vh,520px)] min-h-[23rem] w-full touch-none"
                role="application"
                aria-label="当前 Authority 语义关系画布"
                onPointerDown={onStagePointerDown}
                onPointerMove={onStagePointerMove}
                onPointerUp={onStagePointerUp}
                onPointerCancel={onStagePointerUp}
              >
                <defs><marker id="active-authority-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#94a3b8" /></marker></defs>
                <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                  {scopedGraph.relations.map((relation) => {
                    const source = layout.get(relation.sourceKey);
                    const target = layout.get(relation.targetKey);
                    const sourceNode = model.nodeByKey.get(relation.sourceKey);
                    const targetNode = model.nodeByKey.get(relation.targetKey);
                    return source && target && sourceNode && targetNode
                      ? <GraphEdge key={relation.key} relation={relation} source={source} target={target} sourceLabel={sourceNode.label} targetLabel={targetNode.label} compact={isCompactViewport} />
                      : null;
                  })}
                  {scopedGraph.nodes.map((node) => {
                    const point = layout.get(node.key);
                    return point ? <GraphNode key={node.key} node={node} point={point} selected={selectedNodeKey === node.key} onSelect={selectNode} compact={isCompactViewport} /> : null;
                  })}
                </g>
              </svg>
              {scopedGraph.nodes.length === 1 && scopedGraph.relations.length === 0 ? <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-platform-fg-muted">该对象暂无已发布关系</div> : null}
            </div>
            {model.omittedNodeCount > 0 || model.omittedRelationCount > 0 ? <p className="mt-2 text-xs text-platform-fg-muted">部分内容暂不可解释，已隐藏以保持语义安全。</p> : null}
            {searchResults.length === 0 && (query || typeFilter) ? <p className="mt-3 flex items-center gap-1 text-xs text-platform-fg-muted"><CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />没有匹配的语义对象。</p> : null}
          </main>
          {selectedNodeKey ? <ActiveNodeDetail nodeKey={selectedNodeKey} fallbackNode={selectedNode} model={model} onClose={closeDetail} /> : null}
        </div>
      )}
    </div>
  );
}
