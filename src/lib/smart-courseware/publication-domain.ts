import { contentHash, normalizeSourceBindings } from '@/lib/smart-lesson-plan/domain';
import type { SmartLessonPlan } from '@/lib/smart-lesson-plan/schema';

export const PUBLICATION_PENDING_SOURCE_STATES = [
  'ai_generated_source_pending',
  'teacher_created_source_pending',
] as const;

export type PublicationPendingSourceState = typeof PUBLICATION_PENDING_SOURCE_STATES[number];
export type PublicationGapTargetType = 'GOAL' | 'MODULE';

export type ApprovedPlanSnapshot = {
  id: string;
  revisionNumber: number;
  contentHash: string;
  content: SmartLessonPlan;
};

export type ImmutableCoursewareRevisionSnapshot = {
  id: string;
  revisionNumber: number;
  planRevisionId: string;
  planRevisionNumber: number;
  planContentHash: string;
  manifestHash: string;
  moduleMetadataHash: string;
  contentHash: string;
  moduleMetadataSnapshot: readonly {
    moduleId: string;
    moduleContentHash: string;
    sourceState: string;
    sourceBindings?: unknown;
    sourceBindingSetHash: string;
    gapIdentity: string | null;
    moduleInstanceLineage?: string;
  }[];
};

export type PublicationPendingGap = {
  targetType: PublicationGapTargetType;
  targetId: string;
  targetContentHash: string;
  gapIdentity: string;
  sourceState: PublicationPendingSourceState;
  sourceBindingSetHash: string;
};

export type PublicationValidationReceipt = {
  kind: 'STATIC' | 'BROWSER';
  passed: boolean;
  contentHash: string;
  validatorVersion: string;
  actorId: string;
  completedAt: string;
  browser?: { name: string; version: string };
  fonts?: readonly { family: string; version: string }[];
  viewport?: { width: number; height: number; deviceScaleFactor: number };
};

export type PublicationValidationProfile = {
  staticValidatorVersion: string;
  browserValidatorVersion: string;
  browser: { name: string; version: string };
  fonts: readonly { family: string; version: string }[];
  viewport: { width: number; height: number; deviceScaleFactor: number };
};

export type PublicationGapAcknowledgement = PublicationPendingGap & {
  actorId: string;
  acknowledgedAt: string;
  reason: string;
  planRevisionId?: string;
  coursewareContentHash?: string;
};

export type StaleBaselineAcknowledgement = {
  baselinePlanRevisionId: string;
  baselinePlanRevisionNumber: number;
  baselinePlanContentHash: string;
  newestPlanRevisionId: string;
  newestPlanRevisionNumber: number;
  newestPlanContentHash: string;
  actorId: string;
  acknowledgedAt: string;
  reason: string;
};

export type PublicationEligibilityIssue = {
  code:
    | 'publication-plan-snapshot-mismatch'
    | 'publication-static-receipt-required'
    | 'publication-browser-receipt-required'
    | 'goal-source-gap-identity-invalid'
    | 'module-source-gap-identity-invalid'
    | 'publication-gap-target-invalid'
    | 'goal-source-gap-acknowledgement'
    | 'module-source-gap-acknowledgement'
    | 'stale-baseline-confirmation';
  targetType?: PublicationGapTargetType;
  targetId?: string;
  gapIdentity?: string;
};

export type PublicationEligibilityInput = {
  revision: ImmutableCoursewareRevisionSnapshot;
  approvedPlan: ApprovedPlanSnapshot;
  newestApprovedPlan: Pick<ApprovedPlanSnapshot, 'id' | 'revisionNumber' | 'contentHash'>;
  receipts: readonly PublicationValidationReceipt[];
  validationProfile: PublicationValidationProfile;
  gapAcknowledgements: readonly PublicationGapAcknowledgement[];
  staleBaselineAcknowledgements: readonly StaleBaselineAcknowledgement[];
  /** Advisory only. Deliberately excluded from every gate and evidence hash. */
  aiReview?: unknown;
};

