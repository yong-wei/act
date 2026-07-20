import { describe, expect, it } from 'vitest';

import { sourceBindingFixture, validPlanFixture } from '@/lib/smart-lesson-plan/__tests__/fixtures';
import { contentHash } from '@/lib/smart-lesson-plan/domain';
import { validateSmartLessonPlan } from '@/lib/smart-lesson-plan/schema';

import {
  enumeratePublicationPendingGaps,
  publicationContentHash,
  publicationEvidenceHash,
  validatePublicationEligibility,
  type ApprovedPlanSnapshot,
  type ImmutableCoursewareRevisionSnapshot,
  type PublicationEligibilityInput,
  type PublicationGapAcknowledgement,
  type PublicationPendingGap,
  type PublicationValidationReceipt,
} from '../publication-domain';

describe('smart courseware publication domain', () => {
  it('enumerates both canonical pending lineages from immutable goal and module snapshots', () => {
    const fixture = publicationFixture();

    expect(fixture.gaps).toEqual([
      expect.objectContaining({
        targetType: 'GOAL', targetId: 'goal-1', gapIdentity: 'smart-goal-gap:goal-1',
        sourceState: 'teacher_created_source_pending',
      }),
      expect.objectContaining({
        targetType: 'MODULE', targetId: 'module-1', gapIdentity: 'courseware-gap:module-1',
        sourceState: 'ai_generated_source_pending',
      }),
    ]);
    expect(fixture.gaps.every((gap) => gap.targetContentHash.length === 64)).toBe(true);
  });

  it('passes only with exact static/browser receipts and individual gap acknowledgements', () => {
    const fixture = publicationFixture();
    const result = validatePublicationEligibility(fixture.input);

    expect(result).toMatchObject({ eligible: true, issues: [], pendingGaps: fixture.gaps });
    expect(result.contentHash).toBe(publicationContentHash(fixture.input));
    expect(result.evidenceHash).toBe(publicationEvidenceHash({
      contentHash: result.contentHash,
      receipts: fixture.input.receipts,
      gapAcknowledgements: fixture.input.gapAcknowledgements,
      staleBaselineAcknowledgements: fixture.input.staleBaselineAcknowledgements,
    }));
  });

  it.each([
    ['content hash', (receipt: PublicationValidationReceipt) => { receipt.contentHash = 'wrong'; }],
    ['validator version', (receipt: PublicationValidationReceipt) => { receipt.validatorVersion = 'wrong'; }],
    ['browser version', (receipt: PublicationValidationReceipt) => { receipt.browser = { name: 'chromium', version: '126' }; }],
    ['font version', (receipt: PublicationValidationReceipt) => { receipt.fonts = [{ family: 'Noto Sans SC', version: '2' }]; }],
    ['viewport', (receipt: PublicationValidationReceipt) => { receipt.viewport = { width: 390, height: 844, deviceScaleFactor: 2 }; }],
  ])('rejects a browser receipt with a mismatched %s', (_label, mutate) => {
    const fixture = publicationFixture();
    const receipts = structuredClone(fixture.input.receipts);
    mutate(receipts[1]);

    expect(validatePublicationEligibility({ ...fixture.input, receipts }).issues)
      .toContainEqual({ code: 'publication-browser-receipt-required' });
  });

  it('rejects a failed or stale static receipt independently of browser validation', () => {
    const fixture = publicationFixture();
    const receipts = structuredClone(fixture.input.receipts);
    receipts[0].passed = false;

    expect(validatePublicationEligibility({ ...fixture.input, receipts }).issues)
      .toContainEqual({ code: 'publication-static-receipt-required' });
  });

  it('matches acknowledgements to exact stable gap identity and audit target fields', () => {
    const fixture = publicationFixture();
    const wrongIdentity = structuredClone(fixture.input.gapAcknowledgements);
    wrongIdentity[0].gapIdentity = 'smart-goal-gap:recreated';
    const wrongTargetState = structuredClone(fixture.input.gapAcknowledgements);
    wrongTargetState[1].sourceState = 'teacher_created_source_pending';

    expect(validatePublicationEligibility({ ...fixture.input, gapAcknowledgements: wrongIdentity }).issues)
      .toContainEqual(expect.objectContaining({ code: 'goal-source-gap-acknowledgement' }));
    expect(validatePublicationEligibility({ ...fixture.input, gapAcknowledgements: wrongTargetState }).issues)
      .toContainEqual(expect.objectContaining({ code: 'module-source-gap-acknowledgement' }));
  });

  it.each([
    ['teacher goal', 'GOAL', 'TEACHER_CREATED_SOURCE_PENDING'],
    ['AI module', 'MODULE', 'AI_GENERATED_SOURCE_PENDING'],
  ] as const)('fails closed when a pending %s has no gap identity', (_label, targetType, sourceState) => {
    const fixture = publicationFixture();
    const input = structuredClone(fixture.input);
    if (targetType === 'GOAL') {
      input.approvedPlan.content.goals[0].sourceState = sourceState;
      input.approvedPlan.content.goals[0].gapIdentity = null;
      input.approvedPlan.contentHash = contentHash(input.approvedPlan.content);
      input.revision.planContentHash = input.approvedPlan.contentHash;
      input.revision.contentHash = contentHash({ malformed: targetType });
      input.newestApprovedPlan = input.approvedPlan;
    } else {
      input.revision.moduleMetadataSnapshot[0].sourceState = sourceState;
      input.revision.moduleMetadataSnapshot[0].gapIdentity = null;
      input.revision.contentHash = contentHash({ malformed: targetType });
    }

    const result = validatePublicationEligibility(input);
    expect(result.eligible).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: targetType === 'GOAL'
        ? 'goal-source-gap-identity-invalid'
        : 'module-source-gap-identity-invalid',
      targetType,
    }));
  });

  it('reports malformed pending target audit fields instead of treating the module as acknowledged', () => {
    const fixture = publicationFixture();
    const revision = structuredClone(fixture.revision);
    revision.moduleMetadataSnapshot[0].moduleContentHash = '';

    const result = validatePublicationEligibility({ ...fixture.input, revision });
    expect(result.eligible).toBe(false);
    expect(result.issues).toContainEqual({
      code: 'publication-gap-target-invalid', targetType: 'MODULE', targetId: 'module-1',
    });
  });

  it('rejects an acknowledgement with a missing identity audit field without throwing', () => {
    const fixture = publicationFixture();
    const acknowledgements = structuredClone(fixture.input.gapAcknowledgements);
    Reflect.deleteProperty(acknowledgements[0], 'targetContentHash');

    expect(validatePublicationEligibility({
      ...fixture.input,
      gapAcknowledgements: acknowledgements,
    }).issues).toContainEqual(expect.objectContaining({ code: 'goal-source-gap-acknowledgement' }));
  });

  it('keeps the valid identity acknowledgement path eligible', () => {
    const fixture = publicationFixture();
    expect(validatePublicationEligibility(fixture.input)).toMatchObject({ eligible: true, issues: [] });
  });

  it('preserves a gap acknowledgement across unrelated edits while invalidating whole-content receipts', () => {
    const fixture = publicationFixture();
    const changedPlanContent = structuredClone(fixture.plan.content);
    changedPlanContent.limitations.push('unrelated plan note');
    const changedPlan = { ...fixture.plan, content: changedPlanContent, contentHash: contentHash(changedPlanContent) };
    const changedRevision = {
      ...fixture.revision,
      planContentHash: changedPlan.contentHash,
      contentHash: contentHash({ previous: fixture.revision.contentHash, unrelatedEdit: true }),
    };
    const changedInput = {
      ...fixture.input,
      revision: changedRevision,
      approvedPlan: changedPlan,
      newestApprovedPlan: changedPlan,
    };
    const result = validatePublicationEligibility(changedInput);

    expect(enumeratePublicationPendingGaps(changedInput)).toEqual(fixture.gaps);
    expect(result.issues).not.toContainEqual(expect.objectContaining({ code: 'goal-source-gap-acknowledgement' }));
    expect(result.issues).not.toContainEqual(expect.objectContaining({ code: 'module-source-gap-acknowledgement' }));
    expect(result.issues).toEqual(expect.arrayContaining([
      { code: 'publication-static-receipt-required' },
      { code: 'publication-browser-receipt-required' },
    ]));
  });

  it.each(['content', 'source-state', 'source-bindings', 'delete-recreate'] as const)(
    'requires a new acknowledgement when module %s changes its gap identity',
    (change) => {
      const fixture = publicationFixture();
      const revision = structuredClone(fixture.revision);
      const module = revision.moduleMetadataSnapshot[0];
      if (change === 'content') module.moduleContentHash = contentHash('changed module');
      if (change === 'source-state') module.sourceState = 'TEACHER_CREATED_SOURCE_PENDING';
      if (change === 'source-bindings') module.sourceBindingSetHash = contentHash([sourceBindingFixture]);
      if (change === 'delete-recreate') module.moduleInstanceLineage = 'module-lineage-recreated';
      module.gapIdentity = `courseware-gap:${change}`;

      expect(validatePublicationEligibility({ ...fixture.input, revision }).issues)
        .toContainEqual(expect.objectContaining({
          code: 'module-source-gap-acknowledgement',
          gapIdentity: `courseware-gap:${change}`,
        }));
    },
  );

  it('requires an acknowledgement of the exact stale baseline comparison', () => {
    const fixture = publicationFixture();
    const newestApprovedPlan = { id: 'plan-2', revisionNumber: 2, contentHash: 'f'.repeat(64) };
    const stale = { ...fixture.input, newestApprovedPlan, staleBaselineAcknowledgements: [] };
    expect(validatePublicationEligibility(stale).issues)
      .toContainEqual({ code: 'stale-baseline-confirmation' });

    const acknowledgement = {
      baselinePlanRevisionId: fixture.plan.id,
      baselinePlanRevisionNumber: fixture.plan.revisionNumber,
      baselinePlanContentHash: fixture.plan.contentHash,
      newestPlanRevisionId: newestApprovedPlan.id,
      newestPlanRevisionNumber: newestApprovedPlan.revisionNumber,
      newestPlanContentHash: newestApprovedPlan.contentHash,
      actorId: 'teacher-1', acknowledgedAt: '2026-07-20T00:00:00.000Z', reason: 'publish tested prior plan',
    };
    expect(validatePublicationEligibility({ ...stale, staleBaselineAcknowledgements: [acknowledgement] }).issues)
      .not.toContainEqual({ code: 'stale-baseline-confirmation' });
    expect(validatePublicationEligibility({
      ...stale,
      staleBaselineAcknowledgements: [{ ...acknowledgement, newestPlanRevisionNumber: 3 }],
    }).issues).toContainEqual({ code: 'stale-baseline-confirmation' });
  });

  it('keeps AI review advisory and outside eligibility and evidence identity', () => {
    const fixture = publicationFixture();
    const passing = validatePublicationEligibility({ ...fixture.input, aiReview: { verdict: 'PASS' } });
    const critical = validatePublicationEligibility({ ...fixture.input, aiReview: { verdict: 'FAIL', severity: 'CRITICAL' } });

    expect(critical).toEqual(passing);
  });

  it('returns issues in deterministic order regardless of evidence ordering', () => {
    const fixture = publicationFixture();
    const failed = {
      ...fixture.input,
      receipts: [],
      gapAcknowledgements: [],
      newestApprovedPlan: { id: 'plan-2', revisionNumber: 2, contentHash: 'f'.repeat(64) },
    };
    const first = validatePublicationEligibility(failed);
    const second = validatePublicationEligibility({
      ...failed,
      revision: { ...failed.revision, moduleMetadataSnapshot: [...failed.revision.moduleMetadataSnapshot].reverse() },
    });

    expect(second.issues).toEqual(first.issues);
  });
});

