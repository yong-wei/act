/**
 * Isolated unit tests for resolveTrustedCaptureRevision.
 *
 * Uses temporary real Git repositories so clean / dirty / forged-SHA behavior is
 * proven without exposing a runner injection seam on public loaders or routers.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PUBLIC_BUNDLE_ADAPTER_CAPTURE_PATHS,
  PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS,
  resolveTrustedCaptureRevision,
} from '../../../scripts/actkg-release/capture-revision';

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

async function createTempGitRepo(files: Record<string, string>): Promise<{
  dir: string;
  head: string;
  trackedPaths: string[];
}> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'actkg-capture-'));
  const trackedPaths = Object.keys(files).sort();
  for (const [relative, content] of Object.entries(files)) {
    const absolute = path.join(dir, relative);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content, 'utf8');
  }
  git(dir, ['init']);
  git(dir, ['config', 'user.email', 'capture-test@example.com']);
  git(dir, ['config', 'user.name', 'capture-test']);
  // Stable hashes across git versions for tests that only need a real HEAD.
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'init capture fixture']);
  const head = git(dir, ['rev-parse', 'HEAD']);
  expect(head).toMatch(/^[0-9a-f]{40}$/u);
  return { dir, head, trackedPaths };
}

function failWith(message: string): never {
  throw new Error(message);
}

describe('resolveTrustedCaptureRevision (isolated temp Git)', () => {
  it('accepts a clean repository HEAD and optional matching expected revision', async () => {
    const { dir, head, trackedPaths } = await createTempGitRepo({
      'adapter.ts': 'export const ok = true;\n',
      'package/lock.json': '{"lock":1}\n',
    });

    const resolved = resolveTrustedCaptureRevision({
      gitRoot: dir,
      trackedPaths,
      fail: failWith,
    });
    expect(resolved).toBe(head);

    const withExpected = resolveTrustedCaptureRevision({
      gitRoot: dir,
      trackedPaths,
      expectedCaptureRevision: head,
      fail: failWith,
    });
    expect(withExpected).toBe(head);
  });

  it('rejects dirty protected inputs even when expectedCaptureRevision equals real HEAD', async () => {
    const { dir, head, trackedPaths } = await createTempGitRepo({
      'adapter.ts': 'export const ok = true;\n',
      'package/lock.json': '{"lock":1}\n',
    });
    await writeFile(path.join(dir, 'adapter.ts'), 'export const ok = false;\n', 'utf8');

    expect(() => resolveTrustedCaptureRevision({
      gitRoot: dir,
      trackedPaths,
      expectedCaptureRevision: head,
      fail: failWith,
    })).toThrow(/clean protected Git inputs/u);
  });

  it('rejects untracked protected inputs', async () => {
    const { dir, head } = await createTempGitRepo({
      'adapter.ts': 'export const ok = true;\n',
    });
    await writeFile(path.join(dir, 'secret.env'), 'TOKEN=1\n', 'utf8');

    expect(() => resolveTrustedCaptureRevision({
      gitRoot: dir,
      trackedPaths: ['adapter.ts', 'secret.env'],
      expectedCaptureRevision: head,
      fail: failWith,
    })).toThrow(/same Git HEAD|clean protected Git inputs/u);
  });

  it('rejects forged 40-hex expectedCaptureRevision after clean checks', async () => {
    const { dir, trackedPaths } = await createTempGitRepo({
      'adapter.ts': 'export const ok = true;\n',
    });

    expect(() => resolveTrustedCaptureRevision({
      gitRoot: dir,
      trackedPaths,
      expectedCaptureRevision: 'a'.repeat(40),
      fail: failWith,
    })).toThrow(/expected captureRevision must equal the current Git HEAD/u);
  });

  it('rejects invalid expectedCaptureRevision format before Git state matters', async () => {
    const { dir, trackedPaths } = await createTempGitRepo({
      'adapter.ts': 'export const ok = true;\n',
    });

    expect(() => resolveTrustedCaptureRevision({
      gitRoot: dir,
      trackedPaths,
      expectedCaptureRevision: 'not-a-git-revision',
      fail: failWith,
    })).toThrow(/invalid/u);
  });

  it('binds authoritative-release.ts and rejects staged/unstaged drift on that shared digest module', async () => {
    // public-bundle-v1 imports canonicalJson/sha256 from authoritative-release.ts;
    // capture must fail closed when that shared implementation drifts.
    expect(PUBLIC_BUNDLE_ADAPTER_CAPTURE_PATHS).toContain(
      'scripts/actkg-release/authoritative-release.ts',
    );
    expect(PUBLIC_BUNDLE_ADAPTER_CAPTURE_PATHS).not.toContain(
      'scripts/actkg-release/public-bundle-v2.ts',
    );
    expect(PUBLIC_BUNDLE_ADAPTER_CAPTURE_PATHS).not.toContain(
      'scripts/actkg-release/bundle-compatibility-registry-v2.ts',
    );
    expect(PUBLIC_BUNDLE_ADAPTER_CAPTURE_PATHS).not.toContain(
      'scripts/actkg-release/schemas/public-bundle-v2',
    );
    expect(PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS).toContain(
      'scripts/actkg-release/public-bundle-v2.ts',
    );
    expect(PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS).toContain(
      'scripts/actkg-release/bundle-compatibility-registry-v2.ts',
    );
    expect(PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS).toContain(
      'scripts/actkg-release/schemas/public-bundle-v2',
    );

    const sharedDigestPath = 'scripts/actkg-release/authoritative-release.ts';
    const { dir, head, trackedPaths } = await createTempGitRepo({
      'scripts/actkg-release/public-bundle-v1.ts': 'export const loader = true;\n',
      [sharedDigestPath]: 'export function sha256() { return "clean"; }\n',
      'scripts/actkg-release/capture-revision.ts': 'export const capture = true;\n',
    });

    // Unstaged drift on the shared digest module is rejected.
    await writeFile(
      path.join(dir, sharedDigestPath),
      'export function sha256() { return "unstaged-drift"; }\n',
      'utf8',
    );
    expect(() => resolveTrustedCaptureRevision({
      gitRoot: dir,
      trackedPaths,
      expectedCaptureRevision: head,
      fail: failWith,
    })).toThrow(/clean protected Git inputs/u);

    // Staged-but-uncommitted drift is also rejected (still not clean HEAD inputs).
    git(dir, ['add', '--', sharedDigestPath]);
    expect(() => resolveTrustedCaptureRevision({
      gitRoot: dir,
      trackedPaths,
      expectedCaptureRevision: head,
      fail: failWith,
    })).toThrow(/clean protected Git inputs/u);
  });
});
