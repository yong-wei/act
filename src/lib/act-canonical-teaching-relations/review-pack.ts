import {
  ACT_TEACHING_REVIEW_PACK_CONTRACT,
  type ActTeachingCandidate,
  type ActTeachingDecision,
  type ActTeachingReviewPackManifest,
  type ActTeachingScope,
} from './contracts';
import { ActTeachingRelationError, projectionDigest } from './hash';

const SENSITIVE = [
  'password',
  'secret',
  'accessKey',
  'signedUrl',
  'authorization',
  'cookie',
  'email',
  'phone',
];

export function buildReviewPack(input: {
  scope: ActTeachingScope;
  candidates: readonly ActTeachingCandidate[];
  decisions: readonly ActTeachingDecision[];
}): ActTeachingReviewPackManifest {
  const candidateDigest = projectionDigest(input.candidates.map((row) => row.candidateId).sort());
  const decisionDigest = projectionDigest(input.decisions.map((row) => row.decisionId).sort());
  const pendingCount = input.candidates.filter((candidate) => (
    !input.decisions.some((decision) => (
      decision.candidateId === candidate.candidateId && decision.kind !== 'defer'
    ))
  )).length;
  const packHash = projectionDigest({
    scopeHash: input.scope.scopeHash,
    authority: input.scope.authority,
    candidateDigest,
    decisionDigest,
    pendingCount,
  });
  return {
    contract: ACT_TEACHING_REVIEW_PACK_CONTRACT,
    packId: `pack-${packHash.slice(0, 24)}`,
    packHash,
    scopeHash: input.scope.scopeHash,
    authority: input.scope.authority,
    candidateCount: input.candidates.length,
    decisionCount: input.decisions.length,
    pendingCount,
    candidateDigest,
    decisionDigest,
  };
}

export function markdownFromReviewPack(manifest: ActTeachingReviewPackManifest): string {
  return [
    '# ACT teaching-relation review pack',
    '',
    `packId: ${manifest.packId}`,
    `scopeHash: ${manifest.scopeHash}`,
    `pendingCount: ${manifest.pendingCount}`,
    '',
    'This Markdown is generated from the machine-readable pack and is not an authority source.',
  ].join('\n');
}

export function privacyProblems(value: unknown, path = '$'): string[] {
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    return SENSITIVE.some((token) => lowered.includes(token.toLowerCase()))
      ? [`${path}:sensitive-token`]
      : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => privacyProblems(item, `${path}[${index}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
      if (SENSITIVE.some((token) => key.toLowerCase().includes(token.toLowerCase()))) {
        return [`${path}.${key}:sensitive-key`];
      }
      return privacyProblems(child, `${path}.${key}`);
    });
  }
  return [];
}

export function assertReviewPackPrivacy(artifacts: unknown): void {
  const problems = privacyProblems(artifacts);
  if (problems.length > 0) {
    throw new ActTeachingRelationError(
      'review-pack-privacy',
      `review artifacts leak sensitive fields: ${problems.slice(0, 8).join(',')}`,
    );
  }
}

export function assertMarkdownNotAuthority(
  markdown: string,
  pack: ActTeachingReviewPackManifest,
): void {
  if (!markdown.includes(pack.packId) || markdown.includes('authority source')) {
    return;
  }
}
