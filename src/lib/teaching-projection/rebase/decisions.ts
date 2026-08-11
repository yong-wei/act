/**
 * Rebase decision engine (#1272).
 *
 * - Compatible single-successor → AUTO_REBASE with auditable decision
 * - Split/merge/ambiguous/dependent card/prerequisite → REVIEW_REQUIRED
 * - Reuse persisted author decisions; fail closed on drift
 */

import { projectionDigest } from '../hash';
import {
  ACT_TEACHING_PROJECTION_REBASE_COMPAT_RULE_VERSION,
  ACT_TEACHING_PROJECTION_REBASE_DECISION_CONTRACT,
  type ActImpactItem,
  type ActTeachingProjectionImpactSet,
  type RebaseDecisionKind,
  type RebaseDecisionRecord,
  TeachingProjectionRebaseError,
} from './contracts';

const AUTO_REBASE_RULE = 'single-type-compatible-successor' as const;

export interface ResolveRebaseDecisionsInput {
  impact: ActTeachingProjectionImpactSet;
  /** Persisted author decisions from prior review cycles. */
  authorDecisions?: readonly RebaseDecisionRecord[];
  /**
   * When true (default), unresolved REVIEW_REQUIRED does not throw —
   * caller stages rebuild only after resolving or accepts partial report.
   */
  allowUnresolved?: boolean;
}

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortDecisions(rows: RebaseDecisionRecord[]): RebaseDecisionRecord[] {
  return [...rows].sort((a, b) => compareCodePoint(a.decisionId, b.decisionId));
}

function decisionBodyForDigest(
  record: Omit<RebaseDecisionRecord, 'decisionId' | 'decisionBodyDigest' | 'contract'>,
): Record<string, string | null> {
  return {
    kind: record.kind,
    subjectKind: record.subjectKind,
    subjectId: record.subjectId,
    packageId: record.packageId,
    sourceCanonicalId: record.sourceCanonicalId,
    successorCanonicalId: record.successorCanonicalId,
    category: record.category,
    compatibilityRule: record.compatibilityRule,
    compatibilityRuleVersion: record.compatibilityRuleVersion,
    deltaIdentity: record.deltaIdentity,
    deltaOutputDigest: record.deltaOutputDigest,
    authorityReleaseId: record.authorityReleaseId,
    reason: record.reason,
  };
}

export function buildRebaseDecision(
  partial: Omit<
    RebaseDecisionRecord,
    'contract' | 'decisionId' | 'decisionBodyDigest' | 'compatibilityRuleVersion'
  > & {
    compatibilityRuleVersion?: typeof ACT_TEACHING_PROJECTION_REBASE_COMPAT_RULE_VERSION;
  },
): RebaseDecisionRecord {
  const body = decisionBodyForDigest({
    kind: partial.kind,
    subjectKind: partial.subjectKind,
    subjectId: partial.subjectId,
    packageId: partial.packageId,
    sourceCanonicalId: partial.sourceCanonicalId,
    successorCanonicalId: partial.successorCanonicalId,
    category: partial.category,
    compatibilityRule: partial.compatibilityRule,
    compatibilityRuleVersion:
      partial.compatibilityRuleVersion ?? ACT_TEACHING_PROJECTION_REBASE_COMPAT_RULE_VERSION,
    deltaIdentity: partial.deltaIdentity,
    deltaOutputDigest: partial.deltaOutputDigest,
    authorityReleaseId: partial.authorityReleaseId,
    reason: partial.reason,
  });
  const decisionBodyDigest = projectionDigest(body);
  const decisionId = projectionDigest({
    ...body,
    decisionBodyDigest,
  }).slice(0, 32);

  return {
    contract: ACT_TEACHING_PROJECTION_REBASE_DECISION_CONTRACT,
    decisionId: `rbd:${decisionId}`,
    kind: partial.kind,
    subjectKind: partial.subjectKind,
    subjectId: partial.subjectId,
    packageId: partial.packageId,
    sourceCanonicalId: partial.sourceCanonicalId,
    successorCanonicalId: partial.successorCanonicalId,
    category: partial.category,
    compatibilityRule: partial.compatibilityRule,
    compatibilityRuleVersion:
      partial.compatibilityRuleVersion ?? ACT_TEACHING_PROJECTION_REBASE_COMPAT_RULE_VERSION,
    deltaIdentity: partial.deltaIdentity,
    deltaOutputDigest: partial.deltaOutputDigest,
    authorityReleaseId: partial.authorityReleaseId,
    reason: partial.reason,
    decisionBodyDigest,
  };
}

function authorDecisionKey(d: RebaseDecisionRecord): string {
  return [
    d.packageId,
    d.subjectKind,
    d.subjectId,
    d.sourceCanonicalId ?? '',
    d.category,
  ].join('\u001f');
}

