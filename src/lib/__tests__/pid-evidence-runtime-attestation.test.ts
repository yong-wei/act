import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  assertPidEvidenceBuildSourceHashes,
  PID_EVIDENCE_RUNTIME_PATHS,
} from '@/lib/pid-evidence-runtime-attestation';
import {
  PID_EVIDENCE_BUILD_SOURCE_HASHES,
} from '@/lib/pid-evidence-runtime-manifest.generated';

describe('PID evidence runtime build attestation', () => {
  it('embeds the hashes of the current bound runtime inputs', async () => {
    const sourceHashes = Object.fromEntries(await Promise.all(
      PID_EVIDENCE_RUNTIME_PATHS.map(async (relativePath) => {
        const bytes = await readFile(relativePath);
        return [relativePath, createHash('sha256').update(bytes).digest('hex')];
      }),
    ));

    expect(sourceHashes).toEqual(PID_EVIDENCE_BUILD_SOURCE_HASHES);
  });

  it('accepts the source hashes embedded in the executing bundle', () => {
    expect(() => assertPidEvidenceBuildSourceHashes({
      ...PID_EVIDENCE_BUILD_SOURCE_HASHES,
    })).not.toThrow();
  });

  it('rejects checkout source hashes from a different build', () => {
    const firstPath = Object.keys(PID_EVIDENCE_BUILD_SOURCE_HASHES)[0];
    expect(() => assertPidEvidenceBuildSourceHashes({
      ...PID_EVIDENCE_BUILD_SOURCE_HASHES,
      [firstPath]: '0'.repeat(64),
    })).toThrow(/does not match the executing bundle/);
  });
});
