import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertCaptureProvenance,
  computeLocalProvenance,
} from './browser-evidence-provenance.mjs';

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'konling-evidence-provenance-'));
  await mkdir(path.join(root, 'artifacts/evidence'), { recursive: true });
  await writeFile(path.join(root, 'runtime.ts'), 'export const runtime = true;\n');
  await writeFile(path.join(root, 'artifacts/evidence/output.json'), '{}\n');
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'evidence-test@example.invalid']);
  git(root, ['config', 'user.name', 'Evidence Test']);
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'fixture']);
  return {
    root,
    revision: git(root, ['rev-parse', 'HEAD']),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

test('rejects dirty runtime inputs, unrelated files, and revision mismatch', async () => {
  const f = await fixture();
  try {
    const input = {
      repoRoot: f.root,
      declaredRevision: f.revision,
      sourceFiles: ['runtime.ts'],
    };
    const clean = await computeLocalProvenance(input);
    assert.equal(clean.commitSha, f.revision);
    assert.equal(clean.clean, true);

    await writeFile(path.join(f.root, 'runtime.ts'), 'export const runtime = false;\n');
    await assert.rejects(computeLocalProvenance(input), /dirty|differs from declared revision/u);
    git(f.root, ['checkout', '--', 'runtime.ts']);

    await writeFile(path.join(f.root, 'unrelated.txt'), 'dirty\n');
    await assert.rejects(computeLocalProvenance(input), /unrelated\.txt/u);
    await rm(path.join(f.root, 'unrelated.txt'));

    await assert.rejects(
      computeLocalProvenance({ ...input, declaredRevision: '0'.repeat(40) }),
      /git|unknown revision|bad object|Needed a single revision/u,
    );
  } finally {
    await f.cleanup();
  }
});

test('allows only evidence output drift after capture starts', async () => {
  const f = await fixture();
  try {
    await writeFile(path.join(f.root, 'artifacts/evidence/output.json'), '{"captured":true}\n');
    const proof = await computeLocalProvenance({
      repoRoot: f.root,
      declaredRevision: f.revision,
      sourceFiles: ['runtime.ts'],
      allowedOutputPaths: ['artifacts/evidence'],
    });
    assert.equal(proof.clean, true);
  } finally {
    await f.cleanup();
  }
});

test('rejects a declared capture source even when it lives below the allowed output root', async () => {
  const f = await fixture();
  try {
    const input = {
      repoRoot: f.root,
      declaredRevision: f.revision,
      sourceFiles: ['artifacts/evidence/output.json'],
      allowedOutputPaths: ['artifacts/evidence'],
    };
    await writeFile(path.join(f.root, 'artifacts/evidence/output.json'), '{"tampered":true}\n');
    await assert.rejects(
      computeLocalProvenance(input),
      /differs from declared revision/u,
    );
  } finally {
    await f.cleanup();
  }
});

test('rejects a runtime service that is not bound to the local capture proof', async () => {
  const f = await fixture();
  const localProof = await computeLocalProvenance({
    repoRoot: f.root,
    declaredRevision: f.revision,
    sourceFiles: ['runtime.ts'],
  });
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ...localProof, commitSha: 'f'.repeat(40) }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    assert.ok(address && typeof address === 'object');
    await assert.rejects(assertCaptureProvenance({
      repoRoot: f.root,
      declaredRevision: f.revision,
      sourceFiles: ['runtime.ts'],
      baseUrl: `http://127.0.0.1:${address.port}`,
      phase: 'test',
    }), /runtime commitSha/u);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await f.cleanup();
  }
});
