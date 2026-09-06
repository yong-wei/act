'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { KnowledgeLinkData, KnowledgeNodeData } from '../knowledge-graph-system';
import type { GraphDimension } from '../graph-runtime-session';
import type { KnowledgeGraphLabelMode } from './label-policy';
import type { KnowledgeGraphCameraPose } from './knowledge-graph-canvas';
import type { KnowledgeGraphLayoutState } from './layout-state';
import type { KnowledgeGraphFitRequest } from './root-layout';
import type { KnowledgeGraphSelectedCorridorEmphasis } from './edge-presentation';

/**
 * 模块级空值常量（#2052）：hover/选择等纯渲染重渲染不得因默认参数新建
 * 数组/对象引用而使下游 graphData memo 失效、进而重热力导向引擎。
 */
const EMPTY_NODE_IDS: readonly string[] = [];
const EMPTY_LINKS: readonly KnowledgeLinkData[] = [];
const EMPTY_ACTIVATION_SEQUENCE: Readonly<Record<string, number>> = {};

const KnowledgeGraphCanvas = dynamic(
  () => import('./knowledge-graph-canvas').then((mod) => mod.KnowledgeGraphCanvas),
  { ssr: false },
);

const KnowledgeGraph2D = dynamic(
  () => import('./knowledge-graph-2d').then((mod) => mod.KnowledgeGraph2D),
  { ssr: false },
);

export interface KnowledgeGraphRuntimeCanvasProps {
  dimension: GraphDimension;
  nodes: KnowledgeNodeData[];
  links: KnowledgeLinkData[];
  presentationLinks?: readonly KnowledgeLinkData[];
  selectedNode: KnowledgeNodeData | null;
  hoveredNode: KnowledgeNodeData | null;
  onNodeClick: (node: KnowledgeNodeData) => void;
  onNodeHover: (node: KnowledgeNodeData | null) => void;
  onNodeDragEnd: (node: KnowledgeNodeData) => void;
  onBackgroundClick?: () => void;
  labelMode?: KnowledgeGraphLabelMode;
  layoutState: KnowledgeGraphLayoutState;
  fitViewRequest: KnowledgeGraphFitRequest;
  relayoutVersion: number;
  expandedNodeIds?: readonly string[];
  expandedDirectLinks?: readonly KnowledgeLinkData[];
  activationSequenceByCenterId?: Readonly<Record<string, number>>;
  materializedNodeIds?: readonly string[];
  graphVersion: string | null;
  lessonOrderNodeIds?: readonly string[];
  teachingOrderLinks?: readonly KnowledgeLinkData[];
  selectedCorridorEmphasis?: KnowledgeGraphSelectedCorridorEmphasis | null;
  autoFitScopeKey?: string | null;
  autoFitReady?: boolean;
  autoFitConsumed?: boolean;
  autoFitCameraManipulated?: boolean;
  restoredCameraPose?: KnowledgeGraphCameraPose | null;
  onAutoFitConsumed?: (scopeKey: string) => void;
  onCameraManipulation?: (scopeKey: string) => void;
  onCameraPoseChange?: (scopeKey: string, pose: KnowledgeGraphCameraPose) => void;
  collapsingNodeId?: string | null;
  onCollapsePresentationComplete?: (nodeId: string) => void;
  canvasAriaLabel?: string;
  stageAttr?: string;
  width?: number;
  height?: number;
  liveEngine?: boolean;
  /** Bump to reheat the live force engine without changing structure (#1739). */
  engineReheatRevision?: number;
  /** #2052：引擎首次沉降（或 static 布局完成）时通知父级做首帧门控。 */
  onEngineSettled?: () => void;
}

