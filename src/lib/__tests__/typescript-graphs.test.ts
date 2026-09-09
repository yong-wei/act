import { describe, expect, it } from 'vitest';

import {
  GRAPH_MANIFEST_SCHEMA_VERSION,
  SHARED_CONTRACT_OWNERS,
  createGraphManifest,
  createGraphMeasurementReceipt,
  graphDefinition,
  graphManifestHash,
  parseTscFilePaths,
  validateDependencyCycles,
  validateEntrypointClassification,
  validateGraphConfig,
  validateGraphDefinitions,
  validateMandatoryGraphReceipts,
  validateProductionBoundaries,
  validateSharedContractOwners,
  type GraphConfig,
  type GraphEntrypoint,
} from '../../../scripts/typescript-graphs/contracts';

const repoRoot = process.cwd();

function receipt(command: 'typecheck:tools' | 'typecheck:test', overrides: Partial<ReturnType<typeof createGraphMeasurementReceipt>> = {}) {
  return createGraphMeasurementReceipt({
    graph: command === 'typecheck:tools' ? 'tools' : 'test',
    command,
    scope: command,
    sourceCommit: 'commit',
    sourceTree: 'tree',
    dirty: false,
    manifestHash: 'manifest',
    fixturePath: `typescript-graph-fixtures/${command === 'typecheck:tools' ? 'tools' : 'test'}.ts`,
    fixtureProbe: false,
    toolchain: { node: 'v26.0.0', typescript: '5.8.3' },
    platform: 'test',
    cacheMode: 'warm',
    capturedAt: '2026-08-27T00:00:00.000Z',
    durationMs: 1,
    peakRssBytes: 1,
    fileCount: 1,
    exitStatus: 0,
    status: 'passed',
    tscErrorCount: 0,
    boundaryFailureCount: 0,
    failureCodes: [],
    ...overrides,
  });
}

