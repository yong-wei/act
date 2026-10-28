'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';

import { placeActiveAuthorityLabels } from './active-authority-label-geometry';
import type { ActiveAuthorityGraphProps } from './active-authority-renderer-types';
import {
  activeAuthorityCameraPoseFrom2DTransform,
  canRestoreActiveCameraPose,
  activeNodeAccessibleName,
  activeNodeColor,
  activeNodePointerRadius,
  activeNodeRadius,
  activeNodeShape,
  activeRelationColor,
  activeRelationStyle,
  activeNodeOpacity,
  activeFocusNodeIds,
  activeLinkOpacity,
  activeRelationIsDirected,
  isActiveRootNode,
  type ActiveAuthorityNodeShape,
} from './active-authority-visual';
import { drawActivePolygon } from './active-authority-visual';
import type { ActiveAuthorityLayoutLink, ActiveAuthorityLayoutNode } from './active-authority-geometry';
import { useActiveCanvasPalette, withAlpha, type ActiveCanvasPalette } from './active-authority-palette';
import type { ActiveNodeMasteryMark } from './active-authority-renderer-types';

type ActiveGraph2DMethods = ForceGraphMethods<ActiveAuthorityLayoutNode, ActiveAuthorityLayoutLink>;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

function strokeArc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  start: number,
  end: number,
  color: string,
  width: number,
): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, start, end);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function paintMasteryArc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  mark: ActiveNodeMasteryMark,
  palette: ActiveCanvasPalette,
  lineScale: number,
): void {
  const width = 3 / lineScale;
  strokeArc(ctx, x, y, radius, 0, Math.PI * 2, withAlpha(palette.borderStrong, 0.55), width);
  if (mark.score === null) return;
  const sweep = Math.max(0.04, Math.min(1, mark.score)) * Math.PI * 2;
  strokeArc(ctx, x, y, radius, -Math.PI / 2, -Math.PI / 2 + sweep, palette.mastery[mark.state], width * 1.2);
}

/** Instrument-style root bubble: halo, tinted glass body, offset highlight, rim light and dial ticks. */
function paintRootBubble(
  ctx: CanvasRenderingContext2D,
  node: ActiveAuthorityLayoutNode,
  radius: number,
  palette: ActiveCanvasPalette,
  options: { active: boolean; pulse: number; lineScale: number; mastery?: ActiveNodeMasteryMark },
): void {
  const { x, y } = node;
  const metadata = (node.metadata ?? {}) as { presentationKind?: unknown; rootEntryKind?: unknown; unavailable?: unknown };
  const unavailable = metadata.unavailable === true;
  const dark = palette.theme === 'dark';
  const tone = unavailable ? palette.fgMuted
    : options.mastery && options.mastery.state !== 'evidence-needed' ? palette.mastery[options.mastery.state]
      : metadata.presentationKind === 'aggregate' || metadata.rootEntryKind === 'aggregate' ? palette.rootAggregate : palette.rootDomain;
  const highlight = dark ? palette.fgPrimary : palette.surface;
  const haloRadius = radius * (1.26 + 0.05 * options.pulse);
  const halo = ctx.createRadialGradient(x, y, radius * 0.88, x, y, haloRadius);
  halo.addColorStop(0, withAlpha(tone, (options.active ? 0.32 : 0.14) + 0.14 * options.pulse));
  halo.addColorStop(1, withAlpha(tone, 0));
  ctx.beginPath();
  ctx.arc(x, y, haloRadius, 0, Math.PI * 2);
  ctx.fillStyle = halo;
  ctx.fill();

  const body = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.38, radius * 0.08, x, y, radius);
  body.addColorStop(0, withAlpha(tone, dark ? 0.36 : 0.22));
  body.addColorStop(0.62, withAlpha(tone, dark ? 0.16 : 0.09));
  body.addColorStop(1, withAlpha(tone, dark ? 0.3 : 0.18));
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(palette.canvas, dark ? 0.72 : 0.86);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.fill();

  const glossX = x - radius * 0.36;
  const glossY = y - radius * 0.44;
  const gloss = ctx.createRadialGradient(glossX, glossY, 0, glossX, glossY, radius * 0.62);
  gloss.addColorStop(0, withAlpha(highlight, dark ? 0.16 : 0.7));
  gloss.addColorStop(1, withAlpha(highlight, 0));
  ctx.fillStyle = gloss;
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  const ticks = 36;
  for (let index = 0; index < ticks; index += 1) {
    const angle = (index / ticks) * Math.PI * 2;
    const major = index % 3 === 0;
    const inner = radius - (major ? 7 : 4) / options.lineScale;
    const outer = radius - 1.5 / options.lineScale;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.strokeStyle = withAlpha(tone, major ? 0.42 : 0.2);
    ctx.lineWidth = 1 / options.lineScale;
    ctx.stroke();
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (unavailable) ctx.setLineDash([6 / options.lineScale, 5 / options.lineScale]);
  ctx.strokeStyle = withAlpha(tone, options.active ? 0.95 : 0.62);
  ctx.lineWidth = (options.active ? 2.2 : 1.4) / options.lineScale;
  ctx.stroke();
  ctx.setLineDash([]);
  strokeArc(
    ctx, x, y, radius - 3 / options.lineScale, Math.PI * 1.04, Math.PI * 1.46,
    withAlpha(highlight, dark ? 0.5 : 0.95), 2 / options.lineScale,
  );
  if (options.mastery) {
    paintMasteryArc(ctx, x, y, radius + 6 / options.lineScale, options.mastery, palette, options.lineScale);
  }
}

