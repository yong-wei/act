import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  buildGeneratedSlideBrowserExpectation,
  captureGeneratedSlideBrowserSnapshot,
  deriveGeneratedSlideStepRenderContract,
} from '@/features/interactive/shared/manifest-runtime/generated-slide-browser-measurement';

import { contentHash } from '@/lib/smart-lesson-plan/domain';
import { validateSmartLessonPlan } from '@/lib/smart-lesson-plan/schema';
import {
  GENERATED_SLIDE_LAYOUT_REGISTRY,
  type GeneratedSlideLayoutId,
  type GeneratedSlideManifest,
} from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import {
  GENERATED_SLIDE_BROWSER_FONT_FAMILY,
  GENERATED_SLIDE_BROWSER_FONT_SHA256,
  GENERATED_SLIDE_BROWSER_FONT_VERSION,
  GENERATED_SLIDE_BROWSER_GLYPH_METRIC_PX,
  GENERATED_SLIDE_BROWSER_GLYPH_SAMPLE,
  GENERATED_SLIDE_BROWSER_VALIDATOR_VERSION,
  GENERATED_SLIDE_BROWSER_VERSION,
  GENERATED_SLIDE_BROWSER_VIEWPORT_VERSION,
  validateGeneratedSlideBrowserSnapshot,
  type GeneratedSlideBrowserExpectation,
  type GeneratedSlideBrowserMeasurementSnapshot,
} from '@/features/interactive/shared/manifest-runtime/generated-slide-browser-validation';

import {
  SmartCoursewareError,
  assertPersistedCoursewareManifest,
  coursewareManifestHash,
  projectCoursewareForStudent,
  validateCoursewareComposition,
  type SmartCoursewareActor,
} from './domain';
import {
  enumeratePublicationPendingGaps,
  validatePublicationEligibility,
  type PublicationGapAcknowledgement,
  type PublicationValidationProfile,
  type PublicationValidationReceipt,
  type StaleBaselineAcknowledgement,
} from './publication-domain';

type PublicationDb = PrismaClient;
type ReceiptKind = 'STATIC' | 'BROWSER';
type GapScope = 'GOAL' | 'MODULE';

export const SMART_COURSEWARE_PUBLICATION_STATIC_VALIDATOR_VERSION = 'smart-courseware-publication-static-v1' as const;
export const SMART_COURSEWARE_PUBLICATION_VALIDATION_PROFILE: PublicationValidationProfile = Object.freeze({
  staticValidatorVersion: SMART_COURSEWARE_PUBLICATION_STATIC_VALIDATOR_VERSION,
  browserValidatorVersion: GENERATED_SLIDE_BROWSER_VALIDATOR_VERSION,
  browser: { name: 'Chromium', version: GENERATED_SLIDE_BROWSER_VERSION },
  fonts: [{
    family: GENERATED_SLIDE_BROWSER_FONT_FAMILY,
    version: `${GENERATED_SLIDE_BROWSER_FONT_VERSION}:${GENERATED_SLIDE_BROWSER_FONT_SHA256}`,
  }],
  viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
});

const STATIC_PROFILE_HASH = contentHash({
  validatorVersion: SMART_COURSEWARE_PUBLICATION_STATIC_VALIDATOR_VERSION,
  runtimeContract: 'generated-slide-contract',
});
const BROWSER_PROFILE_HASH = contentHash(SMART_COURSEWARE_PUBLICATION_VALIDATION_PROFILE);

