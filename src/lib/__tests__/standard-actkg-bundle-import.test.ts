import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertValidatedActKGBundleInput,
  importValidatedActKGBundle,
  STANDARD_PUBLIC_BUNDLE_PROTOCOL,
} from '../../../scripts/actkg-release/standard-bundle-import';

function minimalValidatedBundleInput(releaseStage: 'stable' | 'candidate') {
  const bytes = Buffer.from('{"ok":true}');
  const digest = 'a'.repeat(64);
  const commit = 'b'.repeat(40);
  return {
    captureRevision: commit,
    bundleIdentity: {
      bundleId: 'ctb:example:r1',
      bundleRevision: 1,
      bundleDigest: digest,
      bundleKind: 'aggregate' as const,
      releaseStage,
      bundleContractVersion: STANDARD_PUBLIC_BUNDLE_PROTOCOL,
      controlledPath: 'course-content/authoring/knowledge/releases/example',
      manifestRawSha256: digest,
      normalization: 'actkg-public-bundle-manifest/1',
      publicationTag: 'example',
      sourceCommit: commit,
      sourceTag: 'example-source',
    },
    releaseIdentity: {
      releaseId: 'ctr:release:example',
      releaseVersion: 'example-v0.1',
      releaseHash: digest,
      sourceDatasetHash: digest,
    },
    releaseSetIdentity: {
      releaseSetId: 'actkg-example-candidate',
      lockVersion: 'actkg-release-set-lock/v3' as const,
      lockPath: 'course-content/authoring/knowledge/releases/example.lock.json',
      lockRawSha256: digest,
    },
    schemaIdentity: {
      version: '0.2.0',
      rawSha256: digest,
    },
    selectedRuntimeProjection: {
      identity: {
        projectionId: 'ctr:projection:example:act-v2',
        profile: 'runtime',
        projectionProfile: 'ctr:profile:example:act-v2',
        versionDigest: digest,
        sourceRelease: 'ctr:release:example',
        sourceReleaseHash: digest,
        sourceDatasetHash: digest,
        nodeCount: 0,
        linkCount: 0,
        artifactPath: 'example.act-projection.json',
        artifactSha256: digest,
      },
      payload: { nodes: [], links: [] },
    },
    preservedProjections: [],
    runtimeLinkMetadata: [],
    allLinkMetadata: [],
    crosswalk: [],
    components: [],
    rawArtifacts: [{
      descriptor: {
        role: 'release',
        contractVersion: 'ctkg-release/0.2',
        required: true,
        path: 'example.release.json',
        mediaType: 'application/json',
        sha256: digest,
        byteLength: bytes.length,
        recordCount: null,
        known: true,
        semanticsEnabled: true,
      },
      bytes,
    }],
    release: { entries: [] },
    schema: { $id: 'schema' },
    statistics: {
      releaseEntries: 0,
      knowledgeNodes: 0,
      publishedRelations: 0,
      projectionNodes: 0,
      projectionLinks: 0,
      ragCrosswalkRows: 0,
      componentCount: 0,
      relationTypeCount: 0,
    },
    compatibility: {
      code: 'COMPATIBLE_CONTENT_UPDATE' as const,
      reasons: ['ok'],
      matchedIdentities: [],
    },
    unknownOptionalArtifacts: [],
  };
}

/** Records any Prisma property walk / call; proves the stable gate does zero DB I/O. */
function writeTrackingPrisma() {
  const interactions: string[] = [];
  const track = (label: string): unknown => new Proxy(function tracked() {}, {
    apply() {
      interactions.push(`${label}()`);
      throw new Error(`unexpected Prisma interaction: ${label}()`);
    },
    get(_target, prop) {
      if (typeof prop === 'symbol') return undefined;
      return track(`${label}.${prop}`);
    },
  });
  return new Proxy({ interactions } as { interactions: string[] } & Record<string, unknown>, {
    get(target, prop) {
      if (prop === 'interactions') return target.interactions;
      if (typeof prop === 'symbol') return undefined;
      return track(String(prop));
    },
  });
}

