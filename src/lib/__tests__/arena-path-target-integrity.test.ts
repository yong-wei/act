import { describe, expect, it } from 'vitest';

import { resolveArenaPathTargetIntegrity } from '@/lib/arena-path-target-integrity';

const canonical = {
  nodeId: 'arena-task:task-second-order-lead-pid',
  type: 'arena_task',
  sourceKind: 'arena_task',
  sourceRef: 'task-second-order-lead-pid',
  target: '/arena/challenges/task-second-order-lead-pid',
};

describe('Arena path target integrity', () => {
  it('accepts a canonical task that exists in the governed Arena catalog', () => {
    expect(resolveArenaPathTargetIntegrity(canonical)).toEqual({
      status: 'valid',
      reason: 'canonical-arena-task-target',
      taskId: 'task-second-order-lead-pid',
      target: canonical,
    });
  });

  it.each([
    ['generic Arena hall', { ...canonical, target: '/arena' }, 'generic-arena-target'],
    ['knowledge placeholder', {
      ...canonical,
      nodeId: '根轨迹_1_1',
      sourceKind: 'knowledge_graph',
      sourceRef: '根轨迹_1_1',
      target: '/arena?nodeId=%E6%A0%B9%E8%BD%A8%E8%BF%B9_1_1',
    }, 'knowledge-placeholder-identity'],
    ['node id mismatch', { ...canonical, nodeId: 'arena-task:other-task' }, 'arena-node-id-mismatch'],
    ['source kind mismatch', { ...canonical, sourceKind: 'knowledge_graph' }, 'arena-source-kind-mismatch'],
    ['source ref mismatch', { ...canonical, sourceRef: 'other-task' }, 'arena-source-ref-mismatch'],
    ['route mismatch', { ...canonical, target: '/arena/challenges/other-task' }, 'arena-route-mismatch'],
    ['unknown task', {
      nodeId: 'arena-task:unknown-task',
      type: 'arena_task',
      sourceKind: 'arena_task',
      sourceRef: 'unknown-task',
      target: '/arena/challenges/unknown-task',
    }, 'unknown-arena-task'],
  ])('blocks %s with a stable reason', (_label, input, reason) => {
    expect(resolveArenaPathTargetIntegrity(input)).toEqual({
      status: 'blocked',
      reason,
      taskId: null,
      target: null,
    });
  });

  it('repairs only the explicitly verified Yang Fan legacy mapping', () => {
    expect(resolveArenaPathTargetIntegrity({
      nodeId: '根轨迹_1_1',
      type: 'arena_task',
      sourceKind: 'knowledge_graph',
      sourceRef: '根轨迹_1_1',
      target: '/arena?nodeId=%E6%A0%B9%E8%BD%A8%E8%BF%B9_1_1',
      fixtureScope: 'yangfan-diagnostic-fixture.v1',
    })).toEqual({
      status: 'repaired',
      reason: 'verified-yangfan-legacy-arena-mapping',
      taskId: 'task-second-order-lead-pid',
      target: canonical,
    });
  });

  it.each([
    'https://act.local/arena?nodeId=%E6%A0%B9%E8%BD%A8%E8%BF%B9_1_1',
    '//act.local/arena?nodeId=%E6%A0%B9%E8%BD%A8%E8%BF%B9_1_1',
    '/arena/?nodeId=%E6%A0%B9%E8%BD%A8%E8%BF%B9_1_1',
    '/arena?nodeId=%E6%A0%B9%E8%BD%A8%E8%BF%B9_1_1#legacy',
    '/arena?nodeId=%E6%A0%B9%E8%BD%A8%E8%BF%B9_1_1&extra=1',
    '/arena?nodeId=%E6%A0%B9%E8%BD%A8%E8%BF%B9_1_1&nodeId=%E6%A0%B9%E8%BD%A8%E8%BF%B9_1_1',
    '/arena?nodeId=%25E6%25A0%25B9%25E8%25BD%25A8%25E8%25BF%B9_1_1',
    '/arena?nodeId=unknown',
  ])('does not repair non-exact Yang Fan legacy target %s', (target) => {
    expect(resolveArenaPathTargetIntegrity({
      nodeId: '根轨迹_1_1',
      type: 'arena_task',
      sourceKind: 'knowledge_graph',
      sourceRef: '根轨迹_1_1',
      target,
      fixtureScope: 'yangfan-diagnostic-fixture.v1',
    })).toMatchObject({
      status: 'blocked',
      target: null,
    });
  });

  it('does not guess a task for an ordinary generic Arena target', () => {
    expect(resolveArenaPathTargetIntegrity({
      nodeId: 'arena-task:legacy',
      type: 'arena_task',
      sourceKind: 'arena_task',
      sourceRef: 'legacy',
      target: '/arena',
    })).toMatchObject({
      status: 'blocked',
      reason: 'generic-arena-target',
      target: null,
    });
  });
});
