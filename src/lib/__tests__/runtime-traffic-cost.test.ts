import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  INVENTORY,
  SOURCE_EXPORT_SCHEMA_VERSION,
  SOURCE_TYPES,
  normalizeSourceExport,
  observeTraffic,
  summarizeObservation,
  trafficPrivacyViolation,
  type SourceExport,
} from '../runtime-traffic-cost';

const COMMIT = 'a'.repeat(40);
const TREE = 'b'.repeat(40);
const WINDOW = { start: '2026-08-01T00:00:00.000Z', end: '2026-08-02T00:00:00.000Z', timezone: 'UTC' };

function sourceExport(sourceType: SourceExport['sourceType'], rows: SourceExport['rows'], extra: Partial<SourceExport> = {}): SourceExport {
  const denominatorBytes = extra.denominatorBytes ?? rows.reduce((sum, row) => sum + row.bytes, 0);
  const denominatorCount = extra.denominatorCount ?? rows.reduce((sum, row) => sum + (row.count ?? 1), 0);
  return {
    schemaVersion: SOURCE_EXPORT_SCHEMA_VERSION,
    sourceType,
    window: WINDOW,
    exporterVersion: `${sourceType}-fixture/1`,
    reportingDelayHours: sourceType === 'oss' ? 24 : 0,
    denominatorBytes,
    denominatorCount,
    rows,
    ...extra,
  };
}

function completeExports(): SourceExport[] {
  return [
    sourceExport('oss', [
      { metering: 'NetworkOut', prefix: 'runtime/blobs/sha256/', bytes: 100, count: 2, operation: 'get-object' },
      { metering: 'CdnOut', prefix: 'runtime/blob-releases/', bytes: 40, count: 1, operation: 'origin-fetch' },
    ]),
    sourceExport('esa', [
      { metering: 'edge-bytes', path: '/assets/models-opt/destroyer.glb', bytes: 80, count: 1 },
    ]),
    sourceExport('nginx', [
      { path: '/assets/models-opt/destroyer.glb', bytes: 80, count: 1 },
      { path: '/course-runtime/lessons/1-1/1-1-handout.md', bytes: 20, count: 1 },
    ]),
    sourceExport('publisher', [
      { operation: 'head-object', bytes: 0, count: 3 },
      { operation: 'put-object', bytes: 50, count: 1 },
      { operation: 'get-object-legacy', bytes: 10, count: 1 },
    ]),
    sourceExport('developer-mount', [
      { operation: 'blob-read', bytes: 30, count: 1, cacheHit: false, prefix: 'runtime/blobs/sha256/' },
      { operation: 'blob-read', bytes: 30, count: 1, cacheHit: true, prefix: 'runtime/blobs/sha256/' },
    ]),
  ];
}

