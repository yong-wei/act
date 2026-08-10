import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  materializeCaptureBoundInputs,
  resolveCaptureBoundInputs,
} from '../knowledge-cutover/capture-bound-inputs';

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function fixture(): { root: string; revision: string; cleanup: () => void } {
  const root = mkdtempSync(path.join(tmpdir(), 'act-capture-bound-test-'));
  mkdirSync(path.join(root, 'inputs', 'course'), { recursive: true });
  writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({
    contract: 'act-actkg-capture-bound-input-manifest/v1',
    schemaVersion: 1,
    captureRevision: null,
    files: [{ path: 'inputs/author-decision.json' }],
    collections: [{ id: 'course-inputs', root: 'inputs', prefixes: ['course'] }],
    inventorySelection: {
      registryPath: 'inputs/registry.json',
      packages: [{
        packageId: 'fixture',
        scopeId: 'course-package:fixture',
        routeSegment: 'fixture',
        runtimeLessonDir: 'fixture',
        lessonKey: 'fixture',
      }],
    },
  }, null, 2));
  writeFileSync(path.join(root, 'inputs/author-decision.json'), '{"canonicalId":"node-a"}\n');
  writeFileSync(path.join(root, 'inputs/registry.json'), '{"packages":["fixture"]}\n');
  writeFileSync(path.join(root, 'inputs/course/course.json'), '{"lesson":"fixture"}\n');
  writeFileSync(path.join(root, 'unrelated.txt'), 'outside capture\n');
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'capture-test@example.invalid']);
  git(root, ['config', 'user.name', 'Capture Test']);
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'fixture']);
  const revision = git(root, ['rev-parse', 'HEAD']);
  return { root, revision, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

describe('capture-bound ACT inputs', () => {
  it('freezes Git bytes, rejects semantic dirty edits, and ignores unrelated dirty files', () => {
    const f = fixture();
    try {
      const capture = materializeCaptureBoundInputs({
        repoRoot: f.root,
        captureRevision: f.revision,
        manifestPath: 'manifest.json',
      });
      writeFileSync(path.join(f.root, 'inputs/author-decision.json'), '{"canonicalId":"node-b"}\n');
      expect(() => resolveCaptureBoundInputs({
        repoRoot: f.root,
        captureRevision: f.revision,
        manifestPath: 'manifest.json',
      })).toThrow(/differs from captureRevision/);
      expect(readFileSync(path.join(capture.snapshotRoot, 'inputs/author-decision.json'), 'utf8'))
        .toContain('node-a');
      capture.cleanup();
    } finally {
      f.cleanup();
    }
  });

  it('rejects collection additions, deletions, and renames before any output write', () => {
    const cases = [
      (root: string) => writeFileSync(path.join(root, 'inputs/course/added.json'), '{}'),
      (root: string) => rmSync(path.join(root, 'inputs/course/course.json')),
      (root: string) => {
        rmSync(path.join(root, 'inputs/course/course.json'));
        writeFileSync(path.join(root, 'inputs/course/course-renamed.json'), '{}');
      },
    ];
    for (const mutate of cases) {
      const f = fixture();
      try {
        mutate(f.root);
        const output = path.join(f.root, 'pointer.json');
        expect(() => resolveCaptureBoundInputs({
          repoRoot: f.root,
          captureRevision: f.revision,
          manifestPath: 'manifest.json',
        })).toThrow(/collection|missing/);
        expect(existsSync(output)).toBe(false);
      } finally {
        f.cleanup();
      }
    }
  });

  it('rejects mode, symlink, missing blob, and path escape violations', () => {
    const modeFixture = fixture();
    try {
      chmodSync(path.join(modeFixture.root, 'inputs/author-decision.json'), 0o755);
      expect(() => resolveCaptureBoundInputs({
        repoRoot: modeFixture.root,
        captureRevision: modeFixture.revision,
        manifestPath: 'manifest.json',
      })).toThrow(/mode/);
    } finally {
      modeFixture.cleanup();
    }

    const symlinkFixture = fixture();
    try {
      rmSync(path.join(symlinkFixture.root, 'inputs/author-decision.json'));
      symlinkSync(path.join(symlinkFixture.root, 'inputs/registry.json'), path.join(symlinkFixture.root, 'inputs/author-decision.json'));
      expect(() => resolveCaptureBoundInputs({
        repoRoot: symlinkFixture.root,
        captureRevision: symlinkFixture.revision,
        manifestPath: 'manifest.json',
      })).toThrow(/symlink/);
    } finally {
      symlinkFixture.cleanup();
    }

    const missingFixture = fixture();
    try {
      const manifestPath = path.join(missingFixture.root, 'manifest.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
      manifest.files = [...(manifest.files as unknown[]), { path: 'inputs/missing.json' }];
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      git(missingFixture.root, ['add', 'manifest.json']);
      git(missingFixture.root, ['commit', '-qm', 'missing blob declaration']);
      const revision = git(missingFixture.root, ['rev-parse', 'HEAD']);
      expect(() => resolveCaptureBoundInputs({
        repoRoot: missingFixture.root,
        captureRevision: revision,
        manifestPath: 'manifest.json',
      })).toThrow(/missing.*blob|missing.*input/);
    } finally {
      missingFixture.cleanup();
    }

    const escapeFixture = fixture();
    try {
      const manifestPath = path.join(escapeFixture.root, 'manifest.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
      manifest.files = [{ path: '../outside.json' }];
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      git(escapeFixture.root, ['add', 'manifest.json']);
      git(escapeFixture.root, ['commit', '-qm', 'path escape declaration']);
      const revision = git(escapeFixture.root, ['rev-parse', 'HEAD']);
      expect(() => resolveCaptureBoundInputs({
        repoRoot: escapeFixture.root,
        captureRevision: revision,
        manifestPath: 'manifest.json',
      })).toThrow(/escape/);
    } finally {
      escapeFixture.cleanup();
    }
  });

  it('produces a deterministic manifest/input digest', () => {
    const f = fixture();
    try {
      const first = resolveCaptureBoundInputs({ repoRoot: f.root, captureRevision: f.revision, manifestPath: 'manifest.json' }).receipt;
      const second = resolveCaptureBoundInputs({ repoRoot: f.root, captureRevision: f.revision, manifestPath: 'manifest.json' }).receipt;
      expect(first.manifestDigest).toBe(second.manifestDigest);
      expect(first.inputDigest).toBe(second.inputDigest);
      expect(first.collections[0]?.members.map((member) => member.path)).toEqual(['inputs/course/course.json']);
    } finally {
      f.cleanup();
    }
  });
});
