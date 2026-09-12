'use client';

import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import dynamic from 'next/dynamic';

import { GovernedRichText } from '@/components/shared/governed-rich-text';
import { GovernedFormulaLabel } from './graph/semantic-label-layer';
import type { PublicAuthorityRootShard } from '@/lib/authority-domain-shards/contracts';
import type { KnowledgeNodeData } from './knowledge-graph-system';
import type { GraphDimension } from './graph-runtime-session';
import {
  useKnowledgeGraphRuntimeCamera,
  type KnowledgeGraphRuntimeLayout,
} from './graph/use-knowledge-graph-runtime-layout';
import {
  activeRootEntryUnavailable,
  activeRootEntryVisualRole,
  isActiveRootNavigationNode,
  toActiveRootRuntimeNodes,
  toActiveRuntimeLinks,
  toActiveRuntimeNodes,
} from './graph/authority-runtime-adapter';
import type { AuthorityGraphViewModel } from './authority-graph-view-model';
import { packActiveAuthorityRootEntries } from './active-authority-root-entries';
import { crossDomainNodeId, readCrossDomainCanonicalId } from './graph/cross-domain-cluster';
import { activeFocusNodeIds } from './graph/active-renderer/active-authority-visual';
import { toSharedRuntimeRelationType } from './authority-graph-view-model';
import { runtimeNodeTypeFor } from './graph/authority-runtime-adapter';
import { KNOWLEDGE_LABEL_OVERVIEW_COMPACT_MAX_NODES } from './graph/label-policy';
import type { GovernedFormulaProjection } from '@/lib/governed-math/types';
import type { ActiveAuthorityLayoutSessions } from './graph/active-renderer/active-authority-geometry';

/**
 * ForceGraph 2D/3D touches browser globals while its module is evaluated.
 * Keep that third-party graph bundle behind a real client-only boundary; the
 * surrounding Authority view still SSRs its semantic directory and gate.
 */
const ActiveAuthorityRenderer = dynamic(
  () => import('./graph/active-renderer/active-authority-renderer')
    .then((module) => module.ActiveAuthorityRenderer),
  {
    ssr: false,
    loading: () => (
      <div
        className="absolute inset-0"
        data-active-authority-renderer-loading="true"
        aria-hidden="true"
      />
    ),
  },
);

interface ActiveAuthorityRuntimeViewProps {
  kind: 'root' | 'domain';
  catalog?: PublicAuthorityRootShard['root'];
  view?: AuthorityGraphViewModel;
  dimension: GraphDimension;
  selectedNodeId: string | null;
  onSelectNode: (canonicalId: string) => void;
  onClearSelection?: () => void;
  onHoverNode: (canonicalId: string | null) => void;
  onEnterDomain: (visualRole: string) => void;
  hoverPreview?: {
    name: string;
    typeLabel: string;
    summary: string;
    richTitle?: import('@/lib/governed-math').GovernedRichTextProjection;
    richDescription?: import('@/lib/governed-math').GovernedRichTextProjection;
    mathematics?: import('@/lib/governed-math').GovernedFormulaProjection;
  } | null;
  canvasAriaLabel: string;
  /** 未裁剪的域概览规模（compact 视图的 view.nodes 已按上限裁剪）。 */
  overviewCount?: number;
  /** 未裁剪且经 model 过滤的概览目录条目（compact 可浏览目录数据源）。 */
  overviewEntries?: Array<{ id: string; label: string; mathematics?: GovernedFormulaProjection }>;
  layout: KnowledgeGraphRuntimeLayout;
  layoutSessions?: ActiveAuthorityLayoutSessions;
  camera?: ReturnType<typeof useKnowledgeGraphRuntimeCamera>;
  sessionKey: string;
  /** #2052 首帧门控：领域进入沉降完成前以加载占位替代可见帧。 */
  entryGateActive?: boolean;
  /** #2052：画布引擎沉降（或 static 布局完成）回调。 */
  onEngineSettled?: () => void;
  /** #2052 cross-domain-canvas-cluster：跨领域关系聚类（2D/3D 共享真实端点）。 */
  crossDomainClusters?: ReadonlyArray<{
    domainName: string;
    nodes: ReadonlyArray<{ canonicalId: string; name: string; typeLabel: string; summary: string }>;
    links: ReadonlyArray<{ sourceId: string; targetId: string; predicate: string; relationFamily: string | null; sources?: readonly { direction?: string | null }[] }>;
  }>;
  /** #2052：点击跨领域概念节点时携带其 canonicalId 进入目标领域。 */
  onCrossDomainNodeClick?: (canonicalId: string) => void;
}

