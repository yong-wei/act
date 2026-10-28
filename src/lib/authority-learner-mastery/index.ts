/**
 * Self-scoped mastery overlay for the active Authority knowledge graph.
 *
 * Identity comes only from Canonical facts whose object belongs to the active
 * graph, or from historical facts resolved at read time through the reviewed
 * Legacy→Canonical crosswalk. Facts are never rewritten; same-name matching is
 * never attempted; stale crosswalk rows never contribute.
 */

import {
  resolveHistoricalLearningFactDisplayContext,
  type LearningFactCrosswalkIndex,
} from '@/lib/canonical-learning-fact-identity/crosswalk-serving';
import type { LearningFactServingRecord } from '@/lib/canonical-learning-fact-identity/serving';

export const ACTIVE_AUTHORITY_MASTERY_CONTRACT = 'active-authority-mastery-overlay.v1';

export const MASTERY_RECENT_FACT_LIMIT = 20;
export const MASTERY_MIN_EVIDENCE = 2;
export const MASTERY_FULL_CONFIDENCE_EVIDENCE = 5;
export const MASTERY_MASTERED_THRESHOLD = 0.8;
export const MASTERY_DEVELOPING_THRESHOLD = 0.5;

export type AuthorityMasteryState = 'mastered' | 'developing' | 'weak' | 'evidence-needed';

export interface MasteryEvidenceFact extends LearningFactServingRecord {
  outcome: string;
  score: number | null;
  startedAt: Date | string;
}

export interface MasteryDomainMembership {
  visualRole: string;
  memberIds: readonly string[];
}

export interface AuthorityMasteryMark {
  state: AuthorityMasteryState;
  /** Mean evidence score in [0, 1]; null when no evidence contributed. */
  score: number | null;
  confidence: number;
  evidenceCount: number;
}

export interface AuthorityMasteryObjectItem extends AuthorityMasteryMark {
  id: string;
}

export interface AuthorityMasteryDomainItem extends AuthorityMasteryMark {
  visualRole: string;
  coveredCount: number;
  memberCount: number;
}

export interface AuthorityMasteryCoverage {
  mappedFactCount: number;
  unresolvedFactCount: number;
}

export interface ActiveAuthorityMasteryReport {
  contract: typeof ACTIVE_AUTHORITY_MASTERY_CONTRACT;
  status: 'ready' | 'empty';
  domains: AuthorityMasteryDomainItem[];
  objects: AuthorityMasteryObjectItem[];
  coverage: AuthorityMasteryCoverage;
}

export type ActiveAuthorityMasteryOverlay =
  | ActiveAuthorityMasteryReport
  | {
    contract: typeof ACTIVE_AUTHORITY_MASTERY_CONTRACT;
    status: 'not-applicable';
  };

export function notApplicableMasteryOverlay(): ActiveAuthorityMasteryOverlay {
  return { contract: ACTIVE_AUTHORITY_MASTERY_CONTRACT, status: 'not-applicable' };
}

export function emptyMasteryOverlay(coverage: Partial<AuthorityMasteryCoverage> = {}): ActiveAuthorityMasteryOverlay {
  return {
    contract: ACTIVE_AUTHORITY_MASTERY_CONTRACT,
    status: 'empty',
    domains: [],
    objects: [],
    coverage: {
      mappedFactCount: coverage.mappedFactCount ?? 0,
      unresolvedFactCount: coverage.unresolvedFactCount ?? 0,
    },
  };
}

/** Score in [0, 1], or null when the outcome carries no mastery signal. */
export function masteryEvidenceScore(fact: Pick<MasteryEvidenceFact, 'outcome' | 'score'>): number | null {
  if (typeof fact.score === 'number' && Number.isFinite(fact.score)) {
    return Math.min(1, Math.max(0, fact.score / 100));
  }
  switch (fact.outcome) {
    case 'success': return 1;
    case 'partial': return 0.5;
    case 'failure': return 0;
    default: return null;
  }
}

