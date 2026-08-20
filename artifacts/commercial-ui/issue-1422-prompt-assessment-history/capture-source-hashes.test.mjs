import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertCaptureSourcesMatchRevision,
  readCaptureSourceHashes,
} from './capture-source-hashes.mjs';

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'prompt-assessment-capture-hashes-'));
  const sourcePath = 'src/input.ts';
  const sourceBytes = Buffer.from("export const source = 'git-blob';\n", 'utf8');
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, '.gitattributes'), '*.ts text eol=crlf\n');
  await writeFile(path.join(root, sourcePath), sourceBytes);
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'capture-test@example.invalid']);
  git(root, ['config', 'user.name', 'Capture Test']);
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'fixture']);
  await writeFile(path.join(root, sourcePath), "export const source = 'git-blob';\r\n");
  return {
    root,
    sourcePath,
    sourceBytes,
    revision: git(root, ['rev-parse', 'HEAD']),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

test('hashes the declared Git revision while accepting its CRLF checkout and rejecting source drift', async () => {
  const fixture = await createFixture();
  try {
    const worktreeBytes = await readFile(path.join(fixture.root, fixture.sourcePath));
    assert.notEqual(sha256(worktreeBytes), sha256(fixture.sourceBytes));
    assert.deepEqual(
      readCaptureSourceHashes({
        repositoryRoot: fixture.root,
        captureRevision: fixture.revision,
        sourcePaths: [fixture.sourcePath],
      }),
      { [fixture.sourcePath]: sha256(fixture.sourceBytes) },
    );
    assert.doesNotThrow(() => assertCaptureSourcesMatchRevision({
      repositoryRoot: fixture.root,
      captureRevision: fixture.revision,
      sourcePaths: [fixture.sourcePath],
    }));

    await writeFile(path.join(fixture.root, fixture.sourcePath), "export const source = 'changed';\r\n");
    assert.throws(() => assertCaptureSourcesMatchRevision({
      repositoryRoot: fixture.root,
      captureRevision: fixture.revision,
      sourcePaths: [fixture.sourcePath],
    }), /differs from capture revision/u);
  } finally {
    await fixture.cleanup();
  }
});