export async function getSmartCoursewarePublicationState(db: PublicationDb, input: {
  actor: SmartCoursewareActor;
  sourceRevisionId: string;
}) {
  const actor = validateActor(input.actor);
  const revision = await loadOwnedRevision(db, actor.id, validateId(input.sourceRevisionId));
  const gaps = publicationGaps(revision);
  const [receipts, acknowledgements, staleAcknowledgements, publication, latestPlan] = await Promise.all([
    db.smartCoursewarePublicationReceipt.findMany({
      where: { ownerId: actor.id, sourceRevisionId: revision.id, contentHash: revision.contentHash },
      orderBy: { completedAt: 'desc' },
    }),
    db.smartCoursewareGapAcknowledgement.findMany({
      where: {
        ownerId: actor.id,
        ...(gaps.length ? { OR: gaps.map((gap) => ({ scope: gap.scope, gapIdentity: gap.gapIdentity })) } : { id: { in: [] } }),
      },
      orderBy: { acknowledgedAt: 'desc' },
    }),
    db.smartCoursewareStalePlanAcknowledgement.findMany({
      where: { ownerId: actor.id, sourceRevisionId: revision.id },
      orderBy: { acknowledgedAt: 'desc' },
    }),
    db.smartCoursewarePublicationRevision.findFirst({
      where: { ownerId: actor.id, sourceRevisionId: revision.id },
      select: { id: true, revisionNumber: true, displayName: true, manifestHash: true, publishedAt: true },
    }),
    db.smartLessonRevision.findFirst({
      where: { ownerId: actor.id, taskId: revision.planRevision.taskId },
      orderBy: { revisionNumber: 'desc' },
      select: { id: true, revisionNumber: true, contentHash: true },
    }),
  ]);
  const acknowledgedGapIdentities = new Set(acknowledgements.map((item) => `${item.scope}:${item.gapIdentity}`));
  const stalePlan = latestPlan && latestPlan.revisionNumber > revision.planRevisionNumber
    ? {
        baselineRevisionNumber: revision.planRevisionNumber,
        newestPlanRevisionId: latestPlan.id,
        newestRevisionNumber: latestPlan.revisionNumber,
        acknowledged: staleAcknowledgements.some((item) => item.newestPlanRevisionId === latestPlan.id
          && item.baselineRevisionNumber === revision.planRevisionNumber
          && item.baselinePlanContentHash === revision.planContentHash
          && item.newestRevisionNumber === latestPlan.revisionNumber
          && item.newestPlanContentHash === latestPlan.contentHash),
      }
    : null;
  return {
    sourceRevisionId: revision.id,
    sourceContentHash: revision.contentHash,
    planRevisionNumber: revision.planRevisionNumber,
    receipts: {
      static: receipts.some((item) => item.kind === 'STATIC' && item.profileHash === STATIC_PROFILE_HASH),
      browser: receipts.some((item) => item.kind === 'BROWSER' && item.profileHash === BROWSER_PROFILE_HASH),
    },
    pendingGaps: gaps.map((gap) => ({
      scope: gap.scope,
      targetId: gap.targetId,
      gapIdentity: gap.gapIdentity,
      sourceState: gap.sourceState.toLowerCase(),
      acknowledged: acknowledgedGapIdentities.has(`${gap.scope}:${gap.gapIdentity}`),
    })),
    stalePlan,
    publication: publication ? { ...publication, publishedAt: publication.publishedAt.toISOString() } : null,
  };
}

export async function runSmartCoursewareStaticPublicationValidation(db: PublicationDb, input: {
  actor: SmartCoursewareActor;
  sourceRevisionId: string;
}) {
  const actor = validateActor(input.actor);
  const sourceRevisionId = validateId(input.sourceRevisionId);
  const revision = await loadOwnedRevision(db, actor.id, sourceRevisionId);
  const plan = validateSmartLessonPlan(revision.planRevision.content);
  const moduleMetadata = asArray<Record<string, unknown>>(revision.moduleMetadataSnapshot).map((module) => ({
    moduleId: module.moduleId,
    sourceState: module.sourceState,
    sourceBindings: module.sourceBindings,
    teacherFields: module.teacherFields,
  }));
  const validation = validateCoursewareComposition({
    expectedVersion: revision.revisionNumber,
    runtimeManifest: revision.manifestSnapshot,
    moduleMetadata,
  }, plan);
  if (!validation.validation.valid) {
    throw new SmartCoursewareError('static-publication-validation-failed', 409);
  }
  return db.smartCoursewarePublicationReceipt.upsert({
    where: { sourceRevisionId_kind_contentHash_validatorVersion_profileHash: {
      sourceRevisionId, kind: 'STATIC', contentHash: revision.contentHash,
      validatorVersion: SMART_COURSEWARE_PUBLICATION_STATIC_VALIDATOR_VERSION, profileHash: STATIC_PROFILE_HASH,
    } },
    create: {
      id: randomUUID(), ownerId: actor.id, sourceRevisionId, kind: 'STATIC',
      contentHash: revision.contentHash, validatorVersion: SMART_COURSEWARE_PUBLICATION_STATIC_VALIDATOR_VERSION,
      profileHash: STATIC_PROFILE_HASH, browserVersion: null, fontVersion: null,
      evidence: asJson({ validation: validation.validation }), completedById: actor.id,
    },
    update: {},
  });
}