export type PublicationEligibility = {
  eligible: boolean;
  contentHash: string;
  evidenceHash: string;
  pendingGaps: PublicationPendingGap[];
  issues: PublicationEligibilityIssue[];
};

export function enumeratePublicationPendingGaps(input: {
  revision: ImmutableCoursewareRevisionSnapshot;
  approvedPlan: ApprovedPlanSnapshot;
}): PublicationPendingGap[] {
  const goals = input.approvedPlan.content.goals.flatMap((goal): PublicationPendingGap[] => {
    const sourceState = pendingSourceState(goal.sourceState);
    if (!sourceState || !validTargetId(goal.id) || !validGapIdentity(goal.gapIdentity, 'smart-goal-gap:')) return [];
    return [{
      targetType: 'GOAL',
      targetId: goal.id,
      targetContentHash: contentHash(goal.content),
      gapIdentity: goal.gapIdentity,
      sourceState,
      sourceBindingSetHash: contentHash(normalizeSourceBindings(goal.sourceBindings)),
    }];
  });
  const modules = input.revision.moduleMetadataSnapshot.flatMap((module): PublicationPendingGap[] => {
    const sourceState = pendingSourceState(module.sourceState);
    if (!sourceState
      || !validTargetId(module.moduleId)
      || !validSha256(module.moduleContentHash)
      || !validSha256(module.sourceBindingSetHash)
      || !validGapIdentity(module.gapIdentity, 'courseware-gap:')) return [];
    return [{
      targetType: 'MODULE',
      targetId: module.moduleId,
      targetContentHash: module.moduleContentHash,
      gapIdentity: module.gapIdentity,
      sourceState,
      sourceBindingSetHash: module.sourceBindingSetHash,
    }];
  });
  return [...goals, ...modules].sort(compareGaps);
}

export function publicationContentHash(input: {
  revision: ImmutableCoursewareRevisionSnapshot;
  approvedPlan: ApprovedPlanSnapshot;
}): string {
  // Approval already hashes the immutable manifest, module metadata, gaps,
  // provenance, validation and plan baseline. Receipts must bind to that exact
  // approved content identity, not to a publication-specific re-hash.
  return input.revision.contentHash;
}

export function publicationEvidenceHash(input: {
  contentHash: string;
  receipts: readonly PublicationValidationReceipt[];
  gapAcknowledgements: readonly PublicationGapAcknowledgement[];
  staleBaselineAcknowledgements: readonly StaleBaselineAcknowledgement[];
}): string {
  return contentHash({
    contentHash: input.contentHash,
    receipts: sortByHash(input.receipts),
    gapAcknowledgements: sortByHash(input.gapAcknowledgements),
    staleBaselineAcknowledgements: sortByHash(input.staleBaselineAcknowledgements),
  });
}

