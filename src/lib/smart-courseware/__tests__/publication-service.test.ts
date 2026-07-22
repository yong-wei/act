import { Prisma } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { contentHash } from '@/lib/smart-lesson-plan/domain';
import { validPlanFixture } from '@/lib/smart-lesson-plan/__tests__/fixtures';

import {
  SMART_COURSEWARE_PUBLICATION_STATIC_VALIDATOR_VERSION,
  SMART_COURSEWARE_PUBLICATION_VALIDATION_PROFILE,
  acknowledgeSmartCoursewarePublicationGap,
  acknowledgeSmartCoursewareStalePlan,
  getSmartCoursewarePublicationState,
  publishSmartCoursewareRevision,
  runSmartCoursewareBrowserPublicationValidation,
  runSmartCoursewareStaticPublicationValidation,
} from '../publication-service';
import { coursewareManifestHash } from '../domain';
import { validCompositionInput } from './fixtures';

const actor = { id: 'teacher-1', role: 'TEACHER' as const };
const { browserLaunch, fileAccess } = vi.hoisted(() => ({
  browserLaunch: vi.fn(),
  fileAccess: vi.fn(),
}));
vi.mock('playwright', () => ({ chromium: { launch: browserLaunch } }));
vi.mock('node:fs/promises', () => ({ access: fileAccess }));
const validationProfile = SMART_COURSEWARE_PUBLICATION_VALIDATION_PROFILE;
process.env.SMART_COURSEWARE_ORDERING_SECRET = 'smart-courseware-publication-test-secret-v1';

