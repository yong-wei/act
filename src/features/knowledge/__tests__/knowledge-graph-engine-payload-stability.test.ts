import { describe, expect, it } from 'vitest';

import {
  computeKnowledgeForceStructureSignature,
  resolveStableKnowledgeGraphEnginePayload,
} from '../graph/force-lifecycle';

interface Payload {
  nodes: Array<{ id: string }>;
  links: Array<{ source: string; target: string }>;
}

function payloadOf(nodeIds: readonly string[], edges: ReadonlyArray<[string, string]> = []): Payload {
  return {
    nodes: nodeIds.map((id) => ({ id })),
    links: edges.map(([source, target]) => ({ source, target })),
  };
}

describe('engine payload stability guard (#2052 hover drift)', () => {
  const signatureOf = (payload: Payload, extra: ReadonlyArray<string | number> = ['graph-v1', 0, 1]): string => (
    computeKnowledgeForceStructureSignature(payload.nodes, payload.links, extra)
  );
  const previous = {
    signature: signatureOf(payloadOf(['a', 'b'], [['a', 'b']])),
    payload: payloadOf(['a', 'b'], [['a', 'b']]),
  };

  it('reuses the previous payload reference while the structure signature is unchanged', () => {
    const recreated = payloadOf(['a', 'b'], [['a', 'b']]);
    expect(recreated).not.toBe(previous.payload);
    expect(recreated.nodes[0]).not.toBe(previous.payload.nodes[0]);
    const resolved = resolveStableKnowledgeGraphEnginePayload(previous, signatureOf(recreated), recreated);
    expect(resolved.reused).toBe(true);
    expect(resolved.payload).toBe(previous.payload);
  });

  it('rebuilds the payload when node identity, edge endpoints, graph version, relayout or layout state change', () => {
    const cases: Array<[string, string]> = [
      [computeKnowledgeForceStructureSignature(payloadOf(['a', 'b', 'c']).nodes, []), 'new node disclosed'],
      [computeKnowledgeForceStructureSignature(payloadOf(['a', 'b']).nodes, payloadOf([], [['a', 'c']]).links), 'edge endpoint changed'],
      [computeKnowledgeForceStructureSignature(payloadOf(['a', 'b']).nodes, [], ['graph-v2', 0, 1]), 'graph version changed'],
      [computeKnowledgeForceStructureSignature(payloadOf(['a', 'b']).nodes, [], ['graph-v1', 1, 1]), 'relayout version changed'],
      [computeKnowledgeForceStructureSignature(payloadOf(['a', 'b']).nodes, [], ['graph-v1', 0, 2]), 'layout state version changed'],
    ];
    for (const [signature, reason] of cases) {
      const resolved = resolveStableKnowledgeGraphEnginePayload(previous, signature, payloadOf(['a', 'b'], [['a', 'b']]));
      expect(resolved.reused, reason).toBe(false);
      expect(resolved.payload).not.toBe(previous.payload);
    }
  });

  it('keeps hover-irrelevant re-renders on the same signature while pure-render inputs churn', () => {
    // hover/选择/预览重渲染会重建 nodes/links 数组引用但内容不变；
    // 签名（id 集 + 边端点 + 版本输入）保持稳定。
    const hoverRenderSignature = signatureOf(payloadOf(['a', 'b'], [['a', 'b']]));
    expect(hoverRenderSignature).toBe(previous.signature);
  });
});

describe('payload display-field sync on reuse (#2054 review)', () => {
  it('copies mutable display fields onto reused node objects without touching identity or coordinates', async () => {
    const { syncKnowledgeGraphPayloadDisplayFields } = await import('../graph/force-lifecycle');
    const previous = [
      { id: 'a', name: '旧名称', description: '旧描述', labelPriority: false, x: 10, fx: 10 },
      { id: 'b', name: '保留', description: '', labelPriority: true, x: 20 },
    ];
    const fresh = [
      { id: 'a', name: 'New name', description: 'New description', labelPriority: true, x: 99 },
    ];
    syncKnowledgeGraphPayloadDisplayFields(previous, fresh, ['name', 'description', 'labelPriority']);
    expect(previous[0].name).toBe('New name');
    expect(previous[0].description).toBe('New description');
    expect(previous[0].labelPriority).toBe(true);
    // 引擎状态不被同步覆盖。
    expect(previous[0].x).toBe(10);
    expect(previous[0].fx).toBe(10);
    expect(previous[1].name).toBe('保留');
  });
});