function focusedLink(link: ActiveAuthorityLayoutLink, selectedNodeId: string | null, hoveredNodeId: string | null): boolean {
  return link.sourceId === selectedNodeId || link.targetId === selectedNodeId
    || (!selectedNodeId && (link.sourceId === hoveredNodeId || link.targetId === hoveredNodeId));
}

function paintShape(
  ctx: CanvasRenderingContext2D,
  shape: ActiveAuthorityNodeShape,
  x: number,
  y: number,
  radius: number,
): void {
  drawActivePolygon(ctx, shape, x, y, radius);
}

/** Screen space kept clear of workspace chrome and below-node labels when fitting. */
const ACTIVE_FIT_SAFE_AREA = {
  root: { top: 48, bottom: 32 },
  domain: { top: 64, bottom: 124 },
} as const;

function fitBounds(nodes: readonly ActiveAuthorityLayoutNode[]): { centerX: number; centerY: number; width: number; height: number } | null {
  if (nodes.length === 0 || !nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))) return null;
  const minX = Math.min(...nodes.map((node) => node.x - activeNodeRadius(node)));
  const maxX = Math.max(...nodes.map((node) => node.x + activeNodeRadius(node)));
  const minY = Math.min(...nodes.map((node) => node.y - activeNodeRadius(node)));
  const maxY = Math.max(...nodes.map((node) => node.y + activeNodeRadius(node)));
  return { centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY };
}

