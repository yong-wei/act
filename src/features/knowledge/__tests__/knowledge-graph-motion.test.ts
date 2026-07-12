import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createKnowledgeGraphRevealPlan,
  getKnowledgeGraphPresentationLinkOpacity,
  getKnowledgeGraphPresentationLinkProgress,
  getKnowledgeGraphPresentationNodeOpacity,
  getKnowledgeGraphPresentationNodeScale,
  KnowledgeGraphTransitionGate,
} from '../graph/motion';

describe('knowledge graph bounded motion', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
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
