import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { semanticDigestPair } from '../db/runtime-semantic-freshness';

const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'act-runtime-semantic-freshness-'));
const manifestPath = 'course-content/runtime/lessons/1-4/interactive-manifest.json';
const absoluteManifestPath = path.join(tempRoot, manifestPath);

function runGit(args: string[]) {
  return execFileSync('git', args, {
    cwd: tempRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function rawHash(content: string) {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

async function main() {
  try {
    runGit(['init', '-q']);
    runGit(['config', 'user.email', 'runtime-freshness-test@example.invalid']);
    runGit(['config', 'user.name', 'Runtime freshness test']);
    writeFileSync(path.join(tempRoot, 'README.md'), 'baseline\n');
    runGit(['add', 'README.md']);
    runGit(['commit', '-q', '-m', 'baseline']);

    mkdirSync(path.dirname(absoluteManifestPath), { recursive: true });
    const reviewedManifest = `${JSON.stringify({ steps: [{ title: 'Reviewed title' }] }, null, 2)}\n`;
    writeFileSync(absoluteManifestPath, reviewedManifest);
    runGit(['add', manifestPath]);

    const reviewedRawHash = rawHash(reviewedManifest);
    const availablePair = await semanticDigestPair(
      tempRoot,
      manifestPath,
      'json-pointer:/steps/0/title',
      reviewedRawHash,
    );
    assert.equal(availablePair.baselineStatus, 'available');
    assert.equal(availablePair.reviewed, availablePair.current);

    const changedManifest = `${JSON.stringify({ steps: [{ title: 'Unstaged changed title' }] }, null, 2)}\n`;
    writeFileSync(absoluteManifestPath, changedManifest);
    const changedPair = await semanticDigestPair(
      tempRoot,
      manifestPath,
      'json-pointer:/steps/0/title',
      reviewedRawHash,
    );
    assert.equal(changedPair.baselineStatus, 'available');
    assert.notEqual(changedPair.reviewed, changedPair.current);

    const mismatchedPair = await semanticDigestPair(
      tempRoot,
      manifestPath,
      'json-pointer:/steps/0/title',
      rawHash('not the staged manifest'),
    );
    assert.equal(mismatchedPair.baselineStatus, 'unavailable');
    assert.equal(mismatchedPair.reviewed, null);

    console.log('runtime semantic freshness tests passed');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
