'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';

import { GovernedRichText } from '@/components/shared/governed-rich-text';
import type { PublicAuthorityRootShard } from '@/lib/authority-domain-shards/contracts';
import type { KnowledgeNodeData } from './knowledge-graph-system';
import type { GraphDimension } from './graph-runtime-session';
import { KnowledgeGraphRuntimeCanvas } from './graph/knowledge-graph-runtime-canvas';
import {
  useKnowledgeGraphRuntimeCamera,
  type KnowledgeGraphRuntimeLayout,
} from './graph/use-knowledge-graph-runtime-layout';
import {
  ACTIVE_ROOT_RUNTIME_GRAPH_VERSION,
  ACTIVE_RUNTIME_GRAPH_VERSION,
  activeRootEntryUnavailable,
  activeRootEntryVisualRole,
  isActiveRootNavigationNode,
  toActiveRootRuntimeNodes,
  toActiveRuntimeLinks,
  toActiveRuntimeNodes,
} from './graph/authority-runtime-adapter';
import type { AuthorityGraphViewModel } from './authority-graph-view-model';
import { packActiveAuthorityRootEntries } from './active-authority-root-entries';

interface ActiveAuthorityRuntimeViewProps {
  kind: 'root' | 'domain';
  catalog?: PublicAuthorityRootShard['root'];
  view?: AuthorityGraphViewModel;
  dimension: GraphDimension;
  selectedNodeId: string | null;
  onSelectNode: (canonicalId: string) => void;
  onHoverNode: (canonicalId: string | null) => void;
  onEnterDomain: (visualRole: string) => void;
  hoverPreview?: {
    name: string;
    typeLabel: string;
    summary: string;
    richTitle?: import('@/lib/governed-math').GovernedRichTextProjection;
    richDescription?: import('@/lib/governed-math').GovernedRichTextProjection;
  } | null;
  canvasAriaLabel: string;
  showUnavailableTeachingDirectory?: boolean;
  layout: KnowledgeGraphRuntimeLayout;
  sessionKey: string;
}

