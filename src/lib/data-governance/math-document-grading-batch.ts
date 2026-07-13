import { randomUUID } from 'node:crypto';

import {
  buildGradingRequestHash,
  buildPipelineDedupeKey,
  buildRerunIdentity,
  externalProcessingPolicyHash,
  MATH_DOCUMENT_GRADING_LIMITS,
  pseudonymousAuditId,
  sha256,
} from './math-document-grading-contracts';
import {
  assertCurrentGradingProviderPolicy,
  enqueueDocumentConversion,
  enqueueGradingRun,
  materializeTextAnswerEvidence,
  processDocumentConversionJob,
  processGradingRunJob,
  renewGradingJobLease,
  assertPipelineActorScope,
  GRADING_PROVIDER_POLICY_SELECT,
  questionContractFromRow,
  questionContractFromSnapshot,
  toGradingProviderPolicySnapshot,
  withGradingRequestIdempotency,
  writeGradingAudit,
  type PipelineActor,
} from './math-document-grading-persistence';
import { freezeLifecyclePolicy, requireConfiguredLifecyclePolicies } from './math-document-grading-lifecycle';
import type { LocalDocumentConverter, MathpixClient } from './math-document-conversion';
import type { GradingProviderRuntime } from './math-document-grading-evaluator';
import type { SubmissionObjectStore } from '@/lib/assignments/submission-object-store';

type MathGradingDb = Record<string, any>;

export interface BatchRequest {
  assignmentRevisionId: string;
  questionId: string;
  classId: string;
  actor: PipelineActor;
  idempotencyKey: string;
  evaluatorId?: string;
  evaluatorVersion?: string;
  policyId?: string | null;
  conversionPolicyId?: string | null;
  rerunReason?: string;
  maxItems?: number;
  now?: Date;
}

