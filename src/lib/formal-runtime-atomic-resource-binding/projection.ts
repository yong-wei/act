import {
  type FormalBinding,
  type FormalProductProjection,
  type FormalResourceAtom,
  type FormalResourceCandidate,
  type FormalResourceEnvelope,
  type FormalVisualFamily,
} from './contracts';
import { FormalResourceError } from './hash';
import { assertEnvelopeMatch } from './envelope';

const GOVERNANCE_LEAKS = [
  'transcript',
  'ledger',
  'confidence',
  'review',
  'objectKey',
  'signedUrl',
  'localPath',
  'script',
] as const;

export function visualFamilyFor(subtype: FormalResourceCandidate['subtype']): FormalVisualFamily {
  if (subtype === 'video' || subtype === 'audio' || subtype === 'podcast') return 'media';
  if (subtype === 'exercise') return 'exercise';
  if (subtype === 'simulation') return 'simulation';
  if (subtype === 'project') return 'project';
  return 'text';
}

export function projectFormalResource(input: {
  title: string;
  candidate: FormalResourceCandidate;
  atom: FormalResourceAtom;
  binding: FormalBinding;
  envelope: FormalResourceEnvelope;
  activeEnvelope: FormalResourceEnvelope;
}): FormalProductProjection {
  if (input.candidate.disposition !== 'INCLUDED') {
    throw new FormalResourceError('not-formal', 'excluded resources cannot project markers');
  }
  assertEnvelopeMatch(input.envelope, input.activeEnvelope);
  if (input.binding.envelopeHash !== input.envelope.envelopeHash) {
    throw new FormalResourceError('envelope-drift', 'binding belongs to another release envelope');
  }
  return {
    title: input.title,
    subtype: input.candidate.subtype,
    visualFamily: visualFamilyFor(input.candidate.subtype),
    role: input.binding.role,
    atomAnchorSummary: input.atom.anchor.kind === 'media-paragraph'
      ? `${input.atom.anchor.startSeconds}->${input.atom.anchor.endSeconds}`
      : input.atom.anchor.paragraphId ?? input.atom.anchor.questionId ?? input.atom.atomId,
    launchDescriptor: {
      kind: input.candidate.subtype,
      atomId: input.atom.atomId,
      startSeconds: input.atom.anchor.startSeconds,
    },
  };
}

export function projectionLeaksGovernance(value: unknown): boolean {
  const keys = collectKeys(value);
  return GOVERNANCE_LEAKS.some((key) => keys.has(key));
}

function collectKeys(value: unknown, acc = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return acc;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    acc.add(key);
    collectKeys(nested, acc);
  }
  return acc;
}

export function invalidateMediaSet(contentSha256Changed: boolean): boolean {
  return contentSha256Changed;
}

export function questionBindingStale(input: {
  previousHash: string;
  stem: string;
  options: readonly string[];
  answer: string;
  explanation: string;
  hashOf: (value: unknown) => string;
}): boolean {
  return input.previousHash !== input.hashOf({
    stem: input.stem,
    options: [...input.options],
    answer: input.answer,
    explanation: input.explanation,
  });
}
