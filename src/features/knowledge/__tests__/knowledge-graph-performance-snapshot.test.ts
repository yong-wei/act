import { describe, expect, it } from 'vitest';

import {
  installKnowledgeGraphTask74Snapshot,
  isKnowledgeGraphTask74PerformanceQa,
  type KnowledgeGraphTask74Snapshot,
} from '../graph/performance-snapshot';

describe('Task 7.4 performance snapshot boundary', () => {
  it('enables the snapshot only for the exact QA query value', () => {
    expect(isKnowledgeGraphTask74PerformanceQa('?qa=task-7-4-performance')).toBe(true);
    expect(isKnowledgeGraphTask74PerformanceQa('?qa=knowledge-product')).toBe(false);
    expect(isKnowledgeGraphTask74PerformanceQa('?qa=task-7-4-performance-extra')).toBe(false);
  });

  it('exposes a getter-only snapshot and removes only its own getter', () => {
    const target = {} as Window & { __knowledgeGraphTask74Snapshot?: KnowledgeGraphTask74Snapshot };
    const snapshot = { renderMode: '2D' } as KnowledgeGraphTask74Snapshot;
    const cleanup = installKnowledgeGraphTask74Snapshot(target, () => snapshot);

    expect(target.__knowledgeGraphTask74Snapshot).toBe(snapshot);
    expect(Object.getOwnPropertyDescriptor(target, '__knowledgeGraphTask74Snapshot')).toMatchObject({
      set: undefined,
      enumerable: false,
    });
    cleanup();
    expect('__knowledgeGraphTask74Snapshot' in target).toBe(false);
  });
});
