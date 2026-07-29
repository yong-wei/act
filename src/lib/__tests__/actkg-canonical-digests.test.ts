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
import type { JsonObject } from '../../../scripts/actkg-release/public-bundle-types';

const root = process.cwd();
const R2 = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2';

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
