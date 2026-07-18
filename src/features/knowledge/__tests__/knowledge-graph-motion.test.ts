import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createKnowledgeGraphMotionScopeKey,
  bindKnowledgeGraphMotionEnvironment,
  getKnowledgeGraphMotionMarkerPlacement,
  createKnowledgeGraphRevealPlan,
  getKnowledgeGraphMotionMarkerFrame,
  getKnowledgeGraphMotionMarkerPose,
  getKnowledgeGraphPresentationLinkOpacity,
  getKnowledgeGraphPresentationLinkProgress,
  getKnowledgeGraphPresentationNodeOpacity,
  getKnowledgeGraphPresentationNodeScale,
  KNOWLEDGE_GRAPH_CORRIDOR_MOTION,
  KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY,
  KnowledgeGraphMotionFrameLoop,
  KnowledgeGraphTransitionGate,
  prefersReducedKnowledgeGraphMotion,
  selectKnowledgeGraphMotionMarkerEdgeIds,
} from '../graph/motion';
import { createKnowledgeGraphEdgePath } from '../graph/edge-geometry';

describe('knowledge graph bounded motion', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('treats an absent matchMedia API as no reduced-motion preference', () => {
    vi.stubGlobal('window', {});
    expect(prefersReducedKnowledgeGraphMotion()).toBe(false);
    vi.unstubAllGlobals();
  });
  it('caps individual stagger at 24 and batches the remainder within 360ms', () => {
    const plan = createKnowledgeGraphRevealPlan({
      graphVersion: 'v1',
      targetNodeId: 'center',
      generation: 3,
      nodeIds: Array.from({ length: 30 }, (_, index) => `n-${index}`),
      reducedMotion: false,
    });

    expect(plan.key).toBe('v1:center:3');
    expect(plan.focusDurationMs).toBeGreaterThanOrEqual(140);
    expect(plan.focusDurationMs).toBeLessThanOrEqual(180);
    expect(plan.relationDurationMs).toBeGreaterThanOrEqual(180);
    expect(plan.relationDurationMs).toBeLessThanOrEqual(240);
    expect(plan.cameraDurationMs).toBeGreaterThanOrEqual(220);
    expect(plan.cameraDurationMs).toBeLessThanOrEqual(280);
    expect(plan.nodes.filter((node) => node.batch === 'individual')).toHaveLength(24);
    expect(new Set(plan.nodes.slice(24).map((node) => node.delayMs))).toHaveLength(1);
    expect(Math.max(...plan.nodes.map((node) => node.delayMs + node.durationMs))).toBeLessThanOrEqual(360);
  });

  it('uses immediate final states and disables spatial effects for reduced motion', () => {
    const plan = createKnowledgeGraphRevealPlan({
      graphVersion: 'v1', targetNodeId: 'center', generation: 1,
      nodeIds: ['a', 'b'], reducedMotion: true,
    });
    expect(plan.focusDurationMs).toBe(0);
    expect(plan.relationDurationMs).toBe(0);
    expect(plan.cameraDurationMs).toBe(0);
    expect(plan.nodes.every((node) => node.delayMs === 0 && node.durationMs === 0)).toBe(true);
    expect(plan.animateParticles).toBe(false);
  });

  it('cancels stale callbacks when a newer keyed transition begins', () => {
    const gate = new KnowledgeGraphTransitionGate();
    const stale = vi.fn();
    const current = vi.fn();
    gate.schedule('v1:a:1', stale, 1);
    gate.schedule('v1:b:2', current, 1);
    vi.runAllTimers();
    expect(stale).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledOnce();
    gate.dispose();
  });

  it('exposes bounded focus, reveal, and collapse opacity states', () => {
    expect(getKnowledgeGraphPresentationNodeOpacity({
      phase: 'revealing',
      targetNodeId: 'center',
      nodeId: 'child',
      directNodeIds: ['child'],
      revealedNodeIds: [],
    })).toBeLessThan(1);
    expect(getKnowledgeGraphPresentationNodeOpacity({
      phase: 'revealing',
      targetNodeId: 'center',
      nodeId: 'other',
      directNodeIds: ['child'],
      revealedNodeIds: [],
    })).toBeLessThan(1);
    expect(getKnowledgeGraphPresentationNodeOpacity({
      phase: 'collapsing',
      targetNodeId: 'center',
      nodeId: 'child',
      directNodeIds: ['child'],
      revealedNodeIds: ['child'],
    })).toBeLessThan(1);
    expect(getKnowledgeGraphPresentationLinkOpacity({
      phase: 'collapsing',
      targetNodeId: 'center',
      sourceId: 'center',
      targetId: 'child',
      revealedRelationIds: [],
    })).toBeLessThan(1);
  });

  it('interpolates production presentation opacity inside the bounded transition window', () => {
    const midNodeOpacity = getKnowledgeGraphPresentationNodeOpacity({
      phase: 'revealing',
      targetNodeId: 'center',
      nodeId: 'child',
      directNodeIds: ['child'],
      revealedNodeIds: [],
      elapsedMs: 90,
      nodeTimings: { child: { delayMs: 0, durationMs: 180 } },
    });
    const midLinkOpacity = getKnowledgeGraphPresentationLinkOpacity({
      phase: 'revealing',
      targetNodeId: 'center',
      sourceId: 'center',
      targetId: 'child',
      revealedRelationIds: [],
      elapsedMs: 110,
      relationDurationMs: 220,
    });
    const midCollapseOpacity = getKnowledgeGraphPresentationNodeOpacity({
      phase: 'collapsing',
      targetNodeId: 'center',
      nodeId: 'child',
      directNodeIds: ['child'],
      revealedNodeIds: ['child'],
      elapsedMs: 80,
      collapseDurationMs: 160,
    });

    expect(midNodeOpacity).toBeGreaterThan(0.12);
    expect(midNodeOpacity).toBeLessThan(1);
    expect(midLinkOpacity).toBeGreaterThan(0.08);
    expect(midLinkOpacity).toBeLessThan(1);
    expect(midCollapseOpacity).toBeGreaterThan(0.12);
    expect(midCollapseOpacity).toBeLessThan(1);
  });

  it('animates only newly materialized nodes and grows their relations over time', () => {
    const state = {
      phase: 'revealing' as const,
      targetNodeId: 'center',
      directNodeIds: ['new-child', 'existing-child'],
      animatedNodeIds: ['new-child'],
      revealedNodeIds: [],
      animatedRelationIds: ['center:new-child'],
      revealedRelationIds: [],
      elapsedMs: 90,
      relationDurationMs: 220,
      nodeTimings: { 'new-child': { delayMs: 0, durationMs: 180 } },
    };

    expect(getKnowledgeGraphPresentationNodeScale({ ...state, nodeId: 'new-child' })).toBeGreaterThan(0.88);
    expect(getKnowledgeGraphPresentationNodeScale({ ...state, nodeId: 'new-child' })).toBeLessThan(1);
    expect(getKnowledgeGraphPresentationNodeScale({ ...state, nodeId: 'existing-child' })).toBe(1);
    expect(getKnowledgeGraphPresentationLinkProgress({
      ...state,
      sourceId: 'center',
      targetId: 'new-child',
    })).toBeGreaterThan(0);
    expect(getKnowledgeGraphPresentationLinkProgress({
      ...state,
      sourceId: 'center',
      targetId: 'existing-child',
    })).toBe(1);
  });
});