describe('runtime traffic cost observation', () => {
  it('freezes the complete route inventory and expected sources', () => {
    expect(INVENTORY.map((item) => item.routeClass)).toEqual([
      'public-assets',
      'course-runtime',
      'runtime-media-redirect',
      'runtime-blob-view',
      'runtime-blob-public-read',
      'publisher-public-upload',
      'publisher-metadata-check',
      'publisher-legacy-body-readback',
    ]);
    expect(SOURCE_TYPES).toEqual(['oss', 'esa', 'nginx', 'publisher', 'developer-mount']);
  });

  it('qualifies a complete compatible observation without summing vendor boundaries', () => {
    const observation = observeTraffic({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      dirty: false,
      mixedWorktree: false,
      environment: 'fixture',
      window: WINDOW,
      capturedAt: '2026-08-27T00:00:00.000Z',
      exports: completeExports(),
    });
    expect(observation.status).toBe('qualified');
    expect(observation.missingSources).toEqual([]);
    expect(observation.ledgers).toHaveLength(5);
    const oss = observation.ledgers.find((item) => item.sourceType === 'oss')!;
    const esa = observation.ledgers.find((item) => item.sourceType === 'esa')!;
    expect(oss.totals.observed.bytes).toBe(140);
    expect(esa.totals.observed.bytes).toBe(80);
    expect(oss.denominatorBytes + esa.denominatorBytes).toBeGreaterThan(oss.denominatorBytes);
    const publisher = observation.ledgers.find((item) => item.sourceType === 'publisher')!;
    expect(publisher.rows.some((row) => row.routeClass === 'publisher-metadata-check' && row.bytes === 0)).toBe(true);
    expect(publisher.rows.some((row) => row.routeClass === 'publisher-legacy-body-readback' && row.bytes === 10)).toBe(true);
    expect(observeTraffic({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      dirty: false,
      mixedWorktree: false,
      environment: 'fixture',
      window: WINDOW,
      capturedAt: '2026-08-27T00:00:00.000Z',
      exports: completeExports(),
    }).observationId).toBe(observation.observationId);
  });

  it('keeps a missing source in the denominator as incomplete', () => {
    const observation = observeTraffic({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      dirty: false,
      mixedWorktree: false,
      environment: 'fixture',
      window: WINDOW,
      capturedAt: '2026-08-27T00:00:00.000Z',
      exports: completeExports().filter((item) => item.sourceType !== 'esa'),
    });
    expect(observation.status).toBe('incomplete');
    expect(observation.missingSources).toEqual([{ sourceType: 'esa', reason: 'source-export-unavailable' }]);
    expect(observation.ledgers.find((item) => item.sourceType === 'esa')?.missingReason).toBe('source-export-unavailable');
  });

  it('blocks mixed windows, duplicate evidence, unbalanced conflicts, and taxonomy conflicts', () => {
    const mixed = observeTraffic({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      dirty: false,
      mixedWorktree: false,
      environment: 'fixture',
      window: WINDOW,
      capturedAt: '2026-08-27T00:00:00.000Z',
      exports: [
        ...completeExports().filter((item) => item.sourceType !== 'nginx'),
        sourceExport('nginx', [{ path: '/assets/x.glb', bytes: 1, count: 1 }], {
          window: { ...WINDOW, end: '2026-08-03T00:00:00.000Z' },
        }),
      ],
    });
    expect(mixed.conflicts).toContain('mixed-window');
    expect(mixed.status).toBe('incomplete');

    const duplicateRows = [
      { metering: 'NetworkOut', prefix: 'runtime/blobs/sha256/', bytes: 10, count: 1, evidenceId: 'same' },
      { metering: 'NetworkOut', prefix: 'runtime/blobs/sha256/', bytes: 10, count: 1, evidenceId: 'same' },
    ];
    const duplicate = normalizeSourceExport(sourceExport('oss', duplicateRows));
    expect(duplicate.totals.duplicate.bytes).toBe(10);
    expect(duplicate.totals.observed.bytes).toBe(10);

    const conflict = normalizeSourceExport(sourceExport('oss', [
      { operation: 'get-object', prefix: 'runtime/blobs/sha256/', bytes: 5, routeClass: 'runtime-blob-view' },
      { operation: 'get-object', prefix: 'runtime/blobs/sha256/', bytes: 5, routeClass: 'public-assets' },
    ]));
    expect(conflict.status).toBe('blocked');
    expect(conflict.conflicts.length).toBeGreaterThan(0);
  });

  it('records delayed billing instead of rewriting rows as observed', () => {
    const delayed = normalizeSourceExport(sourceExport('oss', [
      { metering: 'NetworkOut', prefix: 'runtime/blobs/sha256/', bytes: 9, qualification: 'delayed' },
    ]));
    expect(delayed.totals.delayed.bytes).toBe(9);
    expect(delayed.totals.observed.bytes).toBe(0);
    expect(delayed.status).toBe('incomplete');
  });

  it('hashes external evidence ids and requires an independent denominator', () => {
    const hashed = normalizeSourceExport(sourceExport('nginx', [
      { path: '/assets/x.glb', bytes: 4, evidenceId: 'alice@example.com' },
    ]));
    expect(JSON.stringify(hashed)).not.toContain('alice@example.com');
    expect(hashed.rows[0]?.evidenceId).toMatch(/^[a-f0-9]{64}$/u);
    const conflictedIdentity = normalizeSourceExport(sourceExport('nginx', [
      { bytes: 1, evidenceId: 'alice@example.com', routeClass: 'public-assets' },
      { bytes: 1, evidenceId: 'alice@example.com', routeClass: 'course-runtime' },
    ]));
    expect(JSON.stringify(conflictedIdentity.conflicts)).not.toContain('alice@example.com');
    const zeroDelayed = normalizeSourceExport(sourceExport('oss', [
      { metering: 'NetworkOut', prefix: 'runtime/blobs/sha256/', bytes: 0, count: 0, qualification: 'delayed' },
    ], { denominatorBytes: 0, denominatorCount: 0 }));
    expect(zeroDelayed.status).toBe('incomplete');
    const delayedUnbalanced = normalizeSourceExport(sourceExport('oss', [
      { metering: 'NetworkOut', prefix: 'runtime/blobs/sha256/', bytes: 9, qualification: 'delayed' },
    ], { denominatorBytes: 20, denominatorCount: 1 }));
    expect(delayedUnbalanced.status).toBe('blocked');
    const unbalanced = normalizeSourceExport(sourceExport('oss', [
      { metering: 'NetworkOut', prefix: 'runtime/blobs/sha256/', bytes: 10, count: 1 },
    ], { denominatorBytes: 20, denominatorCount: 1 }));
    expect(unbalanced.status).toBe('blocked');
  });

  it('rejects protected fields before a portable artifact is written', () => {
    expect(() => normalizeSourceExport(sourceExport('nginx', [
      { path: '/assets/x.glb?Expires=1&Signature=abc', bytes: 1 },
    ]))).toThrow(/privacy-unsafe-source-export:signed-query/);
    expect(trafficPrivacyViolation('/Users/operator/export.json')).toBe('absolute-path');
    expect(trafficPrivacyViolation('Authorization: Bearer abc')).toBe('authorization-header');
    expect(trafficPrivacyViolation('client 203.0.113.10 connected')).toBe('client-ip');
  });

  it('does not mutate cloud state and keeps summaries portable', () => {
    const cli = readFileSync('scripts/runtime-traffic-cost.ts', 'utf8');
    expect(cli).not.toMatch(/PutObject|DeleteBucket|changeDNS|activate-runtime|oss\.put/u);
    expect(cli).toContain('readFileSync');
    const observation = observeTraffic({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      dirty: false,
      mixedWorktree: false,
      environment: 'fixture',
      window: WINDOW,
      capturedAt: '2026-08-27T00:00:00.000Z',
      exports: [],
    });
    expect(observation.status).toBe('incomplete');
    expect(observation.missingSources.map((item) => item.sourceType)).toEqual([...SOURCE_TYPES]);
    const summary = summarizeObservation(observation);
    expect(summary).toContain('Vendor ledgers are independent');
    expect(summary).not.toContain('/Users/');
  });
});
