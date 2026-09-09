'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d';
import * as THREE from 'three';
import { fitActiveAuthorityPerspectiveCamera } from './active-authority-camera-3d';

import {
  placeActiveAuthorityLabels,
} from './active-authority-label-geometry';
import type { ActiveAuthorityGraphProps } from './active-authority-renderer-types';
import {
  activeNodeAccessibleName,
  canRestoreActiveCameraPose,
  activeNodeColor,
  activeNodeRadius,
  activeNodeShape,
  activeRelationColor,
  activeRelationStyle,
  activeNodeOpacity,
  activeFocusNodeIds,
  activeLinkOpacity,
  activeRelationIsDirected,
  disposeActiveObject3D,
  type ActiveAuthorityNodeShape,
} from './active-authority-visual';
import type { ActiveAuthorityLayoutLink, ActiveAuthorityLayoutNode } from './active-authority-geometry';

type ActiveGraph3DMethods = ForceGraphMethods<ActiveAuthorityLayoutNode, ActiveAuthorityLayoutLink>;

interface ActiveControls {
  target?: THREE.Vector3;
  addEventListener?: (event: string, listener: () => void) => void;
  removeEventListener?: (event: string, listener: () => void) => void;
}

function makeGeometry(shape: ActiveAuthorityNodeShape, radius: number): THREE.BufferGeometry {
  switch (shape) {
    case 'square': return new THREE.BoxGeometry(radius * 1.65, radius * 1.65, radius * 1.65);
    case 'hexagon': return new THREE.CylinderGeometry(radius, radius, radius * 0.72, 6);
    case 'triangle': return new THREE.CylinderGeometry(radius, radius, radius * 0.72, 3);
    case 'diamond': return new THREE.OctahedronGeometry(radius, 0);
    case 'pentagon': return new THREE.CylinderGeometry(radius, radius, radius * 0.72, 5);
    default: return new THREE.SphereGeometry(radius, 16, 12);
  }
}

function createNodeObject(node: ActiveAuthorityLayoutNode): THREE.Group {
  const group = new THREE.Group();
  const radius = activeNodeRadius(node);
  const body = new THREE.Mesh(
    makeGeometry(activeNodeShape(node), radius),
    new THREE.MeshLambertMaterial({ color: activeNodeColor(node), transparent: true, opacity: 0.94 }),
  );
  body.userData.activeAuthorityBody = true;
  group.add(body);
  const decoration = (node.metadata ?? {}) as { decoration?: { visualFamilies?: readonly string[]; hasCardStar?: boolean } };
  const familyCount = decoration.decoration?.visualFamilies?.length ?? 0;
  if (familyCount > 0 || decoration.decoration?.hasCardStar) {
    const badge = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(1.5, radius * 0.16), 8, 6),
      new THREE.MeshBasicMaterial({ color: decoration.decoration?.hasCardStar ? '#e1b96b' : '#a3ced3' }),
    );
    badge.position.set(radius * 0.62, radius * 0.62, radius * 0.18);
    badge.userData.activeAuthorityResourceBadge = true;
    group.add(badge);
  }
  group.userData.activeAuthorityNodeId = node.id;
  return group;
}

function setNodeFocus(group: THREE.Group, node: ActiveAuthorityLayoutNode, selectedNodeId: string | null, hoveredNodeId: string | null, focusedNodeIds: ReadonlySet<string>): void {
  const selected = node.id === selectedNodeId;
  const focused = selected || (!selectedNodeId && node.id === hoveredNodeId);
  const body = group.children.find((child) => child.userData.activeAuthorityBody) as THREE.Mesh | undefined;
  if (!body) return;
  const material = body.material as THREE.MeshLambertMaterial;
  material.color.set(activeNodeColor(node));
  material.opacity = activeNodeOpacity(node.id, selectedNodeId, hoveredNodeId, focusedNodeIds);
  material.depthWrite = material.opacity > 0.5;
  for (const child of group.children) {
    if (!child.userData.activeAuthorityResourceBadge) continue;
    const badge = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
    badge.transparent = true;
    badge.opacity = material.opacity;
  }
  group.scale.setScalar(selected ? 1.16 : focused ? 1.08 : 1);
}