export function validatePublicationEligibility(input: PublicationEligibilityInput): PublicationEligibility {
  const publicationHash = publicationContentHash(input);
  const pendingGaps = enumeratePublicationPendingGaps(input);
  const issues: PublicationEligibilityIssue[] = invalidPendingGapIssues(input);

  if (!planSnapshotMatchesRevision(input.revision, input.approvedPlan)) {
    issues.push({ code: 'publication-plan-snapshot-mismatch' });
  }
  if (!input.receipts.some((receipt) => validStaticReceipt(receipt, publicationHash, input.validationProfile))) {
    issues.push({ code: 'publication-static-receipt-required' });
  }
  if (!input.receipts.some((receipt) => validBrowserReceipt(receipt, publicationHash, input.validationProfile))) {
    issues.push({ code: 'publication-browser-receipt-required' });
  }

  for (const gap of pendingGaps) {
    if (!input.gapAcknowledgements.some((acknowledgement) => acknowledgesGap(acknowledgement, gap))) {
      issues.push({
        code: gap.targetType === 'GOAL'
          ? 'goal-source-gap-acknowledgement'
          : 'module-source-gap-acknowledgement',
        targetType: gap.targetType,
        targetId: gap.targetId,
        gapIdentity: gap.gapIdentity,
      });
    }
  }

  if (isStaleBaseline(input.approvedPlan, input.newestApprovedPlan)
    && !input.staleBaselineAcknowledgements.some((acknowledgement) => (
      completeStaleAcknowledgement(acknowledgement)
      && acknowledgement.baselinePlanRevisionId === input.approvedPlan.id
      && acknowledgement.baselinePlanRevisionNumber === input.approvedPlan.revisionNumber
      && acknowledgement.baselinePlanContentHash === input.approvedPlan.contentHash
      && acknowledgement.newestPlanRevisionId === input.newestApprovedPlan.id
      && acknowledgement.newestPlanRevisionNumber === input.newestApprovedPlan.revisionNumber
      && acknowledgement.newestPlanContentHash === input.newestApprovedPlan.contentHash
    ))) {
    issues.push({ code: 'stale-baseline-confirmation' });
  }

  issues.sort(compareIssues);
  return {
    eligible: issues.length === 0,
    contentHash: publicationHash,
    evidenceHash: publicationEvidenceHash({
      contentHash: publicationHash,
      receipts: input.receipts,
      gapAcknowledgements: input.gapAcknowledgements,
      staleBaselineAcknowledgements: input.staleBaselineAcknowledgements,
    }),
    pendingGaps,
    issues,
  };
}

function planSnapshotMatchesRevision(revision: ImmutableCoursewareRevisionSnapshot, plan: ApprovedPlanSnapshot) {
  return revision.planRevisionId === plan.id
    && revision.planRevisionNumber === plan.revisionNumber
    && revision.planContentHash === plan.contentHash
    && contentHash(plan.content) === plan.contentHash;
}

function invalidPendingGapIssues(input: Pick<PublicationEligibilityInput, 'revision' | 'approvedPlan'>) {
  const issues: PublicationEligibilityIssue[] = [];
  for (const goal of input.approvedPlan.content.goals) {
    if (!pendingSourceState(goal.sourceState)) continue;
    if (!validTargetId(goal.id)) {
      issues.push({ code: 'publication-gap-target-invalid', targetType: 'GOAL', targetId: goal.id });
    }
    if (!validGapIdentity(goal.gapIdentity, 'smart-goal-gap:')) {
      issues.push({
        code: 'goal-source-gap-identity-invalid',
        targetType: 'GOAL',
        targetId: goal.id,
        ...(goal.gapIdentity ? { gapIdentity: goal.gapIdentity } : {}),
      });
    }
  }
  for (const coursewareModule of input.revision.moduleMetadataSnapshot) {
    if (!pendingSourceState(coursewareModule.sourceState)) continue;
    if (!validTargetId(coursewareModule.moduleId)
      || !validSha256(coursewareModule.moduleContentHash)
      || !validSha256(coursewareModule.sourceBindingSetHash)) {
      issues.push({ code: 'publication-gap-target-invalid', targetType: 'MODULE', targetId: coursewareModule.moduleId });
    }
    if (!validGapIdentity(coursewareModule.gapIdentity, 'courseware-gap:')) {
      issues.push({
        code: 'module-source-gap-identity-invalid',
        targetType: 'MODULE',
        targetId: coursewareModule.moduleId,
        ...(coursewareModule.gapIdentity ? { gapIdentity: coursewareModule.gapIdentity } : {}),
      });
    }
  }
  return issues;
}

function validTargetId(value: string) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validSha256(value: string) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function validGapIdentity(
  value: string | null,
  prefix: 'smart-goal-gap:' | 'courseware-gap:',
): value is string {
  return typeof value === 'string'
    && value === value.trim()
    && value.startsWith(prefix)
    && value.length > prefix.length
    && value.length <= 200;
}

