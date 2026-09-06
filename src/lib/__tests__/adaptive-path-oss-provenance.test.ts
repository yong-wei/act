import { describe, expect, it } from 'vitest';

import {
  resolveAdaptivePathRuntimeObjectKey,
  verifyAdaptivePathObjectKeys,
  type AdaptivePathObjectKeyVerifier,
} from '@/features/personalization/path-planning/adaptive-path-oss-provenance';

describe('adaptive path runtime object key resolver (#2033)', () => {
  it('parses runtime asset URLs into runtime object keys', () => {
    const resolved = resolveAdaptivePathRuntimeObjectKey('/api/course-runtime/assets/lessons/1-3/media/intro.mp4');
    expect(resolved).toEqual({
      state: 'runtime-object-key',
      objectKey: 'lessons/1-3/media/intro.mp4',
    });
  });

  it('parses blob asset URLs into content-addressed keys', () => {
    const sha = 'a'.repeat(64);
    const resolved = resolveAdaptivePathRuntimeObjectKey(`/api/course-runtime/blob-assets/${sha}`);
    expect(resolved).toEqual({ state: 'blob-content-key', objectKey: `blob:${sha}` });
  });

  it('marks non-runtime targets as not runtime-backed', () => {
    expect(resolveAdaptivePathRuntimeObjectKey('/knowledge?node=x').state).toBe('non-runtime');
    expect(resolveAdaptivePathRuntimeObjectKey('/interactive-learning/resources/card').objectKey).toBeNull();
    expect(resolveAdaptivePathRuntimeObjectKey('/api/course-runtime/other/path').state).toBe('non-runtime');
  });
});

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
});
