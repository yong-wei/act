import { describe, expect, it } from 'vitest';

import {
  createKnowledgeInspectionState,
  knowledgeInspectionReducer,
} from '@/features/knowledge/graph/inspection-state';
import {
  isKnowledgeCanvasPolylineHit,
  finishKnowledgeCanvasBlankGesture,
  moveKnowledgeCanvasBlankGesture,
  shouldDismissKnowledgeCanvasBlankGesture,
  startKnowledgeCanvasBlankGesture,
} from '@/features/knowledge/graph/canvas-dismissal';

const node = (id: string) => ({ id, name: id });

describe('knowledge inspection state', () => {
  it('keeps selected node and inspector visibility independent across close and reopen', () => {
    const selected = knowledgeInspectionReducer(createKnowledgeInspectionState(), {
      type: 'inspect-node',
      node: node('a-1'),
    });
    const closed = knowledgeInspectionReducer(selected, { type: 'close-inspector' });
    const reopened = knowledgeInspectionReducer(closed, { type: 'inspect-node', node: node('a-1') });

    expect(closed).toMatchObject({ selectedNode: node('a-1'), isPanelOpen: false });
    expect(reopened).toMatchObject({ selectedNode: node('a-1'), isPanelOpen: true });
  });

  it('dismisses selection without changing an independently requested focus', () => {
    const selected = knowledgeInspectionReducer(createKnowledgeInspectionState(), {
      type: 'inspect-node',
      node: node('a-1'),
    });
    const focused = knowledgeInspectionReducer(selected, {
      type: 'toggle-explicit-focus',
      nodeId: 'a-1',
    });
    const dismissed = knowledgeInspectionReducer(focused, { type: 'dismiss-selection' });

    expect(dismissed).toEqual(expect.objectContaining({
      selectedNode: null,
      isPanelOpen: false,
      explicitFocusNodeId: 'a-1',
    }));
  });

  it('clears hidden inspection and explicit focus on manual domain navigation and root return', () => {
    const selected = knowledgeInspectionReducer(createKnowledgeInspectionState(), {
      type: 'inspect-node',
      node: node('a-1'),
    });
    const focused = knowledgeInspectionReducer(selected, {
      type: 'toggle-explicit-focus',
      nodeId: 'a-1',
    });
    const switching = knowledgeInspectionReducer(focused, {
      type: 'begin-navigation',
      intentId: 3,
    });

    expect(switching).toEqual(createKnowledgeInspectionState());
    expect(knowledgeInspectionReducer(focused, { type: 'return-root' })).toEqual(
      createKnowledgeInspectionState()
    );
  });

  it('retains an explicit cross-domain target through loading or failure and rejects stale replacement', () => {
    const pending = knowledgeInspectionReducer(createKnowledgeInspectionState(), {
      type: 'begin-navigation',
      intentId: 7,
      targetNodeId: 'b-1',
    });
    const stale = knowledgeInspectionReducer(pending, {
      type: 'commit-navigation-target',
      intentId: 6,
      nodeId: 'a-1',
      node: node('a-1'),
    });
    const committed = knowledgeInspectionReducer(stale, {
      type: 'commit-navigation-target',
      intentId: 7,
      nodeId: 'b-1',
      node: node('b-1'),
    });

    expect(stale).toBe(pending);
    expect(pending.pendingNavigationTarget).toEqual({ intentId: 7, nodeId: 'b-1' });
    expect(committed).toMatchObject({
      selectedNode: node('b-1'),
      isPanelOpen: true,
      pendingNavigationTarget: null,
    });
  });
});

describe('knowledge canvas blank gesture', () => {
  it('accepts a stationary pointer gesture as a blank-canvas dismissal', () => {
    const started = startKnowledgeCanvasBlankGesture({ pointerId: 1, clientX: 20, clientY: 30 });
    const settled = moveKnowledgeCanvasBlankGesture(started, {
      pointerId: 1,
      clientX: 22,
      clientY: 32,
    });
    expect(shouldDismissKnowledgeCanvasBlankGesture(settled)).toBe(false);
    expect(shouldDismissKnowledgeCanvasBlankGesture(
      finishKnowledgeCanvasBlankGesture(settled, { pointerId: 1 })
    )).toBe(true);
  });

  it('rejects pan movement and unrelated pointer completion as blank clicks', () => {
    const started = startKnowledgeCanvasBlankGesture({ pointerId: 1, clientX: 20, clientY: 30 });
    const unrelated = moveKnowledgeCanvasBlankGesture(started, {
      pointerId: 2,
      clientX: 80,
      clientY: 90,
    });
    const panned = moveKnowledgeCanvasBlankGesture(unrelated, {
      pointerId: 1,
      clientX: 30,
      clientY: 30,
    });

    expect(unrelated).toBe(started);
    expect(finishKnowledgeCanvasBlankGesture(started, { pointerId: 2 })).toBe(started);
    expect(shouldDismissKnowledgeCanvasBlankGesture(
      finishKnowledgeCanvasBlankGesture(started, { pointerId: 2 })
    )).toBe(false);
    expect(shouldDismissKnowledgeCanvasBlankGesture(panned)).toBe(false);
    expect(shouldDismissKnowledgeCanvasBlankGesture(null)).toBe(false);
  });

  it('keeps exactly four pixels as a click and rejects movement beyond four pixels', () => {
    const started = startKnowledgeCanvasBlankGesture({ pointerId: 3, clientX: 10, clientY: 10 });
    const atThreshold = moveKnowledgeCanvasBlankGesture(started, {
      pointerId: 3, clientX: 14, clientY: 10,
    });
    const beyondThreshold = moveKnowledgeCanvasBlankGesture(started, {
      pointerId: 3, clientX: 14.01, clientY: 10,
    });

    expect(shouldDismissKnowledgeCanvasBlankGesture(
      finishKnowledgeCanvasBlankGesture(atThreshold, { pointerId: 3 })
    )).toBe(true);
    expect(shouldDismissKnowledgeCanvasBlankGesture(
      finishKnowledgeCanvasBlankGesture(beyondThreshold, { pointerId: 3 })
    )).toBe(false);
  });

  it('classifies points on rendered straight or sampled curved edges as non-blank', () => {
    expect(isKnowledgeCanvasPolylineHit({
      x: 50,
      y: 4,
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      tolerance: 6,
    })).toBe(true);
    expect(isKnowledgeCanvasPolylineHit({
      x: 50,
      y: 18,
      points: [{ x: 0, y: 0 }, { x: 50, y: 20 }, { x: 100, y: 0 }],
      tolerance: 4,
    })).toBe(true);
    expect(isKnowledgeCanvasPolylineHit({
      x: 50,
      y: 40,
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      tolerance: 6,
    })).toBe(false);
  });
});
