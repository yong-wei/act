import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  assertCanonicalResourceBindingCaptureRevisionUnchanged,
  CANONICAL_RESOURCE_BINDING_CAPTURE_PATHS,
  resolveCanonicalResourceBindingCaptureRevision,
} from '@/lib/canonical-resource-binding/capture-revision';

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  expect(result.status, result.stderr || result.stdout).toBe(0);
  return result.stdout.trim();
}

function write(root: string, relativePath: string, content = `${relativePath}\n`): void {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function createGitFixture(options?: { omit?: string }): { root: string; head: string } {
  const root = mkdtempSync(path.join(os.tmpdir(), 'binding-capture-git-'));
  git(root, 'init', '--quiet');
  git(root, 'config', 'user.email', 'capture@example.test');
  git(root, 'config', 'user.name', 'Capture Fixture');
  for (const capturePath of CANONICAL_RESOURCE_BINDING_CAPTURE_PATHS) {
    if (capturePath === options?.omit) continue;
    if (capturePath === 'src/lib/canonical-resource-binding') {
      write(root, `${capturePath}/fixture.ts`);
    } else {
      write(root, capturePath);
    }
  }
  write(root, 'unrelated.txt');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'fixture');
  return { root, head: git(root, 'rev-parse', 'HEAD') };
}