export async function createQuestionScopedGradingBatch(input: {
  db: MathGradingDb;
  request: BatchRequest;
}): Promise<{ batch: any; items: any[]; replay: boolean }> {
  const now = input.request.now ?? new Date();
  if (!['TEACHER', 'ADMIN'].includes(input.request.actor.role)) throw new Error('batch-forbidden');
  const question = await input.db.assignmentQuestion.findUnique({ where: { id: input.request.questionId }, include: { revision: true } });
  const classRow = await input.db.class.findUnique({ where: { id: input.request.classId }, select: { id: true, teacherId: true, isActive: true } });
  if (!question || question.assignmentRevisionId !== input.request.assignmentRevisionId || !question.revision || !classRow || !classRow.isActive) throw new Error('batch-scope-not-found');
  try {
    await assertPipelineActorScope({ db: input.db, actor: input.request.actor, assignmentRevisionId: input.request.assignmentRevisionId, classId: classRow.id, classTeacherId: classRow.teacherId, ownerStudentId: 'class-batch', purpose: 'teacher-review', now });
  } catch (error) {
    if (error instanceof Error && error.message === 'grading-forbidden') throw new Error('batch-class-forbidden');
    throw error;
  }
  const lifecyclePolicies = await requireConfiguredLifecyclePolicies(input.db, ['answer-evidence', 'ai-draft']);
  const batchLifecycle = freezeLifecyclePolicy(lifecyclePolicies.find((policy: any) => policy.dataClass === 'ai-draft'), now);
  const frozenQuestion = questionContractFromRow(question);
  const policyRow = input.request.policyId
    ? await input.db.gradingProviderPolicy.findUnique({ where: { id: input.request.policyId }, select: GRADING_PROVIDER_POLICY_SELECT })
    : null;
  if (input.request.policyId && !policyRow) throw new Error('grading-provider-policy-not-found');
  const policy = toGradingProviderPolicySnapshot(policyRow);
  if (policy && policy.purpose !== 'rubric-grading') throw new Error('provider-policy-purpose-mismatch');
  const conversionPolicyRow = input.request.conversionPolicyId
    ? await input.db.gradingProviderPolicy.findUnique({ where: { id: input.request.conversionPolicyId }, select: GRADING_PROVIDER_POLICY_SELECT })
    : null;
  if (input.request.conversionPolicyId && !conversionPolicyRow) throw new Error('grading-provider-policy-not-found');
  const conversionPolicy = toGradingProviderPolicySnapshot(conversionPolicyRow);
  if (conversionPolicy && conversionPolicy.purpose !== 'answer-conversion') throw new Error('provider-policy-purpose-mismatch');
  const policySnapshotHash = externalProcessingPolicyHash(policy);
  const conversionPolicySnapshotHash = externalProcessingPolicyHash(conversionPolicy);
  const evaluatorIdentity = {
    id: policy?.provider ?? 'configured-provider',
    version: policy?.model ?? policy?.version ?? 'runtime-resolved',
  };
  const requestHash = buildGradingRequestHash('grading-batch', {
    assignmentRevisionId: input.request.assignmentRevisionId.trim(),
    questionId: input.request.questionId.trim(),
    classId: input.request.classId.trim(),
    policyId: input.request.policyId ?? null,
    conversionPolicyId: input.request.conversionPolicyId ?? null,
    policySnapshotHash,
    conversionPolicySnapshotHash,
    evaluatorId: input.request.evaluatorId?.trim() || null,
    evaluatorVersion: input.request.evaluatorVersion?.trim() || null,
    maxItems: input.request.maxItems ?? MATH_DOCUMENT_GRADING_LIMITS.batchItems,
    rerunReason: input.request.rerunReason?.trim() || null,
  });
  const dedupeKey = buildPipelineDedupeKey('grading-batch', {
    assignmentRevisionId: input.request.assignmentRevisionId,
    questionId: input.request.questionId,
    classId: input.request.classId,
    requesterActorPseudoId: pseudonymousAuditId(input.request.actor.id, 'batch'),
    questionSnapshotHash: frozenQuestion.contentHash,
    rubricVersion: frozenQuestion.rubric.version,
    evaluator: evaluatorIdentity,
    policyId: input.request.policyId ?? null,
    policySnapshotHash,
    conversionPolicyId: input.request.conversionPolicyId ?? null,
    conversionPolicySnapshotHash,
    rerunReason: input.request.rerunReason ?? null,
    rerunIdempotencyKey: input.request.rerunReason ? input.request.idempotencyKey : null,
  });
  const attempts = await findEligibleQuestionAttempts(input.db, {
    assignmentRevisionId: input.request.assignmentRevisionId,
    questionId: input.request.questionId,
    classId: input.request.classId,
    maxItems: input.request.maxItems ?? MATH_DOCUMENT_GRADING_LIMITS.batchItems,
  });
  const requestResult = await withGradingRequestIdempotency({
    db: input.db,
    actor: input.request.actor,
    operation: 'grading-batch',
    idempotencyKey: input.request.idempotencyKey,
    requestHash,
    resourceType: 'GradingBatch',
    now,
    load: async (db, resourceId) => {
      const loaded = await db.gradingBatch.findUnique({ where: { id: resourceId }, include: { items: true, jobs: true } });
      return loaded ? { batch: { ...loaded, job: loaded.jobs?.[0] ?? null }, items: loaded.items ?? [] } : null;
    },
    create: async (db) => {
      const existing = await db.gradingBatch.findUnique({ where: { dedupeKey }, include: { items: true, jobs: true } });
      if (existing) return { resourceId: existing.id, value: { batch: { ...existing, job: existing.jobs?.[0] ?? null }, items: existing.items ?? [] }, replay: true };
      const batchId = `grading-batch:${randomUUID()}`;
      const batch = await db.gradingBatch.create({
        data: {
          id: batchId,
          assignmentRevisionId: input.request.assignmentRevisionId,
          questionId: input.request.questionId,
          classId: input.request.classId,
          requesterUserId: input.request.actor.id,
          policyId: input.request.policyId ?? null,
          policySnapshot: policy ?? null,
          policySnapshotHash,
          conversionPolicyId: input.request.conversionPolicyId ?? null,
          conversionPolicySnapshot: conversionPolicy ?? null,
          conversionPolicySnapshotHash,
          dedupeKey,
          idempotencyKey: input.request.idempotencyKey,
          questionSnapshotHash: frozenQuestion.contentHash,
          rubricVersion: frozenQuestion.rubric.version,
          evaluatorId: evaluatorIdentity.id,
          evaluatorVersion: evaluatorIdentity.version,
          questionSnapshot: frozenQuestion,
          rubricSnapshot: frozenQuestion.rubric,
          referenceAnswer: frozenQuestion.referenceAnswer,
          progress: attempts.length === 0 ? 100 : 0,
          state: attempts.length === 0 ? 'SUCCEEDED' : 'QUEUED',
          totalItems: attempts.length,
          completedItems: 0,
          requestedAt: now,
          completedAt: attempts.length === 0 ? now : null,
          rerunReason: input.request.rerunReason ?? null,
          ...batchLifecycle,
          createdAt: now,
          updatedAt: now,
          items: {
            create: attempts.map((attempt: any) => ({
              id: `grading-batch-item:${batchId}:${attempt.id}`,
              answerId: attempt.answerId,
              attemptId: attempt.id,
              answerVersion: attempt.answerVersion,
              questionSnapshotHash: frozenQuestion.contentHash,
              rubricVersion: frozenQuestion.rubric.version,
              evaluatorVersion: evaluatorIdentity.version,
              state: 'QUEUED',
              progress: 0,
              createdAt: now,
              updatedAt: now,
            })),
          },
        },
        include: { items: true },
      });
      const job = await db.gradingJob.create({
        data: {
          id: `grading-job:batch:${batch.id}`,
          kind: 'BATCH',
          state: attempts.length === 0 ? 'SUCCEEDED' : 'QUEUED',
          dedupeKey: buildPipelineDedupeKey('grading-batch-job', { batchId: batch.id, idempotencyKey: input.request.idempotencyKey }),
          idempotencyKey: input.request.idempotencyKey,
          reason: input.request.rerunReason ?? null,
          rerunIdentity: input.request.rerunReason
            ? buildRerunIdentity({ kind: 'batch', sourceId: batch.id, reason: input.request.rerunReason, inputHash: frozenQuestion.contentHash, versionBoundary: evaluatorIdentity.version, idempotencyKey: input.request.idempotencyKey })
            : null,
          batchId: batch.id,
          policyId: input.request.policyId ?? null,
          correlationId: randomUUID(),
          progress: attempts.length === 0 ? 100 : 0,
          completedAt: attempts.length === 0 ? now : null,
          createdAt: now,
          updatedAt: now,
        },
      });
      if (input.request.rerunReason && db.gradingRerun?.create) {
        const rerunIdentity = job.rerunIdentity;
        await db.gradingRerun.create({ data: { id: `grading-rerun:${rerunIdentity.slice(-24)}`, kind: 'RERUN', rerunIdentity, batchId: batch.id, gradingJobId: job.id, reason: input.request.rerunReason, createdByPseudoId: pseudonymousAuditId(input.request.actor.id, 'batch'), versionBoundary: evaluatorIdentity.version, idempotencyKey: `batch:${batch.id}`, createdAt: now } });
      }
      await writeGradingAudit(db, {
        actor: input.request.actor,
        action: 'grading-batch.enqueued',
        purpose: 'rubric-grading',
        resourceType: 'GradingBatch',
        resourceId: batch.id,
        classId: batch.classId,
        metadata: { dedupeKey, idempotencyKey: input.request.idempotencyKey, questionId: batch.questionId, evaluatorVersion: batch.evaluatorVersion, totalItems: batch.totalItems, rerun: Boolean(input.request.rerunReason) },
      });
      return { resourceId: batch.id, value: { batch: { ...batch, job }, items: batch.items } };
    },
  });
  return { ...requestResult.value, replay: requestResult.replay };
}