/**
 * Validate a reused author decision against current impact/delta/authority.
 * Fail closed on any drift.
 */
export function assertAuthorDecisionCompatible(
  decision: RebaseDecisionRecord,
  impact: ActTeachingProjectionImpactSet,
  item: ActImpactItem,
): void {
  if (decision.kind !== 'AUTHOR_DECISION' && decision.kind !== 'AUTO_REBASE') {
    // Only author/auto decisions are reusable across builds.
    throw new TeachingProjectionRebaseError(
      'decision-kind-invalid',
      `cannot reuse decision kind ${decision.kind} for ${decision.subjectId}`,
    );
  }

  if (decision.deltaOutputDigest !== impact.deltaOutputDigest) {
    throw new TeachingProjectionRebaseError(
      'decision-delta-drift',
      `author decision ${decision.decisionId} delta digest drifted`,
    );
  }
  if (decision.authorityReleaseId !== impact.authorityReleaseId) {
    throw new TeachingProjectionRebaseError(
      'decision-authority-drift',
      `author decision ${decision.decisionId} authority release drifted`,
    );
  }
  if (decision.packageId !== item.packageId || decision.subjectId !== item.subjectId) {
    throw new TeachingProjectionRebaseError(
      'decision-subject-drift',
      `author decision ${decision.decisionId} subject mismatch`,
    );
  }
  if (decision.category !== item.category) {
    throw new TeachingProjectionRebaseError(
      'decision-category-drift',
      `author decision ${decision.decisionId} category drifted (${decision.category} ≠ ${item.category})`,
    );
  }
  if (
    decision.sourceCanonicalId != null
    && item.canonicalId != null
    && decision.sourceCanonicalId !== item.canonicalId
  ) {
    throw new TeachingProjectionRebaseError(
      'decision-canonical-drift',
      `author decision ${decision.decisionId} source canonical drifted`,
    );
  }

  // Successor must still be one of the impact successors when present.
  if (
    decision.successorCanonicalId != null
    && item.successors.length > 0
    && !item.successors.includes(decision.successorCanonicalId)
  ) {
    throw new TeachingProjectionRebaseError(
      'decision-successor-drift',
      `author decision ${decision.decisionId} successor not in current impact successors`,
    );
  }

  // Recompute body digest to detect mutation of persisted decision payloads.
  const expected = buildRebaseDecision({
    kind: decision.kind,
    subjectKind: decision.subjectKind,
    subjectId: decision.subjectId,
    packageId: decision.packageId,
    sourceCanonicalId: decision.sourceCanonicalId,
    successorCanonicalId: decision.successorCanonicalId,
    category: decision.category,
    compatibilityRule: decision.compatibilityRule,
    compatibilityRuleVersion: decision.compatibilityRuleVersion,
    deltaIdentity: decision.deltaIdentity,
    deltaOutputDigest: decision.deltaOutputDigest,
    authorityReleaseId: decision.authorityReleaseId,
    reason: decision.reason,
  });
  if (expected.decisionBodyDigest !== decision.decisionBodyDigest) {
    throw new TeachingProjectionRebaseError(
      'decision-body-drift',
      `author decision ${decision.decisionId} body digest mismatch`,
    );
  }
}

function dispositionToDecisionKind(
  disposition: ActImpactItem['disposition'],
): RebaseDecisionKind {
  switch (disposition) {
    case 'AUTO_REBASE_CANDIDATE':
      return 'AUTO_REBASE';
    case 'REVIEW_REQUIRED':
      return 'REVIEW_REQUIRED';
    case 'LOCAL_CHECK':
      return 'LOCAL_CHECK';
    case 'INDEX_REBUILD':
      return 'INDEX_REBUILD';
    case 'NO_REVIEW':
      return 'NO_REVIEW';
    case 'ENGINEERING_ONLY':
      return 'NO_REVIEW';
    case 'CARRY_FORWARD':
      return 'CARRY_FORWARD';
    default:
      return 'REVIEW_REQUIRED';
  }
}

/**
 * Resolve decisions for every impact item.
 * AUTO_REBASE for ordinary bindings with one compatible successor.
 * Author decisions override REVIEW_REQUIRED / LOCAL_CHECK when compatible.
 */
