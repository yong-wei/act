import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { loadAndValidateRegisteredPublicBundleV2 } from '../../../scripts/actkg-release/public-bundle-v2';

import {
  CTKG_SCHEMA_V2_RAW_SHA256,
  CTKG_SCHEMA_V2_VERSION,
  PUBLIC_BUNDLE_V2_CONTRACT_VERSION,
  isSchemaIdentityV2Supported,
} from '../../../scripts/actkg-release/bundle-compatibility-registry-v2';
import {
  REVIEWED_V0_22_COMPONENTS,
  REVIEWED_V0_22_IDENTITIES,
  REVIEWED_V0_22_V2_REGISTRY,
} from '../../../scripts/actkg-release/bundle-compatibility-registry-v022';
import {
  V018_BASELINE_DEFAULT_PATH,
  V018_BASELINE_FILES,
  v2CompatibleComponentIdentity,
} from '../../../scripts/actkg-release/actkg-v022-impact';
import { V022_ACT_CONTROLLED_PATH } from '../../../scripts/actkg-release/actkg-v022-release-mirror';
import {
  assertV022CandidateBundleCounts,
  V022_CANDIDATE_CAPTURE_PATHS,
  type V022AuthorityCandidateReceipt,
} from '../../../scripts/knowledge-cutover/prepare-actkg-v022-authority-candidate';
import type { ValidatedActKGBundleV2 } from '../../../scripts/actkg-release/public-bundle-types';

const V022_CANDIDATE_RECEIPT_PATH =
  'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.22/candidate-receipt.json';