export async function processQuestionGradingBatch(input: {
  db: MathGradingDb;
  batchId: string;
  jobId?: string;
  workerClaimToken?: string;
  itemId?: string;
  store?: SubmissionObjectStore;
  mathpix?: MathpixClient;
  local?: LocalDocumentConverter;
  provider?: GradingProviderRuntime;
  now?: Date;
}): Promise<{ batch: any; itemResults: Array<{ itemId: string; state: string; error?: string }> }> {
  const now = input.now ?? new Date();
  const batch = await input.db.gradingBatch.findUnique({ where: { id: input.batchId }, include: { items: true, question: true, policy: true, conversionPolicy: true } });
  if (!batch) throw new Error('grading-batch-not-found');
  if (batch.assignmentRevisionId === null || batch.questionId === null || batch.classId === null) throw new Error('batch-content-unavailable:parent-lineage-missing');
  if (batch.state && !['CONTENT_UNAVAILABLE', 'CANCELLED', 'FAILED', 'BLOCKED', 'SUCCEEDED', 'PARTIAL'].includes(batch.state)) {
    const missing = ['assignmentRevisionId', 'questionId', 'classId', 'requesterUserId', 'questionSnapshot', 'rubricSnapshot', 'referenceAnswer'].filter((field) => batch[field] === null);
    if (missing.length > 0) throw new Error(`active-grading-batch-lineage-missing:${missing.join(',')}`);
  }
  const durableJob = input.jobId && input.db.gradingJob?.findUnique ? await input.db.gradingJob.findUnique({ where: { id: input.jobId } }) : null;
  if (durableJob && ['SUCCEEDED', 'FAILED', 'CANCELLED', 'BLOCKED', 'CONTENT_UNAVAILABLE'].includes(durableJob.state)) {
    return { batch, itemResults: [] };
  }
  const terminalBatch = ['SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED', 'BLOCKED', 'CONTENT_UNAVAILABLE'].includes(batch.state);
  if (terminalBatch && !input.itemId) {
    if (durableJob && !['SUCCEEDED', 'FAILED', 'CANCELLED', 'BLOCKED', 'CONTENT_UNAVAILABLE'].includes(durableJob.state) && input.db.gradingJob?.update) {
      await input.db.gradingJob.update({
        where: { id: durableJob.id },
        data: {
          state: batchTerminalJobState(batch.state),
          progress: 100,
          completedAt: now,
          lastErrorCode: batch.state === 'PARTIAL' ? 'batch-partial' : null,
          updatedAt: now,
        },
      }).catch(() => undefined);
    }
    return { batch, itemResults: [] };
  }
  if (batch.cancellationRequestedAt) {
    await input.db.gradingBatchItem.updateMany({ where: { batchId: batch.id, state: { in: ['QUEUED', 'CONVERTING', 'GRADING', 'RETRYABLE'] } }, data: { state: 'CANCELLED', failureCode: null, workerClaimToken: null, workerClaimedAt: null, progress: 100, updatedAt: now } });
    const cancelled = await updateBatchWorkerRecord(input.db.gradingBatch, batch.id, { state: 'CANCELLED', completedAt: now, updatedAt: now });
    if (input.jobId && input.workerClaimToken) {
      await claimBatchJobWorkerRecord(input.db.gradingJob, input.jobId, input.workerClaimToken, now);
      await updateBatchJobWorkerRecord(input.db.gradingJob, input.jobId, { state: 'CANCELLED', progress: 100, completedAt: now, workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null, updatedAt: now }, input.workerClaimToken);
    }
    return { batch: cancelled, itemResults: batch.items.map((item: any) => ({ itemId: item.id, state: 'CANCELLED' })) };
  }
  const frozenPolicy = batch.policyId
    ? assertCurrentGradingProviderPolicy({ policyId: batch.policyId, snapshot: batch.policySnapshot, snapshotHash: batch.policySnapshotHash, currentPolicy: batch.policy, expectedPurpose: 'rubric-grading' })
    : batch.policy ? toGradingProviderPolicySnapshot(batch.policy) : null;
  if (frozenPolicy && frozenPolicy.purpose !== 'rubric-grading') throw new Error('provider-policy-purpose-mismatch');
  const frozenConversionPolicy = batch.conversionPolicyId
    ? assertCurrentGradingProviderPolicy({ policyId: batch.conversionPolicyId, snapshot: batch.conversionPolicySnapshot, snapshotHash: batch.conversionPolicySnapshotHash, currentPolicy: batch.conversionPolicy, expectedPurpose: 'answer-conversion' })
    : batch.conversionPolicy ? toGradingProviderPolicySnapshot(batch.conversionPolicy) : null;
  if (frozenConversionPolicy && frozenConversionPolicy.purpose !== 'answer-conversion') throw new Error('provider-policy-purpose-mismatch');
  const workerBatch = { ...batch, policy: frozenPolicy, policySnapshot: frozenPolicy, conversionPolicy: frozenConversionPolicy, conversionPolicySnapshot: frozenConversionPolicy };
  const itemResults: Array<{ itemId: string; state: string; error?: string }> = [];
  let claimedItems = 0;
  let workerStarted = false;
  let ownershipLost = false;
  let parentReady = !(input.jobId && durableJob && input.workerClaimToken);
  if (!input.itemId) {
    await updateBatchWorkerRecord(input.db.gradingBatch, batch.id, { updatedAt: now }, { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] });
  }
  const items = input.itemId
    ? batch.items.filter((item: any) => item.id === input.itemId)
    : batch.items.filter((item: any) => ['QUEUED', 'CONVERTING', 'GRADING', 'RETRYABLE'].includes(item.state));
  if (input.itemId && items.length === 0) throw new Error('batch-item-not-found');
  for (const item of items) {
    if (await isBatchCancellationRequested(input.db, batch.id)) {
      await cancelUnclaimedBatchItems(input.db, batch.id, items, now);
      itemResults.push(...items.filter((candidate: any) => ['QUEUED', 'RETRYABLE'].includes(candidate.state)).map((candidate: any) => ({ itemId: candidate.id, state: 'CANCELLED' })));
      break;
    }
    const claim = await claimBatchItem(input.db, item, now);
    if (!claim) continue;
    claimedItems += 1;
    const leaseAbortController = new AbortController();
    const leaseHeartbeat = startBatchItemLeaseHeartbeat({
      db: input.db,
      itemId: item.id,
      workerClaimToken: claim.token,
      jobId: input.jobId,
      jobClaimToken: input.workerClaimToken,
      now: () => new Date(),
      onLost: () => leaseAbortController.abort(),
    });
    const parentLeaseLost = () => isBatchWorkerLeaseLost({ db: input.db, itemId: item.id, itemClaimToken: claim.token, jobId: parentReady ? input.jobId : undefined, jobClaimToken: parentReady ? input.workerClaimToken : undefined, heartbeat: leaseHeartbeat });
    try {
      if (await parentLeaseLost()) throw new Error('batch-worker-fenced');
      if (!workerStarted) {
        const startWhere = input.itemId ? undefined : { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] };
        await updateBatchWorkerRecord(input.db.gradingBatch, batch.id, { state: 'RUNNING', startedAt: batch.startedAt ?? now, updatedAt: now }, startWhere);
        if (input.jobId && durableJob && input.workerClaimToken) {
          await claimBatchJobWorkerRecord(input.db.gradingJob, input.jobId, input.workerClaimToken, now);
          await updateBatchJobWorkerRecord(input.db.gradingJob, input.jobId, { state: 'RUNNING', progress: batch.progress ?? 0, startedAt: now, updatedAt: now }, input.workerClaimToken);
          parentReady = true;
        }
        workerStarted = true;
      }
      const result = await processBatchItem({
        ...input,
        batch: workerBatch,
        item: { ...item, ...claim.item },
        workerClaimToken: claim.token,
        rerunIdentity: durableJob?.rerunIdentity ?? null,
        rerunReason: durableJob?.reason ?? null,
        parentLeaseLost,
        signal: leaseAbortController.signal,
        now,
      });
      itemResults.push(result);
    } catch (error) {
      const code = error instanceof Error ? error.message.slice(0, 120) : 'batch-item-failed';
      if (/batch-worker-fenced/i.test(code)) {
        ownershipLost = true;
        break;
      }
      if (code === 'batch-cancelled') {
        await updateClaimedBatchItem(input.db.gradingBatchItem, item.id, claim.token, { state: 'CANCELLED', progress: 100, failureCode: null, workerClaimToken: null, workerClaimedAt: null, updatedAt: now });
        itemResults.push({ itemId: item.id, state: 'CANCELLED' });
        continue;
      }
      if (/worker-fenced|item-not-claimed/i.test(code)) continue;
      if (await parentLeaseLost()) {
        ownershipLost = true;
        break;
      }
      const blocked = /blocked|frozen|policy|evidence-not-ready|content-unavailable|association-missing|attempt-(?:missing|not-found)|asset-missing/i.test(code);
      const retryable = !blocked && /queue|timeout|network|provider|unavailable|redis|fetch|conversion-retryable/i.test(code) && item.retryCount < MATH_DOCUMENT_GRADING_LIMITS.retryCount;
      const state = blocked ? 'BLOCKED' : retryable ? 'RETRYABLE' : 'FAILED';
      try {
        await updateClaimedBatchItem(input.db.gradingBatchItem, item.id, claim.token, { state, failureCode: code, retryCount: { increment: 1 }, workerClaimToken: null, workerClaimedAt: null, updatedAt: now });
        itemResults.push({ itemId: item.id, state, error: code });
      } catch (fenceError) {
        if (!/worker-fenced|item-not-claimed/i.test(fenceError instanceof Error ? fenceError.message : String(fenceError))) throw fenceError;
      }
    } finally {
      if (leaseHeartbeat.isLost()) { ownershipLost = true; leaseAbortController.abort(); }
      leaseHeartbeat.stop();
    }
  }
  if (ownershipLost) throw new Error('batch-worker-fenced');
  if (claimedItems === 0 && itemResults.length === 0) {
    const current = input.db.gradingBatch.findUnique ? await input.db.gradingBatch.findUnique({ where: { id: batch.id } }) : batch;
    return { batch: current ?? batch, itemResults };
  }
  const aggregate = await updateBatchAggregate(input.db, batch.id, batch.totalItems, now);
  const { updated, state, progress, retryable, terminal } = aggregate;
  if (input.jobId) {
    const retryItemResult = input.itemId ? itemResults.find((result) => result.itemId === input.itemId) : null;
    const retryJobState = retryItemResult?.state === 'RETRYABLE'
      ? 'RETRYABLE'
      : retryItemResult?.state === 'BLOCKED'
        ? 'BLOCKED'
        : retryItemResult?.state === 'CANCELLED'
          ? 'CANCELLED'
          : retryItemResult?.state === 'FAILED'
            ? 'FAILED'
            : 'SUCCEEDED';
    const jobState = input.itemId
      ? retryJobState
      : state === 'RETRYABLE'
        ? 'RETRYABLE'
        : state === 'FAILED'
          ? 'FAILED'
          : state === 'BLOCKED'
            ? 'BLOCKED'
            : state === 'CANCELLED'
              ? 'CANCELLED'
              : terminal
                ? 'SUCCEEDED'
                : 'RUNNING';
    const jobIsRetryItem = Boolean(input.itemId);
    const jobTerminal = jobIsRetryItem ? jobState !== 'RETRYABLE' : terminal;
    const jobProgress = jobIsRetryItem ? (jobState === 'RETRYABLE' ? 60 : 100) : progress;
    const jobData = {
      state: jobState,
      progress: jobProgress,
      completedAt: jobTerminal ? now : null,
      ...(jobIsRetryItem
        ? { nextRunAt: jobState === 'RETRYABLE' ? new Date(now.getTime() + 5_000) : null, workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null }
        : (terminal || jobState === 'RETRYABLE' ? { workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null } : {})),
      lastErrorCode: jobIsRetryItem ? retryItemResult?.error ?? null : state === 'PARTIAL' ? 'batch-partial' : retryable > 0 ? 'batch-item-retryable' : null,
      updatedAt: now,
    };
    await updateBatchJobWorkerRecord(input.db.gradingJob, input.jobId, jobData, input.workerClaimToken);
  }
  return { batch: updated, itemResults };
}

