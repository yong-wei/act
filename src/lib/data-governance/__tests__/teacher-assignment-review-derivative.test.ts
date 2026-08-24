import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';

import {
  buildReviewedDerivativePlan,
  defaultReviewedDerivativeAnchorCapabilities,
  defaultReviewedDerivativeOptions,
  generateReviewedDerivative,
} from '../teacher-assignment-review-derivative';
import { S3AnnotatedMarkdownDerivativeRenderer } from '../teacher-assignment-review-derivative-storage';

const snapshot = {
  id: 'snapshot-1',
  reviewId: 'review-1',
  reviewVersion: 3,
  machineSnapshotHash: 'sha256:machine',
  annotationSnapshot: [{ id: 'annotation-1', criterionId: 'criterion-1', status: 'ACTIVE', comment: 'Check sign', anchor: { precision: 'SPAN', spanStart: 2, spanEnd: 8 } }],
  criterionSnapshot: [{ criterionId: 'criterion-1', score: 4, comment: 'Good' }],
  overallComment: 'Revise the sign.',
  answerEvidence: { id: 'evidence-1', sourceHash: 'sha256:aaaaaaaa', anchorVersion: 'anchors-v2', precision: 'SPAN', canonicalMarkdown: 'x = -1, then verify', blocks: [], limitations: [], sourceAsset: { id: 'asset-1', objectKey: 'private/source.docx', checksum: 'sha256:aaaaaaaa', sizeBytes: 100, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }, conversion: { state: 'SUCCEEDED', renderedObjectKey: 'grading-rendered/conversion-1.pdf', renderedChecksum: 'sha256:bbbbbbbb' } },
};

it('freezes derivative source lineage without blocking honest runtime output fallback metadata', () => {
  const migration = readFileSync('prisma/migrations/20260717093000_close_teacher_review_persistence/migration.sql', 'utf8');
  const triggerFunction = migration.slice(
    migration.indexOf('CREATE FUNCTION "prevent_teacher_review_derivative_lineage_update"'),
    migration.indexOf('CREATE TRIGGER "TeacherAssignmentReviewedDerivative_immutable_lineage"'),
  );
  expect(triggerFunction).toContain('OLD."sourceChecksum" IS DISTINCT FROM NEW."sourceChecksum"');
  expect(triggerFunction).not.toContain('OLD."outputKind" IS DISTINCT FROM NEW."outputKind"');
  expect(triggerFunction).not.toContain('OLD."limitations" IS DISTINCT FROM NEW."limitations"');
});

