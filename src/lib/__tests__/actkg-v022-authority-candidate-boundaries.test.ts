import { describe, expect, it } from 'vitest';

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
import { V018_BASELINE_DEFAULT_PATH } from '../../../scripts/actkg-release/actkg-v022-impact';
import { V022_ACT_CONTROLLED_PATH } from '../../../scripts/actkg-release/actkg-v022-release-mirror';
import {
  assertV022CandidateBundleCounts,
  V022_CANDIDATE_CAPTURE_PATHS,
} from '../../../scripts/knowledge-cutover/prepare-actkg-v022-authority-candidate';
import type { ValidatedActKGBundleV2 } from '../../../scripts/actkg-release/public-bundle-types';

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
    expect(REVIEWED_V0_22_IDENTITIES.publicationTag).toBe('control-theory-engineering-v0.22');
    expect(REVIEWED_V0_22_IDENTITIES.sourceTag).toBe('control-theory-engineering-v0.22-source-r4');
  });

  it('compares impact against the committed v0.18 snapshot and writes a distinct candidate path', () => {
    expect(V018_BASELINE_DEFAULT_PATH).toBe(
      'course-content/authoring/knowledge/releases/control-theory-engineering-v0.18',
    );
    expect(V022_ACT_CONTROLLED_PATH).toBe(
      'course-content/authoring/knowledge/releases/control-theory-engineering-v0.22',
    );
    expect(V022_CANDIDATE_CAPTURE_PATHS).toContain(V018_BASELINE_DEFAULT_PATH);
    expect(V022_CANDIDATE_CAPTURE_PATHS).toContain(V022_ACT_CONTROLLED_PATH);
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
