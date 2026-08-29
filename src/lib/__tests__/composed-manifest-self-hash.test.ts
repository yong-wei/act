/**
 * Composed-manifest identity must be recomputed from the sealed body.
 * Qualification and production preflight must not trust digest fields.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertComposedManifestFragmentsReopened,
  assertComposedManifestSelfConsistent,
  type DomainTeachingComposedManifest,
  type DomainTeachingFragment,
} from '../teaching-projection';

const MANIFEST_PATH = path.resolve(
  process.cwd(),
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/composed-manifest.json',
);

function loadManifest(): DomainTeachingComposedManifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as DomainTeachingComposedManifest;
}

describe('composed-manifest self-hash', () => {
  it('accepts the sealed authoring composed-manifest', () => {
    expect(() => assertComposedManifestSelfConsistent(loadManifest())).not.toThrow();
  });

  it('rejects a body mutation that keeps self-asserted digest fields', () => {
    const manifest = loadManifest();
    expect(() =>
      assertComposedManifestSelfConsistent({
        ...manifest,
        gatePassed: !manifest.gatePassed,
      }),
    ).toThrow(/does not match its recomputed identity/);
  });

  it('reopens the referenced first fragment and rejects a forged fragment body', () => {
    const manifest = loadManifest();
    const fragment = JSON.parse(
      readFileSync(
        path.resolve(
          process.cwd(),
          'course-content/authoring/knowledge/teaching-projection/domain-fragments/first-fragment.json',
        ),
        'utf8',
      ),
    ) as DomainTeachingFragment;
    expect(() => assertComposedManifestFragmentsReopened(manifest, [fragment])).not.toThrow();
    expect(() =>
      assertComposedManifestFragmentsReopened(manifest, [{
        ...fragment,
        coreNodeCount: fragment.coreNodeCount + 1,
      }]),
    ).toThrow(/coreNodeCount|count-mismatch/);
  });
});
