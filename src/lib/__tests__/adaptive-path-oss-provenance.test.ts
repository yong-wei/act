import { describe, expect, it } from 'vitest';

import {
  promoteIndexedObjectKeyReads,
  verifyAdaptivePathObjectKeys,
  type AdaptivePathObjectKeyReadRecord,
  type AdaptivePathObjectKeyVerifier,
} from '@/features/personalization/path-planning/adaptive-path-oss-provenance';

// #2055：对象键来源已迁移到节点 runtime 绑定字段
// （见 adaptive-path-runtime-binding.test.ts），target 字符串反解已退役。

describe('adaptive path object key read verification (#2033 fault injection)', () => {
  const verifiedAt = '2026-09-06T00:00:00.000Z';

  it('records verified hits and honest failure states from the verifier port', async () => {
    const verifier: AdaptivePathObjectKeyVerifier = {
      verify: async (objectKey) => objectKey === 'lessons/ok.mp4'
        ? { state: 'verified', contentSha256: 'sha-ok' }
        : objectKey === 'lessons/forbidden.mp4'
          ? { state: 'forbidden', contentSha256: null }
          : objectKey === 'simulations/lab/index.html'
            ? { state: 'checksum-mismatch', contentSha256: 'sha-drift' }
            : { state: 'missing', contentSha256: null },
    };
    const records = await verifyAdaptivePathObjectKeys(verifier, [
      { candidateStyleId: 'foundation-remediation', nodeNodeId: 'n1', objectKey: 'lessons/ok.mp4' },
      { candidateStyleId: 'foundation-remediation', nodeNodeId: 'n2', objectKey: 'lessons/forbidden.mp4' },
      { candidateStyleId: 'arena-simulation-sprint', nodeNodeId: 'n3', objectKey: 'simulations/lab/index.html' },
      { candidateStyleId: 'arena-simulation-sprint', nodeNodeId: 'n4', objectKey: 'lessons/gone.mp4' },
    ], verifiedAt);

    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({ objectKey: 'lessons/ok.mp4', state: 'verified', contentSha256: 'sha-ok' }),
      expect.objectContaining({ objectKey: 'lessons/forbidden.mp4', state: 'forbidden', contentSha256: null }),
      expect.objectContaining({ objectKey: 'simulations/lab/index.html', state: 'checksum-mismatch', contentSha256: 'sha-drift' }),
      expect.objectContaining({ objectKey: 'lessons/gone.mp4', state: 'missing', contentSha256: null }),
    ]));
    expect(records.every((record) => record.verifiedAt === verifiedAt)).toBe(true);
  });

  it('deduplicates verifier calls for repeated object keys across candidates', async () => {
    let verifyCalls = 0;
    const verifier: AdaptivePathObjectKeyVerifier = {
      verify: async (objectKey) => {
        verifyCalls += 1;
        return { state: 'verified' as const, contentSha256: `sha:${objectKey}` };
      },
    };
    const records = await verifyAdaptivePathObjectKeys(verifier, [
      { candidateStyleId: 'foundation-remediation', nodeNodeId: 'n1', objectKey: 'lessons/shared.mp4' },
      { candidateStyleId: 'arena-simulation-sprint', nodeNodeId: 'n9', objectKey: 'lessons/shared.mp4' },
    ], verifiedAt);
    // 同一对象键只触发一次验证调用，但记录按候选节点逐条保留。
    expect(verifyCalls).toBe(1);
    expect(records).toHaveLength(2);
    expect(records.every((record) => record.state === 'verified')).toBe(true);
  });

  it('promotes index-verified runtime keys with a body read and leaves published entries indexed', async () => {
    const verifier: AdaptivePathObjectKeyVerifier = {
      verify: async (_objectKey, expectedSha256) => ({
        state: expectedSha256 === 'sha-index' ? 'verified' : 'checksum-mismatch',
        contentSha256: expectedSha256 ?? 'sha-body',
      }),
    };
    const indexed: AdaptivePathObjectKeyReadRecord[] = [
      {
        objectKey: 'lessons/ok.mp4',
        resourceId: 'act:video:ok',
        candidateStyleId: 'foundation-remediation',
        nodeNodeId: 'n1',
        state: 'index-verified',
        contentSha256: 'sha-index',
        verifiedAt,
        runtimeReleaseId: 'runtime-1',
      },
      {
        objectKey: 'published:v1',
        resourceId: 'act:card:ok',
        candidateStyleId: 'foundation-remediation',
        nodeNodeId: 'n2',
        state: 'index-verified',
        contentSha256: 'sha-card',
        verifiedAt,
        runtimeReleaseId: 'runtime-1',
      },
    ];
    const records = await promoteIndexedObjectKeyReads(indexed, verifier, verifiedAt);
    expect(records).toEqual([
      expect.objectContaining({ objectKey: 'lessons/ok.mp4', state: 'verified', contentSha256: 'sha-index' }),
      expect.objectContaining({ objectKey: 'published:v1', state: 'index-verified', contentSha256: 'sha-card' }),
    ]);
  });

  it('does not reuse a verifier result across different frozen digests for the same object key', async () => {
    const seen: Array<string | null | undefined> = [];
    const verifier: AdaptivePathObjectKeyVerifier = {
      verify: async (_objectKey, expectedSha256) => {
        seen.push(expectedSha256);
        return expectedSha256 === 'sha-a'
          ? { state: 'verified', contentSha256: 'sha-a' }
          : { state: 'checksum-mismatch', contentSha256: 'sha-b' };
      },
    };
    const records = await verifyAdaptivePathObjectKeys(verifier, [
      {
        candidateStyleId: 'foundation-remediation',
        nodeNodeId: 'n1',
        objectKey: 'lessons/shared.mp4',
        contentSha256: 'sha-a',
      },
      {
        candidateStyleId: 'arena-simulation-sprint',
        nodeNodeId: 'n9',
        objectKey: 'lessons/shared.mp4',
        contentSha256: 'sha-b',
      },
    ], verifiedAt);
    expect(seen).toEqual(['sha-a', 'sha-b']);
    expect(records.map((record) => record.state)).toEqual(['verified', 'checksum-mismatch']);
  });
});