describe('smart courseware publication persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports unchanged stable-gap acknowledgements created against an earlier draft revision', async () => {
    const revision = publicationSource();
    const findAcknowledgements = vi.fn().mockResolvedValue([
      { ...goalAcknowledgement(), sourceRevisionId: 'earlier-revision', acknowledgedAt: new Date('2026-07-20T00:00:00Z') },
      { ...moduleAcknowledgement(), sourceRevisionId: 'earlier-revision', acknowledgedAt: new Date('2026-07-20T00:00:00Z') },
    ]);
    const db = {
      smartCoursewareRevision: { findFirst: vi.fn().mockResolvedValue(revision) },
      smartCoursewarePublicationReceipt: { findMany: vi.fn().mockResolvedValue([]) },
      smartCoursewareGapAcknowledgement: { findMany: findAcknowledgements },
      smartCoursewareStalePlanAcknowledgement: { findMany: vi.fn().mockResolvedValue([]) },
      smartCoursewarePublicationRevision: { findFirst: vi.fn().mockResolvedValue(null) },
      smartLessonRevision: { findFirst: vi.fn().mockResolvedValue({ id: revision.planRevisionId, revisionNumber: 1, contentHash: revision.planContentHash }) },
    };

    const state = await getSmartCoursewarePublicationState(db as never, { actor, sourceRevisionId: revision.id });

    expect(state.pendingGaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: 'GOAL', acknowledged: true }),
      expect.objectContaining({ scope: 'MODULE', acknowledged: true }),
    ]));
    expect(findAcknowledgements).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ ownerId: actor.id, OR: expect.any(Array) }),
    }));
  });

  it('keeps receipts, acknowledgements, operations, and published revisions immutable in PostgreSQL', () => {
    const migration = readFileSync('prisma/migrations/20260720090000_add_smart_courseware_publication/migration.sql', 'utf8');
    for (const table of [
      'SmartCoursewarePublicationReceipt', 'SmartCoursewareGapAcknowledgement',
      'SmartCoursewareStalePlanAcknowledgement', 'SmartCoursewarePublicationRevision',
      'SmartCoursewarePublicationOperation',
    ]) {
      expect(migration).toContain(`CREATE TRIGGER "${table}_immutable" BEFORE UPDATE OR DELETE ON "${table}"`);
    }
    expect(migration).toContain('SmartCoursewarePublicationRevision_series_revision_key');
    expect(migration).toContain('SmartCoursewarePublicationSeries_next_revision_check');
    expect(migration).toContain('SmartCoursewarePublicationReceipt_source_kind_hash_validator_profile_key');
    expect(migration).toContain('"profileHash" TEXT NOT NULL');
    const reviewRoute = readFileSync(
      'src/app/api/internal/smart-courseware/publication-review/route.ts', 'utf8',
    );
    expect(reviewRoute).toContain("request.headers.get('x-act-publication-review-secret') !== secret");
    expect(reviewRoute).toContain('where: { id: sourceRevisionId, ownerId }');
    const reviewPage = readFileSync(
      'src/app/review/generated-slide-runtime-938/[projection]/page.tsx', 'utf8',
    );
    expect(reviewPage).toContain("projection !== 'student' && projection !== 'teacher'");
    expect(reviewPage).toContain("process.env.NODE_ENV !== 'development' && !sourceRevisionId");
    expect(reviewPage).toContain('searchParams: Promise<{ sourceRevisionId?: string }>');
    const bindingMigration = readFileSync(
      'prisma/migrations/20260720150000_bind_generated_courseware_classrooms/migration.sql', 'utf8',
    );
    expect(bindingMigration).toContain('LessonPlan_generated_courseware_immutable');
    expect(bindingMigration).toContain('TeachingResource_generated_courseware_immutable');
    expect(bindingMigration).toContain('ClassSession_coursewarePublicationRevisionId_fkey');
    expect(bindingMigration).toContain('ClassSession_courseware_binding_immutable');
    expect(bindingMigration).toContain('TeachingResource_generated_courseware_student_safe_check');
  });

  it('runs STATIC and BROWSER validation from fixed server-side execution paths', async () => {
    const revision = publicationSource();
    const upsert = vi.fn(async ({ create }) => create);
    const db = {
      smartCoursewareRevision: { findFirst: vi.fn().mockResolvedValue(revision) },
      smartCoursewarePublicationReceipt: { upsert },
    };
    await runSmartCoursewareStaticPublicationValidation(db as never, { actor, sourceRevisionId: revision.id });

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        kind: 'STATIC', contentHash: revision.contentHash,
        validatorVersion: SMART_COURSEWARE_PUBLICATION_STATIC_VALIDATOR_VERSION,
        profileHash: expect.any(String), completedById: actor.id,
      }),
      update: {},
    }));
    vi.stubEnv('SMART_COURSEWARE_PUBLICATION_REVIEW_BASE_URL', 'http://127.0.0.1:3100');
    vi.stubEnv('SMART_COURSEWARE_PUBLICATION_REVIEW_SECRET', 'server-only-review-secret');
    const browser = fakeBrowser(false);
    browserLaunch.mockResolvedValueOnce(browser);
    await runSmartCoursewareBrowserPublicationValidation(db as never, { actor, sourceRevisionId: revision.id });
    expect(upsert).toHaveBeenLastCalledWith(expect.objectContaining({ create: expect.objectContaining({
      kind: 'BROWSER', profileHash: expect.any(String), contentHash: revision.contentHash,
    }) }));
    expect(browserLaunch).toHaveBeenCalledWith({
      headless: true, executablePath: undefined, args: undefined,
    });
    expect(browser.newContext).toHaveBeenCalledWith({
      viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1,
      extraHTTPHeaders: {
        'x-act-publication-review-secret': 'server-only-review-secret',
        'x-act-publication-owner': actor.id,
      },
    });
    expect(browser.page.goto).toHaveBeenCalledWith(expect.stringContaining(
      '/review/generated-slide-runtime-938/student',
    ), { waitUntil: 'networkidle' });
    vi.unstubAllEnvs();
  });

  it('uses the configured system Chromium with container-safe launch arguments', async () => {
    const revision = publicationSource();
    const db = {
      smartCoursewareRevision: { findFirst: vi.fn().mockResolvedValue(revision) },
      smartCoursewarePublicationReceipt: { upsert: vi.fn(async ({ create }) => create) },
    };
    vi.stubEnv('SMART_COURSEWARE_PUBLICATION_REVIEW_BASE_URL', 'http://127.0.0.1:3100');
    vi.stubEnv('SMART_COURSEWARE_PUBLICATION_REVIEW_SECRET', 'server-only-review-secret');
    vi.stubEnv('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH', '/usr/bin/chromium');
    fileAccess.mockResolvedValueOnce(undefined);
    browserLaunch.mockResolvedValueOnce(fakeBrowser(false));

    await runSmartCoursewareBrowserPublicationValidation(db as never, {
      actor, sourceRevisionId: revision.id,
    });

    expect(fileAccess).toHaveBeenCalledWith('/usr/bin/chromium');
    expect(browserLaunch).toHaveBeenCalledWith({
      headless: true,
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    vi.unstubAllEnvs();
  });

  it('fails closed when the configured Chromium executable is unavailable', async () => {
    const revision = publicationSource();
    const upsert = vi.fn();
    const db = {
      smartCoursewareRevision: { findFirst: vi.fn().mockResolvedValue(revision) },
      smartCoursewarePublicationReceipt: { upsert },
    };
    vi.stubEnv('SMART_COURSEWARE_PUBLICATION_REVIEW_BASE_URL', 'http://127.0.0.1:3100');
    vi.stubEnv('SMART_COURSEWARE_PUBLICATION_REVIEW_SECRET', 'server-only-review-secret');
    vi.stubEnv('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH', '/missing/chromium');
    fileAccess.mockRejectedValueOnce(new Error('ENOENT'));

    await expect(runSmartCoursewareBrowserPublicationValidation(db as never, {
      actor, sourceRevisionId: revision.id,
    })).rejects.toMatchObject({ code: 'publication-browser-runner-unavailable', status: 503 });
    expect(browserLaunch).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('does not persist a browser receipt when collected measurements are invalid', async () => {
    const revision = publicationSource();
    const upsert = vi.fn();
    const db = {
      smartCoursewareRevision: { findFirst: vi.fn().mockResolvedValue(revision) },
      smartCoursewarePublicationReceipt: { upsert },
    };
    vi.stubEnv('SMART_COURSEWARE_PUBLICATION_REVIEW_BASE_URL', 'http://127.0.0.1:3100');
    vi.stubEnv('SMART_COURSEWARE_PUBLICATION_REVIEW_SECRET', 'server-only-review-secret');
    browserLaunch.mockResolvedValueOnce(fakeBrowser(true));
    await expect(runSmartCoursewareBrowserPublicationValidation(db as never, {
      actor, sourceRevisionId: revision.id,
    })).rejects.toMatchObject({ code: 'browser-publication-validation-failed' });
    expect(upsert).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('binds each acknowledgement to the current stable goal/module gap identity', async () => {
    const revision = publicationSource();
    const upsert = vi.fn(async ({ create }) => create);
    const db = {
      smartCoursewareRevision: { findFirst: vi.fn().mockResolvedValue(revision) },
      smartCoursewareGapAcknowledgement: { upsert },
    };

    await expect(acknowledgeSmartCoursewarePublicationGap(db as never, {
      actor, sourceRevisionId: revision.id, scope: 'MODULE', targetId: 'module-1',
      gapIdentity: 'courseware-gap:obsolete-module', reason: '接受缺口',
    })).rejects.toMatchObject({ code: 'publication-gap-identity-changed' });

    await acknowledgeSmartCoursewarePublicationGap(db as never, {
      actor, sourceRevisionId: revision.id, scope: 'GOAL', targetId: 'goal-1',
      gapIdentity: 'smart-goal-gap:goal-1', reason: '当前教学目标允许教师补充来源',
    });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({
      scope: 'GOAL', targetId: 'goal-1', gapIdentity: 'smart-goal-gap:goal-1',
      targetContentHash: contentHash('判断闭环系统稳定性'),
      sourceState: 'TEACHER_CREATED_SOURCE_PENDING', acknowledgedById: actor.id,
    }) }));
  });

  it('rejects a source revision whose manifest snapshot no longer matches its immutable manifest hash', async () => {
    const revision = publicationSource();
    revision.manifestSnapshot.title = 'tampered title';
    const db = publicationDb(revision);
    await expect(publishSmartCoursewareRevision(db as never, {
      actor, sourceRevisionId: revision.id, idempotencyKey: 'publish-tampered-manifest',
    })).rejects.toMatchObject({ code: 'courseware-revision-integrity-mismatch' });
  });

  it('requires one current receipt of each kind and every current goal/module acknowledgement', async () => {
    const revision = publicationSource();
    const db = publicationDb(revision, {
      receipts: [receipt('STATIC', revision.contentHash)],
    });
    await expect(publishSmartCoursewareRevision(db as never, {
      actor, sourceRevisionId: revision.id, idempotencyKey: 'publish-missing-browser',
    })).rejects.toMatchObject({ code: 'browser-publication-receipt-required' });

    const missingGoal = publicationDb(revision, { acknowledgements: [moduleAcknowledgement()] });
    await expect(publishSmartCoursewareRevision(missingGoal as never, {
      actor, sourceRevisionId: revision.id, idempotencyKey: 'publish-missing-goal',
    })).rejects.toMatchObject({ code: 'goal-source-gap-acknowledgement-required' });

    const invalidatedModule = publicationDb(revision, { acknowledgements: [
      goalAcknowledgement(), { ...moduleAcknowledgement(), targetContentHash: 'old-module-hash' },
    ] });
    await expect(publishSmartCoursewareRevision(invalidatedModule as never, {
      actor, sourceRevisionId: revision.id, idempotencyKey: 'publish-stale-module-ack',
    })).rejects.toMatchObject({ code: 'module-source-gap-acknowledgement-required' });
  });

  it('allocates the task series atomically and freezes the complete publication snapshot', async () => {
    const revision = publicationSource();
    const createPublication = vi.fn(async ({ data }) => ({ ...data, publishedAt: new Date('2026-07-20T01:00:00Z') }));
    const createOperation = vi.fn().mockResolvedValue({});
    const db = publicationDb(revision, { createPublication, createOperation });

    const published = await publishSmartCoursewareRevision(db as never, {
      actor, sourceRevisionId: revision.id, idempotencyKey: 'publish-courseware-1',
    });

    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(db.seriesUpdate).toHaveBeenCalledWith({
      where: { id: 'series-1' }, data: { nextRevisionNumber: { increment: 1 } },
      select: { nextRevisionNumber: true },
    });
    expect(published).toMatchObject({
      revisionNumber: 1, displayName: '互动课件第1版（基于教案第1版）',
      sourceRevisionId: revision.id, sourceContentHash: revision.contentHash,
    });
    expect(createPublication).toHaveBeenCalledWith({ data: expect.objectContaining({
      receiptSnapshot: expect.arrayContaining([
        expect.objectContaining({ kind: 'STATIC' }), expect.objectContaining({ kind: 'BROWSER' }),
      ]),
      acknowledgementSnapshot: expect.arrayContaining([
        expect.objectContaining({ scope: 'GOAL' }), expect.objectContaining({ scope: 'MODULE' }),
      ]),
      manifestSnapshot: revision.manifestSnapshot, manifestHash: revision.manifestHash,
      publishedById: actor.id, contentHash: expect.any(String),
    }) });
    expect(createOperation).toHaveBeenCalledWith({ data: expect.objectContaining({
      ownerId: actor.id, idempotencyKey: 'publish-courseware-1', publicationRevisionId: published.id,
    }) });
    expect(db.lessonPlanCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      generatedCoursewarePublicationId: published.id,
      generatedCoursewareManifestHash: revision.manifestHash,
      authorId: actor.id,
    }) });
    expect(db.lessonItemCreate).toHaveBeenCalled();
    const resources = db.teachingResourceCreate.mock.calls.map(([call]) => call.data);
    expect(resources.length).toBeGreaterThan(0);
    expect(resources.every((resource) => resource.generatedCoursewarePublicationId === published.id)).toBe(true);
    expect(JSON.stringify(resources)).not.toContain('referenceAnswer');
    expect(JSON.stringify(resources)).not.toContain('providerKind');
  });

  it('requires an acknowledgement of the exact latest stale-plan comparison', async () => {
    const revision = publicationSource();
    const latest = { id: 'plan-revision-2', revisionNumber: 2, contentHash: 'newest-plan-content-hash' };
    const missing = publicationDb(revision, { latestPlan: latest, staleAcknowledgement: null });
    await expect(publishSmartCoursewareRevision(missing as never, {
      actor, sourceRevisionId: revision.id, idempotencyKey: 'publish-stale-plan-1',
    })).rejects.toMatchObject({ code: 'stale-baseline-confirmation-required' });

    const staleUpsert = vi.fn(async ({ create }) => create);
    const acknowledgementDb = {
      smartCoursewareRevision: { findFirst: vi.fn().mockResolvedValue(revision) },
      smartLessonRevision: { findFirst: vi.fn().mockResolvedValue(latest) },
      smartCoursewareStalePlanAcknowledgement: { upsert: staleUpsert },
    };
    await acknowledgeSmartCoursewareStalePlan(acknowledgementDb as never, {
      actor, sourceRevisionId: revision.id, newestPlanRevisionId: latest.id,
      reason: '已比较第1版和第2版，仍采用当前课件',
    });
    expect(staleUpsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({
      baselinePlanRevisionId: revision.planRevisionId, baselineRevisionNumber: 1,
      newestPlanRevisionId: latest.id, newestRevisionNumber: 2,
    }) }));
  });

  it('replays the original immutable publication without entering a transaction', async () => {
    const revision = publicationSource();
    const publication = { id: 'publication-1', sourceRevisionId: revision.id, revisionNumber: 1 };
    const transaction = vi.fn();
    const db = {
      smartCoursewarePublicationOperation: { findUnique: vi.fn().mockResolvedValue({
        sourceRevisionId: revision.id, publicationRevision: publication,
      }) },
      $transaction: transaction,
    };
    await expect(publishSmartCoursewareRevision(db as never, {
      actor, sourceRevisionId: revision.id, idempotencyKey: 'publish-courseware-replay',
    })).resolves.toEqual(publication);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('fails a serialization loser cleanly so retry cannot allocate a duplicate number', async () => {
    const revision = publicationSource();
    const conflict = new Prisma.PrismaClientKnownRequestError('serialization conflict', {
      code: 'P2034', clientVersion: 'test', meta: {},
    });
    const db = {
      smartCoursewarePublicationOperation: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn().mockRejectedValue(conflict),
    };
    await expect(publishSmartCoursewareRevision(db as never, {
      actor, sourceRevisionId: revision.id, idempotencyKey: 'publish-concurrent-loser',
    })).rejects.toMatchObject({ code: 'courseware-publication-conflict' });
  });
});