export function masteryStateFor(score: number | null, evidenceCount: number): AuthorityMasteryState {
  if (score === null || evidenceCount < MASTERY_MIN_EVIDENCE) return 'evidence-needed';
  if (score >= MASTERY_MASTERED_THRESHOLD) return 'mastered';
  if (score >= MASTERY_DEVELOPING_THRESHOLD) return 'developing';
  return 'weak';
}

function masteryMark(scores: readonly number[]): AuthorityMasteryMark {
  const evidenceCount = scores.length;
  const score = evidenceCount > 0
    ? roundScore(scores.reduce((sum, value) => sum + value, 0) / evidenceCount)
    : null;
  return {
    state: masteryStateFor(score, evidenceCount),
    score,
    confidence: roundScore(Math.min(1, evidenceCount / MASTERY_FULL_CONFIDENCE_EVIDENCE)),
    evidenceCount,
  };
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function timeOf(value: Date | string): number {
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function canonicalTargets(
  fact: MasteryEvidenceFact,
  crosswalk: LearningFactCrosswalkIndex,
): string[] {
  if (fact.knowledgeIdentityNamespace === 'CANONICAL') {
    return fact.canonicalObjectId ? [fact.canonicalObjectId] : [];
  }
  const context = resolveHistoricalLearningFactDisplayContext({ fact, crosswalk });
  return [...new Set(
    context.displayResourceContext
      .filter((row) => !row.stale)
      .map((row) => row.canonicalId),
  )];
}

export function buildActiveAuthorityMasteryOverlay(input: {
  facts: readonly MasteryEvidenceFact[];
  crosswalk: LearningFactCrosswalkIndex;
  domains: readonly MasteryDomainMembership[];
}): ActiveAuthorityMasteryOverlay {
  const activeMembers = new Set(input.domains.flatMap((domain) => domain.memberIds));
  const scoresByObject = new Map<string, { time: number; score: number }[]>();
  let mappedFactCount = 0;
  let unresolvedFactCount = 0;

  for (const fact of input.facts) {
    const score = masteryEvidenceScore(fact);
    if (score === null) continue;
    const targets = canonicalTargets(fact, input.crosswalk).filter((id) => activeMembers.has(id));
    if (targets.length === 0) {
      unresolvedFactCount += 1;
      continue;
    }
    mappedFactCount += 1;
    const time = timeOf(fact.startedAt);
    for (const id of targets) {
      const list = scoresByObject.get(id) ?? [];
      list.push({ time, score });
      scoresByObject.set(id, list);
    }
  }

  if (scoresByObject.size === 0) {
    return emptyMasteryOverlay({ mappedFactCount, unresolvedFactCount });
  }

  const objects: AuthorityMasteryObjectItem[] = [...scoresByObject.entries()]
    .map(([id, entries]) => ({
      id,
      ...masteryMark(
        [...entries]
          .sort((a, b) => b.time - a.time)
          .slice(0, MASTERY_RECENT_FACT_LIMIT)
          .map((entry) => entry.score),
      ),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const objectById = new Map(objects.map((item) => [item.id, item]));

  const domains: AuthorityMasteryDomainItem[] = input.domains.flatMap((domain) => {
    const covered = [...new Set(domain.memberIds)]
      .map((id) => objectById.get(id))
      .filter((item): item is AuthorityMasteryObjectItem => item !== undefined && item.score !== null);
    if (covered.length === 0) return [];
    const evidenceCount = covered.reduce((sum, item) => sum + item.evidenceCount, 0);
    const score = roundScore(covered.reduce((sum, item) => sum + (item.score ?? 0), 0) / covered.length);
    return [{
      visualRole: domain.visualRole,
      state: masteryStateFor(score, evidenceCount),
      score,
      confidence: roundScore(Math.min(1, evidenceCount / MASTERY_FULL_CONFIDENCE_EVIDENCE)),
      evidenceCount,
      coveredCount: covered.length,
      memberCount: new Set(domain.memberIds).size,
    }];
  });

  return {
    contract: ACTIVE_AUTHORITY_MASTERY_CONTRACT,
    status: 'ready',
    domains,
    objects,
    coverage: { mappedFactCount, unresolvedFactCount },
  };
}