describe('selected corridor directional motion', () => {
  it('consumes only eligible non-SCC edges in stable priority order and caps markers at three', () => {
    expect(selectKnowledgeGraphMotionMarkerEdgeIds({
      active: true,
      motionEligibleEdgeIds: ['edge-d', 'edge-b', 'edge-a', 'edge-c', 'edge-a'],
      motionSuppressedEdgeIds: ['edge-b'],
      visibleEdgeIds: ['edge-a', 'edge-b', 'edge-c', 'edge-x'],
    })).toEqual(['edge-a', 'edge-c']);
    expect(selectKnowledgeGraphMotionMarkerEdgeIds({
      active: false,
      motionEligibleEdgeIds: ['edge-a'],
      motionSuppressedEdgeIds: [],
    })).toEqual([]);
    expect(KNOWLEDGE_GRAPH_CORRIDOR_MOTION.maxMarkers).toBe(3);
  });

  it('starts at the source boundary, follows straight and curved tangents, and vanishes at target boundary', () => {
    const line = createKnowledgeGraphEdgePath({
      source: { x: 0, y: 0 }, target: { x: 100, y: 0 },
      sourceBoundary: { shape: 'circle', presentationRadius: 10 },
      targetBoundary: { shape: 'circle', presentationRadius: 10 },
    });
    const curve = createKnowledgeGraphEdgePath({
      source: { x: 0, y: 0 }, target: { x: 100, y: 0 },
      sourceBoundary: { shape: 'circle', presentationRadius: 10 },
      targetBoundary: { shape: 'circle', presentationRadius: 10 },
      sourceKey: 'a', targetKey: 'b', laneCurvature: 0.2,
    });
    const start = getKnowledgeGraphMotionMarkerFrame(0);
    const linePose = getKnowledgeGraphMotionMarkerPose(line, start.progress);
    const curvePose = getKnowledgeGraphMotionMarkerPose(curve, 0.5);
    expect(start).toEqual({ visible: true, progress: 0 });
    expect(linePose.point).toEqual(line.start);
    expect(linePose.tangent).toEqual({ x: 1, y: 0, z: 0 });
    expect(curvePose.point.y).not.toBe(0);
    expect(Math.hypot(curvePose.tangent.x, curvePose.tangent.y, curvePose.tangent.z)).toBeCloseTo(1);

    const terminal = getKnowledgeGraphMotionMarkerFrame(KNOWLEDGE_GRAPH_CORRIDOR_MOTION.travelDurationMs);
    expect(terminal).toEqual({ visible: false, progress: 1 });
    expect(getKnowledgeGraphMotionMarkerPose(curve, terminal.progress).point).toEqual(curve.end);
    expect(getKnowledgeGraphMotionMarkerFrame(
      KNOWLEDGE_GRAPH_CORRIDOR_MOTION.travelDurationMs + KNOWLEDGE_GRAPH_CORRIDOR_MOTION.pauseDurationMs,
    )).toEqual({ visible: true, progress: 0 });
  });

  it.each(['line', 'curve'] as const)('keeps the complete marker footprint inside %s boundaries on every visible frame', (kind) => {
    const path = createKnowledgeGraphEdgePath({
      source: { x: 0, y: 0 }, target: { x: 100, y: 24 },
      sourceBoundary: { shape: 'circle', presentationRadius: 10 },
      targetBoundary: { shape: 'circle', presentationRadius: 12 },
      laneCurvature: kind === 'curve' ? 0.25 : 0,
    });
    for (let elapsedMs = 0; elapsedMs < KNOWLEDGE_GRAPH_CORRIDOR_MOTION.travelDurationMs; elapsedMs += 16) {
      const frame = getKnowledgeGraphMotionMarkerFrame(elapsedMs);
      const placement = getKnowledgeGraphMotionMarkerPlacement(path, frame.progress);
      expect(placement.visible).toBe(true);
      expect(placement.centerDistance - KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY.backExtent).toBeGreaterThanOrEqual(-1e-8);
      expect(placement.centerDistance + KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY.frontExtent).toBeLessThanOrEqual(placement.pathLength + 1e-8);
      const normal = { x: -placement.tangent.y, y: placement.tangent.x };
      const vertices = [
        {
          x: placement.point.x + placement.tangent.x * KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY.frontExtent,
          y: placement.point.y + placement.tangent.y * KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY.frontExtent,
        },
        ...[-1, 1].map((side) => ({
          x: placement.point.x - placement.tangent.x * KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY.backExtent
            + normal.x * KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY.halfWidth * side,
          y: placement.point.y - placement.tangent.y * KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY.backExtent
            + normal.y * KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY.halfWidth * side,
        })),
      ];
      vertices.forEach((vertex) => {
        const longitudinalExtent = (vertex.x - placement.point.x) * placement.tangent.x
          + (vertex.y - placement.point.y) * placement.tangent.y;
        expect(placement.centerDistance + longitudinalExtent).toBeGreaterThanOrEqual(-1e-8);
        expect(placement.centerDistance + longitudinalExtent).toBeLessThanOrEqual(placement.pathLength + 1e-8);
      });
    }
  });

  it('hides a marker when the edge path is shorter than its complete footprint', () => {
    const path = createKnowledgeGraphEdgePath({
      source: { x: 0, y: 0 }, target: { x: 25, y: 0 },
      sourceBoundary: { shape: 'circle', presentationRadius: 10 },
      targetBoundary: { shape: 'circle', presentationRadius: 10 },
    });
    expect(getKnowledgeGraphMotionMarkerPlacement(path, 0.5).visible).toBe(false);
  });

  it('uses an equivalent dimension-neutral frame contract for 2D and 3D paths', () => {
    const twoDimensional = createKnowledgeGraphEdgePath({
      source: { x: 0, y: 0 }, target: { x: 100, y: 40 },
      sourceBoundary: { shape: 'circle', presentationRadius: 8 },
      targetBoundary: { shape: 'circle', presentationRadius: 8 },
      laneCurvature: -0.18,
    });
    const threeDimensional = createKnowledgeGraphEdgePath({
      source: { x: 0, y: 0, z: 0 }, target: { x: 100, y: 40, z: 30 },
      sourceBoundary: { shape: 'sphere', presentationRadius: 8 },
      targetBoundary: { shape: 'sphere', presentationRadius: 8 },
      laneCurvature: -0.18,
    });
    const frame = getKnowledgeGraphMotionMarkerFrame(640);
    const pose2d = getKnowledgeGraphMotionMarkerPose(twoDimensional, frame.progress);
    const pose3d = getKnowledgeGraphMotionMarkerPose(threeDimensional, frame.progress);
    expect(frame.visible).toBe(true);
    expect(pose2d.point.z).toBe(0);
    expect(pose3d.point.z).not.toBe(0);
    expect(Math.hypot(pose2d.tangent.x, pose2d.tangent.y, pose2d.tangent.z)).toBeCloseTo(1);
    expect(Math.hypot(pose3d.tangent.x, pose3d.tangent.y, pose3d.tangent.z)).toBeCloseTo(1);
  });

  it('resets the frame origin for selection, filter, or domain scope changes and releases RAF resources', () => {
    let nextFrameId = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    const cancelled: number[] = [];
    const loop = new KnowledgeGraphMotionFrameLoop({
      now: () => 100,
      requestFrame: (callback) => {
        const id = ++nextFrameId;
        callbacks.set(id, callback);
        return id;
      },
      cancelFrame: (id) => {
        cancelled.push(id);
        callbacks.delete(id);
      },
    });
    const firstFrames: number[] = [];
    const secondFrames: number[] = [];
    const firstKey = createKnowledgeGraphMotionScopeKey({
      graphVersion: 'v1', selectedNodeId: 'selected-a',
      visibleNodeIds: ['a', 'b'], motionEligibleEdgeIds: ['edge-a'],
    });
    const secondKey = createKnowledgeGraphMotionScopeKey({
      graphVersion: 'v1', selectedNodeId: 'selected-a',
      visibleNodeIds: ['a', 'c'], motionEligibleEdgeIds: ['edge-a'],
    });

    loop.start(firstKey, (elapsedMs) => firstFrames.push(elapsedMs));
    expect(firstFrames).toEqual([0]);
    expect(callbacks.size).toBe(1);
    loop.start(secondKey, (elapsedMs) => secondFrames.push(elapsedMs));
    expect(secondFrames).toEqual([0]);
    expect(cancelled).toHaveLength(1);
    expect(callbacks.size).toBe(1);
    loop.stop();
    expect(callbacks.size).toBe(0);
    expect(loop.isRunning()).toBe(false);
    expect(loop.pendingFrameCount()).toBe(0);
  });

  it('cancels immediately while hidden or reduced and restarts from the source with listener cleanup', () => {
    const listeners = new Map<string, EventListener>();
    const mediaListeners = new Set<() => void>();
    const documentTarget = {
      hidden: false,
      addEventListener: vi.fn((name: string, listener: EventListener) => listeners.set(name, listener)),
      removeEventListener: vi.fn((name: string) => listeners.delete(name)),
    };
    const mediaQuery = {
      matches: false,
      addEventListener: vi.fn((_name: string, listener: () => void) => mediaListeners.add(listener)),
      removeEventListener: vi.fn((_name: string, listener: () => void) => mediaListeners.delete(listener)),
    };
    const suspend = vi.fn();
    const resume = vi.fn();
    const cleanup = bindKnowledgeGraphMotionEnvironment({ documentTarget, mediaQuery, suspend, resume });
    expect(resume).toHaveBeenLastCalledWith();

    documentTarget.hidden = true;
    listeners.get('visibilitychange')?.(new Event('visibilitychange'));
    expect(suspend).toHaveBeenCalledOnce();
    documentTarget.hidden = false;
    listeners.get('visibilitychange')?.(new Event('visibilitychange'));
    expect(resume).toHaveBeenCalledTimes(2);
    mediaQuery.matches = true;
    mediaListeners.forEach((listener) => listener());
    expect(suspend).toHaveBeenCalledTimes(2);
    mediaQuery.matches = false;
    mediaListeners.forEach((listener) => listener());
    expect(resume).toHaveBeenCalledTimes(3);

    cleanup();
    expect(listeners.size).toBe(0);
    expect(mediaListeners.size).toBe(0);
  });

  it('keeps bounded-corridor frame calculation below the motion budget', () => {
    const eligible = Array.from({ length: 96 }, (_, index) => `edge-${String(index).padStart(3, '0')}`);
    const startedAt = performance.now();
    for (let index = 0; index < 10_000; index += 1) {
      selectKnowledgeGraphMotionMarkerEdgeIds({
        active: true,
        motionEligibleEdgeIds: eligible,
        motionSuppressedEdgeIds: [],
      }).forEach(() => getKnowledgeGraphMotionMarkerFrame(index));
    }
    expect(performance.now() - startedAt).toBeLessThan(1_000);
  });
});