describe('TypeScript graph contracts', () => {
  it('allows published runtime JSON while rejecting authoring content in the web graph', () => {
    const source = 'src/app/page.tsx';
    const runtime = 'course-content/runtime/lessons/3-6/media/generated-data/3-6-design-data.json';
    const authoring = 'course-content/authoring/lessons/3-6/media/raw/generated-data/3-6-design-data.json';
    expect(validateProductionBoundaries('web', [{ path: source, content: '' }, { path: runtime, content: '{}' }], [
      { source, target: runtime, edgeClass: 'static-import' },
    ])).toEqual([]);
    expect(validateProductionBoundaries('web', [{ path: source, content: '' }], [
      { source, target: authoring, edgeClass: 'static-import' },
    ]).length).toBeGreaterThan(0);
  });
  it('rejects production dependencies that cross into tooling or tests', () => {
    const failures = validateProductionBoundaries(
      'web',
      [{ path: 'src/app/page.tsx', content: '' }],
      [
        { source: 'src/app/page.tsx', target: 'scripts/tool.ts', edgeClass: 'static-import' },
        { source: 'src/app/page.tsx', target: 'src/lib/example.test.ts', edgeClass: 'dynamic-import' },
      ],
    );
    expect(failures.map((failure) => failure.code)).toEqual(expect.arrayContaining(['production-to-tooling', 'production-to-test']));
  });

  it('requires one shared-contract owner and rejects duplicate owners or consumers', () => {
    const owner = SHARED_CONTRACT_OWNERS[0];
    expect(validateSharedContractOwners([owner, { ...owner, ownerGraph: 'worker' }])).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'shared-contract-multiple-owners' }),
    ]));
    expect(validateSharedContractOwners([{ ...owner, ownerGraph: null, consumerGraphs: [] }])).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'shared-contract-owner-missing' }),
      expect.objectContaining({ code: 'shared-contract-unowned' }),
    ]));
    expect(validateSharedContractOwners([{ ...owner, consumerGraphs: ['web', 'worker', 'tools', 'test'] }])).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'shared-contract-owner-is-consumer' }),
    ]));
  });

  it('fails closed for cycles and unclassified entrypoints', () => {
    expect(validateDependencyCycles([
      { source: 'a.ts', target: 'b.ts' },
      { source: 'b.ts', target: 'a.ts' },
    ])).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'dependency-cycle' })]));
    const unknown: GraphEntrypoint = {
      identity: 'package.json:scripts.unknown:custom-entry.ts',
      sourcePath: 'custom-entry.ts',
      graph: null,
      evidence: ['package-script:unknown'],
    };
    expect(validateEntrypointClassification([unknown])).toEqual([
      expect.objectContaining({ code: 'unclassified-entrypoint', identity: unknown.identity }),
    ]);
  });

  it('keeps JSON program inputs in graph file identities', () => {
    expect(parseTscFilePaths([
      `${repoRoot}/src/app/page.tsx`,
      `${repoRoot}/artifacts/example.json`,
      `${repoRoot}/course-content/runtime/example.json`,
      '/usr/lib/node_modules/typescript/lib/lib.es2022.d.ts',
    ].join('\n'), repoRoot)).toEqual([
      'artifacts/example.json',
      'course-content/runtime/example.json',
      'src/app/page.tsx',
    ]);
  });

  it('rejects a broad include, missing excludes and strictness downgrade', () => {
    const definition = graphDefinition('web');
    const config: GraphConfig = {
      include: ['**/*.ts'],
      exclude: [],
      compilerOptions: { strict: false, noEmit: true, moduleResolution: 'classic', module: 'commonjs' },
      references: [],
    };
    const failures = validateGraphConfig(definition, config);
    expect(failures.map((failure) => failure.code)).toEqual(expect.arrayContaining([
      'graph-broad-glob',
      'compiler-policy-downgrade',
      'required-exclude-missing',
      'fixture-not-in-graph',
    ]));
  });

  it('requires current, successful tools and test receipts', () => {
    expect(validateMandatoryGraphReceipts({ receipts: [], sourceCommit: 'commit', sourceTree: 'tree' })).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'mandatory-graph-receipt-missing', identity: 'typecheck:tools' }),
      expect.objectContaining({ code: 'mandatory-graph-receipt-missing', identity: 'typecheck:test' }),
    ]));
    expect(validateMandatoryGraphReceipts({
      receipts: [receipt('typecheck:tools', { sourceTree: 'old-tree' }), receipt('typecheck:test', { status: 'failed', exitStatus: 2 })],
      sourceCommit: 'commit',
      sourceTree: 'tree',
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'mandatory-graph-receipt-stale', identity: 'typecheck:tools' }),
      expect.objectContaining({ code: 'mandatory-graph-receipt-failed', identity: 'typecheck:test' }),
    ]));
    expect(validateMandatoryGraphReceipts({
      receipts: [receipt('typecheck:tools', { dirty: true }), receipt('typecheck:test')],
      sourceCommit: 'commit',
      sourceTree: 'tree',
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'mandatory-graph-receipt-dirty', identity: 'typecheck:tools' }),
    ]));
    expect(validateMandatoryGraphReceipts({
      receipts: [receipt('typecheck:tools', { graph: 'test' }), receipt('typecheck:test')],
      sourceCommit: 'commit',
      sourceTree: 'tree',
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'mandatory-graph-receipt-graph-mismatch', identity: 'typecheck:tools' }),
    ]));
  });

  it('keeps manifests deterministic while measurement receipts retain runtime variables', () => {
    const input = {
      repoRoot,
      graph: 'web' as const,
      sourceCommit: 'commit',
      sourceTree: 'tree',
      programFiles: ['typescript-graph-fixtures/web.ts'],
      entrypoints: [],
    };
    const first = createGraphManifest(input);
    const second = createGraphManifest(input);
    expect(first.schemaVersion).toBe(GRAPH_MANIFEST_SCHEMA_VERSION);
    expect(graphManifestHash(first)).toBe(graphManifestHash(second));
    expect(JSON.stringify(first)).not.toContain('durationMs');
    expect(JSON.stringify(first)).not.toContain('peakRssBytes');
    expect(receipt('typecheck:tools', { capturedAt: '2026-08-27T00:00:01.000Z' }).receiptId)
      .not.toBe(receipt('typecheck:tools', { capturedAt: '2026-08-27T00:00:02.000Z' }).receiptId);
  });

  it('validates the checked-in graph definitions', () => {
    expect(validateGraphDefinitions(repoRoot)).toEqual([]);
  });
});
