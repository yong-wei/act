import { projectionDigest } from '@/lib/teaching-projection/hash';

export { projectionDigest };

export class FormalResourceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'FormalResourceError';
    this.code = code;
  }
}

export function freezeRef(ref: string, body: string): { ref: string; body: string } {
  if (!ref || !body || ref.startsWith('pending:') || ref.startsWith('label:')) {
    throw new FormalResourceError('invalid-evidence-ref', `evidence ref is not independently verifiable: ${ref}`);
  }
  return { ref, body };
}

export function bindingId(input: {
  resourceId: string;
  atomId: string;
  canonicalId: string;
  role: string;
  scopeId: string;
}): string {
  return `frb-${projectionDigest(input).slice(0, 24)}`;
}

export function atomId(input: {
  resourceId: string;
  kind: string;
  stableKey: string;
  contentSha256: string;
}): string {
  return `atom-${projectionDigest(input).slice(0, 24)}`;
}