function publicationFixture() {
  const content = validPlanFixture();
  content.goals[0] = {
    ...content.goals[0],
    sourceState: 'TEACHER_CREATED_SOURCE_PENDING',
    sourceBindings: [],
    gapIdentity: 'smart-goal-gap:goal-1',
  };
  const validated = validateSmartLessonPlan(content);
  const plan: ApprovedPlanSnapshot = {
    id: 'plan-1', revisionNumber: 1, content: validated, contentHash: contentHash(validated),
  };
  const moduleMetadataSnapshot = [{
    moduleId: 'module-1', moduleInstanceLineage: 'module-lineage-1', moduleContentHash: contentHash('module one'),
    sourceState: 'AI_GENERATED_SOURCE_PENDING', sourceBindings: [], sourceBindingSetHash: contentHash([]),
    gapIdentity: 'courseware-gap:module-1',
  }];
  const revision: ImmutableCoursewareRevisionSnapshot = {
    id: 'courseware-revision-1', revisionNumber: 1,
    planRevisionId: plan.id, planRevisionNumber: plan.revisionNumber, planContentHash: plan.contentHash,
    manifestHash: contentHash('manifest'), moduleMetadataHash: contentHash(moduleMetadataSnapshot),
    contentHash: contentHash({ plan: plan.contentHash, modules: moduleMetadataSnapshot }), moduleMetadataSnapshot,
  };
  const gaps = enumeratePublicationPendingGaps({ revision, approvedPlan: plan });
  const validationProfile = {
    staticValidatorVersion: 'static-v1', browserValidatorVersion: 'browser-v1',
    browser: { name: 'chromium', version: '125' },
    fonts: [{ family: 'Noto Sans SC', version: '1' }],
    viewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  };
  const exactContentHash = publicationContentHash({ revision, approvedPlan: plan });
  const receipts: PublicationValidationReceipt[] = [{
    kind: 'STATIC', passed: true, contentHash: exactContentHash, validatorVersion: 'static-v1',
    actorId: 'worker-static', completedAt: '2026-07-20T00:00:00.000Z',
  }, {
    kind: 'BROWSER', passed: true, contentHash: exactContentHash, validatorVersion: 'browser-v1',
    browser: validationProfile.browser, fonts: validationProfile.fonts, viewport: validationProfile.viewport,
    actorId: 'worker-browser', completedAt: '2026-07-20T00:01:00.000Z',
  }];
  const gapAcknowledgements: PublicationGapAcknowledgement[] = gaps.map((gap) => ({
    ...gap, actorId: 'teacher-1', acknowledgedAt: '2026-07-20T00:02:00.000Z', reason: 'source gap accepted',
  }));
  const input: PublicationEligibilityInput = {
    revision, approvedPlan: plan, newestApprovedPlan: plan, receipts, validationProfile,
    gapAcknowledgements, staleBaselineAcknowledgements: [],
  };
  return { input, plan, revision, gaps };
}