export function ActiveAuthorityRuntimeView({
  kind,
  catalog,
  view,
  dimension,
  selectedNodeId,
  onSelectNode,
  onClearSelection,
  onHoverNode,
  onEnterDomain,
  hoverPreview,
  canvasAriaLabel,
  overviewCount,
  overviewEntries,
  layout,
  layoutSessions,
  camera,
  sessionKey,
  entryGateActive = false,
  onEngineSettled,
  crossDomainClusters,
  onCrossDomainNodeClick,
}: ActiveAuthorityRuntimeViewProps) {
  const {
    layoutState,
    relayoutVersion,
    fitViewRequest,
    handleNodeDragEnd,
    engineReheatRevision,
  } = layout;
  const localCamera = useKnowledgeGraphRuntimeCamera();
  const {
    cameraPoseByScopeRef,
    manipulatedAutoFitScopeKeys,
    consumedAutoFitScopeKeys,
    handleCameraManipulation,
    handleAutoFitConsumed,
    handleCameraPoseChange,
  } = camera ?? localCamera;
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [compactLabelPriority, setCompactLabelPriority] = useState(false);
  const rootNodes = useMemo(
    () => (kind === 'root' && catalog ? toActiveRootRuntimeNodes(catalog) : []),
    [catalog, kind],
  );
  const domainNodes = useMemo(
    () => (kind === 'domain' && view
      ? toActiveRuntimeNodes(view).map((node) => ({
        ...node,
        // compact 视口与大规模概览走重点标签通道：普通 LOD 的投影字号
        // 闸会把 fit 后的大域标签全部隐藏（#1739 大域标签预算）。
        labelPriority: compactLabelPriority
          || view.nodes.length > KNOWLEDGE_LABEL_OVERVIEW_COMPACT_MAX_NODES,
      }))
      : []),
    [compactLabelPriority, kind, view],
  );
  const domainLinks = useMemo(
    () => (kind === 'domain' && view ? toActiveRuntimeLinks(view) : []),
    [kind, view],
  );
  // #2052 cross-domain-canvas-cluster：跨领域概念合成节点与真实关系边。
  const crossNodes = useMemo(() => (kind === 'domain'
    ? (crossDomainClusters ?? []).flatMap((cluster) => cluster.nodes.map((node) => ({
      id: crossDomainNodeId(node.canonicalId),
      name: node.name,
      nodeType: runtimeNodeTypeFor('circle'),
      description: '',
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      graphDegree: 1,
      crossDomainClusterDomain: cluster.domainName,
    })))
    : []), [kind, crossDomainClusters]);
  const crossLinks = useMemo(() => (kind === 'domain'
    ? (crossDomainClusters ?? []).flatMap((cluster) => cluster.links.map((link) => ({
      id: `cross-edge:${link.sourceId}->${link.targetId}:${link.predicate}`,
      sourceId: link.sourceId,
      targetId: link.targetId,
      relation: link.predicate,
      relationFamily: link.relationFamily,
      authoritySources: link.sources,
      directed: link.sources?.[0] ? ['directed', 'source_to_target', 'source-to-target'].includes(link.sources[0].direction ?? '') : undefined,
      relationType: toSharedRuntimeRelationType({ predicate: link.predicate, relationFamily: link.relationFamily }),
    })))
    : []), [kind, crossDomainClusters]);
  // Active 的 2D/3D 共享同一组真实跨域身份与关系，只由维度改变投影方式。
  const nodes = useMemo(() => kind === 'root'
    ? rootNodes
    : [...domainNodes, ...crossNodes], [kind, rootNodes, domainNodes, crossNodes]);
  const links = useMemo(() => kind === 'root'
    ? []
    : [...domainLinks, ...crossLinks], [kind, domainLinks, crossLinks]);
  const focusedNodes = useMemo(() => activeFocusNodeIds(links, selectedNodeId), [links, selectedNodeId]);
  const cameraScopeKey = `${sessionKey}:${dimension}`;
  const rootEntries = catalog
    ? packActiveAuthorityRootEntries(catalog, { viewportWidth: 960, viewportHeight: 640 })
    : [];
  const showNodeDirectory = kind === 'domain' && view !== undefined && (
    // mobile 大域（超 compact 上限）画布标签几何受限（fit 后像素级
    // 节点），可浏览目录承担无选择可读名称（#1739 spec mobile 大域
    // 场景）。Teaching 不可用 / 零边不再展开可见目录；目录保持
    // sr-only 语义通道（#1742）。compact 视图的 view.nodes 已按可见
    // 上限裁剪，规模判断用未裁剪的 overviewCount；桌面画布不受压缩。
    compactLabelPriority && (overviewCount ?? view.nodes.length) > KNOWLEDGE_LABEL_OVERVIEW_COMPACT_MAX_NODES
  );

  useEffect(() => {
    const updateCompact = () => setCompactLabelPriority(window.innerWidth < 640);
    updateCompact();
    window.addEventListener('resize', updateCompact);
    return () => window.removeEventListener('resize', updateCompact);
  }, []);

  const handleNodeClick = (node: KnowledgeNodeData) => {
    if (kind === 'root') {
      if (activeRootEntryUnavailable(node)) return;
      const visualRole = activeRootEntryVisualRole(node);
      if (!visualRole) return;
      onEnterDomain(visualRole);
      return;
    }
    const crossCanonicalId = readCrossDomainCanonicalId(node.id);
    if (crossCanonicalId) {
      if (!onCrossDomainNodeClick) return;
      onCrossDomainNodeClick(crossCanonicalId);
      return;
    }
    onSelectNode(node.id);
  };

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden"
      data-active-authority-runtime="dedicated-renderer"
      data-active-authority-dimension={dimension}
      data-authority-root-canvas={kind === 'root' ? 'true' : undefined}
      data-authority-shard-root={kind === 'root' ? 'true' : undefined}
      data-authority-root-domain-count={kind === 'root' && catalog ? catalog.domains.length : undefined}
      data-knowledge-runtime-owner="active-authority-renderer"
    >
      <div className="relative min-h-0 flex-1">
        <ActiveAuthorityRenderer
          kind={kind}
          dimension={dimension}
          nodes={nodes}
          links={links}
          selectedNodeId={selectedNodeId}
          hoveredNodeId={hoveredId}
          onNodeClick={handleNodeClick}
          onBackgroundClick={onClearSelection}
          onNodeHover={(node) => {
            if (kind === 'root' || !node || isActiveRootNavigationNode(node) || (selectedNodeId && !focusedNodes.has(node.id))) {
              setHoveredId(null);
              onHoverNode(null);
              return;
            }
            setHoveredId(node.id);
            onHoverNode(node.id);
          }}
          onNodeDragEnd={handleNodeDragEnd}
          layoutState={layoutState}
          layoutSessions={layoutSessions}
          fitViewRequest={fitViewRequest}
          relayoutVersion={relayoutVersion}
          engineReheatRevision={engineReheatRevision}
          autoFitScopeKey={cameraScopeKey}
          autoFitReady={nodes.length > 0}
          autoFitConsumed={consumedAutoFitScopeKeys.has(cameraScopeKey)}
          autoFitCameraManipulated={manipulatedAutoFitScopeKeys.has(cameraScopeKey)}
          restoredCameraPose={cameraPoseByScopeRef.current.get(cameraScopeKey) ?? null}
          onAutoFitConsumed={handleAutoFitConsumed}
          onCameraManipulation={handleCameraManipulation}
          onCameraPoseChange={handleCameraPoseChange}
          canvasAriaLabel={canvasAriaLabel}
          onEngineSettled={onEngineSettled}
        />
        {entryGateActive ? (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-platform-surface"
            data-active-authority-entry-gate="true"
            aria-live="polite"
          >
            <span className="text-sm text-platform-fg-muted">正在加载当前领域知识。</span>
          </div>
        ) : null}
      </div>
      {kind === 'root' ? (
        <ul className="sr-only" data-active-authority-root-directory="true">
          {rootEntries.map((entry) => (
            <li key={entry.packingId}>
              {entry.kind === 'aggregate' ? (
                <span
                  data-authority-aggregate-entry="true"
                  data-authority-root-entry="aggregate"
                  data-authority-root-label="name"
                >
                  {entry.name}
                </span>
              ) : (
                <button
                  type="button"
                  data-authority-root-entry="domain"
                  data-authority-domain-entry={entry.visualRole ?? undefined}
                  data-authority-root-label="name"
                  data-authority-root-unavailable={entry.unavailable ? 'true' : 'false'}
                  disabled={entry.unavailable || !entry.visualRole}
                  aria-label={entry.name}
                  aria-disabled={entry.unavailable || !entry.visualRole}
                  onClick={() => {
                    if (entry.unavailable || !entry.visualRole) return;
                    onEnterDomain(entry.visualRole);
                  }}
                >
                  {entry.name}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : view ? (
        <ul
          className={showNodeDirectory
            ? 'grid max-h-40 shrink-0 grid-cols-1 gap-1 overflow-y-auto border-t border-platform-border bg-platform-surface/95 p-2 sm:grid-cols-2 lg:grid-cols-3'
            : 'sr-only'}
          data-active-authority-semantic-nodes
          data-active-authority-node-directory={showNodeDirectory ? 'visible' : 'semantic'}
          aria-label={showNodeDirectory ? '可浏览的知识对象' : undefined}
        >
          {(showNodeDirectory && overviewEntries
            // 无边/大域目录 = 完整概览 ∪ 当前已披露对象（邻域披露的节点
            // 仍可在目录中浏览与选择，#1739）。
            ? [...overviewEntries.map((entry) => ({ canonicalId: entry.id, label: entry.label, mathematics: entry.mathematics, shape: undefined, halo: false, cardStar: false })), ...view.nodes.map((node) => ({ canonicalId: node.canonicalId, label: node.label, mathematics: node.presentation.mathematics, shape: node.presentation.type.shape, halo: node.decoration.hasCrossDomainHalo, cardStar: node.decoration.hasCardStar }))]
              .filter((entry, index, all) => all.findIndex((other) => other.canonicalId === entry.canonicalId) === index)
            : view.nodes.map((node) => ({ canonicalId: node.canonicalId, label: node.label, mathematics: node.presentation.mathematics, shape: node.presentation.type.shape, halo: node.decoration.hasCrossDomainHalo, cardStar: node.decoration.hasCardStar }))).map((node) => (
            <li key={node.canonicalId}>
              <button
                type="button"
                aria-label={node.mathematics?.state === 'available' ? node.mathematics.accessibleLabel : undefined}
                className={showNodeDirectory
                  ? 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-platform-fg-primary transition-colors hover:bg-platform-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-platform-primary'
                  : undefined}
                data-active-authority-node={node.canonicalId}
                data-active-authority-visible-node={showNodeDirectory ? 'true' : undefined}
                data-active-authority-node-shape={node.shape}
                data-active-authority-node-selected={selectedNodeId === node.canonicalId ? 'true' : 'false'}
                aria-pressed={selectedNodeId === node.canonicalId}
                data-active-authority-halo={node.halo ? 'true' : 'false'}
                data-active-authority-card-star={node.cardStar ? 'true' : 'false'}
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                  event.preventDefault();
                  onSelectNode(node.canonicalId);
                }}
              >
                {showNodeDirectory ? <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-platform-primary" /> : null}
                <span data-active-authority-node-label="true" data-active-authority-node-label-placement="below">{node.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {kind === 'domain' && view ? (
        <ul className="sr-only" data-active-authority-semantic-edges>
          {view.edges.map((edge) => (
            <li
              key={edge.edgeId}
              data-active-authority-relation={edge.edgeId}
              data-active-authority-relation-source={edge.sourceId}
              data-active-authority-relation-target={edge.targetId}
              data-active-authority-relation-kind={edge.presentation.semantic.kind}
              data-active-authority-relation-selected={
                selectedNodeId === edge.sourceId || selectedNodeId === edge.targetId ? 'true' : 'false'
              }
            >
              {edge.presentation.semantic.label}
            </li>
          ))}
        </ul>
      ) : null}
      {hoverPreview ? (
        <div
          role="status"
          data-active-authority-hover-preview="true"
          className="pointer-events-none absolute left-3 top-3 max-w-xs rounded-md border border-platform-border bg-platform-surface/95 px-3 py-2 text-xs text-platform-fg-primary shadow-lg"
        >
          <p className="font-medium">
            {hoverPreview.richTitle && hoverPreview.richTitle.state !== 'missing'
              ? <GovernedRichText projection={hoverPreview.richTitle} density="preview" />
              : hoverPreview.name}
          </p>
          {hoverPreview.mathematics && hoverPreview.mathematics.state !== 'missing' ? (
            <p className="mt-1 max-w-full overflow-hidden" data-active-authority-hover-formula="true">
              <GovernedFormulaLabel
                projection={hoverPreview.mathematics}
                theme="dark"
              />
            </p>
          ) : null}
          <p className="text-platform-fg-secondary">{hoverPreview.typeLabel}</p>
          <p className="mt-1 text-platform-fg-muted">
            {hoverPreview.richDescription && hoverPreview.richDescription.state !== 'missing'
              ? <GovernedRichText projection={hoverPreview.richDescription} density="preview" />
              : hoverPreview.summary}
          </p>
        </div>
      ) : null}
    </div>
  );
}