function publicationSource() {
  const plan = validPlanFixture();
  plan.goals[0] = {
    ...plan.goals[0], id: 'goal-1', content: '判断闭环系统稳定性',
    sourceState: 'TEACHER_CREATED_SOURCE_PENDING', sourceBindings: [],
    gapIdentity: 'smart-goal-gap:goal-1',
  };
  const composition = validCompositionInput();
  composition.runtimeManifest.lessonId = 'draft-1';
  composition.runtimeManifest.title = plan.topic;
  const runtimeModules = composition.runtimeManifest.stages.flatMap((stage) =>
    stage.steps.flatMap((step) => step.modules));
  const moduleMetadataSnapshot = composition.moduleMetadata.map((metadata, index) => ({
    ...metadata,
    moduleContentHash: contentHash(runtimeModules[index]),
    sourceBindingSetHash: contentHash(index === 0 ? [] : metadata.sourceBindings),
    moduleInstanceLineage: `lineage-${metadata.moduleId}`,
    ...(index === 0 ? {
      sourceState: 'teacher_created_source_pending' as const,
      sourceBindings: [], gapIdentity: 'courseware-gap:module-1', provenance: 'teacher_created',
    } : { gapIdentity: null, provenance: 'teacher_created' }),
  }));
  const gapsSnapshot = [{ moduleId: 'module-1', gapIdentity: 'courseware-gap:module-1' }];
  const provenanceSnapshot = [{ moduleId: 'module-1', provenance: 'teacher_created' }];
  const validationSnapshot = { valid: true };
  const planContentHash = contentHash(plan);
  const moduleMetadataHash = contentHash(moduleMetadataSnapshot);
  const revision = {
    id: 'approved-courseware-1', ownerId: actor.id, draftId: 'draft-1', revisionNumber: 1,
    planRevisionId: 'plan-revision-1', planRevisionNumber: 1, planContentHash,
    manifestSnapshot: composition.runtimeManifest, manifestHash: coursewareManifestHash(composition.runtimeManifest),
    moduleMetadataSnapshot, moduleMetadataHash, gapsSnapshot, provenanceSnapshot, validationSnapshot,
    contentHash: '',
    approvalIdempotencyKey: 'approve-key', approvalRequestHash: 'approve-request',
    approvedById: actor.id, approvedAt: new Date('2026-07-20T00:00:00Z'),
    planRevision: { id: 'plan-revision-1', taskId: 'task-1', revisionNumber: 1, content: plan },
  };
  revision.contentHash = contentHash({
    planRevisionId: revision.planRevisionId, planContentHash: revision.planContentHash,
    manifestHash: revision.manifestHash, moduleMetadataHash, gaps: gapsSnapshot,
    provenance: provenanceSnapshot, validation: validationSnapshot,
  });
  return revision;
}

