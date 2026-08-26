'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';

import { GovernedRichText } from '@/components/shared/governed-rich-text';
import type { KnowledgeLinkData, KnowledgeNodeData } from './knowledge-graph-system';
import { getEmptyKnowledgeGraphLayoutState } from './graph/layout-state';
import { toSharedRuntimeRelationType, type AuthorityGraphViewModel } from './authority-graph-view-model';
import type { GraphDimension } from './graph-runtime-session';

const KnowledgeGraph2D = dynamic(
  () => import('./graph/knowledge-graph-2d').then((mod) => mod.KnowledgeGraph2D),
  { ssr: false },
);

const KnowledgeGraphCanvas = dynamic(
  () => import('./graph/knowledge-graph-canvas').then((mod) => mod.KnowledgeGraphCanvas),
  { ssr: false },
);

interface ActiveAuthorityForceCanvasProps {
  view: AuthorityGraphViewModel;
  dimension: GraphDimension;
  selectedNodeId: string | null;
  onSelect: (canonicalId: string) => void;
  onHover: (canonicalId: string | null) => void;
  hoverPreview: {
    name: string;
    typeLabel: string;
    summary: string;
    richTitle?: import('@/lib/governed-math').GovernedRichTextProjection;
    richDescription?: import('@/lib/governed-math').GovernedRichTextProjection;
  } | null;
  canvasAriaLabel: string;
  showUnavailableTeachingDirectory?: boolean;
}

function toRuntimeNodes(
  view: AuthorityGraphViewModel,
  compactLabelPriority: boolean,
): KnowledgeNodeData[] {
  return view.nodes.map((node, index) => ({
    id: node.canonicalId,
    name: node.label,
    nodeType: 'THEORY',
    description: node.description ?? '',
    positionX: (index % 6) * 80,
    positionY: Math.floor(index / 6) * 80,
    positionZ: 0,
    labelPriority: compactLabelPriority,
    conceptKind: node.canonicalType,
    metadata: {
      sourceMode: 'active',
      decoration: node.decoration,
    },
    richTitle: node.presentation.richTitle,
  }));
}

function toRuntimeLinks(view: AuthorityGraphViewModel): KnowledgeLinkData[] {
  return view.edges.map((edge) => {
    const relationType = toSharedRuntimeRelationType({
      predicate: edge.predicate,
      relationFamily: edge.relationFamily,
    });
    return {
      id: edge.edgeId,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      relation: edge.predicate,
      relationType,
    };
  });
}

export function ActiveAuthorityForceCanvas({
  view,
  dimension,
  selectedNodeId,
  onSelect,
  onHover,
  hoverPreview,
  canvasAriaLabel,
  showUnavailableTeachingDirectory = false,
}: ActiveAuthorityForceCanvasProps) {
  const [layoutState] = useState(getEmptyKnowledgeGraphLayoutState);
  const rendererHostRef = useRef<HTMLDivElement | null>(null);
  const [rendererSize, setRendererSize] = useState<{ width: number; height: number } | null>(null);
  const compactLabelPriority = Boolean(rendererSize && rendererSize.width < 640);
  const nodes = useMemo(
    () => toRuntimeNodes(view, compactLabelPriority),
    [compactLabelPriority, view],
  );
  const links = useMemo(() => toRuntimeLinks(view), [view]);
  const selectedNode = nodes.find((row) => row.id === selectedNodeId) ?? null;
  const fitScopeSignature = useMemo(
    () => nodes.map((node) => `${node.id}:${node.name}:${node.positionX}:${node.positionY}`).join('|'),
    [nodes],
  );
  const fitScopeVersionRef = useRef({ signature: '', id: 0 });
  const fitViewRequest = useMemo(() => {
    if (fitScopeVersionRef.current.signature !== fitScopeSignature) {
      fitScopeVersionRef.current = {
        signature: fitScopeSignature,
        id: fitScopeVersionRef.current.id + 1,
      };
    }
    return { id: fitScopeVersionRef.current.id, target: 'current' as const };
  }, [fitScopeSignature]);
  const showNodeDirectory = view.edges.length === 0 || showUnavailableTeachingDirectory;

  useEffect(() => {
    const host = rendererHostRef.current;
    if (!host) return;
    const updateRendererSize = () => {
      const width = Math.floor(host.clientWidth);
      const height = Math.floor(host.clientHeight);
      if (width <= 0 || height <= 0) return;
      setRendererSize((current) => current?.width === width && current.height === height
        ? current
        : { width, height });
    };
    updateRendererSize();
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateRendererSize);
    observer?.observe(host);
    return () => observer?.disconnect();
  }, []);

  const handleNodeEvent = (node: KnowledgeNodeData | null, kind: 'click' | 'hover') => {
    if (kind === 'hover') {
      onHover(node?.id ?? null);
      return;
    }
    if (node) onSelect(node.id);
  };

  const liveEngine = process.env.VITEST !== 'true';

  return (
    <div
      className="relative flex h-full min-h-[23rem] w-full flex-col overflow-hidden rounded-xl border border-platform-border bg-platform-canvas"
      data-active-authority-runtime="force-graph"
      data-active-authority-dimension={dimension}
      data-active-authority-label-priority={compactLabelPriority ? 'true' : 'false'}
      data-active-graph-stage="authority"
      role="application"
      aria-label={canvasAriaLabel}
    >
      <div ref={rendererHostRef} className="relative min-h-0 flex-1">
        {liveEngine && dimension === '3d' ? (
          <KnowledgeGraphCanvas
            nodes={nodes}
            links={links}
            selectedNode={selectedNode}
            hoveredNode={null}
            onNodeClick={(node) => handleNodeEvent(node, 'click')}
            onNodeHover={(node) => handleNodeEvent(node, 'hover')}
            onNodeDragEnd={() => undefined}
            labelMode="all"
            layoutState={layoutState}
            fitViewRequest={fitViewRequest}
            relayoutVersion={0}
            expandedNodeIds={[]}
            expandedDirectLinks={[]}
            activationSequenceByCenterId={{}}
            materializedNodeIds={nodes.map((row) => row.id)}
            graphVersion="active-authority"
            width={rendererSize?.width}
            height={rendererSize?.height}
          />
        ) : liveEngine ? (
          <KnowledgeGraph2D
            nodes={nodes}
            links={links}
            selectedNode={selectedNode}
            hoveredNode={null}
            onNodeClick={(node) => handleNodeEvent(node, 'click')}
            onNodeHover={(node) => handleNodeEvent(node, 'hover')}
            onNodeDragEnd={() => undefined}
            labelMode="all"
            layoutState={layoutState}
            fitViewRequest={fitViewRequest}
            relayoutVersion={0}
            expandedNodeIds={[]}
            expandedDirectLinks={[]}
            activationSequenceByCenterId={{}}
            materializedNodeIds={nodes.map((row) => row.id)}
            graphVersion="active-authority"
            width={rendererSize?.width}
            height={rendererSize?.height}
          />
        ) : null}
      </div>
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
                onSelect(node.canonicalId);
              }}
            >
              {showNodeDirectory ? <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-platform-primary" /> : null}
              <span data-active-authority-node-label="true" data-active-authority-node-label-placement="below">{node.label}</span>
            </button>
          </li>
        ))}
      </ul>
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
