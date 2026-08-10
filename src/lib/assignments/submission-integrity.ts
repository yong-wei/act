import { createHash, randomBytes } from 'node:crypto';

import { SubmissionError } from './submission-domain';

export function opaqueObjectKey() {
  const token = randomBytes(24).toString('hex');
  return `quarantine/${token.slice(0, 2)}/${token}`;
}

export function submissionHash(value: unknown) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

export function assertSubmissionObjectIntegrity(
  bytes: Uint8Array,
  expectedSizeBytes: number,
  expectedChecksum: string,
): void {
  const actualChecksum = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  if (bytes.byteLength !== expectedSizeBytes || actualChecksum !== expectedChecksum) {
    throw new SubmissionError('asset-integrity-mismatch', 502);
  }
}