function receipt(kind: 'STATIC' | 'BROWSER', revisionHash: string) {
  return {
    id: `receipt-${kind}`, ownerId: actor.id, sourceRevisionId: 'approved-courseware-1', kind,
    contentHash: revisionHash,
    validatorVersion: kind === 'STATIC' ? validationProfile.staticValidatorVersion : validationProfile.browserValidatorVersion,
    profileHash: contentHash(kind === 'STATIC' ? {
      validatorVersion: SMART_COURSEWARE_PUBLICATION_STATIC_VALIDATOR_VERSION,
      runtimeContract: 'generated-slide-contract',
    } : validationProfile),
    browserVersion: kind === 'BROWSER' ? validationProfile.browser.version : null,
    fontVersion: kind === 'BROWSER' ? contentHash(validationProfile.fonts) : null,
    evidence: kind === 'BROWSER' ? {
      browser: validationProfile.browser, fonts: validationProfile.fonts, viewport: validationProfile.viewport,
    } : { browser: null, fonts: [], viewport: null },
    completedById: actor.id, completedAt: new Date(),
  };
}

function goalAcknowledgement() {
  return {
    id: 'ack-goal', ownerId: actor.id, sourceRevisionId: 'approved-courseware-1', scope: 'GOAL',
    targetId: 'goal-1', gapIdentity: 'smart-goal-gap:goal-1',
    targetContentHash: contentHash('判断闭环系统稳定性'),
    sourceState: 'TEACHER_CREATED_SOURCE_PENDING', sourceBindingSetHash: contentHash([]), reason: 'accepted',
    acknowledgedById: actor.id, acknowledgedAt: new Date(),
  };
}