describe('resolveCanonicalResourceBindingCaptureRevision', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it('returns clean Git HEAD and accepts matching environment and revision file', async () => {
    const fixture = createGitFixture();
    roots.push(fixture.root);
    write(fixture.root, '.app-revision', `${fixture.head}\n`);

    await expect(resolveCanonicalResourceBindingCaptureRevision({
      cwd: fixture.root,
      env: {
        APP_REVISION: fixture.head,
        APP_REVISION_FILE: '.app-revision',
      },
    })).resolves.toBe(fixture.head);
  });

  it('rejects environment or revision-file values that do not match Git HEAD', async () => {
    const fixture = createGitFixture();
    roots.push(fixture.root);

    await expect(resolveCanonicalResourceBindingCaptureRevision({
      cwd: fixture.root,
      env: { APP_REVISION: 'a'.repeat(40) },
    })).rejects.toThrow('APP_REVISION does not match Git HEAD');

    write(fixture.root, '.app-revision', `${'b'.repeat(40)}\n`);
    await expect(resolveCanonicalResourceBindingCaptureRevision({
      cwd: fixture.root,
      env: { APP_REVISION_FILE: '.app-revision' },
    })).rejects.toThrow('APP_REVISION_FILE does not match Git HEAD');
  });

  it('rejects modified tracked governance inputs', async () => {
    const fixture = createGitFixture();
    roots.push(fixture.root);
    write(fixture.root, 'src/lib/resource-registry-metadata.ts', 'modified\n');

    await expect(resolveCanonicalResourceBindingCaptureRevision({
      cwd: fixture.root,
      env: {},
    })).rejects.toThrow('canonical resource binding capture inputs are dirty');
  });

  it('rejects untracked files inside governed implementation paths', async () => {
    const fixture = createGitFixture();
    roots.push(fixture.root);
    write(fixture.root, 'src/lib/canonical-resource-binding/untracked.ts');

    await expect(resolveCanonicalResourceBindingCaptureRevision({
      cwd: fixture.root,
      env: {},
    })).rejects.toThrow('canonical resource binding capture inputs are dirty');
  });

  it('allows unrelated tracked and untracked worktree changes', async () => {
    const fixture = createGitFixture();
    roots.push(fixture.root);
    write(fixture.root, 'unrelated.txt', 'modified\n');
    write(fixture.root, 'outside-governance.txt');

    await expect(resolveCanonicalResourceBindingCaptureRevision({
      cwd: fixture.root,
      env: {},
    })).resolves.toBe(fixture.head);
  });

  it('rejects a Git checkout whose required governance sources are not tracked', async () => {
    const fixture = createGitFixture({
      omit: 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
    });
    roots.push(fixture.root);

    await expect(resolveCanonicalResourceBindingCaptureRevision({
      cwd: fixture.root,
      env: {},
    })).rejects.toThrow('canonical resource binding capture inputs must be tracked by Git');
  });

  it('rejects environment-only revision identity outside Git', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'binding-capture-runtime-'));
    roots.push(root);

    await expect(resolveCanonicalResourceBindingCaptureRevision({
      cwd: root,
      env: { APP_REVISION: 'c'.repeat(40) },
    })).rejects.toThrow('APP_REVISION_FILE');
  });

  it('accepts a valid revision file outside Git', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'binding-capture-runtime-'));
    roots.push(root);
    const revision = 'd'.repeat(40);
    write(root, '.app-revision', `${revision}\n`);

    await expect(resolveCanonicalResourceBindingCaptureRevision({
      cwd: root,
      env: {},
    })).resolves.toBe(revision);
  });

  it('falls back to .app-revision when Git is unavailable on PATH', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'binding-capture-runtime-'));
    roots.push(root);
    const revision = '1'.repeat(40);
    write(root, '.app-revision', `${revision}\n`);
    const previousPath = process.env.PATH;
    process.env.PATH = path.join(root, 'without-git');

    try {
      await expect(resolveCanonicalResourceBindingCaptureRevision({
        cwd: root,
        env: { APP_REVISION: revision },
      })).resolves.toBe(revision);
    } finally {
      process.env.PATH = previousPath;
    }
  });

  it('accepts an explicit non-Git revision path only when it resolves to cwd/.app-revision', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'binding-capture-runtime-'));
    roots.push(root);
    const revision = 'd'.repeat(40);
    write(root, '.app-revision', `${revision}\n`);

    await expect(resolveCanonicalResourceBindingCaptureRevision({
      cwd: root,
      env: { APP_REVISION_FILE: path.join(root, '.app-revision') },
    })).resolves.toBe(revision);
  });

  it('rejects a custom non-Git revision file even when it contains a valid commit shape', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'binding-capture-runtime-'));
    roots.push(root);
    write(root, 'forged-revision', `${'d'.repeat(40)}\n`);

    await expect(resolveCanonicalResourceBindingCaptureRevision({
      cwd: root,
      env: { APP_REVISION_FILE: path.join(root, 'forged-revision') },
    })).rejects.toThrow('APP_REVISION_FILE must resolve to cwd/.app-revision');
  });

  it('rejects environment and revision-file mismatch outside Git', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'binding-capture-runtime-'));
    roots.push(root);
    write(root, '.app-revision', `${'e'.repeat(40)}\n`);

    await expect(resolveCanonicalResourceBindingCaptureRevision({
      cwd: root,
      env: { APP_REVISION: 'f'.repeat(40) },
    })).rejects.toThrow('APP_REVISION does not match the immutable image revision file');
  });

  it('rejects governed input dirtied after the initial capture check', async () => {
    const fixture = createGitFixture();
    roots.push(fixture.root);
    const initialRevision = await resolveCanonicalResourceBindingCaptureRevision({
      cwd: fixture.root,
      env: {},
    });
    write(fixture.root, 'src/lib/resource-registry-metadata.ts', 'changed after read\n');

    await expect(assertCanonicalResourceBindingCaptureRevisionUnchanged(
      initialRevision,
      { cwd: fixture.root, env: {} },
    )).rejects.toThrow('canonical resource binding capture inputs are dirty');
  });

  it('rejects HEAD drift after the initial capture check', async () => {
    const fixture = createGitFixture();
    roots.push(fixture.root);
    const initialRevision = await resolveCanonicalResourceBindingCaptureRevision({
      cwd: fixture.root,
      env: {},
    });
    write(fixture.root, 'unrelated.txt', 'new committed revision\n');
    git(fixture.root, 'add', 'unrelated.txt');
    git(fixture.root, 'commit', '--quiet', '-m', 'advance head');

    await expect(assertCanonicalResourceBindingCaptureRevisionUnchanged(
      initialRevision,
      { cwd: fixture.root, env: {} },
    )).rejects.toThrow('capture revision changed during inventory construction');
  });
});