export function ActiveAuthorityGraph2D({
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
  masteryByNodeId,
}: ActiveAuthorityGraphProps) {
  const palette = useActiveCanvasPalette();
  const reducedMotion = usePrefersReducedMotion();
  const graphHostRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<ActiveGraph2DMethods | undefined>(undefined);
  const projectionFrameRef = useRef<number | null>(null);
  const programmaticCameraRef = useRef(false);
  const pendingCameraNotificationRef = useRef<{ scopeKey: string; pose: ReturnType<typeof activeAuthorityCameraPoseFrom2DTransform> } | null>(null);
  const settledGraphRef = useRef<readonly ActiveAuthorityLayoutNode[] | null>(null);
  const fittingGraphRef = useRef(false);
  const initialCameraReadyRef = useRef(false);
  const pendingExplicitFitRef = useRef(false);
  const previousFitRequestRef = useRef(fitViewRequest.id);
  const previousScopeKeyRef = useRef(autoFitScopeKey);
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
  const fitCountRef = useRef(0);
  const focusedNodeIds = useMemo(() => activeFocusNodeIds(links, selectedNodeId), [links, selectedNodeId]);
  const graphData = useMemo(() => ({
    nodes: [...nodes],
    links: links.map((link) => ({ ...link })),
  }), [links, nodes]);
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
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) continue;
      const point = graph.graph2ScreenCoords(node.x, node.y);
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      points.set(node.id, { x: point.x, y: point.y, scale: graph.zoom?.() ?? 1 });
    }
    const placements = placeActiveAuthorityLabels({
      descriptors: labels,
      points,
      width,
      height,
      selectedNodeId,
      hoveredNodeId,
    });
    labelLayerRef.current?.sync(placements);
  }, [graphData.nodes, height, hoveredNodeId, labelLayerRef, labels, selectedNodeId, width]);

  const scheduleProjection = useCallback(() => {
    if (projectionFrameRef.current !== null) return;
    projectionFrameRef.current = window.requestAnimationFrame(() => {
      projectionFrameRef.current = null;
      projectLabels();
    });
  }, [projectLabels]);
  scheduleProjectionRef.current = scheduleProjection;

  const flushCameraPose = useCallback((transform: { k: number; x: number; y: number }) => {
    onCameraPoseChangeRef.current?.(
      autoFitScopeKeyRef.current,
      activeAuthorityCameraPoseFrom2DTransform(transform, width, height),
    );
  }, [height, width]);

  const fitGraph = useCallback((reason: 'initial' | 'explicit') => {
    const graph = graphRef.current;
    if (!graph || typeof graph.centerAt !== 'function' || typeof graph.zoom !== 'function'
      || !graphData.nodes.length || width <= 0 || height <= 0) return false;
    const canvas = graphHostRef.current?.querySelector('canvas');
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) return false;
    const bounds = fitBounds(graphData.nodes);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return false;
    const padding = Math.min(80, Math.max(32, Math.min(width, height) * 0.12));
    const insets = ACTIVE_FIT_SAFE_AREA[kind];
    const usableHeight = Math.max(height * 0.4, height - insets.top - insets.bottom);
    const pose = restoredCameraPoseRef.current;
    const restore = reason === 'initial' && pose && canRestoreActiveCameraPose(pose, width, height);
    const zoom = restore && pose.position.z > 0 ? 1 / pose.position.z
      : Math.max(0.03, Math.min(8, (width - padding * 2) / bounds.width, (usableHeight - padding) / bounds.height));
    const centerX = restore ? pose.target.x : bounds.centerX;
    const centerY = restore ? pose.target.y : bounds.centerY + (insets.bottom - insets.top) / 2 / zoom;
    programmaticCameraRef.current = true;
    try {
      graph.zoom(zoom, 0);
      graph.centerAt(centerX, centerY, 0);
    } finally { programmaticCameraRef.current = false; }
    const actualZoom = graph.zoom();
    const screenCenter = graph.graph2ScreenCoords(centerX, centerY);
    if (!Number.isFinite(actualZoom) || Math.abs(actualZoom - zoom) > 0.0001
      || Math.abs(screenCenter.x - width / 2) > 1 || Math.abs(screenCenter.y - height / 2) > 1) return false;
    initialCameraReadyRef.current = true;
    if (reason === 'initial' && !autoFitConsumedRef.current) onAutoFitConsumedRef.current(autoFitScopeKeyRef.current);
    pendingExplicitFitRef.current = false;
    flushCameraPose({ k: actualZoom, x: centerX, y: centerY });
    fitCountRef.current += 1;
    graphHostRef.current?.setAttribute('data-active-authority-fit-count', String(fitCountRef.current));
    graphHostRef.current?.setAttribute('data-active-authority-fit-reason', reason);
    graphHostRef.current?.setAttribute('data-active-authority-fit-requested-zoom', String(zoom));
    graphHostRef.current?.setAttribute('data-active-authority-fit-zoom', String(actualZoom));
    scheduleProjectionRef.current?.();
    return true;
  }, [flushCameraPose, graphData.nodes, height, kind, width]);
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
  const handleRenderFramePost = useCallback(() => {
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
    scheduleProjection();
  }, [labels, scheduleProjection]);

  useEffect(() => {
    const generation = ++lifecycleGenerationRef.current;
    const labelLayer = labelLayerRef.current;
    const graph = graphRef.current;
    const lifecycleState = lifecycleGenerationRef;
    graph?.resumeAnimation?.();
    return () => {
      if (projectionFrameRef.current !== null) window.cancelAnimationFrame(projectionFrameRef.current);
      projectionFrameRef.current = null;
      if (initializationFrameRef.current !== null) window.cancelAnimationFrame(initializationFrameRef.current);
      initializationFrameRef.current = null;
      labelLayer?.cancel();
      pendingCameraNotificationRef.current = null;
      graph?.pauseAnimation?.();
      queueMicrotask(() => {
        // React StrictMode performs a setup/cleanup/setup probe. The next
        // setup advances the generation before this microtask runs.
        if (lifecycleState.current !== generation) return;
      });
    };
  }, [labelLayerRef]);

  const paintNode = useCallback((node: ActiveAuthorityLayoutNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const radius = activeNodeRadius(node);
    const focused = node.id === selectedNodeId || (!selectedNodeId && node.id === hoveredNodeId);
    const lineScale = Math.max(0.2, globalScale);
    const mastery = masteryByNodeId?.get(node.id);
    ctx.save();
    if (isActiveRootNode(node)) {
      const pulse = focused && !reducedMotion ? (Math.sin(performance.now() / 650) + 1) / 2 : 0;
      paintRootBubble(ctx, node, radius, palette, { active: focused, pulse, lineScale, mastery });
      ctx.restore();
      return;
    }
    const tone = activeNodeColor(node, palette);
    ctx.globalAlpha = activeNodeOpacity(node.id, selectedNodeId, hoveredNodeId, focusedNodeIds);
    if (focused) {
      const glow = ctx.createRadialGradient(node.x, node.y, radius * 0.6, node.x, node.y, radius * 2.1);
      glow.addColorStop(0, withAlpha(tone, 0.42));
      glow.addColorStop(1, withAlpha(tone, 0));
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius * 2.1, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    }
    ctx.beginPath();
    paintShape(ctx, activeNodeShape(node), node.x, node.y, radius);
    ctx.fillStyle = tone;
    ctx.fill();
    ctx.strokeStyle = focused ? palette.focus : withAlpha(palette.theme === 'dark' ? palette.canvas : palette.surface, 0.9);
    ctx.lineWidth = (focused ? 2.4 : 1.4) / lineScale;
    ctx.stroke();
    const glossX = node.x - radius * 0.32;
    const glossY = node.y - radius * 0.36;
    const gloss = ctx.createRadialGradient(glossX, glossY, 0, glossX, glossY, radius * 0.7);
    gloss.addColorStop(0, withAlpha(palette.theme === 'dark' ? palette.fgPrimary : palette.surface, 0.38));
    gloss.addColorStop(1, withAlpha(palette.theme === 'dark' ? palette.fgPrimary : palette.surface, 0));
    ctx.fillStyle = gloss;
    ctx.fill();
    if (node.id === selectedNodeId) {
      strokeArc(ctx, node.x, node.y, radius + 4.5 / lineScale, 0, Math.PI * 2, withAlpha(palette.focus, 0.85), 1.6 / lineScale);
    }
    if (mastery) paintMasteryArc(ctx, node.x, node.y, radius + (node.id === selectedNodeId ? 8 : 3.5) / lineScale, mastery, palette, lineScale);
    const decoration = (node.metadata ?? {}) as { decoration?: { visualFamilies?: readonly string[]; hasCardStar?: boolean } };
    const families = decoration.decoration?.visualFamilies ?? [];
    families.slice(0, 3).forEach((_, index) => {
      ctx.beginPath();
      ctx.fillStyle = index === 0 ? palette.tone.amber : palette.fgSecondary;
      const angle = -Math.PI / 2 + index * 1.9;
      ctx.arc(node.x + Math.cos(angle) * radius * 0.52, node.y + Math.sin(angle) * radius * 0.52, Math.max(2 / lineScale, radius * 0.12), 0, Math.PI * 2);
      ctx.fill();
    });
    if (decoration.decoration?.hasCardStar) {
      ctx.fillStyle = palette.tone.amber;
      ctx.fillRect(node.x + radius * 0.46, node.y - radius * 0.9, Math.max(2 / lineScale, radius * 0.22), Math.max(2 / lineScale, radius * 0.22));
    }
    ctx.restore();
  }, [focusedNodeIds, hoveredNodeId, masteryByNodeId, palette, reducedMotion, selectedNodeId]);

  const paintPointer = useCallback((node: ActiveAuthorityLayoutNode, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(node.x, node.y, activeNodePointerRadius(node, globalScale), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, []);

  const linkColor = useCallback((link: ActiveAuthorityLayoutLink) => {
    const color = activeRelationColor(link, palette);
    return withAlpha(color, activeLinkOpacity(link, selectedNodeId, hoveredNodeId));
  }, [hoveredNodeId, palette, selectedNodeId]);
  const breathing = kind === 'root' && Boolean(hoveredNodeId ?? selectedNodeId) && !reducedMotion;
  const linkWidth = useCallback((link: ActiveAuthorityLayoutLink) => (
    focusedLink(link, selectedNodeId, hoveredNodeId) ? 2.4 : 0.9
  ), [hoveredNodeId, selectedNodeId]);
  const arrowLength = useCallback((link: ActiveAuthorityLayoutLink) => (
    activeRelationIsDirected(link) ? (focusedLink(link, selectedNodeId, hoveredNodeId) ? 9 : 6) : 0
  ), [hoveredNodeId, selectedNodeId]);

  const handleZoom = useCallback((transform: { k: number; x: number; y: number }) => {
    if (initialCameraReadyRef.current && !programmaticCameraRef.current) {
      // react-kapsule may synchronously emit onZoom while applying size props
      // in ForceGraph2D's render. Notify React owners only after that stack ends.
      const queued = pendingCameraNotificationRef.current !== null;
      pendingCameraNotificationRef.current = {
        scopeKey: autoFitScopeKeyRef.current,
        pose: activeAuthorityCameraPoseFrom2DTransform(transform, width, height),
      };
      if (!queued) queueMicrotask(() => {
        const notification = pendingCameraNotificationRef.current;
        pendingCameraNotificationRef.current = null;
        if (!notification) return;
        onCameraManipulationRef.current(notification.scopeKey);
        onCameraPoseChangeRef.current?.(notification.scopeKey, notification.pose);
      });
    }
    scheduleProjectionRef.current?.();
  }, [height, width]);

  return (
    <div
      ref={graphHostRef}
      className="absolute inset-0"
      data-active-authority-graph-2d="true"
      data-active-authority-graph-kind={kind}
      data-active-authority-graph-identity={graphData.nodes.map((node) => node.id).join(',')}
      data-active-authority-graph-edge-identity={graphData.links.map((link) => `${link.id}:${link.sourceId}->${link.targetId}`).join('|')}
    >
      <ForceGraph2D
        ref={graphRef}
        width={width}
        height={height}
        graphData={graphData}
        nodeId="id"
        linkSource="sourceId"
        linkTarget="targetId"
        nodeRelSize={1}
        nodeVal={(node) => activeNodeRadius(node) ** 2}
        nodeCanvasObjectMode={() => 'replace'}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={paintPointer}
        nodeLabel={(node) => selectedNodeId && !focusedNodeIds.has(node.id) ? '' : activeNodeAccessibleName(node)}
        linkLineDash={(link) => { const dash = activeRelationStyle(link).dash; return dash ? [...dash] : null; }}
        linkColor={linkColor as never}
        linkWidth={linkWidth as never}
        linkDirectionalArrowLength={arrowLength as never}
        linkDirectionalArrowColor={linkColor as never}
        linkDirectionalArrowRelPos={1}
        backgroundColor="rgba(0,0,0,0)"
        autoPauseRedraw={!breathing}
        minZoom={0.03}
        maxZoom={8}
        warmupTicks={0}
        cooldownTicks={2}
        cooldownTime={1}
        d3AlphaDecay={1}
        d3AlphaMin={1}
        d3VelocityDecay={1}
        onEngineStop={handleEngineStop}
        onEngineTick={handleEngineTick}
        onRenderFramePost={handleRenderFramePost}
        onZoom={handleZoom}
        onZoomEnd={handleZoom}
        onNodeClick={(node) => onNodeClick(node)}
        onBackgroundClick={onBackgroundClick}
        onNodeHover={(node) => onNodeHover(node)}
        onNodeDrag={() => scheduleProjection()}
        onNodeDragEnd={(node) => onNodeDragEnd(node)}
        enableNodeDrag
        enableZoomInteraction
        enablePanInteraction
      />
      <span className="sr-only" data-active-authority-renderer-engine="2d">
        {autoFitReady ? `${graphData.nodes.length} 个知识对象` : '等待图谱尺寸'}
      </span>
      <span className="sr-only" data-active-authority-renderer-camera-state={autoFitCameraManipulated ? 'manipulated' : 'auto'} />
    </div>
  );
}
