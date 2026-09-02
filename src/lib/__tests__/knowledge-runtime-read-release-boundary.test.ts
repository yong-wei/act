import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  canonicalJson,
  computeCanonicalReleaseHash,
  sha256,
} from '@/lib/authoritative-knowledge/canonical-json';
import { computeCanonicalReleaseHash as toolComputeCanonicalReleaseHash } from '../../../scripts/actkg-release/actkg-canonical-digests';
import { canonicalJson as toolCanonicalJson, sha256 as toolSha256 } from '../../../scripts/actkg-release/authoritative-release';

const repoRoot = process.cwd();
const RELEASE_RELATIVE =
  'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2/control-theory-engineering-v0.3.release.json';
const TOOL_IMPORT = /from ['"][^'"]*scripts\/(?:actkg-release|knowledge-cutover)[^'"]*['"]/;

function listSourceFiles(relativeDir: string): string[] {
  const absolute = path.join(repoRoot, relativeDir);
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      const next = path.join(dir, entry);
      const stat = statSync(next);
      if (stat.isDirectory()) {
        walk(next);
        continue;
      }
      if (/\.(?:test|spec)\.(?:ts|tsx)$/.test(entry)) continue;
      if (/\.(?:ts|tsx)$/.test(entry)) out.push(next);
    }
  };
  walk(absolute);
  return out;
}

describe('knowledge runtime read / release-tool boundary', () => {
  it('keeps product runtime readers off release and cutover writers', () => {
    const files = [
      ...listSourceFiles('src/app'),
      ...listSourceFiles('src/features'),
      ...listSourceFiles('src/lib'),
    ];
    const offenders = files.filter((file) => TOOL_IMPORT.test(readFileSync(file, 'utf8')));
    expect(offenders.map((file) => path.relative(repoRoot, file))).toEqual([]);
    expect(readFileSync(path.join(repoRoot, 'src/lib/authoritative-knowledge/repository.ts'), 'utf8'))
      .toContain("from './canonical-json'");
    expect(readFileSync(path.join(repoRoot, 'src/lib/actkg-v022-display-projections/envelope.ts'), 'utf8'))
      .toContain("from '@/lib/authoritative-knowledge/canonical-json'");
    expect(readFileSync(path.join(repoRoot, 'src/lib/teaching-projection/textbook-locators/inventory.ts'), 'utf8'))
      .toContain("from '@/lib/authoritative-knowledge/canonical-json'");
  });

  it('recomputes a vendored ActKG release self-hash through the read surface', () => {
    const release = JSON.parse(readFileSync(path.join(repoRoot, RELEASE_RELATIVE), 'utf8')) as Record<string, unknown>;
    const fromRead = computeCanonicalReleaseHash(release);
    expect(fromRead).toBe(String(release.release_hash));
    expect(fromRead).toBe(toolComputeCanonicalReleaseHash(release));
    expect(canonicalJson({ b: 1, a: 2 })).toBe(toolCanonicalJson({ b: 1, a: 2 }));
    expect(sha256('actkg-read')).toBe(toolSha256('actkg-read'));
  });

  it('fails closed when a hashed payload is tampered', () => {
    const release = JSON.parse(readFileSync(path.join(repoRoot, RELEASE_RELATIVE), 'utf8')) as Record<string, unknown>;
    const sealed = String(release.release_hash);
    const drifted = { ...release, release_status: 'tampered' };
    expect(computeCanonicalReleaseHash(drifted)).not.toBe(sealed);
  });
});