describe('actkg v0.22 authority candidate boundaries', () => {
  it('reuses the admitted v0.18 schema identity and v2 protocol', () => {
    expect(REVIEWED_V0_22_V2_REGISTRY.bundleContractVersion).toBe(PUBLIC_BUNDLE_V2_CONTRACT_VERSION);
    expect(REVIEWED_V0_22_V2_REGISTRY.schemaVersion).toBe(CTKG_SCHEMA_V2_VERSION);
    expect(REVIEWED_V0_22_V2_REGISTRY.schemaRawSha256).toBe(CTKG_SCHEMA_V2_RAW_SHA256);
    expect(isSchemaIdentityV2Supported(
      REVIEWED_V0_22_V2_REGISTRY.schemaVersion,
      REVIEWED_V0_22_V2_REGISTRY.schemaRawSha256,
    )).toBe(true);
    expect(REVIEWED_V0_22_V2_REGISTRY.discoverCounts).toBe(true);
  });

  it('locks the composite envelope to Integration v0.20 and terminology v0.5', () => {
    const roles = Object.fromEntries(
      REVIEWED_V0_22_COMPONENTS.map((component) => [component.componentRole, component.releaseVersion]),
    );
    expect(roles.integration).toBe('control-theory-integration-v0.20');
    expect(roles.terminology).toBe('control-theory-zh-cn-terminology-v0.5');
    expect(REVIEWED_V0_22_IDENTITIES.publicationTag).toBe('control-theory-engineering-v0.22-r5');
    expect(REVIEWED_V0_22_IDENTITIES.sourceTag).toBe('control-theory-engineering-v0.22-source-r8');
  });

  it('compares impact against the committed v0.18 snapshot and writes a distinct candidate path', () => {
    expect(V018_BASELINE_DEFAULT_PATH).toBe(
      'course-content/authoring/knowledge/releases/control-theory-engineering-v0.18',
    );
    expect(V022_ACT_CONTROLLED_PATH).toBe(
      'course-content/authoring/knowledge/releases/control-theory-engineering-v0.22-r5',
    );
    expect(V022_CANDIDATE_CAPTURE_PATHS).toContain(V018_BASELINE_DEFAULT_PATH);
    expect(V022_CANDIDATE_CAPTURE_PATHS).toContain(V022_ACT_CONTROLLED_PATH);
    expect(new Set(V022_CANDIDATE_CAPTURE_PATHS).size).toBe(V022_CANDIDATE_CAPTURE_PATHS.length);
    expect(V018_BASELINE_FILES).toEqual(expect.arrayContaining([
      'act-projection.json',
      'domain-projection.json',
      'review-projection.json',
    ]));
  });

  it('treats shared v0.18 and v0.22 component hashes as identical V2 identities', () => {
    const readComponents = (relativePath: string): Array<{ release_id: string; release_hash: string }> => {
      const parsed = JSON.parse(readFileSync(relativePath, 'utf8')) as {
        components: Array<{ release_id: string; release_hash: string }>;
      };
      return parsed.components;
    };
    const baseline = readComponents(`${V018_BASELINE_DEFAULT_PATH}/component-releases.json`);
    const candidate = readComponents(`${V022_ACT_CONTROLLED_PATH}/component-releases.json`);
    const baselineIds = new Set(baseline.map((row) => row.release_id));
    const shared = candidate.filter((row) => baselineIds.has(row.release_id));
    expect(shared).toHaveLength(13);
    for (const row of shared) {
      const base = baseline.find((entry) => entry.release_id === row.release_id);
      expect(base?.release_hash).toBe(row.release_hash);
      expect(v2CompatibleComponentIdentity({
        componentReleaseId: row.release_id,
        releaseHash: row.release_hash,
      })).toEqual(v2CompatibleComponentIdentity({
        componentReleaseId: base!.release_id,
        releaseHash: base!.release_hash,
      }));
    }
  });

  it('admits the repaired v0.22-r5 envelope through the existing v2 adapter', async () => {
    const captureRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const bundle = await loadAndValidateRegisteredPublicBundleV2({
      root: process.cwd(),
      bundlePath: V022_ACT_CONTROLLED_PATH,
      gitRoot: process.cwd(),
      captureRevision,
      registry: REVIEWED_V0_22_V2_REGISTRY,
    });
    expect(bundle.protocol).toBe(PUBLIC_BUNDLE_V2_CONTRACT_VERSION);
    expect(bundle.schemaIdentity.rawSha256).toBe(CTKG_SCHEMA_V2_RAW_SHA256);
    expect(bundle.bundleIdentity.bundleRevision).toBe(5);
    expect(bundle.bundleIdentity.bundleDigest).toBe(REVIEWED_V0_22_IDENTITIES.bundleDigest);
    expect(bundle.statistics.relationTypeCount).toBe(9);
    expect(bundle.multilingualLabels).toHaveLength(2148);
    expect(bundle.runtimeLinkMetadata.length).toBeGreaterThan(0);
    assertV022CandidateBundleCounts(bundle);
  });

  it('records discovered v0.22 membership from the staged candidate receipt', () => {
    const receipt = JSON.parse(readFileSync(V022_CANDIDATE_RECEIPT_PATH, 'utf8')) as V022AuthorityCandidateReceipt;
    expect(receipt.status).toBe('staged');
    expect(receipt.mode).toBe('local-disposable-non-activation');
    expect(receipt.nonActivation).toBe(true);
    expect(receipt.replayByteEquivalent).toBe(true);
    expect(receipt.impactByteEquivalent).toBe(true);
    expect(receipt.pointers.unchanged).toBe(true);
    expect(receipt.validated.bundleDigest).toBe(REVIEWED_V0_22_IDENTITIES.bundleDigest);
    expect(receipt.validated.releaseNodes).toBe(7300);
    expect(receipt.validated.runtimeProjectionNodes).toBe(7082);
    expect(receipt.validated.runtimeProjectionLinks).toBe(2932);
    expect(receipt.validated.multilingualLabels).toBe(2148);
    expect(receipt.replays).toHaveLength(2);
    expect(receipt.replays[0]?.snapshotId).toBe(receipt.replays[1]?.snapshotId);
    expect(receipt.replays[0]?.snapshotHash).toBe(receipt.replays[1]?.snapshotHash);
    expect(receipt.replays[1]?.idempotentImport.mode).toBe('idempotent');
    expect(receipt.impact.directDenominator).toBe('complete-v0.18-snapshot');
    expect(receipt.impact.upstreamDiffStatus).toBe('DISAGREED');
    const authority = receipt.pointers.after.find((pointer) => (
      pointer.relativePath === 'course-content/authoring/knowledge/authority/current.json'
    ));
    expect(authority?.sha256).toBe('086f14793fbf2aa3afc8fba471503042242645122425c3018b6526e8ab2835f2');
  });

  it('refuses unresolved membership instead of hard-coding v0.18 counts', () => {
    const empty = {
      statistics: {
        releaseNodes: 0,
        projectionNodes: 0,
        publishedRelations: 0,
        terminologyAssertions: 0,
      },
      projectionProfiles: [],
      rawArtifacts: [],
    } as unknown as ValidatedActKGBundleV2;
    expect(() => assertV022CandidateBundleCounts(empty)).toThrow(/membership was not resolved/);
  });
});