export async function runSmartCoursewareBrowserPublicationValidation(db: PublicationDb, input: {
  actor: SmartCoursewareActor;
  sourceRevisionId: string;
}) {
  const actor = validateActor(input.actor);
  const revision = await loadOwnedRevision(db, actor.id, validateId(input.sourceRevisionId));
  const baseUrl = validatedPublicationReviewOrigin();
  const secret = requiredServerEnvironment('SMART_COURSEWARE_PUBLICATION_REVIEW_SECRET');
  const { chromium } = await import('playwright');
  const executablePath = await resolvePublicationChromiumExecutablePath();
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: executablePath
      ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      : undefined,
  });
  const results: Array<ReturnType<typeof validateGeneratedSlideBrowserSnapshot>> = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1,
      extraHTTPHeaders: {
        'x-act-publication-review-secret': secret,
        'x-act-publication-owner': actor.id,
      },
    });
    await context.addInitScript('globalThis.__name ??= (target) => target;');
    const manifest = revision.manifestSnapshot as unknown as GeneratedSlideManifest;
    for (const projection of ['student', 'teacher'] as const) {
      const page = await context.newPage();
      const url = new URL(`/review/generated-slide-runtime-938/${projection}`, baseUrl);
      url.searchParams.set('sourceRevisionId', revision.id);
      const response = await page.goto(url.toString(), { waitUntil: 'networkidle' });
      if (!response?.ok() || new URL(response.url()).origin !== baseUrl.origin
        || new URL(response.url()).pathname !== url.pathname) {
        throw new SmartCoursewareError('browser-publication-review-route-unavailable', 503);
      }
      await page.locator('[data-publication-review="ready"]').waitFor({ state: 'attached', timeout: 15_000 });
      const steps = manifest.stages.flatMap((stage) => stage.steps);
      for (const step of steps) {
        const snapshot = await captureGeneratedSlideBrowserSnapshot({ page, browser, projection, stepId: step.id });
        const renderContract = deriveGeneratedSlideStepRenderContract({ step, projection, revealProgress: 8 });
        const expectation = browserExpectation(revision.manifestHash, {
          slotIds: GENERATED_SLIDE_LAYOUT_REGISTRY[step.layoutId as GeneratedSlideLayoutId].slots.map((slot) => slot.id),
          moduleIds: renderContract.moduleIds,
          formulaIds: renderContract.formulaIds,
          textIds: renderContract.textIds,
        });
        const result = validateGeneratedSlideBrowserSnapshot(snapshot, expectation);
        results.push(result);
        if (!result.valid) throw new SmartCoursewareError('browser-publication-validation-failed', 409);
      }
      await page.close();
    }
    await context.close();
  } finally {
    await browser.close();
  }
  return db.smartCoursewarePublicationReceipt.upsert({
    where: { sourceRevisionId_kind_contentHash_validatorVersion_profileHash: {
      sourceRevisionId: revision.id, kind: 'BROWSER', contentHash: revision.contentHash,
      validatorVersion: GENERATED_SLIDE_BROWSER_VALIDATOR_VERSION, profileHash: BROWSER_PROFILE_HASH,
    } },
    create: {
      id: randomUUID(), ownerId: actor.id, sourceRevisionId: revision.id, kind: 'BROWSER',
      contentHash: revision.contentHash, validatorVersion: GENERATED_SLIDE_BROWSER_VALIDATOR_VERSION,
      profileHash: BROWSER_PROFILE_HASH, browserVersion: GENERATED_SLIDE_BROWSER_VERSION,
      fontVersion: GENERATED_SLIDE_BROWSER_FONT_VERSION, evidence: asJson({
        browser: SMART_COURSEWARE_PUBLICATION_VALIDATION_PROFILE.browser,
        fonts: SMART_COURSEWARE_PUBLICATION_VALIDATION_PROFILE.fonts,
        viewport: SMART_COURSEWARE_PUBLICATION_VALIDATION_PROFILE.viewport,
        route: `/review/generated-slide-runtime-938/{student|teacher}?sourceRevisionId=${revision.id}`,
        results,
      }),
      completedById: actor.id,
    },
    update: {},
  });
}

export async function acknowledgeSmartCoursewarePublicationGap(db: PublicationDb, input: {
  actor: SmartCoursewareActor;
  sourceRevisionId: string;
  scope: GapScope;
  targetId: string;
  gapIdentity: string;
  reason: string;
}) {
  const actor = validateActor(input.actor);
  const revision = await loadOwnedRevision(db, actor.id, validateId(input.sourceRevisionId));
  const gap = findGap(revision, input.scope, validateId(input.targetId));
  if (!gap || gap.gapIdentity !== validateText(input.gapIdentity, 200)) {
    throw new SmartCoursewareError('publication-gap-identity-changed', 409);
  }
  const reason = validateText(input.reason, 4000);
  return db.smartCoursewareGapAcknowledgement.upsert({
    where: { ownerId_scope_gapIdentity: { ownerId: actor.id, scope: input.scope, gapIdentity: gap.gapIdentity } },
    create: {
      id: randomUUID(), ownerId: actor.id, sourceRevisionId: revision.id, scope: input.scope,
      targetId: gap.targetId, gapIdentity: gap.gapIdentity, targetContentHash: gap.targetContentHash,
      sourceState: gap.sourceState, sourceBindingSetHash: gap.sourceBindingSetHash,
      reason, acknowledgedById: actor.id,
    },
    update: {},
  });
}

