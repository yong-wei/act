'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  activeAuthorityStructureSignature,
  reconcileActiveAuthorityLayout,
  getActiveAuthorityWorldBounds,
  type ActiveAuthorityLayoutSessions,
} from './active-authority-geometry';
import { buildActiveAuthorityLabelDescriptors } from './active-authority-label-geometry';
import { ActiveAuthorityLabelLayer, type ActiveAuthorityLabelLayerHandle } from './active-authority-label-layer';
import { ActiveAuthorityGraph2D } from './active-authority-graph-2d';
import { ActiveAuthorityGraph3D } from './active-authority-graph-3d';
import type { ActiveAuthorityRendererProps } from './active-authority-renderer-types';

export function ActiveAuthorityRenderer({
  kind,
  dimension,
  nodes,
  links,
  selectedNodeId,
  hoveredNodeId,
  onNodeClick,
  onNodeHover,
  onNodeDragEnd,
  layoutState,
  layoutSessions,
  fitViewRequest,
  relayoutVersion,
  engineReheatRevision,
  autoFitScopeKey,
  autoFitReady,
  autoFitConsumed,
  autoFitCameraManipulated,
  restoredCameraPose,
  onAutoFitConsumed,
  onCameraManipulation,
  onCameraPoseChange,
  canvasAriaLabel,
  onEngineSettled,
}: ActiveAuthorityRendererProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const labelLayerRef = useRef<ActiveAuthorityLabelLayerHandle | null>(null);
  const localSessionsRef = useRef<ActiveAuthorityLayoutSessions>(new Map());
  const sessions = layoutSessions ?? localSessionsRef.current;
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const structureSignature = activeAuthorityStructureSignature(
    nodes,
    links,
    dimension,
    relayoutVersion,
  );
  const layoutNodes = useMemo(() => {
    let session = sessions.get(autoFitScopeKey);
    if (!session) {
      session = { nodes: new Map(), relayoutVersion };
      sessions.set(autoFitScopeKey, session);
    }
    return reconcileActiveAuthorityLayout(session, {
      nodes, links, dimension, layoutState, layoutSalt: structureSignature, relayoutVersion,
    });
  }, [autoFitScopeKey, dimension, layoutState, links, nodes, relayoutVersion, sessions, structureSignature]);
  const labels = useMemo(
    () => buildActiveAuthorityLabelDescriptors({
      nodes: layoutNodes,
      kind,
      selectedNodeId,
      hoveredNodeId,
    }),
    [hoveredNodeId, kind, layoutNodes, selectedNodeId],
  );
  const worldBounds = useMemo(() => getActiveAuthorityWorldBounds(layoutNodes), [layoutNodes]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const update = () => {
      const width = Math.floor(host.clientWidth);
      const height = Math.floor(host.clientHeight);
      if (width <= 0 || height <= 0) return;
      setSize((current) => current.width === width && current.height === height
        ? current
        : { width, height });
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(host);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const ready = size.width > 0 && size.height > 0 && layoutNodes.length > 0;
  return (
    <div
      ref={hostRef}
      className="relative h-full min-h-0 w-full overflow-hidden"
      data-active-authority-renderer="true"
      data-knowledge-runtime-canvas="true"
      data-active-graph-stage="authority"
      data-active-authority-renderer-ready={ready ? 'true' : 'false'}
      data-active-authority-renderer-dimension={dimension}
      data-active-authority-renderer-kind={kind}
      data-active-authority-layout-origin="world-zero"
      data-active-authority-node-count={String(layoutNodes.length)}
      data-active-authority-relation-count={String(links.length)}
      data-active-authority-world-center={`${worldBounds.center.x},${worldBounds.center.y},${worldBounds.center.z}`}
      data-active-authority-world-bounds={`${worldBounds.width},${worldBounds.height},${worldBounds.depth}`}
      role="application"
      aria-label={canvasAriaLabel}
      tabIndex={-1}
    >
      {ready ? (
        dimension === '2d' ? (
          <ActiveAuthorityGraph2D
            key={autoFitScopeKey}
            kind={kind}
            dimension={dimension}
            nodes={layoutNodes}
            links={links}
            selectedNodeId={selectedNodeId}
            hoveredNodeId={hoveredNodeId}
            onNodeClick={onNodeClick}
            onNodeHover={onNodeHover}
            onNodeDragEnd={onNodeDragEnd}
            fitViewRequest={fitViewRequest}
            relayoutVersion={relayoutVersion}
            engineReheatRevision={engineReheatRevision}
            autoFitScopeKey={autoFitScopeKey}
            autoFitReady={autoFitReady}
            autoFitConsumed={autoFitConsumed}
            autoFitCameraManipulated={autoFitCameraManipulated}
            restoredCameraPose={restoredCameraPose}
            onAutoFitConsumed={onAutoFitConsumed}
            onCameraManipulation={onCameraManipulation}
            onCameraPoseChange={onCameraPoseChange}
            onEngineSettled={onEngineSettled}
            labelLayerRef={labelLayerRef}
            labels={labels}
            width={size.width}
            height={size.height}
          />
        ) : (
          <ActiveAuthorityGraph3D
            key={autoFitScopeKey}
            kind={kind}
            dimension={dimension}
            nodes={layoutNodes}
            links={links}
            selectedNodeId={selectedNodeId}
            hoveredNodeId={hoveredNodeId}
            onNodeClick={onNodeClick}
            onNodeHover={onNodeHover}
            onNodeDragEnd={onNodeDragEnd}
            fitViewRequest={fitViewRequest}
            relayoutVersion={relayoutVersion}
            engineReheatRevision={engineReheatRevision}
            autoFitScopeKey={autoFitScopeKey}
            autoFitReady={autoFitReady}
            autoFitConsumed={autoFitConsumed}
            autoFitCameraManipulated={autoFitCameraManipulated}
            restoredCameraPose={restoredCameraPose}
            onAutoFitConsumed={onAutoFitConsumed}
            onCameraManipulation={onCameraManipulation}
            onCameraPoseChange={onCameraPoseChange}
            onEngineSettled={onEngineSettled}
            labelLayerRef={labelLayerRef}
            labels={labels}
            width={size.width}
            height={size.height}
          />
        )
      ) : (
        <div
          className="absolute inset-0"
          data-active-authority-renderer-waiting="true"
          aria-hidden="true"
        />
      )}
      <ActiveAuthorityLabelLayer ref={labelLayerRef} labels={labels} />
    </div>
  );
}