export async function retryQuestionGradingBatchItem(input: {
  db: MathGradingDb;
  batchId: string;
  itemId: string;
  actor: PipelineActor;
  idempotencyKey: string;
  requestHash?: string;
  reason: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const batch = await input.db.gradingBatch.findUnique({ where: { id: input.batchId }, include: { class: true } });
  const item = await input.db.gradingBatchItem.findUnique({ where: { id: input.itemId } });
  if (!batch || !item || item.batchId !== batch.id) throw new Error('batch-item-not-found');
  if (batch.assignmentRevisionId === null || batch.classId === null || batch.class === null || item.attemptId === null) throw new Error('batch-content-unavailable:parent-lineage-missing');
  const retryableStates = ['FAILED', 'RETRYABLE', 'BLOCKED'];
  try {
    await assertPipelineActorScope({ db: input.db, actor: input.actor, assignmentRevisionId: batch.assignmentRevisionId, classId: batch.classId, classTeacherId: batch.class.teacherId, ownerStudentId: 'class-batch', purpose: 'teacher-review', now });
  } catch {
    throw new Error('batch-retry-forbidden');
  }
  if (!input.reason.trim()) throw new Error('retry-reason-required');
  const actorPseudoId = pseudonymousAuditId(input.actor.id, 'retry');
  const rerunIdentity = buildRerunIdentity({ kind: 'retry', sourceId: item.id, reason: input.reason.trim(), inputHash: `${batch.questionSnapshotHash}:${actorPseudoId}`, versionBoundary: batch.evaluatorVersion, idempotencyKey: input.idempotencyKey });
  const requestHash = buildGradingRequestHash('grading-batch-item-retry', { batchId: batch.id, itemId: item.id, reason: input.reason.trim(), callerRequestHash: input.requestHash ?? null });
  const dedupeKey = buildPipelineDedupeKey('grading-retry-job', { itemId: item.id, idempotencyKey: input.idempotencyKey, actorPseudoId });
  const requestResult = await withGradingRequestIdempotency({
    db: input.db,
    actor: input.actor,
    operation: 'grading-batch-item-retry',
    idempotencyKey: input.idempotencyKey,
    requestHash,
    resourceType: 'GradingJob',
    now,
    load: async (db, resourceId) => {
      const job = await db.gradingJob.findUnique({ where: { id: resourceId } });
      return job ? { job, rerunIdentity } : null;
    },
    create: async (db) => {
      const currentItem = db.gradingBatchItem?.findUnique ? await db.gradingBatchItem.findUnique({ where: { id: item.id } }) : item;
      if (!currentItem || !retryableStates.includes(currentItem.state)) throw new Error('batch-item-not-retryable');
      if (currentItem?.retryCount >= MATH_DOCUMENT_GRADING_LIMITS.retryCount) throw new Error('retry-quota-exceeded');
      const existing = await db.gradingJob?.findUnique?.({ where: { dedupeKey } });
      if (existing) return { resourceId: existing.id, value: { job: existing, rerunIdentity }, replay: true };
      const job = await db.gradingJob.create({
        data: {
          id: `grading-job:retry:${rerunIdentity.slice(-24)}`,
          kind: 'RETRY',
          rerunIdentity,
          state: 'QUEUED',
          dedupeKey,
          idempotencyKey: input.idempotencyKey,
          reason: input.reason.trim(),
          batchId: batch.id,
          batchItemId: item.id,
          attemptId: item.attemptId,
          correlationId: randomUUID(),
          createdAt: now,
          updatedAt: now,
        },
      });
      if (db.gradingRerun?.create) {
        await db.gradingRerun.create({ data: { id: `grading-rerun:${rerunIdentity.slice(-24)}`, kind: 'RETRY', rerunIdentity, batchId: batch.id, gradingJobId: job.id, reason: input.reason.trim(), createdByPseudoId: actorPseudoId, versionBoundary: batch.evaluatorVersion, idempotencyKey: `retry:${job.id}`, createdAt: now } });
      }
      const resetData = { state: 'QUEUED', failureCode: null, lastAttemptAt: now, workerClaimToken: null, workerClaimedAt: null, updatedAt: now };
      if (db.gradingBatchItem?.updateMany) {
        const reset = await db.gradingBatchItem.updateMany({ where: { id: item.id, state: { in: retryableStates } }, data: resetData });
        if (reset?.count !== undefined && reset.count !== 1) throw new Error('batch-item-retry-fenced');
      } else {
        await db.gradingBatchItem.update({ where: { id: item.id }, data: resetData });
      }
      await db.gradingBatch?.updateMany?.({ where: { id: batch.id, state: { in: ['FAILED', 'RETRYABLE', 'BLOCKED', 'PARTIAL'] } }, data: { state: 'QUEUED', cancellationRequestedAt: null, nextRunAt: null, updatedAt: now } });
      await writeGradingAudit(db, {
        actor: input.actor,
        action: 'grading-batch-item.retry-requested',
        purpose: 'rubric-grading',
        resourceType: 'GradingBatchItem',
        resourceId: item.id,
        classId: batch.classId,
        metadata: { batchId: batch.id, idempotencyKey: input.idempotencyKey, rerunIdentity, reason: input.reason.trim() },
      });
      return { resourceId: job.id, value: { job, rerunIdentity } };
    },
  });
  return { ...requestResult.value, replay: requestResult.replay };
}

export async function cancelQuestionGradingBatch(input: { db: MathGradingDb; batchId: string; actor: PipelineActor; idempotencyKey?: string; requestHash?: string; now?: Date }) {
  const now = input.now ?? new Date();
  const batch = await input.db.gradingBatch.findUnique({ where: { id: input.batchId }, include: { class: true } });
  if (!batch) throw new Error('grading-batch-not-found');
  if (batch.assignmentRevisionId === null || batch.classId === null || batch.class === null) throw new Error('batch-content-unavailable:parent-lineage-missing');
  try {
    await assertPipelineActorScope({ db: input.db, actor: input.actor, assignmentRevisionId: batch.assignmentRevisionId, classId: batch.classId, classTeacherId: batch.class.teacherId, ownerStudentId: 'class-batch', purpose: 'teacher-review', now });
  } catch {
    throw new Error('batch-cancel-forbidden');
  }
  const requestHash = buildGradingRequestHash('grading-batch-cancel', { batchId: batch.id, callerRequestHash: input.requestHash ?? null });
  const cancel = async (db: MathGradingDb) => {
    const updated = await db.gradingBatch.update({ where: { id: batch.id }, data: { cancellationRequestedAt: now, updatedAt: now } });
    await writeGradingAudit(db, {
      actor: input.actor,
      action: 'grading-batch.cancellation-requested',
      purpose: 'rubric-grading',
      resourceType: 'GradingBatch',
      resourceId: batch.id,
      classId: batch.classId,
      metadata: { state: batch.state, idempotencyKey: input.idempotencyKey ?? null },
    });
    return updated;
  };
  const result = input.idempotencyKey
    ? await withGradingRequestIdempotency({
      db: input.db,
      actor: input.actor,
      operation: 'grading-batch-cancel',
      idempotencyKey: input.idempotencyKey,
      requestHash,
      resourceType: 'GradingBatch',
      now,
      load: async (db, resourceId) => db.gradingBatch.findUnique({ where: { id: resourceId } }),
      create: async (db) => ({ resourceId: batch.id, value: await cancel(db) }),
    })
    : { value: await (input.db.$transaction ? input.db.$transaction(cancel) : cancel(input.db)), replay: false };
  return result.value;
}

async function processBatchItem(input: {
  db: MathGradingDb;
  batch: any;
  item: any;
  store?: SubmissionObjectStore;
  mathpix?: MathpixClient;
  local?: LocalDocumentConverter;
  provider?: GradingProviderRuntime;
  workerClaimToken: string;
  rerunIdentity?: string | null;
  rerunReason?: string | null;
  parentLeaseLost?: () => Promise<boolean> | boolean;
  signal?: AbortSignal;
  now: Date;
}): Promise<{ itemId: string; state: string; error?: string }> {
  await assertBatchWorkerLease(input);
  await assertBatchNotCancelled(input.db, input.batch.id);
  if (!input.item.attemptId) throw new Error('batch-item-content-unavailable:attempt-missing');
  const attempt = await input.db.submissionAttempt.findUnique({ where: { id: input.item.attemptId }, include: { answer: { include: { assets: { where: { attemptId: input.item.attemptId, state: 'FINALIZED' }, orderBy: { version: 'desc' }, take: 1 }, submission: true, question: true } } } });
  if (!attempt || !attempt.answer) throw new Error('batch-item-content-unavailable:attempt-not-found');
  if (attempt.answer.submission === null || attempt.answer.question === null || attempt.answer.submission?.frozenAudienceClassId === null || attempt.answer.question?.assignmentRevisionId === null) throw new Error('batch-item-content-unavailable:association-missing');
  if (input.item.answerVersion !== undefined && attempt.answerVersion !== input.item.answerVersion) throw new Error('batch-frozen-answer-version-mismatch');
  if (input.item.questionSnapshotHash && attempt.answer.question.contentHash !== input.item.questionSnapshotHash) throw new Error('batch-frozen-question-hash-mismatch');
  const frozenQuestion = questionContractFromSnapshot({ questionSnapshot: input.batch.questionSnapshot, questionSnapshotHash: input.batch.questionSnapshotHash, rubricSnapshot: input.batch.rubricSnapshot, referenceAnswer: input.batch.referenceAnswer, questionId: input.batch.questionId, assignmentRevisionId: input.batch.assignmentRevisionId });
  if (frozenQuestion.contentHash !== input.batch.questionSnapshotHash || frozenQuestion.rubric.version !== input.batch.rubricVersion) throw new Error('batch-frozen-snapshot-invalid');
  if (typeof input.batch.questionSnapshot?.referenceAnswer === 'string' && input.batch.questionSnapshot.referenceAnswer !== input.batch.referenceAnswer) throw new Error('batch-frozen-reference-answer-mismatch');
  if (input.item.rubricVersion && input.item.rubricVersion !== input.batch.rubricVersion) throw new Error('batch-frozen-rubric-version-mismatch');
  if (input.item.evaluatorVersion && input.item.evaluatorVersion !== input.batch.evaluatorVersion) throw new Error('batch-frozen-evaluator-version-mismatch');
  let evidence = input.item.evidenceId ? await input.db.answerEvidence.findUnique({ where: { id: input.item.evidenceId }, include: { blocks: true } }) : null;
  if (!evidence) {
    if (attempt.textSnapshot?.trim()) {
      await assertBatchWorkerLease(input);
      await assertBatchNotCancelled(input.db, input.batch.id);
      const result = await materializeTextAnswerEvidence({
        db: input.db,
        attemptId: attempt.id,
        actor: { id: 'grading-worker', role: 'SERVICE' },
        operation: 'grading-batch-item-evidence',
        idempotencyKey: `batch:${input.batch.id}:${input.item.id}:evidence`,
        requestHash: buildGradingRequestHash('grading-batch-item-evidence', {
          batchId: input.batch.id,
          batchItemId: input.item.id,
          attemptId: attempt.id,
          answerVersion: attempt.answerVersion,
        }),
        now: input.now,
      });
      evidence = result.evidence;
    } else {
      const asset = attempt.answer.assets[0];
      if (!asset) throw new Error('batch-finalized-asset-missing');
      await assertBatchWorkerLease(input);
      await updateClaimedBatchItem(input.db.gradingBatchItem, input.item.id, input.workerClaimToken, { state: 'CONVERTING', progress: 20, conversionId: input.item.conversionId, updatedAt: input.now });
      await assertBatchNotCancelled(input.db, input.batch.id);
      const conversionPolicyId = input.batch.conversionPolicyId ?? null;
      const executionSuffix = input.rerunIdentity ? `:${input.rerunIdentity}` : '';
      const conversion = await enqueueDocumentConversion({ db: input.db, assetId: asset.id, attemptId: attempt.id, actor: { id: 'grading-worker', role: 'SERVICE' }, adapterVersion: 'router.v1', policyId: conversionPolicyId, policySnapshot: input.batch.conversionPolicySnapshot ?? null, policySnapshotHash: input.batch.conversionPolicySnapshotHash ?? null, idempotencyKey: `batch:${input.batch.id}:${input.item.id}:conversion${executionSuffix}`, rerunIdentity: input.rerunIdentity ?? null, reason: input.rerunReason ? `conversion-rerun:${input.rerunReason}` : 'batch-item-conversion', now: input.now });
      await updateClaimedBatchItem(input.db.gradingBatchItem, input.item.id, input.workerClaimToken, { conversionId: conversion.conversion.id, updatedAt: input.now });
      if (conversion.job) {
        const processedConversion = await processDocumentConversionJob({ db: input.db, jobId: conversion.job.id, workerClaimToken: input.workerClaimToken, store: input.store, mathpix: conversionPolicyId ? input.mathpix : undefined, local: input.local, parentLeaseLost: input.parentLeaseLost, signal: input.signal, now: input.now });
        if (processedConversion.conversion.state === 'CANCELLED') throw new Error('batch-cancelled');
        if (processedConversion.conversion.state === 'RETRYABLE') throw new Error('batch-conversion-retryable');
        if (processedConversion.conversion.state === 'BLOCKED') throw new Error('batch-conversion-blocked');
      }
      await assertBatchWorkerLease(input);
      await assertBatchNotCancelled(input.db, input.batch.id);
      evidence = await input.db.answerEvidence.findFirst({ where: { attemptId: attempt.id, readiness: 'READY' }, include: { blocks: true }, orderBy: { version: 'desc' } });
    }
  }
  if (!evidence || evidence.readiness !== 'READY') throw new Error('batch-evidence-not-ready');
  if (input.item.evidenceVersion !== undefined && evidence.version !== input.item.evidenceVersion) throw new Error('batch-frozen-evidence-version-mismatch');
  if (input.item.evidenceHash && evidence.sourceHash !== input.item.evidenceHash) throw new Error('batch-frozen-evidence-hash-mismatch');
  await assertBatchWorkerLease(input);
  await assertBatchNotCancelled(input.db, input.batch.id);
  await updateClaimedBatchItem(input.db.gradingBatchItem, input.item.id, input.workerClaimToken, { evidenceId: evidence.id, evidenceHash: evidence.sourceHash, evidenceVersion: evidence.version, state: 'GRADING', progress: 60, updatedAt: input.now });
  await assertBatchWorkerLease(input);
  const executionSuffix = input.rerunIdentity ? `:${input.rerunIdentity}` : '';
  const rerunReason = input.rerunReason
    ? `batch-item-retry:${input.rerunReason}`
    : input.batch.rerunReason ?? undefined;
  const enqueued = await enqueueGradingRun({ db: input.db, attemptId: attempt.id, evidenceId: evidence.id, actor: { id: 'grading-worker', role: 'SERVICE' }, idempotencyKey: `batch:${input.batch.id}:${input.item.id}:grading${executionSuffix}`, batchId: input.batch.id, batchItemId: input.item.id, policyId: input.batch.policyId, policySnapshot: input.batch.policySnapshot ?? null, policySnapshotHash: input.batch.policySnapshotHash ?? null, evaluatorId: input.batch.evaluatorId, evaluatorVersion: input.batch.evaluatorVersion, frozenQuestion, rerunReason, now: input.now });
  await assertBatchWorkerLease(input);
  const processed = enqueued.job ? await processGradingRunJob({ db: input.db, jobId: enqueued.job.id, workerClaimToken: input.workerClaimToken, provider: input.provider, policy: input.batch.policySnapshot ?? input.batch.policy ?? null, parentLeaseLost: input.parentLeaseLost, signal: input.signal, now: input.now }) : null;
  const runState = processed?.run.state ?? enqueued.run.state;
  const finalState = runState === 'AWAITING_REVIEW' ? 'SUCCEEDED' : runState === 'CANCELLED' ? 'CANCELLED' : runState === 'BLOCKED' ? 'BLOCKED' : runState === 'RETRYABLE' ? 'RETRYABLE' : 'FAILED';
  await assertBatchWorkerLease(input);
  await updateClaimedBatchItem(input.db.gradingBatchItem, input.item.id, input.workerClaimToken, { gradingRunId: enqueued.run.id, inputHash: enqueued.run.inputHash, state: finalState, progress: finalState === 'RETRYABLE' ? 60 : 100, workerClaimToken: null, workerClaimedAt: null, updatedAt: input.now });
  return { itemId: input.item.id, state: finalState };
}

async function assertBatchWorkerLease(input: { parentLeaseLost?: () => Promise<boolean> | boolean; signal?: AbortSignal }): Promise<void> {
  if (input.signal?.aborted || (input.parentLeaseLost && await input.parentLeaseLost())) throw new Error('batch-worker-fenced');
}

async function findEligibleQuestionAttempts(db: MathGradingDb, input: { assignmentRevisionId: string; questionId: string; classId: string; maxItems: number }) {
  const attempts = await db.submissionAttempt.findMany({
    where: { answer: { assignmentQuestionId: input.questionId, state: 'SUBMITTED', submission: { assignmentRevisionId: input.assignmentRevisionId, frozenAudienceClassId: input.classId, state: 'SUBMITTED' } } },
    orderBy: { submittedAt: 'desc' },
    take: input.maxItems,
    select: { id: true, answerId: true, answerVersion: true },
  });
  const seen = new Set<string>();
  return attempts.filter((attempt: any) => !seen.has(attempt.answerId) && seen.add(attempt.answerId));
}

function batchTerminalJobState(state: string): 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'BLOCKED' | 'CONTENT_UNAVAILABLE' {
  if (state === 'FAILED') return 'FAILED';
  if (state === 'CANCELLED') return 'CANCELLED';
  if (state === 'BLOCKED') return 'BLOCKED';
  if (state === 'CONTENT_UNAVAILABLE') return 'CONTENT_UNAVAILABLE';
  return 'SUCCEEDED';
}

const BATCH_ITEM_CLAIM_LEASE_MS = 5 * 60_000;
export const BATCH_ITEM_LEASE_HEARTBEAT_MS = 60_000;

export async function renewBatchItemLease(input: { db: MathGradingDb; itemId: string; workerClaimToken: string; now?: Date }): Promise<boolean> {
  const model = input.db.gradingBatchItem;
  const requestedNow = input.now ?? new Date();
  let current: any = null;
  try {
    current = model?.findUnique ? await model.findUnique({ where: { id: input.itemId } }) : null;
  } catch {
    return false;
  }
  if (current && (current.workerClaimToken !== input.workerClaimToken || !['CONVERTING', 'GRADING'].includes(current.state))) return false;
  const currentClaimedAt = current?.workerClaimedAt ? new Date(current.workerClaimedAt) : null;
  const staleBefore = new Date(requestedNow.getTime() - BATCH_ITEM_CLAIM_LEASE_MS);
  if (currentClaimedAt && currentClaimedAt <= staleBefore) return false;
  const proposedClaimedAt = currentClaimedAt && currentClaimedAt > requestedNow ? currentClaimedAt : requestedNow;
  const data = { workerClaimedAt: proposedClaimedAt, updatedAt: proposedClaimedAt };
  if (model?.updateMany) {
    const result = await model.updateMany({ where: { id: input.itemId, workerClaimToken: input.workerClaimToken, state: { in: ['CONVERTING', 'GRADING'] }, OR: [{ workerClaimedAt: null }, { workerClaimedAt: { gt: staleBefore } }], AND: [{ OR: [{ workerClaimedAt: null }, { workerClaimedAt: { lt: proposedClaimedAt } }] }] }, data });
    const renewed = result?.count === undefined ? Boolean(result) : result.count === 1;
    if (renewed) return true;
    try {
      const latest = model.findUnique ? await model.findUnique({ where: { id: input.itemId } }) : null;
      return Boolean(latest && latest.workerClaimToken === input.workerClaimToken && ['CONVERTING', 'GRADING'].includes(latest.state) && latest.workerClaimedAt && new Date(latest.workerClaimedAt) >= proposedClaimedAt && new Date(latest.workerClaimedAt) > staleBefore);
    } catch {
      return false;
    }
  }
  return false;
}

export function startBatchItemLeaseHeartbeat(input: {
  db: MathGradingDb;
  itemId: string;
  workerClaimToken: string;
  jobId?: string;
  jobClaimToken?: string;
  intervalMs?: number;
  now?: () => Date;
  onLost?: () => void;
}) {
  let lost = false;
  const timer = setInterval(() => {
    const now = input.now?.() ?? new Date();
    void Promise.all([
      renewBatchItemLease({ db: input.db, itemId: input.itemId, workerClaimToken: input.workerClaimToken, now }),
      input.jobId && input.jobClaimToken
        ? renewGradingJobLease({ db: input.db, jobId: input.jobId, workerClaimToken: input.jobClaimToken, now })
        : Promise.resolve(true),
    ]).then(([itemRenewed, jobRenewed]) => {
      if (!itemRenewed || !jobRenewed) { lost = true; input.onLost?.(); }
    }).catch(() => { lost = true; input.onLost?.(); });
  }, input.intervalMs ?? BATCH_ITEM_LEASE_HEARTBEAT_MS);
  return { stop: () => clearInterval(timer), isLost: () => lost };
}

async function isBatchWorkerLeaseLost(input: { db: MathGradingDb; itemId: string; itemClaimToken: string; jobId?: string; jobClaimToken?: string; heartbeat: { isLost: () => boolean } }): Promise<boolean> {
  if (input.heartbeat.isLost()) return true;
  const itemRenewed = await renewBatchItemLease({ db: input.db, itemId: input.itemId, workerClaimToken: input.itemClaimToken });
  const jobRenewed = input.jobId && input.jobClaimToken
    ? await renewGradingJobLease({ db: input.db, jobId: input.jobId, workerClaimToken: input.jobClaimToken })
    : true;
  return !itemRenewed || !jobRenewed;
}

async function isBatchCancellationRequested(db: MathGradingDb, batchId: string): Promise<boolean> {
  if (!db.gradingBatch?.findUnique) return false;
  const row = await db.gradingBatch.findUnique({ where: { id: batchId }, select: { cancellationRequestedAt: true } });
  return Boolean(row?.cancellationRequestedAt);
}

async function assertBatchNotCancelled(db: MathGradingDb, batchId: string): Promise<void> {
  if (await isBatchCancellationRequested(db, batchId)) throw new Error('batch-cancelled');
}

async function cancelUnclaimedBatchItems(db: MathGradingDb, batchId: string, items: any[], now: Date): Promise<void> {
  const model = db.gradingBatchItem;
  const data = { state: 'CANCELLED', progress: 100, failureCode: null, workerClaimToken: null, workerClaimedAt: null, updatedAt: now };
  if (model?.updateMany) {
    await model.updateMany({ where: { batchId, state: { in: ['QUEUED', 'RETRYABLE'] }, workerClaimToken: null }, data });
    return;
  }
  for (const item of items.filter((candidate: any) => ['QUEUED', 'RETRYABLE'].includes(candidate.state))) {
    await model?.update?.({ where: { id: item.id }, data });
  }
}

async function claimBatchItem(db: MathGradingDb, item: any, now: Date): Promise<{ item: any; token: string } | null> {
  const model = db.gradingBatchItem;
  if (!model) throw new Error('batch-item-store-unavailable');
  const token = randomUUID();
  const staleBefore = new Date(now.getTime() - BATCH_ITEM_CLAIM_LEASE_MS);
  const where = {
    id: item.id,
    state: { in: ['QUEUED', 'RETRYABLE', 'CONVERTING', 'GRADING'] },
    OR: [{ workerClaimToken: null }, { workerClaimedAt: { lt: staleBefore } }],
  };
  const data = {
    state: item.state === 'GRADING' ? 'GRADING' : 'CONVERTING',
    workerClaimToken: token,
    workerClaimedAt: now,
    lastAttemptAt: now,
    updatedAt: now,
  };
  if (model.updateMany) {
    const result = await model.updateMany({ where, data });
    if (result?.count !== undefined && result.count !== 1) return null;
  } else if (model.update) {
    await model.update({ where: { id: item.id }, data });
  } else {
    throw new Error('batch-item-store-unavailable');
  }
  return { item: { ...item, ...data }, token };
}

async function updateClaimedBatchItem(model: any, id: string, token: string, data: Record<string, unknown>): Promise<any> {
  if (!model) throw new Error('batch-item-store-unavailable');
  if (model.updateMany) {
    const result = await model.updateMany({ where: { id, workerClaimToken: token }, data });
    if (result?.count !== undefined && result.count !== 1) throw new Error('batch-item-worker-fenced');
    return model.findUnique ? model.findUnique({ where: { id } }) : { id, ...data };
  }
  if (model.update) return model.update({ where: { id }, data });
  throw new Error('batch-item-store-unavailable');
}

async function updateBatchWorkerRecord(model: any, id: string, data: any, stateWhere?: Record<string, unknown>): Promise<any> {
  if (model?.updateMany) {
    const result = await model.updateMany({ where: { id, state: stateWhere ?? { not: 'CONTENT_UNAVAILABLE' } }, data });
    if (result?.count === 0) throw new Error('batch-worker-fenced');
    return model.findUnique ? model.findUnique({ where: { id } }) : { id, ...data };
  }
  if (model?.update) return model.update({ where: { id }, data });
  throw new Error('batch-worker-store-unavailable');
}

async function updateBatchAggregate(db: MathGradingDb, batchId: string, totalItems: number, now: Date): Promise<{ updated: any; state: string; progress: number; retryable: number; terminal: boolean }> {
  const update = async (tx: MathGradingDb) => {
    const current = tx.gradingBatch.findUnique ? await tx.gradingBatch.findUnique({ where: { id: batchId }, select: { cancellationRequestedAt: true } }) : null;
    if (current?.cancellationRequestedAt && tx.gradingBatchItem?.updateMany) {
      await tx.gradingBatchItem.updateMany({ where: { batchId, state: { in: ['QUEUED', 'RETRYABLE'] }, workerClaimToken: null }, data: { state: 'CANCELLED', progress: 100, failureCode: null, updatedAt: now } });
    }
    const counts = await tx.gradingBatchItem.groupBy({ by: ['state'], where: { batchId }, _count: { _all: true } });
    const count = (state: string) => counts.find((row: any) => row.state === state)?._count?._all ?? 0;
    const completed = count('SUCCEEDED');
    const failed = count('FAILED');
    const blocked = count('BLOCKED');
    const retryable = count('RETRYABLE');
    const active = count('QUEUED') + count('CONVERTING') + count('GRADING') + retryable;
    const naturallyTerminal = completed + failed + blocked + count('CANCELLED') >= totalItems && active === 0;
    const terminal = Boolean(current?.cancellationRequestedAt) || naturallyTerminal;
    const state = current?.cancellationRequestedAt ? 'CANCELLED' : naturallyTerminal ? (completed === totalItems ? 'SUCCEEDED' : completed > 0 ? 'PARTIAL' : blocked > 0 ? 'BLOCKED' : 'FAILED') : retryable > 0 && active === retryable ? 'RETRYABLE' : 'RUNNING';
    const progress = current?.cancellationRequestedAt ? 100 : totalItems === 0 ? 100 : Math.min(100, Math.round(((completed + failed + blocked + count('CANCELLED')) / totalItems) * 100));
    const updated = await updateBatchWorkerRecord(tx.gradingBatch, batchId, { state, progress, completedItems: completed, failedItems: failed, blockedItems: blocked, lastErrorCode: retryable > 0 ? 'batch-item-retryable' : null, completedAt: terminal ? now : null, updatedAt: now });
    return { updated, state, progress, retryable, terminal };
  };
  if (!db.$transaction) return update(db);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction((tx: MathGradingDb) => update(tx), { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!isBatchSerializationConflict(error) || attempt === 2) throw error;
    }
  }
  throw new Error('batch-aggregate-transaction-failed');
}