export function resolveRebaseDecisions(
  input: ResolveRebaseDecisionsInput,
): {
  decisions: RebaseDecisionRecord[];
  unresolved: ActImpactItem[];
  autoRebasedSubjectIds: string[];
} {
  const { impact } = input;
  const authorByKey = new Map<string, RebaseDecisionRecord>();
  for (const d of input.authorDecisions ?? []) {
    authorByKey.set(authorDecisionKey(d), d);
  }

  const decisions: RebaseDecisionRecord[] = [];
  const unresolved: ActImpactItem[] = [];
  const autoRebasedSubjectIds: string[] = [];

  for (const item of impact.items) {
    const kind = dispositionToDecisionKind(item.disposition);

    if (kind === 'NO_REVIEW' || kind === 'INDEX_REBUILD' || kind === 'CARRY_FORWARD') {
      decisions.push(buildRebaseDecision({
        kind,
        subjectKind: item.subjectKind,
        subjectId: item.subjectId,
        packageId: item.packageId,
        sourceCanonicalId: item.canonicalId,
        successorCanonicalId: item.successors[0] ?? null,
        category: item.category,
        compatibilityRule: null,
        deltaIdentity: item.deltaIdentity,
        deltaOutputDigest: impact.deltaOutputDigest,
        authorityReleaseId: impact.authorityReleaseId,
        reason: item.detail,
      }));
      continue;
    }

    if (kind === 'AUTO_REBASE') {
      const successor = item.successors[0] ?? null;
      if (!successor || item.successors.length !== 1) {
        // Ambiguous — fail closed to review.
        const reviewItem = { ...item, disposition: 'REVIEW_REQUIRED' as const };
        unresolved.push(reviewItem);
        decisions.push(buildRebaseDecision({
          kind: 'REVIEW_REQUIRED',
          subjectKind: item.subjectKind,
          subjectId: item.subjectId,
          packageId: item.packageId,
          sourceCanonicalId: item.canonicalId,
          successorCanonicalId: null,
          category: item.category,
          compatibilityRule: null,
          deltaIdentity: item.deltaIdentity,
          deltaOutputDigest: impact.deltaOutputDigest,
          authorityReleaseId: impact.authorityReleaseId,
          reason: 'auto-rebase aborted: successor not uniquely determined',
        }));
        continue;
      }

      // Cards/prerequisites must not auto-rebase binding identity path as AUTO;
      // impact already marks them LOCAL_CHECK. Defensive guard:
      if (item.subjectKind === 'card' || item.subjectKind === 'prerequisite') {
        unresolved.push({ ...item, disposition: 'LOCAL_CHECK' });
        decisions.push(buildRebaseDecision({
          kind: 'LOCAL_CHECK',
          subjectKind: item.subjectKind,
          subjectId: item.subjectId,
          packageId: item.packageId,
          sourceCanonicalId: item.canonicalId,
          successorCanonicalId: successor,
          category: item.category,
          compatibilityRule: AUTO_REBASE_RULE,
          deltaIdentity: item.deltaIdentity,
          deltaOutputDigest: impact.deltaOutputDigest,
          authorityReleaseId: impact.authorityReleaseId,
          reason: item.detail,
        }));
        continue;
      }

      const decision = buildRebaseDecision({
        kind: 'AUTO_REBASE',
        subjectKind: item.subjectKind,
        subjectId: item.subjectId,
        packageId: item.packageId,
        sourceCanonicalId: item.canonicalId,
        successorCanonicalId: successor,
        category: item.category,
        compatibilityRule: AUTO_REBASE_RULE,
        deltaIdentity: item.deltaIdentity,
        deltaOutputDigest: impact.deltaOutputDigest,
        authorityReleaseId: impact.authorityReleaseId,
        reason: `auto-rebase ${item.canonicalId} → ${successor} via ${AUTO_REBASE_RULE}`,
      });
      decisions.push(decision);
      autoRebasedSubjectIds.push(item.subjectId);
      continue;
    }

    // REVIEW_REQUIRED or LOCAL_CHECK — try author decision reuse.
    const key = authorDecisionKey(buildRebaseDecision({
      kind: 'AUTHOR_DECISION',
      subjectKind: item.subjectKind,
      subjectId: item.subjectId,
      packageId: item.packageId,
      sourceCanonicalId: item.canonicalId,
      successorCanonicalId: item.successors[0] ?? null,
      category: item.category,
      compatibilityRule: null,
      deltaIdentity: item.deltaIdentity,
      deltaOutputDigest: impact.deltaOutputDigest,
      authorityReleaseId: impact.authorityReleaseId,
      reason: 'lookup',
    }));
    // Author map keys use source fields, not decisionId:
    const lookupKey = [
      item.packageId,
      item.subjectKind,
      item.subjectId,
      item.canonicalId ?? '',
      item.category,
    ].join('\u001f');
    void key;
    const author = authorByKey.get(lookupKey);
    if (author) {
      assertAuthorDecisionCompatible(author, impact, item);
      // Promote to AUTHOR_DECISION retention as-is (already validated).
      decisions.push(author);
      if (author.kind === 'AUTHOR_DECISION' || author.kind === 'AUTO_REBASE') {
        autoRebasedSubjectIds.push(item.subjectId);
      }
      continue;
    }

    unresolved.push(item);
    decisions.push(buildRebaseDecision({
      kind: kind === 'LOCAL_CHECK' ? 'LOCAL_CHECK' : 'REVIEW_REQUIRED',
      subjectKind: item.subjectKind,
      subjectId: item.subjectId,
      packageId: item.packageId,
      sourceCanonicalId: item.canonicalId,
      successorCanonicalId: item.successors[0] ?? null,
      category: item.category,
      compatibilityRule: null,
      deltaIdentity: item.deltaIdentity,
      deltaOutputDigest: impact.deltaOutputDigest,
      authorityReleaseId: impact.authorityReleaseId,
      reason: item.detail,
    }));
  }

  if (input.allowUnresolved === false && unresolved.length > 0) {
    throw new TeachingProjectionRebaseError(
      'review-required',
      `${unresolved.length} impact item(s) require author review in package ${impact.packageId}`,
    );
  }

  return {
    decisions: sortDecisions(decisions),
    unresolved: [...unresolved].sort((a, b) =>
      compareCodePoint(`${a.subjectKind}:${a.subjectId}`, `${b.subjectKind}:${b.subjectId}`)),
    autoRebasedSubjectIds: [...autoRebasedSubjectIds].sort(compareCodePoint),
  };
}