function validStaticReceipt(receipt: PublicationValidationReceipt, hash: string, profile: PublicationValidationProfile) {
  return receipt.kind === 'STATIC'
    && receipt.passed
    && receipt.contentHash === hash
    && receipt.validatorVersion === profile.staticValidatorVersion
    && completeReceipt(receipt);
}

function validBrowserReceipt(receipt: PublicationValidationReceipt, hash: string, profile: PublicationValidationProfile) {
  return receipt.kind === 'BROWSER'
    && receipt.passed
    && receipt.contentHash === hash
    && receipt.validatorVersion === profile.browserValidatorVersion
    && contentHash(receipt.browser ?? null) === contentHash(profile.browser)
    && contentHash(normalizeFonts(receipt.fonts ?? [])) === contentHash(normalizeFonts(profile.fonts))
    && contentHash(receipt.viewport ?? null) === contentHash(profile.viewport)
    && completeReceipt(receipt);
}

function completeReceipt(receipt: PublicationValidationReceipt) {
  return validRequiredText(receipt.actorId) && validRequiredText(receipt.completedAt);
}

function completeGapAcknowledgement(acknowledgement: PublicationGapAcknowledgement) {
  return validRequiredText(acknowledgement.gapIdentity)
    && validRequiredText(acknowledgement.actorId)
    && validRequiredText(acknowledgement.acknowledgedAt)
    && validRequiredText(acknowledgement.reason);
}

function acknowledgesGap(acknowledgement: PublicationGapAcknowledgement, gap: PublicationPendingGap) {
  return completeGapAcknowledgement(acknowledgement)
    && acknowledgement.gapIdentity === gap.gapIdentity
    && acknowledgement.targetType === gap.targetType
    && acknowledgement.targetId === gap.targetId
    && acknowledgement.targetContentHash === gap.targetContentHash
    && acknowledgement.sourceState === gap.sourceState
    && acknowledgement.sourceBindingSetHash === gap.sourceBindingSetHash;
}

function completeStaleAcknowledgement(acknowledgement: StaleBaselineAcknowledgement) {
  return validRequiredText(acknowledgement.actorId)
    && validRequiredText(acknowledgement.acknowledgedAt)
    && validRequiredText(acknowledgement.reason);
}

function validRequiredText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStaleBaseline(
  baseline: Pick<ApprovedPlanSnapshot, 'id' | 'revisionNumber' | 'contentHash'>,
  newest: Pick<ApprovedPlanSnapshot, 'id' | 'revisionNumber' | 'contentHash'>,
) {
  return baseline.id !== newest.id
    || baseline.revisionNumber !== newest.revisionNumber
    || baseline.contentHash !== newest.contentHash;
}

function pendingSourceState(value: string): PublicationPendingSourceState | null {
  if (value === 'AI_GENERATED_SOURCE_PENDING' || value === 'ai_generated_source_pending') {
    return 'ai_generated_source_pending';
  }
  if (value === 'TEACHER_CREATED_SOURCE_PENDING' || value === 'teacher_created_source_pending') {
    return 'teacher_created_source_pending';
  }
  return null;
}

function normalizeFonts(fonts: readonly { family: string; version: string }[]) {
  return [...fonts].sort((left, right) => (
    left.family.localeCompare(right.family) || left.version.localeCompare(right.version)
  ));
}

function sortByHash<T>(values: readonly T[]) {
  return [...values].sort((left, right) => contentHash(left).localeCompare(contentHash(right)));
}

function compareGaps(left: PublicationPendingGap, right: PublicationPendingGap) {
  return left.targetType.localeCompare(right.targetType)
    || left.targetId.localeCompare(right.targetId)
    || left.gapIdentity.localeCompare(right.gapIdentity);
}

function compareIssues(left: PublicationEligibilityIssue, right: PublicationEligibilityIssue) {
  return left.code.localeCompare(right.code)
    || (left.targetType ?? '').localeCompare(right.targetType ?? '')
    || (left.targetId ?? '').localeCompare(right.targetId ?? '')
    || (left.gapIdentity ?? '').localeCompare(right.gapIdentity ?? '');
}