export async function acknowledgeSmartCoursewareStalePlan(db: PublicationDb, input: {
  actor: SmartCoursewareActor;
  sourceRevisionId: string;
  newestPlanRevisionId: string;
  reason: string;
}) {
  const actor = validateActor(input.actor);
  const revision = await loadOwnedRevision(db, actor.id, validateId(input.sourceRevisionId));
  const latest = await db.smartLessonRevision.findFirst({
    where: { ownerId: actor.id, taskId: revision.planRevision.taskId },
    orderBy: { revisionNumber: 'desc' }, select: { id: true, revisionNumber: true, contentHash: true },
  });
  if (!latest || latest.id !== validateId(input.newestPlanRevisionId)
    || latest.revisionNumber <= revision.planRevisionNumber) {
    throw new SmartCoursewareError('stale-plan-baseline-changed', 409);
  }
  return db.smartCoursewareStalePlanAcknowledgement.upsert({
    where: { ownerId_sourceRevisionId_newestPlanRevisionId: {
      ownerId: actor.id, sourceRevisionId: revision.id, newestPlanRevisionId: latest.id,
    } },
    create: {
      id: randomUUID(), ownerId: actor.id, sourceRevisionId: revision.id,
      baselinePlanRevisionId: revision.planRevisionId,
      baselineRevisionNumber: revision.planRevisionNumber,
      baselinePlanContentHash: revision.planContentHash,
      newestPlanRevisionId: latest.id, newestRevisionNumber: latest.revisionNumber,
      newestPlanContentHash: latest.contentHash,
      reason: validateText(input.reason, 4000), acknowledgedById: actor.id,
    },
    update: {},
  });
}

