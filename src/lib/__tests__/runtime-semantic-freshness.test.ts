import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  canonicalLocatorDigest,
  sanitizedGitEnvironment,
  semanticDigestPair,
  semanticFreshnessReasons,
} from '../../../scripts/db/runtime-semantic-freshness';

function rawDigest(content: Buffer): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, env: sanitizedGitEnvironment(), stdio: 'pipe' });
}

describe('runtime semantic freshness', () => {
  it('ignores unrelated JSON records and object field order for a pointer digest', () => {
    const before = Buffer.from(JSON.stringify({ steps: { a: { title: 'A', modules: [1, 2] }, b: { title: 'B' } } }));
    const after = Buffer.from(JSON.stringify({ unrelated: true, steps: { b: { title: 'changed' }, a: { modules: [1, 2], title: 'A' } } }));

    expect(canonicalLocatorDigest(after, 'json-pointer:/steps/a')).toBe(
      canonicalLocatorDigest(before, 'json-pointer:/steps/a'),
    );
  });

  it('changes only when the located semantic value changes', () => {
    const before = Buffer.from('{"steps":{"a":{"title":"A"}}}');
    const after = Buffer.from('{"steps":{"a":{"title":"B"}}}');

    expect(canonicalLocatorDigest(after, 'json-pointer:/steps/a')).not.toBe(
      canonicalLocatorDigest(before, 'json-pointer:/steps/a'),
    );
  });

  it('uses the selected Markdown line instead of the whole evidence file', () => {
    const before = Buffer.from('# Stable heading\nold body\n');
    const after = Buffer.from('# Stable heading\nnew body\n');

    expect(canonicalLocatorDigest(after, 'markdown-line:1')).toBe(
      canonicalLocatorDigest(before, 'markdown-line:1'),
    );
  });

  it('digests actual file bytes for file-sha256 selectors', () => {
    const selector = `file-sha256:${'a'.repeat(64)}`;
    const text = Buffer.from('same selector, text content');
    const binary = Buffer.from([0, 255, 1, 2, 3]);

    expect(canonicalLocatorDigest(text, selector)).toBe(rawDigest(text));
    expect(canonicalLocatorDigest(binary, selector)).toBe(rawDigest(binary));
    expect(canonicalLocatorDigest(text, selector)).not.toBe(canonicalLocatorDigest(binary, selector));
  });

  it('recovers the reviewed blob from git history and marks changed pointer content pending', async () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'runtime-semantic-freshness-'));
    const relativePath = 'course-content/runtime/lessons/4-2/fixture.json';
    try {
      git(repo, 'init', '-q');
      git(repo, 'config', 'user.name', 'Freshness Test');
      git(repo, 'config', 'user.email', 'freshness@example.invalid');
      mkdirSync(path.dirname(path.join(repo, relativePath)), { recursive: true });
      const reviewed = Buffer.from('{"steps":{"cover-comic":{"title":"reviewed"}}}\n');
      writeFileSync(path.join(repo, relativePath), reviewed);
      git(repo, 'add', relativePath);
      git(repo, 'commit', '-qm', 'reviewed baseline');
      writeFileSync(path.join(repo, relativePath), '{"steps":{"cover-comic":{"title":"changed"}}}\n');
      git(repo, 'add', relativePath);
      git(repo, 'commit', '-qm', 'current head');

      const pair = await semanticDigestPair(
        repo,
        relativePath,
        'json-pointer:/steps/cover-comic',
        rawDigest(reviewed),
      );
      const reasons = semanticFreshnessReasons('manifest', pair);

      expect(pair.baselineStatus).toBe('available');
      expect(pair.reviewed).not.toBe(pair.current);
      expect(reasons).toEqual(['manifest-semantic-changed']);
      expect(reasons.length > 0 ? 'pending-rereview' : 'human-confirmed').toBe('pending-rereview');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('fails closed when the reviewed hash is absent even when current equals HEAD', async () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'runtime-semantic-freshness-'));
    const relativePath = 'fixture.json';
    const inheritedGit = {
      GIT_DIR: process.env.GIT_DIR,
      GIT_WORK_TREE: process.env.GIT_WORK_TREE,
      GIT_INDEX_FILE: process.env.GIT_INDEX_FILE,
      GIT_COMMON_DIR: process.env.GIT_COMMON_DIR,
    };
    try {
      git(repo, 'init', '-q');
      git(repo, 'config', 'user.name', 'Freshness Test');
      git(repo, 'config', 'user.email', 'freshness@example.invalid');
      writeFileSync(path.join(repo, relativePath), '{"steps":{"cover-comic":{"title":"current"}}}\n');
      git(repo, 'add', relativePath);
      git(repo, 'commit', '-qm', 'current head');
      process.env.GIT_DIR = '/invalid/inherited/git-dir';
      process.env.GIT_WORK_TREE = '/invalid/inherited/work-tree';
      process.env.GIT_INDEX_FILE = '/invalid/inherited/index';
      process.env.GIT_COMMON_DIR = '/invalid/inherited/common-dir';

      const pair = await semanticDigestPair(
        repo,
        relativePath,
        'json-pointer:/steps/cover-comic',
        `sha256:${'0'.repeat(64)}`,
      );
      const reasons = semanticFreshnessReasons('manifest', pair);

      expect(pair.current).not.toBeNull();
      expect(pair.reviewed).toBeNull();
      expect(pair.baselineStatus).toBe('unavailable');
      expect(reasons).toEqual(['manifest-semantic-baseline-unavailable']);
      expect(reasons.length > 0 ? 'pending-rereview' : 'human-confirmed').toBe('pending-rereview');
    } finally {
      for (const [key, value] of Object.entries(inheritedGit)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
