import { describe, expect, it } from 'vitest';

import {
  assertRuntimeCaptureRevisionProofMatches,
  createRuntimeCaptureRevisionProbeUrl,
  fetchRuntimeCaptureRevisionProof,
  parseRuntimeCaptureRevisionProof,
} from '../commercial-ui-capture-revision';

const localProof = {
  commitSha: 'a'.repeat(40),
  treeSha: 'b'.repeat(40),
  sourceFingerprint: 'c'.repeat(64),
  clean: true,
} as const;

describe('commercial UI runtime capture proof', () => {
  it('fails closed when the target service reports another commit', () => {
    const runtimeProof = {
      ...localProof,
      commitSha: 'd'.repeat(40),
    };
    expect(() => assertRuntimeCaptureRevisionProofMatches(localProof, runtimeProof, 'knowledge capture service'))
      .toThrow(/commitSha/u);
  });

  it('reads the same-origin probe before accepting a capture', async () => {
    const baseUrl = 'http://localhost:3002';
    const probeUrl = 'http://localhost:3002/api/internal/local-qa/revision';
    expect(createRuntimeCaptureRevisionProbeUrl(baseUrl)).toBe(probeUrl);
    expect(parseRuntimeCaptureRevisionProof(localProof)).toEqual(localProof);

    const proof = await fetchRuntimeCaptureRevisionProof(baseUrl, async (input) => {
      expect(input).toBe(probeUrl);
      return new Response(JSON.stringify(localProof), { status: 200 });
    });
    expect(proof).toEqual(localProof);

    await expect(fetchRuntimeCaptureRevisionProof(baseUrl, async () => (
      new Response(JSON.stringify({ ...localProof, clean: false }), { status: 200 })
    ))).rejects.toThrow(/dirty service/u);
  });
});
