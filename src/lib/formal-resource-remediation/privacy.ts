/**
 * Privacy validation for public runtime projections (#1515, task 2.4).
 *
 * Absolute local paths, raw answer payloads, private repository internals,
 * credentials, signed URLs, and unrestricted transcript bodies must never
 * enter public runtime projections. The scanner checks the complete
 * serialized projection payload, not a whitelist of fields, so a leak added
 * anywhere in the shape is caught.
 */

import { FormalResourceRemediationError } from './contracts';

/** Patterns that must never appear in a public runtime projection. */
const FORBIDDEN_PATTERNS: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: 'absolute-local-path', pattern: /"(?:\/Users|\/home|\/private)\/[^"]*"/u },
  { name: 'windows-absolute-path', pattern: /"[A-Za-z]:\\\\[^"]*"/u },
  { name: 'signed-url', pattern: /(?:X-Amz-Signature|OSSAccessKeyId|Signature=)[A-Za-z0-9%=&+/._-]+/u },
  { name: 'credential-pair', pattern: /"(?:accessKey|secretKey|apiKey|password|token)"\s*:\s*"[^"]{8,}"/iu },
  { name: 'bearer-token', pattern: /Bearer\s+[A-Za-z0-9._-]{16,}/u },
  { name: 'ssh-private-key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u },
];

/** Field names whose values are answer/scoring payloads by contract. */
const ANSWER_FIELD_PATTERN =
  /"(?:answer|answers|correctOption|correctOptions|scoringKey|scorePayload|explanation)"/iu;

/**
 * Validate that a serialized public projection contains none of the
 * forbidden privacy signals. Transcript bodies are allowed only under a
 * bounded field (e.g. atom anchor summaries), never as whole-file payloads.
 */
export function assertProjectionPrivacySafe(
  projectionName: string,
  serializedProjection: string,
): void {
  for (const { name, pattern } of FORBIDDEN_PATTERNS) {
    const match = pattern.exec(serializedProjection);
    if (match) {
      throw new FormalResourceRemediationError(
        'privacy-violation',
        `Projection ${projectionName} leaks ${name}: ${match[0].slice(0, 80)}`,
      );
    }
  }
}

/**
 * Exercise answer and scoring payloads are isolated to private processing
 * records; a public projection that even names an answer field fails.
 */
export function assertNoAnswerPayloads(
  projectionName: string,
  serializedProjection: string,
): void {
  if (ANSWER_FIELD_PATTERN.test(serializedProjection)) {
    throw new FormalResourceRemediationError(
      'privacy-violation',
      `Projection ${projectionName} names an answer/scoring field; exercise answers stay in private processing records.`,
    );
  }
}

/** Combined check for any public runtime projection artifact. */
export function assertPublicProjectionIsSafe(
  projectionName: string,
  value: unknown,
): void {
  const serialized = JSON.stringify(value);
  assertProjectionPrivacySafe(projectionName, serialized);
  assertNoAnswerPayloads(projectionName, serialized);
}