export function KnowledgeGraphRuntimeCanvas({
  dimension,
  nodes,
  links,
  presentationLinks,
  selectedNode,
  hoveredNode,
  onNodeClick,
  onNodeHover,
  onNodeDragEnd,
  onBackgroundClick,
  labelMode = 'all',
  layoutState,
  fitViewRequest,
  relayoutVersion,
  expandedNodeIds = EMPTY_NODE_IDS,
  expandedDirectLinks = EMPTY_LINKS,
  activationSequenceByCenterId = EMPTY_ACTIVATION_SEQUENCE,
  materializedNodeIds,
  graphVersion,
  lessonOrderNodeIds,
  teachingOrderLinks,
  selectedCorridorEmphasis,
  autoFitScopeKey,
  autoFitReady,
  autoFitConsumed,
  autoFitCameraManipulated,
  restoredCameraPose,
  onAutoFitConsumed,
  onCameraManipulation,
  onCameraPoseChange,
  collapsingNodeId,
  onCollapsePresentationComplete,
  canvasAriaLabel,
  stageAttr,
  width,
  height,
  liveEngine = true,
  engineReheatRevision = 0,
  onEngineSettled,
}: KnowledgeGraphRuntimeCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const resolvedMaterializedNodeIds = useMemo(
    () => materializedNodeIds ?? nodes.map((node) => node.id),
    [materializedNodeIds, nodes],
  );
  const usesExternalSize = typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0;
  const engineWidth = usesExternalSize ? width : size?.width;
  const engineHeight = usesExternalSize ? height : size?.height;

  useEffect(() => {
    if (usesExternalSize) return undefined;
    const host = hostRef.current;
    if (!host) return undefined;
    const update = () => {
      const width = Math.floor(host.clientWidth);
      const height = Math.floor(host.clientHeight);
      if (width <= 0 || height <= 0) return;
      setSize((current) => (
        current?.width === width && current.height === height
          ? current
          : { width, height }
      ));
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(host);
    return () => observer?.disconnect();
  }, [usesExternalSize]);

  return (
    <div
      ref={hostRef}
      className="relative h-full min-h-0 w-full overflow-hidden"
      data-knowledge-runtime-canvas="true"
      data-knowledge-canvas-primary="true"
      data-knowledge-runtime-dimension={dimension}
      data-active-graph-stage={stageAttr}
      role="application"
      aria-label={canvasAriaLabel}
      tabIndex={-1}
    >
      {liveEngine && dimension === '3d' ? (
        <KnowledgeGraphCanvas
          nodes={nodes}
          links={links}
          presentationLinks={presentationLinks}
          selectedNode={selectedNode}
          hoveredNode={hoveredNode}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
          onNodeDragEnd={onNodeDragEnd}
          onBackgroundClick={onBackgroundClick}
          labelMode={labelMode}
          layoutState={layoutState}
          fitViewRequest={fitViewRequest}
          autoFitScopeKey={autoFitScopeKey}
          autoFitReady={autoFitReady}
          autoFitConsumed={autoFitConsumed}
          autoFitCameraManipulated={autoFitCameraManipulated}
          restoredCameraPose={restoredCameraPose}
          onAutoFitConsumed={onAutoFitConsumed}
          onCameraManipulation={onCameraManipulation}
          onCameraPoseChange={onCameraPoseChange}
          relayoutVersion={relayoutVersion}
          engineReheatRevision={engineReheatRevision}
          onEngineSettled={onEngineSettled}
          expandedNodeIds={expandedNodeIds}
          expandedDirectLinks={expandedDirectLinks}
          activationSequenceByCenterId={activationSequenceByCenterId}
          materializedNodeIds={resolvedMaterializedNodeIds}
          graphVersion={graphVersion}
          lessonOrderNodeIds={lessonOrderNodeIds}
          teachingOrderLinks={teachingOrderLinks}
          selectedCorridorEmphasis={selectedCorridorEmphasis}
          collapsingNodeId={collapsingNodeId}
          onCollapsePresentationComplete={onCollapsePresentationComplete}
          width={engineWidth}
          height={engineHeight}
        />
      ) : liveEngine ? (
        <KnowledgeGraph2D
          nodes={nodes}
          links={links}
          presentationLinks={presentationLinks}
          selectedNode={selectedNode}
          hoveredNode={hoveredNode}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
          onNodeDragEnd={onNodeDragEnd}
          onBackgroundClick={onBackgroundClick}
          labelMode={labelMode}
          layoutState={layoutState}
          fitViewRequest={fitViewRequest}
          relayoutVersion={relayoutVersion}
          engineReheatRevision={engineReheatRevision}
          onEngineSettled={onEngineSettled}
          expandedNodeIds={expandedNodeIds}
          expandedDirectLinks={expandedDirectLinks}
          activationSequenceByCenterId={activationSequenceByCenterId}
          materializedNodeIds={resolvedMaterializedNodeIds}
          graphVersion={graphVersion}
          lessonOrderNodeIds={lessonOrderNodeIds}
          teachingOrderLinks={teachingOrderLinks}
          selectedCorridorEmphasis={selectedCorridorEmphasis}
          collapsingNodeId={collapsingNodeId}
          onCollapsePresentationComplete={onCollapsePresentationComplete}
          width={engineWidth}
          height={engineHeight}
        />
      ) : null}
    </div>
  );
}