export async function publishSmartCoursewareRevision(db: PublicationDb, input: {
  actor: SmartCoursewareActor;
  sourceRevisionId: string;
  idempotencyKey: string;
}) {
  const actor = validateActor(input.actor);
  const sourceRevisionId = validateId(input.sourceRevisionId);
  const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
  const replay = await findPublicationReplay(db, actor.id, idempotencyKey, sourceRevisionId);
  if (replay) return replay;

  let requestHash: string | null = null;
  try {
    return await db.$transaction(async (tx) => {
      const revision = await loadOwnedRevision(tx as PublicationDb, actor.id, sourceRevisionId);
      requestHash = contentHash({ sourceRevisionId: revision.id, sourceContentHash: revision.contentHash });

      const existing = await tx.smartCoursewarePublicationRevision.findUnique({
        where: { sourceRevisionId: revision.id },
      });
      if (existing) {
        await createPublicationOperation(tx, actor.id, idempotencyKey, requestHash, revision.id, existing.id);
        return existing;
      }

      const receipts = await tx.smartCoursewarePublicationReceipt.findMany({
        where: {
          ownerId: actor.id, sourceRevisionId: revision.id, contentHash: revision.contentHash,
          OR: [
            { kind: 'STATIC', profileHash: STATIC_PROFILE_HASH },
            { kind: 'BROWSER', profileHash: BROWSER_PROFILE_HASH },
          ],
        },
        orderBy: { completedAt: 'desc' },
      });
      const gaps = publicationGaps(revision);
      const acknowledgements = gaps.length === 0 ? [] : await tx.smartCoursewareGapAcknowledgement.findMany({
        where: { ownerId: actor.id, OR: gaps.map((gap) => ({ scope: gap.scope, gapIdentity: gap.gapIdentity })) },
      });
      const latestPlan = await tx.smartLessonRevision.findFirst({
        where: { ownerId: actor.id, taskId: revision.planRevision.taskId },
        orderBy: { revisionNumber: 'desc' }, select: { id: true, revisionNumber: true, contentHash: true },
      });
      let staleAcknowledgement = null;
      if (latestPlan && latestPlan.revisionNumber > revision.planRevisionNumber) {
        staleAcknowledgement = await tx.smartCoursewareStalePlanAcknowledgement.findUnique({
          where: { ownerId_sourceRevisionId_newestPlanRevisionId: {
            ownerId: actor.id, sourceRevisionId: revision.id, newestPlanRevisionId: latestPlan.id,
          } },
        });
        if (!staleAcknowledgement
          || staleAcknowledgement.baselineRevisionNumber !== revision.planRevisionNumber
          || staleAcknowledgement.baselinePlanContentHash !== revision.planContentHash
          || staleAcknowledgement.newestRevisionNumber !== latestPlan.revisionNumber
          || staleAcknowledgement.newestPlanContentHash !== latestPlan.contentHash) {
          throw new SmartCoursewareError('stale-baseline-confirmation-required', 409);
        }
      }

      const receiptEvidence = receipts.map(persistedReceipt);
      const gapEvidence = acknowledgements.map(persistedGapAcknowledgement);
      const staleEvidence = staleAcknowledgement ? [persistedStaleAcknowledgement(staleAcknowledgement)] : [];
      const eligibility = validatePublicationEligibility({
        revision: revisionSnapshot(revision),
        approvedPlan: approvedPlanSnapshot(revision),
        newestApprovedPlan: latestPlan ?? {
          id: revision.planRevisionId, revisionNumber: revision.planRevisionNumber,
          contentHash: revision.planContentHash,
        },
        receipts: receiptEvidence,
        validationProfile: SMART_COURSEWARE_PUBLICATION_VALIDATION_PROFILE,
        gapAcknowledgements: gapEvidence,
        staleBaselineAcknowledgements: staleEvidence,
      });
      if (!eligibility.eligible) throw eligibilityError(eligibility.issues[0].code);

      const series = await tx.smartCoursewarePublicationSeries.upsert({
        where: { taskId: revision.planRevision.taskId },
        create: { id: randomUUID(), ownerId: actor.id, taskId: revision.planRevision.taskId },
        update: {},
      });
      if (series.ownerId !== actor.id) throw new SmartCoursewareError('courseware-publication-owner-mismatch', 403);
      const allocated = await tx.smartCoursewarePublicationSeries.update({
        where: { id: series.id }, data: { nextRevisionNumber: { increment: 1 } },
        select: { nextRevisionNumber: true },
      });
      const revisionNumber = allocated.nextRevisionNumber - 1;
      const displayName = `互动课件第${revisionNumber}版（基于教案第${revision.planRevisionNumber}版）`;
      const receiptSnapshot = receiptEvidence;
      const acknowledgementSnapshot = acknowledgements.filter((acknowledgement) => gaps.some((gap) =>
        acknowledgement.scope === gap.scope && acknowledgement.gapIdentity === gap.gapIdentity));
      const publicationContentHash = eligibility.evidenceHash;
      const publication = await tx.smartCoursewarePublicationRevision.create({ data: {
        id: randomUUID(), ownerId: actor.id, seriesId: series.id, revisionNumber, displayName,
        sourceRevisionId: revision.id, sourceContentHash: revision.contentHash,
        planRevisionId: revision.planRevisionId, planRevisionNumber: revision.planRevisionNumber,
        manifestSnapshot: asJson(revision.manifestSnapshot), manifestHash: revision.manifestHash,
        moduleMetadataSnapshot: asJson(revision.moduleMetadataSnapshot), gapsSnapshot: asJson(revision.gapsSnapshot),
        provenanceSnapshot: asJson(revision.provenanceSnapshot), validationSnapshot: asJson(revision.validationSnapshot),
        receiptSnapshot: asJson(receiptSnapshot), acknowledgementSnapshot: asJson(acknowledgementSnapshot),
        stalePlanAcknowledgementSnapshot: staleAcknowledgement ? asJson(staleAcknowledgement) : Prisma.JsonNull,
        contentHash: publicationContentHash, publishedById: actor.id,
      } });
      await createGovernedPublicationProjection(tx, publication, revision);
      await createPublicationOperation(tx, actor.id, idempotencyKey, requestHash, revision.id, publication.id);
      return publication;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (isUniqueConstraint(error) || isRetryableTransactionConflict(error)) {
      const recovered = await findPublicationReplay(db, actor.id, idempotencyKey, sourceRevisionId);
      if (recovered && requestHash) return recovered;
      throw new SmartCoursewareError('courseware-publication-conflict', 409);
    }
    throw error;
  }
}

async function createGovernedPublicationProjection(
  tx: Prisma.TransactionClient,
  publication: {
    id: string;
    displayName: string;
    revisionNumber: number;
    manifestHash: string;
    planRevisionNumber: number;
  },
  sourceRevision: Awaited<ReturnType<typeof loadOwnedRevision>>,
) {
  const manifest = sourceRevision.manifestSnapshot as unknown as GeneratedSlideManifest;
  const studentProjection = projectCoursewareForStudent({
    draftId: sourceRevision.draftId,
    version: publication.revisionNumber,
    runtimeManifest: manifest,
    orderingPermutationSecret: requiredServerEnvironment('SMART_COURSEWARE_ORDERING_SECRET'),
  });
  const studentSteps = new Map(studentProjection.runtimeManifest.steps.map((step) => [step.id, step]));
  const lessonPlan = await tx.lessonPlan.create({
    data: {
      id: randomUUID(),
      title: publication.displayName,
      description: `已发布互动课件，固定基于教案第${publication.planRevisionNumber}版。`,
      authorId: sourceRevision.ownerId,
      isPublic: false,
      isPreset: false,
      generatedCoursewarePublicationId: publication.id,
      generatedCoursewareManifestHash: publication.manifestHash,
    },
  });

  for (const [stageIndex, stage] of manifest.stages.entries()) {
    for (const [stepIndex, step] of stage.steps.entries()) {
      const runtimeStep = studentSteps.get(step.id);
      if (!runtimeStep) throw new SmartCoursewareError('courseware-student-projection-incomplete', 409);
      const resource = await tx.teachingResource.create({
        data: {
          id: randomUUID(),
          title: step.title,
          description: `${publication.displayName} · ${step.title}`,
          type: 'STATIC_TEXT',
          content: `## ${step.title}`,
          displayName: step.title,
          displayOrder: stageIndex * 100 + stepIndex,
          teacherOnly: false,
          config: asJson({
            kind: 'generated-courseware-student-runtime-v1',
            publicationRevisionId: publication.id,
            manifestHash: publication.manifestHash,
            stepId: step.id,
            runtimeManifest: studentProjection.runtimeManifest,
          }),
          authorId: sourceRevision.ownerId,
          generatedCoursewarePublicationId: publication.id,
        },
      });
      await tx.lessonItem.create({
        data: {
          id: randomUUID(),
          planId: lessonPlan.id,
          itemType: 'RESOURCE',
          resourceId: resource.id,
          stage: projectionStage(stage.stage),
          order: stepIndex,
          duration: Math.max(1, Math.ceil(step.durationSeconds / 60)),
          overrideConfig: asJson({
            titleOverride: step.title,
            generatedCoursewareStepId: step.id,
            publicationRevisionId: publication.id,
            manifestHash: publication.manifestHash,
          }),
          generatedCoursewarePublicationId: publication.id,
        },
      });
    }
  }
}

function projectionStage(stage: GeneratedSlideManifest['stages'][number]['stage']) {
  const stages = {
    'bridge-in': 'BRIDGE_IN',
    objective: 'OBJECTIVE',
    'pre-assessment': 'PRE_ASSESSMENT',
    'participatory-learning': 'PARTICIPATORY',
    'post-assessment': 'POST_ASSESSMENT',
    summary: 'SUMMARY',
  } as const;
  const projected = stages[stage as keyof typeof stages];
  if (!projected) throw new SmartCoursewareError('courseware-projection-stage-invalid', 409);
  return projected;
}

async function loadOwnedRevision(db: PublicationDb, ownerId: string, id: string) {
  const revision = await db.smartCoursewareRevision.findFirst({
    where: { id, ownerId }, include: { planRevision: true },
  });
  if (!revision) throw new SmartCoursewareError('courseware-revision-not-found', 404);
  const expectedContentHash = contentHash({
    planRevisionId: revision.planRevisionId,
    planContentHash: revision.planContentHash,
    manifestHash: revision.manifestHash,
    moduleMetadataHash: revision.moduleMetadataHash,
    gaps: revision.gapsSnapshot,
    provenance: revision.provenanceSnapshot,
    validation: revision.validationSnapshot,
  });
  if (contentHash(revision.planRevision.content) !== revision.planContentHash
    || contentHash(revision.moduleMetadataSnapshot) !== revision.moduleMetadataHash
    || coursewareManifestHash(revision.manifestSnapshot as unknown as GeneratedSlideManifest) !== revision.manifestHash
    || expectedContentHash !== revision.contentHash) {
    throw new SmartCoursewareError('courseware-revision-integrity-mismatch', 409);
  }
  const plan = validateSmartLessonPlan(revision.planRevision.content);
  assertPersistedCoursewareManifest({
    draftId: revision.draftId,
    approvedPlanTitle: plan.topic,
    manifest: revision.manifestSnapshot as unknown as GeneratedSlideManifest,
    contentHash: revision.manifestHash,
  });
  return revision;
}

function publicationGaps(revision: Awaited<ReturnType<typeof loadOwnedRevision>>) {
  return enumeratePublicationPendingGaps({
    revision: revisionSnapshot(revision), approvedPlan: approvedPlanSnapshot(revision),
  }).map((gap) => ({
    scope: gap.targetType,
    targetId: gap.targetId,
    gapIdentity: gap.gapIdentity,
    targetContentHash: gap.targetContentHash,
    sourceState: gap.sourceState.toUpperCase(),
    sourceBindingSetHash: gap.sourceBindingSetHash,
  }));
}

function findGap(revision: Awaited<ReturnType<typeof loadOwnedRevision>>, scope: GapScope, targetId: string) {
  return publicationGaps(revision).find((gap) => gap.scope === scope && gap.targetId === targetId);
}

async function findPublicationReplay(db: PublicationDb, ownerId: string, idempotencyKey: string, sourceRevisionId: string) {
  const operation = await db.smartCoursewarePublicationOperation.findUnique({
    where: { ownerId_idempotencyKey: { ownerId, idempotencyKey } },
    include: { publicationRevision: true },
  });
  if (!operation) return null;
  if (operation.sourceRevisionId !== sourceRevisionId) throw new SmartCoursewareError('idempotency-key-conflict', 409);
  return operation.publicationRevision;
}

async function createPublicationOperation(tx: Prisma.TransactionClient, ownerId: string, idempotencyKey: string,
  requestHash: string, sourceRevisionId: string, publicationRevisionId: string) {
  await tx.smartCoursewarePublicationOperation.create({ data: {
    id: randomUUID(), ownerId, idempotencyKey, requestHash, sourceRevisionId, publicationRevisionId,
  } });
}

function validateActor(actor: SmartCoursewareActor) {
  if (!actor?.id?.trim() || !['TEACHER', 'ADMIN'].includes(actor.role)) {
    throw new SmartCoursewareError('teacher-or-admin-required', 403);
  }
  return { id: actor.id.trim(), role: actor.role } as SmartCoursewareActor;
}

function validateId(value: string) {
  return validateText(value, 200);
}

function validateIdempotencyKey(value: string) {
  const key = value?.trim();
  if (!key || !/^[A-Za-z0-9._:-]{8,160}$/.test(key)) throw new SmartCoursewareError('idempotency-key-invalid');
  return key;
}

function validateText(value: string | undefined, max: number) {
  const text = value?.trim();
  if (!text || text.length > max) throw new SmartCoursewareError('text-invalid');
  return text;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) throw new SmartCoursewareError('courseware-publication-snapshot-invalid', 409);
  return value as T[];
}

function isUniqueConstraint(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isRetryableTransactionConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

function approvedPlanSnapshot(revision: Awaited<ReturnType<typeof loadOwnedRevision>>) {
  return {
    id: revision.planRevision.id,
    revisionNumber: revision.planRevision.revisionNumber,
    contentHash: revision.planContentHash,
    content: validateSmartLessonPlan(revision.planRevision.content),
  };
}

function revisionSnapshot(revision: Awaited<ReturnType<typeof loadOwnedRevision>>) {
  return {
    id: revision.id,
    revisionNumber: revision.revisionNumber,
    planRevisionId: revision.planRevisionId,
    planRevisionNumber: revision.planRevisionNumber,
    planContentHash: revision.planContentHash,
    manifestHash: revision.manifestHash,
    moduleMetadataHash: revision.moduleMetadataHash,
    contentHash: revision.contentHash,
    moduleMetadataSnapshot: asArray<{
      moduleId: string;
      moduleContentHash: string;
      sourceState: string;
      sourceBindings?: unknown;
      sourceBindingSetHash: string;
      gapIdentity: string | null;
      moduleInstanceLineage?: string;
    }>(revision.moduleMetadataSnapshot),
  };
}

function persistedReceipt(receipt: {
  kind: ReceiptKind;
  contentHash: string;
  validatorVersion: string;
  completedById: string;
  completedAt: Date;
  evidence: Prisma.JsonValue;
}): PublicationValidationReceipt {
  const evidence = jsonObject(receipt.evidence);
  return {
    kind: receipt.kind,
    passed: true,
    contentHash: receipt.contentHash,
    validatorVersion: receipt.validatorVersion,
    actorId: receipt.completedById,
    completedAt: receipt.completedAt.toISOString(),
    ...(receipt.kind === 'BROWSER' ? {
      browser: evidence.browser as unknown as PublicationValidationReceipt['browser'],
      fonts: evidence.fonts as unknown as PublicationValidationReceipt['fonts'],
      viewport: evidence.viewport as unknown as PublicationValidationReceipt['viewport'],
    } : {}),
  };
}

function persistedGapAcknowledgement(acknowledgement: {
  scope: GapScope;
  targetId: string;
  targetContentHash: string;
  gapIdentity: string;
  sourceState: string;
  sourceBindingSetHash: string;
  acknowledgedById: string;
  acknowledgedAt: Date;
  reason: string;
}): PublicationGapAcknowledgement {
  return {
    targetType: acknowledgement.scope,
    targetId: acknowledgement.targetId,
    targetContentHash: acknowledgement.targetContentHash,
    gapIdentity: acknowledgement.gapIdentity,
    sourceState: acknowledgement.sourceState.toLowerCase() as PublicationGapAcknowledgement['sourceState'],
    sourceBindingSetHash: acknowledgement.sourceBindingSetHash,
    actorId: acknowledgement.acknowledgedById,
    acknowledgedAt: acknowledgement.acknowledgedAt.toISOString(),
    reason: acknowledgement.reason,
  };
}

function persistedStaleAcknowledgement(acknowledgement: {
  baselineRevisionNumber: number;
  baselinePlanRevisionId: string;
  baselinePlanContentHash: string;
  newestPlanRevisionId: string;
  newestRevisionNumber: number;
  newestPlanContentHash: string;
  acknowledgedById: string;
  acknowledgedAt: Date;
  reason: string;
}): StaleBaselineAcknowledgement {
  return {
    baselinePlanRevisionId: acknowledgement.baselinePlanRevisionId,
    baselinePlanRevisionNumber: acknowledgement.baselineRevisionNumber,
    baselinePlanContentHash: acknowledgement.baselinePlanContentHash,
    newestPlanRevisionId: acknowledgement.newestPlanRevisionId,
    newestPlanRevisionNumber: acknowledgement.newestRevisionNumber,
    newestPlanContentHash: acknowledgement.newestPlanContentHash,
    actorId: acknowledgement.acknowledgedById,
    acknowledgedAt: acknowledgement.acknowledgedAt.toISOString(),
    reason: acknowledgement.reason,
  };
}

function eligibilityError(code: string) {
  const mapped: Record<string, string> = {
    'publication-plan-snapshot-mismatch': 'courseware-revision-integrity-mismatch',
    'publication-static-receipt-required': 'static-publication-receipt-required',
    'publication-browser-receipt-required': 'browser-publication-receipt-required',
    'goal-source-gap-acknowledgement': 'goal-source-gap-acknowledgement-required',
    'module-source-gap-acknowledgement': 'module-source-gap-acknowledgement-required',
    'stale-baseline-confirmation': 'stale-baseline-confirmation-required',
  };
  return new SmartCoursewareError(mapped[code] ?? 'courseware-publication-ineligible', 409);
}

function jsonObject(value: Prisma.JsonValue) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new SmartCoursewareError('publication-receipt-evidence-invalid', 409);
  }
  return value as Record<string, Prisma.JsonValue>;
}

function requiredServerEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new SmartCoursewareError('publication-browser-runner-unavailable', 503);
  return value;
}

async function resolvePublicationChromiumExecutablePath() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
  if (!executablePath) return undefined;
  try {
    await access(executablePath);
    return executablePath;
  } catch {
    throw new SmartCoursewareError('publication-browser-runner-unavailable', 503);
  }
}

function validatedPublicationReviewOrigin() {
  const configured = new URL(requiredServerEnvironment('SMART_COURSEWARE_PUBLICATION_REVIEW_BASE_URL'));
  if (configured.username || configured.password || configured.search || configured.hash
    || configured.pathname !== '/' || !['http:', 'https:'].includes(configured.protocol)) {
    throw new SmartCoursewareError('publication-browser-origin-invalid', 503);
  }
  const loopback = ['127.0.0.1', '::1', 'localhost'].includes(configured.hostname);
  const appOriginValue = process.env.NEXTAUTH_URL ?? process.env.APP_URL;
  const appOrigin = appOriginValue ? new URL(appOriginValue).origin : null;
  if (!loopback && configured.origin !== appOrigin) {
    throw new SmartCoursewareError('publication-browser-origin-invalid', 503);
  }
  if (configured.protocol === 'http:' && !loopback) {
    throw new SmartCoursewareError('publication-browser-origin-invalid', 503);
  }
  return configured;
}

function browserExpectation(
  manifestHash: string,
  expected: { slotIds: string[]; moduleIds: string[]; formulaIds: string[]; textIds: string[] },
): GeneratedSlideBrowserExpectation {
  return buildGeneratedSlideBrowserExpectation({
    contentHash: manifestHash, slotIds: expected.slotIds, moduleIds: expected.moduleIds,
    formulaIds: expected.formulaIds,
    textIds: expected.textIds,
  });
}
