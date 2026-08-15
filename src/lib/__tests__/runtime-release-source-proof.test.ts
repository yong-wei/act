import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import { buildGitRuntimeBlobReleaseSnapshot } from '../runtime-release-git-snapshot';
import { assertRuntimeBlobReleaseReceiptMatchesManifest, buildRuntimeBlobReleaseReceipt, runtimeBlobReleaseManifestWireSha256 } from '../runtime-release';
import {
  assertRuntimeReleaseSourceProvenanceProofMatchesManifest,
  buildRuntimeReleaseSourceProvenanceProof,
  parseRuntimeReleaseSourceProvenanceProof,
  serializeRuntimeReleaseSourceProvenanceProof,
} from '../runtime-release-source-proof';

const execFile = promisify(execFileCallback);
const roots: string[] = [];

async function git(root: string, ...args: string[]) {
  const result = await execFile('git', args, { cwd: root });
  return result.stdout.trim();
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('runtime source-provenance proof', () => {
  it('binds canonical manifest, Git tree mode/OID, origin integration ancestor and parent identity', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-source-proof-'));
    roots.push(root);
    await mkdir(path.join(root, 'course-content', 'runtime', 'lessons'), { recursive: true });
    await writeFile(path.join(root, 'course-content', 'runtime', 'lessons', 'lesson.json'), '{"id":"proof"}\n');
    await execFile('git', ['init', '-b', 'integration'], { cwd: root });
    await execFile('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
    await execFile('git', ['config', 'user.name', 'Test'], { cwd: root });
    await execFile('git', ['add', '.'], { cwd: root });
    await execFile('git', ['commit', '-m', 'proof'], { cwd: root });
    const sourceRevision = await git(root, 'rev-parse', 'HEAD');
    const parentSnapshot = await buildGitRuntimeBlobReleaseSnapshot({ repoRoot: root, sourceRevision, integrationRef: 'integration' });
    const snapshot = await buildGitRuntimeBlobReleaseSnapshot({
      repoRoot: root,
      sourceRevision,
      integrationRef: 'integration',
      parentManifest: parentSnapshot.manifest,
    });
    const proof = buildRuntimeReleaseSourceProvenanceProof({
      sourceRevision: snapshot.sourceRevision,
      integrationRef: snapshot.integrationRef,
      integrationRevision: snapshot.integrationRevision,
      manifest: snapshot.manifest,
      manifestWireSha256: runtimeBlobReleaseManifestWireSha256(snapshot.manifest),
      parentManifest: snapshot.parentManifest,
      gitTree: snapshot.gitTree.map(({ path: relativePath, mode, blobObjectId }) => ({ path: relativePath, mode, gitObjectId: blobObjectId })),
    });
    const parsed = parseRuntimeReleaseSourceProvenanceProof(JSON.parse(serializeRuntimeReleaseSourceProvenanceProof(proof)));
    expect(parsed).toEqual(proof);
    const receipt = buildRuntimeBlobReleaseReceipt(snapshot.manifest, { sourceProvenanceProofSha256: proof.proofSha256 });
    expect(() => assertRuntimeBlobReleaseReceiptMatchesManifest(receipt, snapshot.manifest)).not.toThrow();
    expect(parsed.parent).toEqual({
      releaseId: parentSnapshot.manifest.releaseId,
      manifestSha256: parentSnapshot.manifest.manifestSha256,
      treeSha256: parentSnapshot.manifest.treeSha256,
    });
    expect(parsed.gitTree).toEqual([{ path: 'lessons/lesson.json', mode: '100644', gitObjectId: expect.stringMatching(/^[a-f0-9]{40}$/) }]);
    expect(() => parseRuntimeReleaseSourceProvenanceProof({ ...parsed, schemaVersion: 'act-runtime-release-source-provenance-proof.v999' })).toThrow(/unsupported proof schema/);
    expect(() => parseRuntimeReleaseSourceProvenanceProof({ ...parsed, proofSha256: 'f'.repeat(64) })).toThrow(/proof digest/);
    expect(() => assertRuntimeReleaseSourceProvenanceProofMatchesManifest(parsed, { ...snapshot.manifest, treeSha256: 'f'.repeat(64) }, runtimeBlobReleaseManifestWireSha256(snapshot.manifest))).toThrow(/does not match/);
    expect(createHash('sha256').update(serializeRuntimeReleaseSourceProvenanceProof(proof)).digest('hex')).toMatch(/^[a-f0-9]{64}$/);
  });
});