export function ActiveAuthorityRuntimeView({
  kind,
  catalog,
  view,
  dimension,
  selectedNodeId,
  onSelectNode,
  onHoverNode,
  onEnterDomain,
  hoverPreview,
  canvasAriaLabel,
  showUnavailableTeachingDirectory = false,
  layout,
  sessionKey,
}: ActiveAuthorityRuntimeViewProps) {
  const {
    layoutState,
    relayoutVersion,
    fitViewRequest,
    handleNodeDragEnd,
    requestFitView,
  } = layout;
  const {
    cameraPoseByScopeRef,
    manipulatedAutoFitScopeKeys,
    consumedAutoFitScopeKeys,
    handleCameraManipulation,
    handleAutoFitConsumed,
    handleCameraPoseChange,
  } = useKnowledgeGraphRuntimeCamera();
  const fittedSessionRef = useRef<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [compactLabelPriority, setCompactLabelPriority] = useState(false);
  const rootNodes = useMemo(
    () => (kind === 'root' && catalog ? toActiveRootRuntimeNodes(catalog) : []),
    [catalog, kind],
  );
  const domainNodes = useMemo(
    () => (kind === 'domain' && view
      ? toActiveRuntimeNodes(view).map((node) => ({ ...node, labelPriority: compactLabelPriority }))
      : []),
    [compactLabelPriority, kind, view],
  );
  const domainLinks = useMemo(
    () => (kind === 'domain' && view ? toActiveRuntimeLinks(view) : []),
    [kind, view],
  );
  const nodes = kind === 'root' ? rootNodes : domainNodes;
  const links = kind === 'root' ? [] : domainLinks;
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const hoveredNode = nodes.find((node) => node.id === hoveredId) ?? null;
  const graphVersion = kind === 'root' ? ACTIVE_ROOT_RUNTIME_GRAPH_VERSION : ACTIVE_RUNTIME_GRAPH_VERSION;
  const cameraScopeKey = `${sessionKey}:${dimension}`;
  const rootEntries = catalog
    ? packActiveAuthorityRootEntries(catalog, { viewportWidth: 960, viewportHeight: 640 })
    : [];
  const showNodeDirectory = kind === 'domain' && (
    !view || view.edges.length === 0 || showUnavailableTeachingDirectory
  );

  useEffect(() => {
    const updateCompact = () => setCompactLabelPriority(window.innerWidth < 640);
    updateCompact();
    window.addEventListener('resize', updateCompact);
    return () => window.removeEventListener('resize', updateCompact);
  }, []);

  useEffect(() => {
    if (!sessionKey || nodes.length === 0) return;
    if (fittedSessionRef.current === sessionKey) return;
    fittedSessionRef.current = sessionKey;
    requestFitView('current');
  }, [nodes.length, requestFitView, sessionKey]);

  const handleNodeClick = (node: KnowledgeNodeData) => {
    if (kind === 'root') {
      if (activeRootEntryUnavailable(node)) return;
      const visualRole = activeRootEntryVisualRole(node);
      if (!visualRole) return;
      onEnterDomain(visualRole);
      return;
    }
    onSelectNode(node.id);
  };

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden"
      data-active-authority-runtime="force-graph"
      data-active-authority-dimension={dimension}
      data-authority-root-canvas={kind === 'root' ? 'true' : undefined}
      data-authority-shard-root={kind === 'root' ? 'true' : undefined}
      data-authority-root-domain-count={kind === 'root' && catalog ? catalog.domains.length : undefined}
      data-knowledge-runtime-owner="shared"
    >
      <div className="relative min-h-0 flex-1">
        <KnowledgeGraphRuntimeCanvas
          dimension={dimension}
          nodes={nodes}
          links={links}
          selectedNode={selectedNode}
          hoveredNode={hoveredNode}
          onNodeClick={handleNodeClick}
          onNodeHover={(node) => {
            if (kind === 'root' || !node || isActiveRootNavigationNode(node)) {
              setHoveredId(null);
              onHoverNode(null);
              return;
            }
            setHoveredId(node.id);
            onHoverNode(node.id);
          }}
          onNodeDragEnd={handleNodeDragEnd}
          layoutState={layoutState}
          fitViewRequest={fitViewRequest}
          relayoutVersion={relayoutVersion}
          graphVersion={graphVersion}
          autoFitScopeKey={cameraScopeKey}
          autoFitReady={nodes.length > 0}
          autoFitConsumed={consumedAutoFitScopeKeys.has(cameraScopeKey)}
          autoFitCameraManipulated={manipulatedAutoFitScopeKeys.has(cameraScopeKey)}
          restoredCameraPose={cameraPoseByScopeRef.current.get(cameraScopeKey) ?? null}
          onAutoFitConsumed={handleAutoFitConsumed}
          onCameraManipulation={handleCameraManipulation}
          onCameraPoseChange={handleCameraPoseChange}
          canvasAriaLabel={canvasAriaLabel}
          stageAttr="authority"
          liveEngine={process.env.VITEST !== 'true'}
        />
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
          {view.nodes.map((node) => (
            <li key={node.canonicalId}>
              <button
                type="button"
                className={showNodeDirectory
                  ? 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-platform-fg-primary transition-colors hover:bg-platform-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-platform-primary'
                  : undefined}
                data-active-authority-node={node.canonicalId}
                data-active-authority-visible-node={showNodeDirectory ? 'true' : undefined}
                data-active-authority-node-shape={node.presentation.type.shape}
                data-active-authority-node-selected={selectedNodeId === node.canonicalId ? 'true' : 'false'}
                aria-pressed={selectedNodeId === node.canonicalId}
                data-active-authority-halo={node.decoration.hasCrossDomainHalo ? 'true' : 'false'}
                data-active-authority-card-star={node.decoration.hasCardStar ? 'true' : 'false'}
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
            {hoverPreview.richTitle
              ? <GovernedRichText projection={hoverPreview.richTitle} density="preview" />
              : hoverPreview.name}
          </p>
          <p className="text-platform-fg-secondary">{hoverPreview.typeLabel}</p>
          <p className="mt-1 text-platform-fg-muted">
            {hoverPreview.richDescription
              ? <GovernedRichText projection={hoverPreview.richDescription} density="preview" />
              : hoverPreview.summary}
          </p>
        </div>
      ) : null}
    </div>
  );
}
