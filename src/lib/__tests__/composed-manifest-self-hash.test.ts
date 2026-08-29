/**
 * Composed-manifest identity must be recomputed from the sealed body.
 * Qualification and production preflight must not trust digest fields.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertComposedManifestSelfConsistent,
  type DomainTeachingComposedManifest,
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
});
