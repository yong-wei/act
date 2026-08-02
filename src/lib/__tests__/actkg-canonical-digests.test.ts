/**
 * Unit tests for ActKG authoritative canonical digests.
 * These do not require a clean Git capture tree.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  computeCanonicalReleaseHash,
  computeProjectionVersionDigest,
} from '../../../scripts/actkg-release/actkg-canonical-digests';
import { PROJECTION_AGGREGATION_POLICIES } from '../../../scripts/actkg-release/bundle-compatibility-registry';
import type { JsonObject } from '../../../scripts/actkg-release/public-bundle-types';

const root = process.cwd();
const R2 = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2';
const V3E_MODULE =
  'course-content/authoring/knowledge/releases/time-domain-analysis-engineering-v0.1';
const V4 = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.4';
const V9 = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.9';
const V10 = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.10';
const V11 = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.11';

// Verified from vendored control-theory-engineering-v0.10 projections under
// m1m-v2n-release-tier-preserving public profile reconstruction.
const V10_PROJECTION_DIGESTS = {
  runtime: 'f2270fd9ce9b4db55769cf53174ccdae70c57c3847984a372c809ba2c9607b30',
  domain: '1a3dd4f4c25180aa874c37aebcbd8af054f0ef32594e2581938e4a918f8c2db9',
  review: '50a7d07619d2334345931e324a7826ad2d79ee8524a372b7ad47d229779996fd',
} as const;

// Verified from vendored control-theory-engineering-v0.11 projections under
// m1n-v1l-release-tier-preserving public profile reconstruction.
const V11_PROJECTION_DIGESTS = {
  runtime: '1ff0966c76d21e9961d828485849a4921a037b81144b4448c4fa6ece4f7d6de3',
  domain: '98ece18efeea479dd25288f67e6b6be8381a8d3856e2a6b748b66c8b207f1019',
  review: 'dcb32b9d914433679578a34ddcfe039e0d1edcd23f8c3b8e2d7544dfe567befc',
} as const;

describe('ActKG canonical digests (validation.py / public_bundle.py)', () => {
  it('recomputes the vendored r2 Release self-hash', async () => {
    const release = JSON.parse(
      await readFile(path.join(root, R2, 'control-theory-engineering-v0.3.release.json'), 'utf8'),
    ) as JsonObject;
    expect(computeCanonicalReleaseHash(release)).toBe(String(release.release_hash));
  });

  it('recomputes vendored r2 projection version_digest values with public profile reconstruction', async () => {
    const cases: Array<{ file: string; profile: string }> = [
      { file: 'control-theory-engineering-v0.3.act-projection.json', profile: 'runtime' },
      { file: 'control-theory-engineering-v0.3.domain-projection.json', profile: 'domain' },
      { file: 'control-theory-engineering-v0.3.review-projection.json', profile: 'review' },
    ];
    for (const entry of cases) {
      const projection = JSON.parse(
        await readFile(path.join(root, R2, entry.file), 'utf8'),
      ) as JsonObject;
      expect(computeProjectionVersionDigest(projection, null, entry.profile)).toBe(
        String(projection.version_digest),
      );
    }
  });

  it('recomputes vendored v3E projection digests with their registered aggregation policies', async () => {
    const cases: Array<{
      directory: string;
      file: string;
      profile: string;
      aggregationPolicy: string;
    }> = [
      {
        directory: V4,
        file: 'act-projection.json',
        profile: 'runtime',
        aggregationPolicy: 'm1f-v1t-release-tier-preserving',
      },
      {
        directory: V3E_MODULE,
        file: 'act-projection.json',
        profile: 'runtime',
        aggregationPolicy: 'm1f-v3e-release-tier-preserving',
      },
    ];
    for (const entry of cases) {
      const projection = JSON.parse(
        await readFile(path.join(root, entry.directory, entry.file), 'utf8'),
      ) as JsonObject;
      expect(
        computeProjectionVersionDigest(
          projection,
          null,
          entry.profile,
          entry.aggregationPolicy,
        ),
      ).toBe(String(projection.version_digest));
      expect(
        computeProjectionVersionDigest(
          projection,
          null,
          entry.profile,
          'm1e-v1b-release-tier-preserving',
        ),
      ).not.toBe(String(projection.version_digest));
    }
  });

  it('matches the authoritative M1I profile reconstruction and rejects a prior policy', () => {
    const projection: JsonObject = {
      projection_profile: 'ctr:profile:control-theory-engineering-v0.7:act-v2',
      source_release: 'ctr:release:control-theory-engineering-v0.7',
      source_release_hash: 'e46f854d7a05fd4ec840c5eaff69288e7ce34cb2119da501913cbf457ce91f8e',
      source_dataset_hash: '21e957c750c29efaae3b7ec5d70f8155cc33221dae5faec24f3fda1d59c4f31c',
      nodes: [{ id: 'ctc:test' }],
      links: [],
      hidden_entities: [],
    };

    expect(
      computeProjectionVersionDigest(
        projection,
        null,
        'runtime',
        'm1i-v1e-release-tier-preserving',
      ),
    ).toBe('1b7df5ec9857489ed955695c82cddf209199c8441cc9e48a5ff0e11c1b19c7ed');
    expect(
      computeProjectionVersionDigest(
        projection,
        null,
        'runtime',
        'm1g-v1e-release-tier-preserving',
      ),
    ).not.toBe('1b7df5ec9857489ed955695c82cddf209199c8441cc9e48a5ff0e11c1b19c7ed');
  });

  it('recomputes all vendored v0.9 projection digests with the registered M1L policy', async () => {
    const aggregationPolicy = 'm1l-v1s-release-tier-preserving';
    expect(PROJECTION_AGGREGATION_POLICIES).toContain(aggregationPolicy);
    const cases: Array<{ file: string; profile: string; expectedDigest: string }> = [
      {
        file: 'act-projection.json',
        profile: 'runtime',
        expectedDigest: 'e691104ef37e5ec3f46d2a2857cb176ad4248feb6c9c4e95ce409619acff2117',
      },
      {
        file: 'domain-projection.json',
        profile: 'domain',
        expectedDigest: 'a003a637a431b6735c94c38814bc888a36ffdb81ad431f948c0e9b209a952840',
      },
      {
        file: 'review-projection.json',
        profile: 'review',
        expectedDigest: 'eccc55a7d9b641ecba5c7ea0f2ab6022ebd364911867bce22961782e86016e8c',
      },
    ];
    for (const entry of cases) {
      const projection = JSON.parse(
        await readFile(path.join(root, V9, entry.file), 'utf8'),
      ) as JsonObject;
      expect(projection.version_digest).toBe(entry.expectedDigest);
      expect(
        computeProjectionVersionDigest(
          projection,
          null,
          entry.profile,
          aggregationPolicy,
        ),
      ).toBe(entry.expectedDigest);
    }
  });

  it('recomputes vendored v0.10 projection digests with m1m-v2n policy and rejects prior policy', async () => {
    expect(PROJECTION_AGGREGATION_POLICIES).toContain('m1m-v2n-release-tier-preserving');
    const cases: Array<{
      file: string;
      profile: 'runtime' | 'domain' | 'review';
      expectedDigest: string;
    }> = [
      {
        file: 'act-projection.json',
        profile: 'runtime',
        expectedDigest: V10_PROJECTION_DIGESTS.runtime,
      },
      {
        file: 'domain-projection.json',
        profile: 'domain',
        expectedDigest: V10_PROJECTION_DIGESTS.domain,
      },
      {
        file: 'review-projection.json',
        profile: 'review',
        expectedDigest: V10_PROJECTION_DIGESTS.review,
      },
    ];
    for (const entry of cases) {
      const projection = JSON.parse(
        await readFile(path.join(root, V10, entry.file), 'utf8'),
      ) as JsonObject;
      // Pin expected digests to the vendored payload values, not only recomputation.
      expect(String(projection.version_digest)).toBe(entry.expectedDigest);
      expect(
        computeProjectionVersionDigest(
          projection,
          null,
          entry.profile,
          'm1m-v2n-release-tier-preserving',
        ),
      ).toBe(entry.expectedDigest);
      expect(
        computeProjectionVersionDigest(
          projection,
          null,
          entry.profile,
          'm1k-v1d-release-tier-preserving',
        ),
      ).not.toBe(entry.expectedDigest);
    }
  });

  it('recomputes vendored v0.11 projection digests with m1n-v1l policy and rejects prior policy', async () => {
    expect(PROJECTION_AGGREGATION_POLICIES).toContain('m1n-v1l-release-tier-preserving');
    const cases: Array<{
      file: string;
      profile: 'runtime' | 'domain' | 'review';
      expectedDigest: string;
    }> = [
      {
        file: 'act-projection.json',
        profile: 'runtime',
        expectedDigest: V11_PROJECTION_DIGESTS.runtime,
      },
      {
        file: 'domain-projection.json',
        profile: 'domain',
        expectedDigest: V11_PROJECTION_DIGESTS.domain,
      },
      {
        file: 'review-projection.json',
        profile: 'review',
        expectedDigest: V11_PROJECTION_DIGESTS.review,
      },
    ];
    for (const entry of cases) {
      const projection = JSON.parse(
        await readFile(path.join(root, V11, entry.file), 'utf8'),
      ) as JsonObject;
      expect(String(projection.version_digest)).toBe(entry.expectedDigest);
      expect(
        computeProjectionVersionDigest(
          projection,
          null,
          entry.profile,
          'm1n-v1l-release-tier-preserving',
        ),
      ).toBe(entry.expectedDigest);
      expect(
        computeProjectionVersionDigest(
          projection,
          null,
          entry.profile,
          'm1m-v2n-release-tier-preserving',
        ),
      ).not.toBe(entry.expectedDigest);
    }
  });

  it('changes projection version_digest when nodes, links, or hidden_entities change', async () => {
    const projection = JSON.parse(
      await readFile(
        path.join(root, R2, 'control-theory-engineering-v0.3.act-projection.json'),
        'utf8',
      ),
    ) as JsonObject;
    const base = computeProjectionVersionDigest(projection, null, 'runtime');

    const nodesChanged = structuredClone(projection);
    const nodes = nodesChanged.nodes as JsonObject[];
    nodes[0] = { ...nodes[0]!, display_name: 'tampered' };
    expect(computeProjectionVersionDigest(nodesChanged, null, 'runtime')).not.toBe(base);

    const linksChanged = structuredClone(projection);
    linksChanged.links = (linksChanged.links as JsonObject[]).slice(0, -1);
    expect(computeProjectionVersionDigest(linksChanged, null, 'runtime')).not.toBe(base);

    const hiddenChanged = structuredClone(projection);
    hiddenChanged.hidden_entities = ['ctc:hidden'];
    expect(computeProjectionVersionDigest(hiddenChanged, null, 'runtime')).not.toBe(base);
  });
});