describe('standard ActKG Bundle persistence boundary', () => {
  it('rejects raw directory paths and unvalidated Manifest inputs', () => {
    expect(() => assertValidatedActKGBundleInput(
      'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2',
    )).toThrow(/rejects raw directory paths|ValidatedActKGBundle/u);
    expect(() => assertValidatedActKGBundleInput(Buffer.from('{}'))).toThrow(
      /rejects raw directory paths|ValidatedActKGBundle/u,
    );
    expect(() => assertValidatedActKGBundleInput({
      bundle_manifest: true,
      artifacts: [],
    })).toThrow(/captureRevision|ValidatedActKGBundle/u);
  });

  it('accepts a minimal ValidatedActKGBundle shape without file discovery imports', () => {
    const input = minimalValidatedBundleInput('stable');
    const validated = assertValidatedActKGBundleInput(input);
    expect(validated.bundleIdentity.bundleId).toBe('ctb:example:r1');
    expect(validated.rawArtifacts[0]?.bytes.equals(input.rawArtifacts[0]!.bytes)).toBe(true);
  });

  it('rejects candidate-stage Bundles before any database interaction', async () => {
    const db = writeTrackingPrisma();
    // Shape-valid candidate object is still allowed through the compatibility
    // boundary (allowCandidateBundle), but the write gate must fail closed.
    const candidateInput = minimalValidatedBundleInput('candidate');
    expect(() => assertValidatedActKGBundleInput(candidateInput)).not.toThrow();

    await expect(
      importValidatedActKGBundle(db as never, candidateInput),
    ).rejects.toThrow(/only stable public Bundles may be persisted|candidate-stage|releaseStage/u);

    expect(db.interactions).toEqual([]);
  });

  it('keeps the importer free of Manifest parsing and file discovery', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'scripts/actkg-release/standard-bundle-import.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/loadAndValidatePublicBundleV1|bundle-manifest\.json|readdir|readFile/u);
    expect(source).toMatch(/assertValidatedActKGBundleInput/);
    expect(source).toMatch(/STAGED_CANDIDATE_STATE/);
    expect(source).toMatch(/ACCEPTED_CANDIDATE_STATE/);
    expect(source).toMatch(/acceptBundleReceipt|STAGED→ACCEPTED|candidateState: STAGED_CANDIDATE_STATE/);
    expect(source).toMatch(/canonicalizeAllLinkMetadata/);
    expect(source).toMatch(/MAX_IMPORT_ATTEMPTS|isRetryableConflict/);
    expect(source).toMatch(/pg_advisory_xact_lock|acquireImportLocks/);
    expect(source).toMatch(/GLOBAL_ACCEPTANCE_LOCK_TOKEN|global-acceptance/);
    expect(source).toMatch(/maxGlobalAcceptedImportedAt/);
    expect(source).toMatch(/releaseStage !== 'stable'/u);
    // Strictly monotonic global acceptance timestamps (not wall-clock alone).
    expect(source).toMatch(/nextStrictAcceptanceTimestamp/);
    expect(source).toMatch(/previousMs \+ 1|previousAcceptedImportedAt\.getTime\(\) \+ 1/u);
  });

  it('advances acceptance timestamps strictly past prior ACCEPTED importedAt', async () => {
    const { nextStrictAcceptanceTimestamp } = await import(
      '../../../scripts/actkg-release/standard-bundle-import'
    );
    const previous = new Date('2026-07-29T12:00:00.000Z');
    const sameMs = new Date(previous.getTime());
    const advanced = nextStrictAcceptanceTimestamp(previous, sameMs);
    expect(advanced.getTime()).toBe(previous.getTime() + 1);

    const laterWall = new Date(previous.getTime() + 50);
    expect(nextStrictAcceptanceTimestamp(previous, laterWall).getTime()).toBe(laterWall.getTime());

    const first = nextStrictAcceptanceTimestamp(null, previous);
    expect(first.getTime()).toBe(previous.getTime());
  });

  it('derives stable advisory lock keys without SQL string interpolation', async () => {
    const { advisoryLockKeys, GLOBAL_ACCEPTANCE_LOCK_TOKEN } = await import(
      '../../../scripts/actkg-release/standard-bundle-import'
    );
    const a = advisoryLockKeys('release', 'ctr:release:example');
    const b = advisoryLockKeys('release', 'ctr:release:example');
    const c = advisoryLockKeys('bundle', 'ctr:release:example');
    const global = advisoryLockKeys('global', GLOBAL_ACCEPTANCE_LOCK_TOKEN);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(global).not.toEqual(a);
    expect(Number.isInteger(a[0])).toBe(true);
    expect(Number.isInteger(a[1])).toBe(true);
    expect(GLOBAL_ACCEPTANCE_LOCK_TOKEN).toContain('global-acceptance');
  });

  it('deduplicates runtime Projection when it also appears in preservedProjections', async () => {
    const { uniqueProjectionIdentityRows } = await import(
      '../../../scripts/actkg-release/standard-bundle-import'
    );
    const runtime = {
      projectionId: 'ctr:projection:example:act-v2',
      profile: 'runtime',
      projectionProfile: 'ctr:profile:example:act-v2',
      versionDigest: 'a'.repeat(64),
      sourceRelease: 'ctr:release:example',
      sourceReleaseHash: 'b'.repeat(64),
      sourceDatasetHash: 'c'.repeat(64),
      nodeCount: 1,
      linkCount: 0,
      artifactPath: 'example.act-projection.json',
      artifactSha256: 'd'.repeat(64),
    };
    const rows = uniqueProjectionIdentityRows({
      selectedRuntimeProjection: { identity: runtime, payload: {} },
      preservedProjections: [
        { identity: runtime, payload: {} },
        {
          identity: { ...runtime, projectionId: 'ctr:projection:example:domain-v2', profile: 'domain', projectionProfile: 'ctr:profile:example:domain-v2' },
          payload: {},
        },
      ],
    } as never);
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.isRuntime)).toHaveLength(1);
    expect(rows.find((row) => row.isRuntime)?.identity.projectionId).toBe(runtime.projectionId);
  });

  it('canonicalizes allLinkMetadata with profile merge and conflict fail-closed', async () => {
    const { canonicalizeAllLinkMetadata } = await import(
      '../../../scripts/actkg-release/standard-bundle-import'
    );
    const baseRow = {
      relationId: 'ctr:rel-1',
      releaseTier: 'gold',
      sourceRelease: 'ctr:release:example',
      sourceReleaseHash: 'a'.repeat(64),
      evidenceRefs: ['e1'],
      payload: { k: 1 },
    };
    const validated = {
      allLinkMetadata: [
        { profiles: ['runtime'], path: 'a.jsonl', rows: [baseRow] },
        { profiles: ['domain'], path: 'b.jsonl', rows: [{ ...baseRow, evidenceRefs: ['e1'] }] },
      ],
    } as never;
    const merged = canonicalizeAllLinkMetadata(validated);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.profiles).toEqual(['domain', 'runtime']);

    expect(() => canonicalizeAllLinkMetadata({
      allLinkMetadata: [
        { profiles: ['runtime'], path: 'a.jsonl', rows: [baseRow] },
        {
          profiles: ['domain'],
          path: 'b.jsonl',
          rows: [{ ...baseRow, releaseTier: 'silver' }],
        },
      ],
    } as never)).toThrow(/conflicting canonical content/u);
  });

  it('preserves optional #1125 historical Artifact fields as nullable in Prisma schema', () => {
    const schema = readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    expect(schema).toMatch(/model ActkgBundleReceipt/);
    expect(schema).toMatch(/model ActkgBundleArtifact/);
    expect(schema).toMatch(/model ActkgProjectionIdentity/);
    expect(schema).toMatch(/model ActkgProjectionLinkMetadata/);
    expect(schema).toMatch(/role\s+String\?/);
    expect(schema).toMatch(/bundleContractVersion\s+String\?/);
    expect(schema).toMatch(/releaseRawSha256\s+String\?/);
  });

  it('does not rewrite the frozen #1125 exact adapter entrypoint', () => {
    const aggregate = readFileSync(
      path.join(process.cwd(), 'scripts/actkg-release/ctkg-0-2-aggregate-release.ts'),
      'utf8',
    );
    expect(aggregate).toMatch(/export const AGGREGATE_RELEASE_ID = 'control-theory-engineering-v0\.2'/u);
    expect(aggregate).toMatch(/ctkg-0\.2-aggregate-engineering-release-v1/u);
    const cli = readFileSync(
      path.join(process.cwd(), 'scripts/db/import-authoritative-actkg-release.ts'),
      'utf8',
    );
    expect(cli).toMatch(/importValidatedAggregateRelease/);
    expect(cli).not.toMatch(/importValidatedActKGBundle/);
  });
});