function moduleAcknowledgement() {
  return {
    id: 'ack-module', ownerId: actor.id, sourceRevisionId: 'approved-courseware-1', scope: 'MODULE',
    targetId: 'module-1', gapIdentity: 'courseware-gap:module-1',
    targetContentHash: contentHash(validCompositionInput().runtimeManifest.stages[0].steps[0].modules[0]),
    sourceState: 'TEACHER_CREATED_SOURCE_PENDING', sourceBindingSetHash: contentHash([]), reason: 'accepted',
    acknowledgedById: actor.id, acknowledgedAt: new Date(),
  };
}

function publicationDb(revision: ReturnType<typeof publicationSource>, overrides: {
  receipts?: ReturnType<typeof receipt>[];
  acknowledgements?: Array<ReturnType<typeof goalAcknowledgement> | ReturnType<typeof moduleAcknowledgement>>;
  latestPlan?: { id: string; revisionNumber: number; contentHash: string };
  staleAcknowledgement?: Record<string, unknown> | null;
  createPublication?: ReturnType<typeof vi.fn>;
  createOperation?: ReturnType<typeof vi.fn>;
} = {}) {
  const createPublication = overrides.createPublication ?? vi.fn(async ({ data }) => data);
  const createOperation = overrides.createOperation ?? vi.fn().mockResolvedValue({});
  const seriesUpdate = vi.fn().mockResolvedValue({ nextRevisionNumber: 2 });
  const lessonPlanCreate = vi.fn(async ({ data }) => data);
  const teachingResourceCreate = vi.fn(async ({ data }) => data);
  const lessonItemCreate = vi.fn(async ({ data }) => data);
  const tx = {
    smartCoursewareRevision: { findFirst: vi.fn().mockResolvedValue(revision) },
    smartCoursewarePublicationRevision: {
      findUnique: vi.fn().mockResolvedValue(null), create: createPublication,
    },
    smartCoursewarePublicationReceipt: { findMany: vi.fn().mockResolvedValue(overrides.receipts ?? [
      receipt('STATIC', revision.contentHash), receipt('BROWSER', revision.contentHash),
    ]) },
    smartCoursewareGapAcknowledgement: { findMany: vi.fn().mockResolvedValue(overrides.acknowledgements ?? [
      goalAcknowledgement(), moduleAcknowledgement(),
    ]) },
    smartLessonRevision: { findFirst: vi.fn().mockResolvedValue(overrides.latestPlan ?? {
      id: revision.planRevision.id, revisionNumber: revision.planRevisionNumber,
      contentHash: revision.planContentHash,
    }) },
    smartCoursewareStalePlanAcknowledgement: { findUnique: vi.fn().mockResolvedValue(overrides.staleAcknowledgement ?? null) },
    smartCoursewarePublicationSeries: {
      upsert: vi.fn().mockResolvedValue({ id: 'series-1', ownerId: actor.id, taskId: 'task-1' }),
      update: seriesUpdate,
    },
    smartCoursewarePublicationOperation: { create: createOperation },
    lessonPlan: { create: lessonPlanCreate },
    teachingResource: { create: teachingResourceCreate },
    lessonItem: { create: lessonItemCreate },
  };
  return {
    smartCoursewarePublicationOperation: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)),
    seriesUpdate,
    lessonPlanCreate,
    teachingResourceCreate,
    lessonItemCreate,
  };
}