function focusedLink(link: ActiveAuthorityLayoutLink, selectedNodeId: string | null, hoveredNodeId: string | null): boolean {
  return link.sourceId === selectedNodeId || link.targetId === selectedNodeId
    || (!selectedNodeId && (link.sourceId === hoveredNodeId || link.targetId === hoveredNodeId));
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function ActiveAuthorityGraph3D({
  kind,
  nodes,
  links,
  selectedNodeId,
  hoveredNodeId,
  onNodeClick,
  onBackgroundClick,
  onNodeHover,
  onNodeDragEnd,
  fitViewRequest,
  engineReheatRevision,
  autoFitScopeKey,
  autoFitReady,
  autoFitConsumed,
  autoFitCameraManipulated,
  restoredCameraPose,
  onAutoFitConsumed,
  onCameraManipulation,
  onCameraPoseChange,
  onEngineSettled,
  labelLayerRef,
  labels,
  width,
  height,
}: ActiveAuthorityGraphProps) {
  const graphHostRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<ActiveGraph3DMethods | undefined>(undefined);
  const nodeObjectCacheRef = useRef(new Map<string, THREE.Group>());
  const linkObjectCacheRef = useRef(new Map<string, THREE.Line>());
  const projectionFrameRef = useRef<number | null>(null);
  const programmaticCameraRef = useRef(false);
  const settledGraphRef = useRef<readonly ActiveAuthorityLayoutNode[] | null>(null);
  const fittingGraphRef = useRef(false);
  const initialCameraReadyRef = useRef(false);
  const pendingExplicitFitRef = useRef(false);
  const selectedNodeIdRef = useRef<string | null>(selectedNodeId);
  const hoveredNodeIdRef = useRef<string | null>(hoveredNodeId);
  const previousFitRequestRef = useRef(fitViewRequest.id);
  const previousScopeKeyRef = useRef(autoFitScopeKey);
  const previousReheatRef = useRef(engineReheatRevision);
  const graphNodesRef = useRef<readonly ActiveAuthorityLayoutNode[]>([]);
  const scheduleProjectionRef = useRef<(() => void) | null>(null);
  const fitGraphRef = useRef<((reason: 'initial' | 'explicit') => boolean) | null>(null);
  const settleAfterRenderRef = useRef<(() => void) | null>(null);
  const autoFitConsumedRef = useRef(autoFitConsumed);
  const autoFitScopeKeyRef = useRef(autoFitScopeKey);
  const restoredCameraPoseRef = useRef(restoredCameraPose);
  const onAutoFitConsumedRef = useRef(onAutoFitConsumed);
  const onCameraManipulationRef = useRef(onCameraManipulation);
  const onCameraPoseChangeRef = useRef(onCameraPoseChange);
  const onEngineSettledRef = useRef(onEngineSettled);
  const lifecycleGenerationRef = useRef(0);
  const initializationFrameRef = useRef<number | null>(null);
  const initializationAttemptRef = useRef(0);
  const focusedNodeIds = useMemo(() => activeFocusNodeIds(links, selectedNodeId), [links, selectedNodeId]);
  const focusedNodeIdsRef = useRef(focusedNodeIds);
  focusedNodeIdsRef.current = focusedNodeIds;
  const graphData = useMemo(() => ({
    nodes: [...nodes],
    links: links.map((link) => ({ ...link })),
  }), [links, nodes]);
  selectedNodeIdRef.current = selectedNodeId;
  hoveredNodeIdRef.current = hoveredNodeId;
  graphNodesRef.current = graphData.nodes;
  autoFitConsumedRef.current = autoFitConsumed;
  autoFitScopeKeyRef.current = autoFitScopeKey;
  restoredCameraPoseRef.current = restoredCameraPose;
  onAutoFitConsumedRef.current = onAutoFitConsumed;
  onCameraManipulationRef.current = onCameraManipulation;
  onCameraPoseChangeRef.current = onCameraPoseChange;
  onEngineSettledRef.current = onEngineSettled;

  const projectLabels = useCallback(() => {
    const graph = graphRef.current;
    if (!graph?.graph2ScreenCoords) return;
    const points = new Map<string, { x: number; y: number; scale: number }>();
    for (const node of graphData.nodes) {
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y) || !Number.isFinite(node.z)) continue;
      const point = graph.graph2ScreenCoords(node.x, node.y, node.z);
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      points.set(node.id, { x: point.x, y: point.y, scale: 1 });
    }
    labelLayerRef.current?.sync(placeActiveAuthorityLabels({
      descriptors: labels,
      points,
      width,
      height,
      selectedNodeId,
      hoveredNodeId,
    }));
  }, [graphData.nodes, height, hoveredNodeId, labelLayerRef, labels, selectedNodeId, width]);

  const scheduleProjection = useCallback(() => {
    if (projectionFrameRef.current !== null) return;
    projectionFrameRef.current = window.requestAnimationFrame(() => {
      projectionFrameRef.current = null;
      projectLabels();
    });
  }, [projectLabels]);
  scheduleProjectionRef.current = scheduleProjection;

  const reportCameraPose = useCallback(() => {
    const graph = graphRef.current;
    const camera = graph?.camera?.() as THREE.PerspectiveCamera | undefined;
    const controls = graph?.controls?.() as ActiveControls | undefined;
    if (!camera || !controls?.target) return;
    const pose = {
      viewport: { width, height },
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
      up: { x: camera.up.x, y: camera.up.y, z: camera.up.z },
    };
    if (Object.values(pose.position).every(Number.isFinite)
      && Object.values(pose.target).every(Number.isFinite)
      && Object.values(pose.up).every(Number.isFinite)) {
      onCameraPoseChangeRef.current?.(autoFitScopeKeyRef.current, pose);
    }
  }, [height, width]);

  const fitGraph = useCallback((reason: 'initial' | 'explicit') => {
    const graph = graphRef.current;
    const camera = graph?.camera?.() as THREE.PerspectiveCamera | undefined;
    if (!graph || typeof graph.cameraPosition !== 'function' || !camera
      || !graphData.nodes.length || width <= 0 || height <= 0) return false;
    const canvas = graphHostRef.current?.querySelector('canvas');
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) return false;
    const pose = restoredCameraPoseRef.current;
    const restore = reason === 'initial' && pose && canRestoreActiveCameraPose(pose, width, height);
    programmaticCameraRef.current = true;
    let expectedPosition: THREE.Vector3;
    try {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (reason === 'initial' && pose) {
        camera.up.set(pose.up.x, pose.up.y, pose.up.z);
        graph.cameraPosition(pose.position, pose.target, 0);
      }
      if (restore) {
        expectedPosition = new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z);
      } else {
        const fitted = fitActiveAuthorityPerspectiveCamera(camera, graphData.nodes, width, height);
        if (!fitted) return false;
        expectedPosition = fitted.position;
        graph.cameraPosition(fitted.position, fitted.target, 0);
      }
    } finally { programmaticCameraRef.current = false; }
    if (camera.position.distanceTo(expectedPosition) > 0.1) return false;
    initialCameraReadyRef.current = true;
    if (reason === 'initial' && !autoFitConsumedRef.current) onAutoFitConsumedRef.current(autoFitScopeKeyRef.current);
    pendingExplicitFitRef.current = false;
    reportCameraPose();
    scheduleProjectionRef.current?.();
    return true;
  }, [graphData.nodes, height, reportCameraPose, width]);
  fitGraphRef.current = fitGraph;

  const settleAfterRender = useCallback(() => {
    const currentNodes = graphNodesRef.current;
    if (fittingGraphRef.current) return;
    if (settledGraphRef.current === currentNodes && initialCameraReadyRef.current
      && !pendingExplicitFitRef.current) return;
    fittingGraphRef.current = true;
    try {
      const reason = pendingExplicitFitRef.current ? 'explicit'
        : !initialCameraReadyRef.current ? 'initial' : null;
      if (reason && !fitGraphRef.current?.(reason)) return;
      const changed = settledGraphRef.current !== currentNodes;
      settledGraphRef.current = currentNodes;
      if (changed) onEngineSettledRef.current?.();
    } finally { fittingGraphRef.current = false; }
  }, []);
  settleAfterRenderRef.current = settleAfterRender;

  const handleEngineStop = useCallback(() => {
    settleAfterRenderRef.current?.();
    scheduleProjectionRef.current?.();
  }, []);

  useEffect(() => {
    if (width <= 0 || height <= 0 || graphNodesRef.current.length === 0) return undefined;
    initializationAttemptRef.current = 0;
    const initialize = () => {
      initializationFrameRef.current = null;
      settleAfterRenderRef.current?.();
      if (settledGraphRef.current === graphNodesRef.current && initialCameraReadyRef.current
        && !pendingExplicitFitRef.current) return;
      if (initializationAttemptRef.current < 120) {
        initializationAttemptRef.current += 1;
        initializationFrameRef.current = window.requestAnimationFrame(initialize);
        return;
      }
    };
    initializationFrameRef.current = window.requestAnimationFrame(initialize);
    return () => {
      if (initializationFrameRef.current !== null) window.cancelAnimationFrame(initializationFrameRef.current);
      initializationFrameRef.current = null;
    };
  }, [fitViewRequest.id, graphData.nodes, height, width]);

  const handleEngineTick = useCallback(() => {
    settleAfterRenderRef.current?.();
    scheduleProjectionRef.current?.();
  }, []);

  useEffect(() => {
    if (fitViewRequest.id === previousFitRequestRef.current) return;
    previousFitRequestRef.current = fitViewRequest.id;
    pendingExplicitFitRef.current = true;
    if (settledGraphRef.current === graphNodesRef.current) fitGraphRef.current?.('explicit');
  }, [fitViewRequest.id, graphData.nodes]);

  useEffect(() => {
    if (previousScopeKeyRef.current === autoFitScopeKey) return;
    previousScopeKeyRef.current = autoFitScopeKey;
    settledGraphRef.current = null;
    fittingGraphRef.current = false;
    initialCameraReadyRef.current = false;
    pendingExplicitFitRef.current = false;
  }, [autoFitScopeKey]);

  useEffect(() => {
    if (previousReheatRef.current === engineReheatRevision) return;
    previousReheatRef.current = engineReheatRevision;
    graphRef.current?.d3ReheatSimulation?.();
    scheduleProjection();
  }, [engineReheatRevision, scheduleProjection]);

  useEffect(() => {
    scheduleProjection();
  }, [labels, scheduleProjection]);

  useEffect(() => {
    const controls = graphRef.current?.controls?.() as ActiveControls | undefined;
    if (!controls?.addEventListener) return undefined;
    const handleChange = () => {
      if (initialCameraReadyRef.current && !programmaticCameraRef.current) {
        onCameraManipulationRef.current(autoFitScopeKeyRef.current);
        reportCameraPose();
      }
      scheduleProjection();
    };
    controls.addEventListener('change', handleChange);
    return () => controls.removeEventListener?.('change', handleChange);
  }, [autoFitScopeKey, onCameraManipulation, reportCameraPose, scheduleProjection]);

  useEffect(() => {
    const currentIds = new Set(graphData.nodes.map((node) => node.id));
    for (const [id, object] of nodeObjectCacheRef.current) {
      if (currentIds.has(id)) continue;
      disposeActiveObject3D(object);
      nodeObjectCacheRef.current.delete(id);
    }
  }, [graphData.nodes]);

  useEffect(() => {
    const generation = ++lifecycleGenerationRef.current;
    const labelLayer = labelLayerRef.current;
    const graph = graphRef.current;
    const lifecycleState = lifecycleGenerationRef;
    const nodeObjects = nodeObjectCacheRef.current;
    const linkObjects = linkObjectCacheRef.current;
    graph?.resumeAnimation?.();
    return () => {
      if (projectionFrameRef.current !== null) window.cancelAnimationFrame(projectionFrameRef.current);
      projectionFrameRef.current = null;
      if (initializationFrameRef.current !== null) window.cancelAnimationFrame(initializationFrameRef.current);
      initializationFrameRef.current = null;
      labelLayer?.cancel();
      graph?.pauseAnimation?.();
      queueMicrotask(() => {
        // React StrictMode cleanup is followed by an immediate setup probe.
        if (lifecycleState.current !== generation) return;
        for (const object of nodeObjects.values()) disposeActiveObject3D(object);
        nodeObjects.clear();
        for (const object of linkObjects.values()) disposeActiveObject3D(object);
        linkObjects.clear();
      });
    };
  }, [labelLayerRef]);

  useEffect(() => {
    for (const node of graphData.nodes) {
      const object = nodeObjectCacheRef.current.get(node.id);
      if (!object) continue;
      setNodeFocus(object, node, selectedNodeId, hoveredNodeId, focusedNodeIds);
    }
  }, [focusedNodeIds, graphData.nodes, hoveredNodeId, selectedNodeId]);

  const nodeObject = useCallback((node: ActiveAuthorityLayoutNode): THREE.Group => {
    // ForceGraph owns object reuse and clears custom groups when rebuilding.
    // Retain references for focus updates, never return a disposed old group.
    const created = createNodeObject(node);
    setNodeFocus(
      created,
      node,
      selectedNodeIdRef.current,
      hoveredNodeIdRef.current,
      focusedNodeIdsRef.current,
    );
    nodeObjectCacheRef.current.set(node.id, created);
    return created;
  }, []);
  const linkObject = useCallback((link: ActiveAuthorityLayoutLink) => {
    const style = activeRelationStyle(link);
    const opacity = activeLinkOpacity(link, selectedNodeIdRef.current, hoveredNodeIdRef.current);
    const material = style.dash
      ? new THREE.LineDashedMaterial({ color: style.color, transparent: true, opacity, dashSize: style.dash[0], gapSize: style.dash[1] })
      : new THREE.LineBasicMaterial({ color: style.color, transparent: true, opacity });
    material.depthWrite = false;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const object = new THREE.Line(geometry, material);
    linkObjectCacheRef.current.set(link.id, object);
    return object;
  }, []);
  const updateLinkPosition = useCallback((object: THREE.Object3D, coordinates: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } }) => {
    const line = object as THREE.Line;
    const attribute = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    const next = [coordinates.start.x, coordinates.start.y, coordinates.start.z, coordinates.end.x, coordinates.end.y, coordinates.end.z];
    if (next.some((value, index) => attribute.array[index] !== Math.fround(value))) {
      attribute.array.set(next);
      attribute.needsUpdate = true;
      line.geometry.computeBoundingSphere();
      if (line.material instanceof THREE.LineDashedMaterial) line.computeLineDistances();
    }
    return true;
  }, []);
  useEffect(() => {
    const visible = new Set(graphData.links.map((link) => link.id));
    for (const id of linkObjectCacheRef.current.keys()) if (!visible.has(id)) linkObjectCacheRef.current.delete(id);
    for (const link of graphData.links) {
      const material = linkObjectCacheRef.current.get(link.id)?.material as THREE.LineBasicMaterial | undefined;
      if (!material) continue;
      material.opacity = activeLinkOpacity(link, selectedNodeId, hoveredNodeId);
      material.color.set(activeRelationColor(link));
    }
  }, [graphData.links, hoveredNodeId, selectedNodeId]);
  const linkColor = useCallback((link: ActiveAuthorityLayoutLink) => {
    const color = activeRelationColor(link);
    return withAlpha(color, activeLinkOpacity(link, selectedNodeId, hoveredNodeId));
  }, [hoveredNodeId, selectedNodeId]);
  const linkWidth = useCallback((link: ActiveAuthorityLayoutLink) => (
    focusedLink(link, selectedNodeId, hoveredNodeId) ? 2.3 : 0.9
  ), [hoveredNodeId, selectedNodeId]);
  const arrowLength = useCallback((link: ActiveAuthorityLayoutLink) => (
    activeRelationIsDirected(link) ? (focusedLink(link, selectedNodeId, hoveredNodeId) ? 10 : 7) : 0
  ), [hoveredNodeId, selectedNodeId]);

  return (
    <div
      ref={graphHostRef}
      className="absolute inset-0"
      data-active-authority-graph-3d="true"
      data-active-authority-graph-kind={kind}
      data-active-authority-graph-identity={graphData.nodes.map((node) => node.id).join(',')}
      data-active-authority-graph-edge-identity={graphData.links.map((link) => `${link.id}:${link.sourceId}->${link.targetId}`).join('|')}
    >
      <ForceGraph3D
        ref={graphRef}
        width={width}
        height={height}
        graphData={graphData}
        nodeId="id"
        linkSource="sourceId"
        linkTarget="targetId"
        nodeRelSize={1}
        nodeVal={(node) => activeNodeRadius(node) ** 2}
        nodeThreeObject={nodeObject}
        nodeThreeObjectExtend={false}
        nodeLabel={(node) => selectedNodeId && !focusedNodeIds.has(node.id) ? '' : activeNodeAccessibleName(node)}
        linkThreeObject={linkObject as never}
        linkThreeObjectExtend={false}
        linkPositionUpdate={updateLinkPosition as never}
        linkColor={linkColor as never}
        linkWidth={linkWidth as never}
        linkDirectionalArrowLength={arrowLength as never}
        linkDirectionalArrowColor={linkColor as never}
        linkDirectionalArrowRelPos={1}
        backgroundColor="rgba(0,0,0,0)"
        showNavInfo={false}
        warmupTicks={0}
        cooldownTicks={2}
        cooldownTime={1}
        d3AlphaDecay={1}
        d3AlphaMin={1}
        d3VelocityDecay={1}
        onEngineStop={handleEngineStop}
        onEngineTick={handleEngineTick}
        onNodeClick={(node) => onNodeClick(node)}
        onBackgroundClick={onBackgroundClick}
        onNodeHover={(node) => onNodeHover(node)}
        onNodeDrag={() => scheduleProjection()}
        onNodeDragEnd={(node) => onNodeDragEnd(node)}
        enableNodeDrag
        enableNavigationControls
        enablePointerInteraction
      />
      <span className="sr-only" data-active-authority-renderer-engine="3d">
        {autoFitReady ? `${graphData.nodes.length} 个知识对象` : '等待图谱尺寸'}
      </span>
      <span className="sr-only" data-active-authority-renderer-camera-state={autoFitCameraManipulated ? 'manipulated' : 'auto'} />
    </div>
  );
}
