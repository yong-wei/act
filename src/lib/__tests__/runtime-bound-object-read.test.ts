import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { promoteIndexedObjectKeyReads } from '@/features/personalization/path-planning/adaptive-path-oss-provenance';
import {
  boundRuntimeObjectPath,
  createBoundRuntimeObjectKeyVerifier,
  resolveBoundMediaByteRange,
  verifyBoundRuntimeObject,
} from '@/lib/runtime-bound-object-read';

function writeRuntimeTree() {
  const root = mkdtempSync(path.join(tmpdir(), 'bound-runtime-'));
  const body = Buffer.from('oss-object\n');
  const sha256 = createHash('sha256').update(body).digest('hex');
  mkdirSync(path.join(root, '.act-runtime-blobs'));
  mkdirSync(path.join(root, 'lessons/1-1/media'), { recursive: true });
  writeFileSync(path.join(root, '.act-runtime-blobs', sha256), body);
  symlinkSync(path.join('..', '..', '..', '.act-runtime-blobs', sha256), path.join(root, 'lessons/1-1/media/intro.mp4'));
  return { root, sha256, body };
}

describe('bound runtime object reads', () => {
  it('verifies helper-linked release bytes and classifies missing or checksum failures', async () => {
    const { root, sha256 } = writeRuntimeTree();
    try {
      await expect(verifyBoundRuntimeObject(root, 'lessons/1-1/media/intro.mp4', sha256)).resolves.toEqual({
        state: 'verified',
        contentSha256: sha256,
      });
      await expect(verifyBoundRuntimeObject(root, 'lessons/1-1/media/missing.mp4', sha256)).resolves.toEqual({
        state: 'missing',
        contentSha256: null,
      });
      await expect(verifyBoundRuntimeObject(root, 'lessons/1-1/media/intro.mp4', 'b'.repeat(64))).resolves.toEqual({
        state: 'checksum-mismatch',
        contentSha256: sha256,
      });
      expect(boundRuntimeObjectPath(root, '../secret')).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('hashes helper-linked bytes before verified and rejects a named digest that does not match the file', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'bound-runtime-corrupt-'));
    const claimed = 'a'.repeat(64);
    const body = Buffer.from('corrupt-cache\n');
    mkdirSync(path.join(root, '.act-runtime-blobs'));
    mkdirSync(path.join(root, 'lessons/1-1/media'), { recursive: true });
    writeFileSync(path.join(root, '.act-runtime-blobs', claimed), body);
    symlinkSync(
      path.join('..', '..', '..', '.act-runtime-blobs', claimed),
      path.join(root, 'lessons/1-1/media/intro.mp4'),
    );
    const digest = createHash('sha256').update(body).digest('hex');
    try {
      await expect(verifyBoundRuntimeObject(root, 'lessons/1-1/media/intro.mp4', claimed)).resolves.toEqual({
        state: 'checksum-mismatch',
        contentSha256: digest,
      });
      await expect(verifyBoundRuntimeObject(root, `blob:${claimed}`)).resolves.toEqual({
        state: 'checksum-mismatch',
        contentSha256: digest,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolves a single byte range for bound media', () => {
    expect(resolveBoundMediaByteRange(null, 100)).toEqual({ kind: 'all' });
    expect(resolveBoundMediaByteRange('bytes=0-9', 100)).toEqual({ kind: 'partial', start: 0, end: 9 });
    expect(resolveBoundMediaByteRange('bytes=50-', 100)).toEqual({ kind: 'partial', start: 50, end: 99 });
    expect(resolveBoundMediaByteRange('bytes=0-999', 100)).toEqual({ kind: 'partial', start: 0, end: 99 });
    expect(resolveBoundMediaByteRange('bytes=100-101', 100)).toEqual({ kind: 'unsatisfiable' });
    expect(resolveBoundMediaByteRange('bytes=0-1,2-3', 100)).toEqual({ kind: 'unsatisfiable' });
  });

  it('promotes a generated path record to verified and keeps failed reads out of differentiation', async () => {
    const { root, sha256 } = writeRuntimeTree();
    try {
      const records = await promoteIndexedObjectKeyReads([
        {
          objectKey: 'lessons/1-1/media/intro.mp4',
          resourceId: 'act:video:1-1',
          candidateStyleId: 'foundation-remediation',
          nodeNodeId: 'n1',
          state: 'index-verified',
          contentSha256: sha256,
          verifiedAt: '2026-09-11T00:00:00.000Z',
          runtimeReleaseId: 'runtime-1',
        },
        {
          objectKey: 'lessons/1-1/media/missing.mp4',
          resourceId: 'act:video:missing',
          candidateStyleId: 'foundation-remediation',
          nodeNodeId: 'n2',
          state: 'index-verified',
          contentSha256: sha256,
          verifiedAt: '2026-09-11T00:00:00.000Z',
          runtimeReleaseId: 'runtime-1',
        },
      ], createBoundRuntimeObjectKeyVerifier(root), '2026-09-11T00:00:00.000Z');
      expect(records.map((record) => record.state)).toEqual(['verified', 'missing']);
      const unread = records.filter((record) => record.state !== 'verified' && record.state !== 'index-verified');
      expect(unread.map((record) => record.nodeNodeId)).toEqual(['n2']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
