import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ACTIVE_GRAPH_SUPPORT,
  readActiveCanvas,
  readActiveNode,
} from '@/app/api/knowledge/_active-authority';
import {
  resolveActiveEngineeringGraphAuthority,
  resolveConfiguredAuthorityRoot,
} from '@/lib/authoritative-knowledge/engineering-authority-consumers';
import { resolveAuthorityStorePaths } from '@/lib/authoritative-knowledge/authority-store';
import { buildCanvasProjection } from '@/lib/authoritative-knowledge/projections';

describe('active Authority committed store contract', () => {
  const storeEnvKeys = [
    'ACT_AUTHORITY_STORE_ROOT',
    'AUTHORITY_STORE_ROOT',
    'ACT_CONSUMER_ACTIVATION_ROOT',
    'CONSUMER_ACTIVATION_ROOT',
  ] as const;
  const previousStoreEnv = new Map<string, string | undefined>();

  beforeAll(() => {
    // Ensure this contract test reads the tracked checkout stores rather than
    // a developer-specific environment override. No files are written.
    for (const key of storeEnvKeys) {
      previousStoreEnv.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterAll(() => {
    for (const key of storeEnvKeys) {
      const value = previousStoreEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('loads the committed engineering graph and projects canonical objects without a standard Projection', () => {
    const resolved = resolveActiveEngineeringGraphAuthority(
      resolveAuthorityStorePaths(resolveConfiguredAuthorityRoot()),
    );

    expect(resolved.status).toBe('ready');
    expect(resolved.consumerId).toBe('engineering-graph');
    expect(resolved.consumerStatus).toBe('READY');
    expect(resolved.activationMode).toBe('use-combination');
    expect(resolved.projectionId).toBeNull();
    expect(resolved.projectionHash).toBeNull();
    expect(resolved.combination?.projectionId).toBeNull();
    expect(resolved.combination?.projectionHash).toBeNull();
    expect(resolved.snapshot).not.toBeNull();
    if (resolved.status !== 'ready' || !resolved.snapshot) return;

    const snapshot = resolved.snapshot;
    expect(snapshot.objects.length).toBeGreaterThan(0);
    expect(snapshot.projectionNodes ?? []).toHaveLength(0);
    expect(snapshot.projectionLinks ?? []).toHaveLength(0);

    const canvas = readActiveCanvas();
    expect(canvas.status).toBe('available');
    if (canvas.status !== 'available') return;
    expect(canvas.projection.source.authorityState).toBe('active');
    expect(canvas.projection.nodes.length).toBeGreaterThan(0);
    expect(canvas.projection.relations.length).toBeGreaterThan(0);
    expect(canvas.projection.provenance.projection).toEqual({
      status: 'not-applicable',
      projectionId: null,
      projectionHash: null,
    });

    const nodeId = snapshot.objects[0]?.canonicalId;
    expect(nodeId).toBeTruthy();
    if (!nodeId) return;
    const detail = readActiveNode('ADMIN', nodeId);
    expect(detail.status).toBe('available');
    if (detail.status !== 'available') return;
    expect(detail.projection.node.id).toBe(nodeId);
    expect(detail.projection.source.authorityState).toBe('active');
    expect(detail.projection.provenance.projection.projectionId).toBeNull();
    expect(Object.hasOwn(detail.projection.source, 'controlledPath')).toBe(false);

    expect(() => buildCanvasProjection(snapshot, ACTIVE_GRAPH_SUPPORT)).toThrow(
      'standard runtime Projection is empty or missing',
    );
  });
});
