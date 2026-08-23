'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState, type MouseEvent } from 'react';

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
  hoverPreview: { name: string; typeLabel: string; summary: string } | null;
  canvasAriaLabel: string;
}

function toRuntimeNodes(view: AuthorityGraphViewModel): KnowledgeNodeData[] {
  return view.nodes.map((node, index) => ({
    id: node.canonicalId,
    name: node.label,
    nodeType: 'THEORY',
    description: node.description ?? '',
    positionX: (index % 6) * 80,
    positionY: Math.floor(index / 6) * 80,
    positionZ: 0,
    conceptKind: node.canonicalType,
    metadata: {
      sourceMode: 'active',
      decoration: node.decoration,
    },
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
}: ActiveAuthorityForceCanvasProps) {
  const nodes = useMemo(() => toRuntimeNodes(view), [view]);
  const links = useMemo(() => toRuntimeLinks(view), [view]);
  const selectedNode = nodes.find((row) => row.id === selectedNodeId) ?? null;
  const [layoutState] = useState(getEmptyKnowledgeGraphLayoutState);
  const fitViewRequest = useMemo(() => ({ id: 1, target: 'current' as const }), []);

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
      className="relative h-full min-h-[23rem] w-full overflow-hidden rounded-xl border border-platform-border bg-[#07111f]"
      data-active-authority-runtime="force-graph"
      data-active-authority-dimension={dimension}
      data-active-graph-stage="authority"
      role="application"
      aria-label={canvasAriaLabel}
    >
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
        />
      ) : null}
      <ul className="sr-only" data-active-authority-semantic-nodes>
        {view.nodes.map((node) => (
          <li key={node.canonicalId}>
            <button
              type="button"
              data-active-authority-node={node.canonicalId}
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
            {edge.predicate}
          </li>
        ))}
      </ul>
      {hoverPreview ? (
        <div
          role="status"
          data-active-authority-hover-preview="true"
          className="pointer-events-none absolute left-3 top-3 max-w-xs rounded-md border border-platform-border bg-platform-surface/95 px-3 py-2 text-xs text-platform-fg-primary shadow-lg"
        >
          <p className="font-medium">{hoverPreview.name}</p>
          <p className="text-platform-fg-secondary">{hoverPreview.typeLabel}</p>
          <p className="mt-1 text-platform-fg-muted">{hoverPreview.summary}</p>
        </div>
      ) : null}
    </div>
  );
}