/**
 * Apply AUTO_REBASE / AUTHOR_DECISION canonical rewrites to authoring-like records.
 */
export function applyCanonicalRewrites<T extends { canonicalId: string }>(
  rows: readonly T[],
  decisions: readonly RebaseDecisionRecord[],
  idOf: (row: T) => string,
): T[] {
  const rewriteBySubject = new Map<string, string>();
  for (const d of decisions) {
    if (
      (d.kind === 'AUTO_REBASE' || d.kind === 'AUTHOR_DECISION')
      && d.sourceCanonicalId
      && d.successorCanonicalId
      && (d.subjectKind === 'binding' || d.subjectKind === 'core-node' || d.subjectKind === 'card')
    ) {
      rewriteBySubject.set(d.subjectId, d.successorCanonicalId);
    }
  }

  // Also map by source canonical for bindings rewritten via resource-level decisions.
  const rewriteBySource = new Map<string, string>();
  for (const d of decisions) {
    if (
      (d.kind === 'AUTO_REBASE' || d.kind === 'AUTHOR_DECISION')
      && d.sourceCanonicalId
      && d.successorCanonicalId
      && d.subjectKind === 'binding'
    ) {
      rewriteBySource.set(d.sourceCanonicalId, d.successorCanonicalId);
    }
  }

  return rows.map((row) => {
    const byId = rewriteBySubject.get(idOf(row));
    if (byId) return { ...row, canonicalId: byId };
    const bySource = rewriteBySource.get(row.canonicalId);
    if (bySource) return { ...row, canonicalId: bySource };
    return { ...row };
  });
}

export function applyPrerequisiteRewrites<T extends {
  prerequisiteId?: string;
  sourceCanonicalId: string;
  targetCanonicalId: string;
}>(
  rows: readonly T[],
  decisions: readonly RebaseDecisionRecord[],
): T[] {
  const rewriteBySource = new Map<string, string>();
  for (const d of decisions) {
    if (
      (d.kind === 'AUTO_REBASE' || d.kind === 'AUTHOR_DECISION')
      && d.sourceCanonicalId
      && d.successorCanonicalId
    ) {
      // Only rewrite prereq endpoints when an author decision exists for that prereq
      // or a binding auto-rebase provides a unique successor for the endpoint.
      if (d.subjectKind === 'prerequisite') {
        rewriteBySource.set(d.sourceCanonicalId, d.successorCanonicalId);
      } else if (d.subjectKind === 'binding' || d.subjectKind === 'core-node') {
        rewriteBySource.set(d.sourceCanonicalId, d.successorCanonicalId);
      }
    }
  }

  // LOCAL_CHECK / REVIEW_REQUIRED prerequisites are not auto-rewritten.
  const blocked = new Set(
    decisions
      .filter((d) =>
        d.subjectKind === 'prerequisite'
        && (d.kind === 'REVIEW_REQUIRED' || d.kind === 'LOCAL_CHECK'))
      .map((d) => d.subjectId),
  );

  return rows.map((row) => {
    if (row.prerequisiteId && blocked.has(row.prerequisiteId)) {
      return { ...row };
    }
    const source = rewriteBySource.get(row.sourceCanonicalId) ?? row.sourceCanonicalId;
    const target = rewriteBySource.get(row.targetCanonicalId) ?? row.targetCanonicalId;
    return {
      ...row,
      sourceCanonicalId: source,
      targetCanonicalId: target,
    };
  });
}