function fakeBrowser(invalid: boolean) {
  const element = (selector: string, x: number, y: number, width: number, height: number) => ({
    selector,
    rect: { x, y, width, height, top: y, right: x + width, bottom: y + height, left: x },
    clientWidth: width, clientHeight: height,
    scrollWidth: invalid && selector.includes('canvas') ? width + 10 : width,
    scrollHeight: height, fontSizePx: 24,
    computedOverflowX: 'visible', computedOverflowY: 'visible',
    clipPath: 'none', maskImage: 'none', textOverflow: 'clip', nativeFormControl: false,
  });
  const page = {
    goto: vi.fn().mockImplementation(async (url: string) => ({ ok: () => true, url: () => url })),
    locator: vi.fn().mockReturnValue({ scrollIntoViewIfNeeded: vi.fn() }),
    evaluate: vi.fn().mockImplementation(async (_collector, args: { canvasSelector: string }) => {
      const stepId = args.canvasSelector.match(/canvas=\"([^\"]+)/)?.[1] ?? 'step-1';
      const moduleId = stepId.replace('step', 'module');
      const stepNumber = Number(stepId.split('-').at(-1));
      const textIds = stepNumber >= 3 && stepNumber <= 5
        ? [
          `${moduleId}:payload.prompt:text`,
          `${moduleId}:payload.options.0.label:text`,
          `${moduleId}:payload.options.1.label:text`,
        ]
        : [`${moduleId}:payload.text:text`];
      return ({
      contentHash: publicationSource().manifestHash,
      viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
      environment: {
        browserVersion: validationProfile.browser.version,
        resolvedFontFamily: validationProfile.fonts[0].family,
        fixedFontAvailable: true,
        loadedFontSha256: validationProfile.fonts[0].version.split(':').slice(1).join(':'),
        glyphMetricFingerprintPx: 1021.7188720703125,
        fallbackGlyphMetricFingerprintPx: 900,
      },
      canvas: element('[data-generated-slide-canvas]', 0, 0, invalid ? 1000 : 1280, 720),
      titleSlot: element('[data-generated-slide-title-slot]', 20, 20, 1240, 80),
      titleContent: element('[data-manifest-step-title]', 30, 30, 1200, 50),
      slots: [{ ...element('[data-generated-slide-slot="main"]', 20, 120, 1240, 560), slotId: 'main' }],
      modules: [{
        ...element(`[data-generated-slide-module-root="${moduleId}"]`, 30, 130, 1200, 520),
        moduleId, slotId: 'main',
      }],
      formulas: [], containers: [], text: textIds.map((textId, index) => ({
        ...element(`[data-generated-slide-text-marker="${textId}"]`, 40, 140 + index * 100, 1100, 80),
        textId, moduleId, minimumFontSizePx: 16,
      })),
      });
    }),
    close: vi.fn(),
  };
  const context = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn() };
  return {
    version: () => validationProfile.browser.version,
    newContext: vi.fn().mockResolvedValue(context),
    close: vi.fn(),
    page,
  };
}