function isBatchSerializationConflict(error: unknown): boolean {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : '';
  const message = error instanceof Error ? error.message : String(error);
  return code === 'P2034' || /serialization|deadlock|could not serialize|write conflict/i.test(message);
}

async function claimBatchJobWorkerRecord(model: any, id: string, workerClaimToken: string, now: Date): Promise<void> {
  if (!model?.updateMany) throw new Error('batch-worker-store-unavailable');
  const result = await model.updateMany({ where: { id, state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] }, OR: [{ workerClaimToken: null }, { workerClaimToken, workerLeaseExpiresAt: { lt: now } }, { workerLeaseExpiresAt: { lt: now } }] }, data: { state: 'RUNNING', workerClaimToken, workerClaimedAt: now, workerLeaseExpiresAt: new Date(now.getTime() + 5 * 60_000), updatedAt: now } });
  if (result?.count === 0) throw new Error('batch-worker-fenced');
}

async function updateBatchJobWorkerRecord(model: any, id: string, data: any, workerClaimToken?: string): Promise<any> {
  if (model?.updateMany) {
    const result = await model.updateMany({ where: { id, state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] }, ...(workerClaimToken ? { workerClaimToken } : {}) }, data });
    if (result?.count === 0) throw new Error('batch-worker-fenced');
    return model.findUnique ? model.findUnique({ where: { id } }) : { id, ...data };
  }
  if (model?.update) return model.update({ where: { id }, data });
  throw new Error('batch-worker-store-unavailable');
}