describe('reviewed derivative', () => {
  it('uses the immutable canonical PDF for a Word submission', () => {
    expect(buildReviewedDerivativePlan(snapshot, { generatorId: 'renderer', generatorVersion: '2', anchorMapVersion: 'anchors-v2', nativeFormats: ['DOCX', 'PDF'] })).toMatchObject({
      outputKind: 'REVIEWED_PDF', nativeCapable: false, sourceChecksum: 'sha256:bbbbbbbb', sourceObjectKey: 'grading-rendered/conversion-1.pdf', sourceRepresentation: 'CANONICAL_PDF',
    });
  });

  it('keeps Word feedback in PDF form when mapping is unreliable', () => {
    const plan = buildReviewedDerivativePlan(snapshot, { generatorId: 'renderer', generatorVersion: '2', anchorMapVersion: 'anchors-v3', nativeFormats: ['DOCX', 'PDF'] });
    expect(plan).toMatchObject({ outputKind: 'REVIEWED_PDF', nativeCapable: false, anchorPrecision: 'GENERAL' });
    expect(plan.limitations).toContain('anchor-capability-unregistered');
    expect(plan.annotations[0].anchor).toEqual({ precision: 'GENERAL' });
  });

  it('uses a ready canonical PDF for assignment-level Word evidence with a composite source hash', () => {
    const aggregate: any = structuredClone(snapshot);
    aggregate.answerEvidence.sourceAssetId = null;
    aggregate.answerEvidence.sourceHash = 'sha256:cccccccc';
    aggregate.answerEvidence.sourceManifest = { version: 'assignment-answer-evidence.v2' };
    aggregate.answerEvidence.conversion.state = 'FALLBACK';
    aggregate.answerEvidence.conversion.adapter = 'local-markitdown';

    const plan = buildReviewedDerivativePlan(aggregate, {
      generatorId: 'renderer', generatorVersion: '2', anchorMapVersion: 'anchors-v2', nativeFormats: ['DOCX', 'PDF'],
    });

    expect(plan).toMatchObject({
      outputKind: 'REVIEWED_PDF',
      sourceChecksum: 'sha256:bbbbbbbb',
      sourceRepresentation: 'CANONICAL_PDF',
      sourceSizeBytes: null,
    });
  });

  it('rejects an out-of-range span even when the anchor-map version matches', () => {
    const unsafe = structuredClone(snapshot);
    unsafe.annotationSnapshot[0].anchor = { precision: 'SPAN', spanStart: 2, spanEnd: 20_000 };
    const plan = buildReviewedDerivativePlan(unsafe, { generatorId: 'renderer', generatorVersion: '2', anchorMapVersion: 'anchors-v2', nativeFormats: ['DOCX', 'PDF'] });
    expect(plan).toMatchObject({ outputKind: 'REVIEWED_PDF', anchorPrecision: 'GENERAL', nativeCapable: false });
    expect(plan.annotations[0].anchor).toEqual({ precision: 'GENERAL' });
  });

  it('blocks Word feedback when its immutable canonical PDF is unavailable', () => {
    const unconverted: any = structuredClone(snapshot);
    delete unconverted.answerEvidence.conversion;
    expect(() => buildReviewedDerivativePlan(unconverted, { generatorId: 'renderer', generatorVersion: '2', anchorMapVersion: 'anchors-v2', nativeFormats: ['DOCX', 'PDF'] })).toThrow('reviewed-derivative-canonical-pdf-missing');
  });

  it('labels PDF span fallback as summary-only and removes the unusable precise range', () => {
    const pdf = structuredClone(snapshot);
    pdf.answerEvidence.sourceAsset.mimeType = 'application/pdf';
    const plan = buildReviewedDerivativePlan(pdf, { generatorId: 'pdf-renderer', generatorVersion: '1', anchorMapVersion: 'anchors-v2', nativeFormats: ['PDF'] });
    expect(plan).toMatchObject({ outputKind: 'REVIEWED_PDF', nativeCapable: false, anchorPrecision: 'GENERAL' });
    expect(plan.limitations).toContain('reviewed-pdf-summary-only-no-precise-overlay');
    expect(plan.annotations[0].anchor).toEqual({ precision: 'GENERAL' });
  });

  it('persists immutable checksum lineage and reuses the full-version idempotency key', async () => {
    const created: any[] = [];
    const db: any = {
      teacherAssignmentReviewedDerivative: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockImplementation(async () => created[0] ?? null),
        create: vi.fn(async ({ data }: any) => { const row = { id: 'derivative-1', ...data }; created.push(row); return row; }),
        updateMany: vi.fn(async ({ data }: any) => { Object.assign(created[0], data); return { count: 1 }; }),
      },
    };
    const renderer = { render: vi.fn().mockResolvedValue({ objectKey: 'reviewed/1.docx', checksum: 'sha256:bbbbbbbb', sizeBytes: 120 }) };
    const options = { generatorId: 'renderer', generatorVersion: '2', anchorMapVersion: 'anchors-v2', nativeFormats: ['DOCX'] as const };
    const first = await generateReviewedDerivative({ db, snapshot, renderer, options, now: new Date('2026-07-17T02:00:00Z') });
    const replay = await generateReviewedDerivative({ db, snapshot, renderer, options, now: new Date('2026-07-17T02:01:00Z') });
    expect(first).toMatchObject({ state: 'READY', sourceChecksum: 'sha256:bbbbbbbb', outputChecksum: 'sha256:bbbbbbbb' });
    expect(replay.idempotencyKey).toBe(first.idempotencyKey);
    expect(first.idempotencyKey).toContain('sha256:');
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  it('persists an honest runtime native-to-Markdown fallback instead of stale native metadata', async () => {
    const db = memoryDerivative();
    const result = await generateReviewedDerivative({
      db, snapshot,
      renderer: { render: vi.fn().mockResolvedValue({ objectKey: 'reviewed/fallback.md', checksum: 'sha256:bbbbbbbb', sizeBytes: 12, outputKind: 'ANNOTATED_MARKDOWN', outputMimeType: 'text/markdown', nativeCapable: false, anchorPrecision: 'GENERAL', limitations: ['docx-comments-relationship-unsupported'] }) },
      options: { generatorId: 'renderer', generatorVersion: '2', anchorMapVersion: 'anchors-v2', nativeFormats: ['DOCX'] },
      now: new Date('2026-07-17T02:00:00Z'),
    } as any);
    expect(result).toMatchObject({ state: 'READY', outputKind: 'ANNOTATED_MARKDOWN', outputMimeType: 'text/markdown', nativeCapable: false, limitations: ['docx-comments-relationship-unsupported'] });
    expect(db.row).toMatchObject({ outputKind: 'ANNOTATED_MARKDOWN', outputMimeType: 'text/markdown', nativeCapable: false });
  });

  it('stores fallback Markdown under a deterministic private object key', async () => {
    const source = new TextEncoder().encode('original source bytes');
    const fallbackSnapshot = structuredClone(snapshot);
    const sourceChecksum = `sha256:${createHash('sha256').update(source).digest('hex')}`;
    fallbackSnapshot.answerEvidence.sourceHash = sourceChecksum;
    fallbackSnapshot.answerEvidence.sourceAsset.checksum = sourceChecksum;
    const send = vi.fn(async (command: unknown) => command instanceof GetObjectCommand
      ? { Body: { transformToByteArray: async () => source } }
      : {});
    const renderer = new S3AnnotatedMarkdownDerivativeRenderer({ bucket: 'private-reviews', prefix: 'reviewed' }, { send } as any);
    const plan = buildReviewedDerivativePlan(fallbackSnapshot, { generatorId: 'markdown', generatorVersion: '1', anchorMapVersion: 'unavailable', nativeFormats: [] });
    const result = await renderer.render(plan);
    expect(result).toMatchObject({ objectKey: expect.stringContaining('reviewed/snapshot-1/'), checksum: expect.stringMatching(/^sha256:/) });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ Bucket: 'private-reviews', ContentType: 'text/markdown' }) }));
    expect(send.mock.calls.some(([command]) => command instanceof GetObjectCommand)).toBe(false);
  });

  it('matches production conversion anchor versions through the capability registry instead of one global version', () => {
    const converted = structuredClone(snapshot);
    converted.answerEvidence.anchorVersion = 'markitdown.prod:anchors';
    const capabilities = defaultReviewedDerivativeAnchorCapabilities({ markitdownVersion: 'markitdown.prod', mathpixVersion: 'mathpix.prod' });
    const plan = buildReviewedDerivativePlan(converted, { generatorId: 'renderer', generatorVersion: '3', nativeFormats: ['DOCX', 'PDF'], anchorCapabilities: capabilities });
    expect(capabilities).toEqual(expect.arrayContaining([
      { anchorVersion: 'markitdown.prod:anchors', nativeFormats: ['DOCX'] },
      { anchorVersion: 'mathpix.prod:anchors', nativeFormats: ['PDF'] },
    ]));
    expect(plan).toMatchObject({ outputKind: 'REVIEWED_PDF', nativeCapable: false, anchorMapVersion: 'markitdown.prod:anchors', sourceRepresentation: 'CANONICAL_PDF' });
  });

  it('builds worker readiness options for both real conversion adapter anchor versions', () => {
    const runtime = defaultReviewedDerivativeOptions({ generatorVersion: '4', markitdownVersion: 'local.runtime', mathpixVersion: 'mathpix.runtime' });
    expect(runtime).toMatchObject({ generatorId: 'native-reviewed-derivative-s3', generatorVersion: '4', nativeFormats: ['DOCX', 'PDF'] });
    expect(runtime.anchorCapabilities).toEqual([
      { anchorVersion: 'local.runtime:anchors', nativeFormats: ['DOCX'] },
      { anchorVersion: 'mathpix.runtime:anchors', nativeFormats: ['PDF'] },
    ]);
  });

  it('does not report a concurrent in-progress derivative as ready', async () => {
    const plan = buildReviewedDerivativePlan(snapshot, { generatorId: 'renderer', generatorVersion: '2', anchorMapVersion: 'anchors-v2', nativeFormats: ['DOCX'] });
    const db: any = { teacherAssignmentReviewedDerivative: { findUnique: vi.fn().mockResolvedValue({ id: 'other', idempotencyKey: plan.idempotencyKey, state: 'GENERATING', claimToken: 'other-worker', leaseExpiresAt: new Date(Date.now() + 60_000) }) } };
    await expect(generateReviewedDerivative({ db, snapshot, renderer: { render: vi.fn() }, options: { generatorId: 'renderer', generatorVersion: '2', anchorMapVersion: 'anchors-v2', nativeFormats: ['DOCX'] } })).rejects.toMatchObject({ code: 'reviewed-derivative-generation-in-progress', retryable: true });
  });

  it('aggregates the weakest active annotation precision and uses GENERAL for no annotations', () => {
    const mixed: any = structuredClone(snapshot);
    mixed.annotationSnapshot.push({ id: 'annotation-2', criterionId: 'criterion-1', status: 'ACTIVE', comment: 'Page note', anchor: { precision: 'PAGE', pageNumber: 2, bbox: [10, 10, 20, 20] } });
    mixed.answerEvidence.blocks = [{ id: 'block-page-2', pageNumber: 2, bbox: [10, 10, 20, 20] }];
    expect(buildReviewedDerivativePlan(mixed, { generatorId: 'markdown', generatorVersion: '1', anchorMapVersion: 'anchors-v2', nativeFormats: [] }).anchorPrecision).toBe('PAGE');
    mixed.annotationSnapshot = [];
    expect(buildReviewedDerivativePlan(mixed, { generatorId: 'markdown', generatorVersion: '1', anchorMapVersion: 'anchors-v2', nativeFormats: [] }).anchorPrecision).toBe('GENERAL');
  });

  it('blocks source checksum mismatch before rendering', async () => {
    const mismatch = structuredClone(snapshot);
    mismatch.answerEvidence.sourceAsset.checksum = 'sha256:cccccccc';
    const renderer = { render: vi.fn() };
    await expect(generateReviewedDerivative({
      db: { teacherAssignmentReviewedDerivative: {} },
      snapshot: mismatch, renderer,
      options: { generatorId: 'renderer', generatorVersion: '2', anchorMapVersion: 'anchors-v2', nativeFormats: ['DOCX'] },
    } as any)).rejects.toMatchObject({ code: 'reviewed-derivative-source-checksum-mismatch', blocked: true });
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('takes over an expired crashed generation with a new token', async () => {
    const db = memoryDerivative({ id: 'derivative-1', state: 'GENERATING', claimToken: 'dead-worker', claimedAt: new Date('2026-07-17T01:00:00Z'), leaseExpiresAt: new Date('2026-07-17T01:01:00Z'), attemptCount: 1 });
    const result = await generateReviewedDerivative({
      db, snapshot, renderer: { render: vi.fn().mockResolvedValue({ objectKey: 'reviewed/recovered.docx', checksum: 'sha256:dddddddd', sizeBytes: 10 }) },
      options: { generatorId: 'renderer', generatorVersion: '2', anchorMapVersion: 'anchors-v2', nativeFormats: ['DOCX'] },
      claimToken: 'worker-b', leaseMs: 60_000, now: new Date('2026-07-17T02:00:00Z'),
    } as any);
    expect(result).toMatchObject({ state: 'READY', outputChecksum: 'sha256:dddddddd' });
    expect(db.row).toMatchObject({ state: 'READY', claimToken: null, attemptCount: 2 });
  });

  it('allows only one live derivative token and fences the old worker success write', async () => {
    const oldRender = deferred<{ objectKey: string; checksum: string; sizeBytes: number }>();
    const db = memoryDerivative();
    const old = generateReviewedDerivative({
      db, snapshot, renderer: { render: () => oldRender.promise },
      options: { generatorId: 'renderer', generatorVersion: '2', anchorMapVersion: 'anchors-v2', nativeFormats: ['DOCX'] },
      claimToken: 'worker-a', leaseMs: 1_000, now: new Date('2026-07-17T02:00:00Z'),
    } as any);
    await vi.waitFor(() => expect(db.row?.claimToken).toBe('worker-a'));
    const liveRenderer = { render: vi.fn() };
    await expect(generateReviewedDerivative({
      db, snapshot, renderer: liveRenderer,
      options: { generatorId: 'renderer', generatorVersion: '2', anchorMapVersion: 'anchors-v2', nativeFormats: ['DOCX'] },
      claimToken: 'worker-b', leaseMs: 1_000, now: new Date('2026-07-17T02:00:00.500Z'),
    } as any)).rejects.toMatchObject({ code: 'reviewed-derivative-generation-in-progress' });
    expect(liveRenderer.render).not.toHaveBeenCalled();
    const takeover = generateReviewedDerivative({
      db, snapshot, renderer: { render: vi.fn().mockResolvedValue({ objectKey: 'reviewed/new.docx', checksum: 'sha256:eeeeeeee', sizeBytes: 20 }) },
      options: { generatorId: 'renderer', generatorVersion: '2', anchorMapVersion: 'anchors-v2', nativeFormats: ['DOCX'] },
      claimToken: 'worker-b', leaseMs: 1_000, now: new Date('2026-07-17T02:00:02Z'),
    } as any);
    await expect(takeover).resolves.toMatchObject({ state: 'READY', outputChecksum: 'sha256:eeeeeeee' });
    oldRender.resolve({ objectKey: 'reviewed/old.docx', checksum: 'sha256:ffffffff', sizeBytes: 30 });
    await expect(old).rejects.toMatchObject({ code: 'reviewed-derivative-generation-fenced' });
    expect(db.row).toMatchObject({ state: 'READY', outputChecksum: 'sha256:eeeeeeee', claimToken: null });
  });

  it('fences an old worker failure after another token has completed', async () => {
    const oldRender = deferred<{ objectKey: string; checksum: string; sizeBytes: number }>();
    const db = memoryDerivative();
    const old = generateReviewedDerivative({
      db, snapshot, renderer: { render: () => oldRender.promise },
      options: { generatorId: 'renderer', generatorVersion: '2', anchorMapVersion: 'anchors-v2', nativeFormats: ['DOCX'] },
      claimToken: 'worker-a', leaseMs: 1_000, now: new Date('2026-07-17T02:00:00Z'),
    } as any);
    await vi.waitFor(() => expect(db.row?.claimToken).toBe('worker-a'));
    await generateReviewedDerivative({
      db, snapshot, renderer: { render: vi.fn().mockResolvedValue({ objectKey: 'reviewed/new.docx', checksum: 'sha256:eeeeeeee', sizeBytes: 20 }) },
      options: { generatorId: 'renderer', generatorVersion: '2', anchorMapVersion: 'anchors-v2', nativeFormats: ['DOCX'] },
      claimToken: 'worker-b', leaseMs: 1_000, now: new Date('2026-07-17T02:00:02Z'),
    } as any);
    oldRender.reject(new Error('old renderer failed'));
    await expect(old).rejects.toMatchObject({ code: 'reviewed-derivative-generation-fenced' });
    expect(db.row).toMatchObject({ state: 'READY', outputChecksum: 'sha256:eeeeeeee', lastErrorCode: null });
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function memoryDerivative(initial?: any) {
  const plan = buildReviewedDerivativePlan(snapshot, { generatorId: 'renderer', generatorVersion: '2', anchorMapVersion: 'anchors-v2', nativeFormats: ['DOCX'] });
  const db: any = {
    row: initial ? { ...initial, idempotencyKey: plan.idempotencyKey, sourceChecksum: plan.sourceChecksum, reviewSnapshotChecksum: plan.reviewSnapshotChecksum } : null,
    teacherAssignmentReviewedDerivative: {
      findUnique: vi.fn(async () => db.row ? { ...db.row } : null),
      create: vi.fn(async ({ data }: any) => { db.row = { id: 'derivative-1', ...data }; return { ...db.row }; }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const row = db.row;
        const stateMatches = !where.state || (where.state.in ? where.state.in.includes(row?.state) : row?.state === where.state);
        const orMatches = !where.OR || where.OR.some((branch: any) => (branch.leaseExpiresAt === null && row?.leaseExpiresAt == null)
          || (branch.leaseExpiresAt?.lte && row?.leaseExpiresAt <= branch.leaseExpiresAt.lte));
        const matches = row && (!where.id || row.id === where.id) && stateMatches
          && orMatches
          && (where.claimToken === undefined || row.claimToken === where.claimToken)
          && (!where.leaseExpiresAt?.gt || row.leaseExpiresAt > where.leaseExpiresAt.gt)
          && (!where.leaseExpiresAt?.lte || row.leaseExpiresAt <= where.leaseExpiresAt.lte)
          && (!where.sourceChecksum || row.sourceChecksum === where.sourceChecksum)
          && (!where.reviewSnapshotChecksum || row.reviewSnapshotChecksum === where.reviewSnapshotChecksum);
        if (!matches) return { count: 0 };
        const increment = data.attemptCount?.increment ?? 0;
        Object.assign(row, data, { attemptCount: Number(row.attemptCount ?? 0) + increment });
        return { count: 1 };
      }),
    },
  };
  return db;
}
