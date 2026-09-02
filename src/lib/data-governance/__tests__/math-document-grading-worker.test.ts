import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  conversion: vi.fn(),
  grading: vi.fn(),
  batch: vi.fn(),
  operationRefresh: vi.fn(),
  store: vi.fn(() => ({})),
  writer: vi.fn(),
}));

vi.mock('../../../../src/lib/assignments/submission-object-store', () => ({ createSubmissionObjectStore: mocks.store }));
vi.mock('../../../../src/lib/data-governance/math-document-grading-persistence', () => ({ GRADING_JOB_LEASE_MS: 5 * 60_000, processDocumentConversionJob: mocks.conversion, processGradingRunJob: mocks.grading, writeRenderedObjectToSubmissionStore: mocks.writer }));
vi.mock('../../../../src/lib/data-governance/math-document-grading-batch', () => ({ processQuestionGradingBatch: mocks.batch }));
vi.mock('../../../../src/lib/assignments/assignment-grading-orchestration', () => ({ refreshAssignmentAiGradingOperation: mocks.operationRefresh }));
vi.mock('../../../../src/lib/prisma-client', () => ({ createPrismaClient: vi.fn() }));

import { processMathDocumentGradingJob, settleMathDocumentGradingJobFailure } from '../../../../scripts/workers/math-document-grading-worker';
import { getMathDocumentGradingWorkerCapabilityStatus } from '../math-document-grading-worker-readiness';

function matchesWhere(row: Record<string, any>, where: Record<string, any>): boolean {
  if (where.OR && !where.OR.some((candidate: Record<string, any>) => matchesWhere(row, candidate))) return false;
  if (where.AND && !where.AND.every((candidate: Record<string, any>) => matchesWhere(row, candidate))) return false;
  return Object.entries(where).every(([field, expected]) => {
    if (field === 'OR' || field === 'AND') return true;
    const actual = row[field];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('in' in expected && !expected.in.includes(actual)) return false;
      if ('gt' in expected && !(actual != null && new Date(actual) > new Date(expected.gt))) return false;
      return true;
    }
    return actual === expected;
  });
}

function mutableModel(row: Record<string, any>, updates?: Array<{ where: any; data: any }>) {
  return {
    findUnique: vi.fn(async () => row),
    updateMany: vi.fn(async ({ where, data }: any) => {
      if (!matchesWhere(row, where)) return { count: 0 };
      updates?.push({ where, data });
      Object.assign(row, data);
      return { count: 1 };
    }),
  };
}

describe('math-document grading worker recovery dispatch', () => {
  it('refreshes the linked assignment grading operation after a batch job', async () => {
    mocks.operationRefresh.mockClear();
    mocks.batch.mockResolvedValue({ batch: { id: 'batch-1', state: 'SUCCEEDED' }, itemResults: [] });
    const job = { data: { kind: 'batch', batchId: 'batch-1', jobId: 'job-1' } } as any;

    await processMathDocumentGradingJob(job, {});

    expect(mocks.operationRefresh).toHaveBeenNthCalledWith(1, { db: {}, batchId: 'batch-1' });
    expect(mocks.operationRefresh).toHaveBeenNthCalledWith(2, { db: {}, batchId: 'batch-1' });
  });

  it('marks the linked operation running before batch processing completes', async () => {
    mocks.operationRefresh.mockClear();
    let resolveBatch: (value: any) => void = () => undefined;
    mocks.batch.mockImplementation(() => new Promise((resolve) => { resolveBatch = resolve; }));
    const job = { data: { kind: 'batch', batchId: 'batch-pending', jobId: 'job-pending' } } as any;

    const processing = processMathDocumentGradingJob(job, {});
    await Promise.resolve();
    expect(mocks.operationRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.operationRefresh).toHaveBeenLastCalledWith({ db: {}, batchId: 'batch-pending' });

    resolveBatch({ batch: { id: 'batch-pending', state: 'SUCCEEDED' }, itemResults: [] });
    await processing;
    expect(mocks.operationRefresh).toHaveBeenCalledTimes(2);
  });

  it('fails worker capability readiness when production dependencies are incomplete', () => {
    const status = getMathDocumentGradingWorkerCapabilityStatus({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://worker:password@db:5432/act',
      REDIS_URL: 'redis://redis:6379',
    });

    expect(status.ready).toBe(false);
    expect(status.missing).toEqual(expect.arrayContaining([
      'SUBMISSION_OBJECT_STORE',
      'SUBMISSION_S3_ENDPOINT',
      'MATHPIX_APP_ID',
      'SILICONFLOW_API_KEY',
      'GRADING_AUDIT_SECRET',
    ]));
  });

  it('does not treat an audit-secret placeholder as a production secret', () => {
    const status = getMathDocumentGradingWorkerCapabilityStatus({
      NODE_ENV: 'production',
      GRADING_AUDIT_SECRET: 'replace-with-rotatable-audit-secret',
    });

    expect(status.capabilities.auditSecret).toBe(false);
    expect(status.missing).toContain('GRADING_AUDIT_SECRET');
  });

  it('allows HTTP object storage only on the local development loopback', () => {
    const local = getMathDocumentGradingWorkerCapabilityStatus({
      NODE_ENV: 'development',
      SUBMISSION_OBJECT_STORE: 's3',
      SUBMISSION_S3_ENDPOINT: 'http://127.0.0.1:9000',
      SUBMISSION_S3_BUCKET: 'submissions',
      SUBMISSION_S3_ACCESS_KEY: 'access',
      SUBMISSION_S3_SECRET_KEY: 'secret',
    });
    const remote = getMathDocumentGradingWorkerCapabilityStatus({
      NODE_ENV: 'development',
      SUBMISSION_OBJECT_STORE: 's3',
      SUBMISSION_S3_ENDPOINT: 'http://objects.example',
      SUBMISSION_S3_BUCKET: 'submissions',
      SUBMISSION_S3_ACCESS_KEY: 'access',
      SUBMISSION_S3_SECRET_KEY: 'secret',
    });
    const production = getMathDocumentGradingWorkerCapabilityStatus({
      NODE_ENV: 'production',
      SUBMISSION_OBJECT_STORE: 's3',
      SUBMISSION_S3_ENDPOINT: 'http://127.0.0.1:9000',
      SUBMISSION_S3_BUCKET: 'submissions',
      SUBMISSION_S3_ACCESS_KEY: 'access',
      SUBMISSION_S3_SECRET_KEY: 'secret',
    });

    expect(local.capabilities.objectStore).toBe(true);
    expect(local.missing).not.toContain('SUBMISSION_S3_ENDPOINT');
    expect(remote.capabilities.objectStore).toBe(false);
    expect(remote.missing).toContain('SUBMISSION_S3_ENDPOINT');
    expect(production.capabilities.objectStore).toBe(false);
    expect(production.missing).toContain('SUBMISSION_S3_ENDPOINT');
  });

  it('reports all non-secret worker capabilities when the environment contract is complete', () => {
    const status = getMathDocumentGradingWorkerCapabilityStatus({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://worker:password@db:5432/act',
      REDIS_URL: 'redis://redis:6379',
      SUBMISSION_OBJECT_STORE: 's3',
      SUBMISSION_S3_ENDPOINT: 'https://objects.example',
      SUBMISSION_S3_BUCKET: 'submissions',
      SUBMISSION_S3_ACCESS_KEY: 'worker-access',
      SUBMISSION_S3_SECRET_KEY: 'worker-secret',
      SUBMISSION_SCANNER_MODE: 's3-object-tag',
      SUBMISSION_SCANNER_ACCESS_KEY: 'scanner-access',
      SUBMISSION_SCANNER_SECRET_KEY: 'scanner-secret',
      SUBMISSION_SCANNER_PROBE_KEY: 'health/probe',
      SUBMISSION_CONTENT_SCANNER: 'clamav-tcp',
      SUBMISSION_CLAMAV_HOST: 'clamav',
      SUBMISSION_CLAMAV_PORT: '3310',
      SILICONFLOW_API_KEY: 'ai-key',
      GRADING_AI_PROVIDER_ENABLED: 'true',
      GRADING_MATHPIX_ENABLED: 'true',
      GRADING_MATHPIX_POLICY_VERSION: 'mathpix.v1',
      MATHPIX_IMAGE_ENDPOINT: 'https://api.mathpix.com/v3/text',
      MATHPIX_DOCUMENT_ENDPOINT: 'https://api.mathpix.com/v3/pdf',
      MATHPIX_APP_ID: 'mathpix-id',
      MATHPIX_APP_KEY: 'mathpix-key',
      GRADING_AUDIT_SECRET: 'audit-secret',
      GRADING_LIFECYCLE_LOOKUP_SECRET: 'stable-lookup-secret',
    });

    expect(status).toMatchObject({
      ready: true,
      configReady: true,
      capabilities: {
        database: true,
        redis: true,
        objectStore: true,
        scanner: true,
        aiProvider: true,
        mathpix: true,
      },
      missing: [],
    });
  });

  it('does not report Mathpix ready when the grading provider is disabled', () => {
    const status = getMathDocumentGradingWorkerCapabilityStatus({
      NODE_ENV: 'production',
      GRADING_MATHPIX_ENABLED: 'false',
      MATHPIX_APP_ID: 'mathpix-id',
      MATHPIX_APP_KEY: 'mathpix-key',
    });

    expect(status.capabilities.mathpix).toBe(false);
    expect(status.missing).toContain('GRADING_MATHPIX_ENABLED');
  });

  it.each(['MATHPIX_IMAGE_ENDPOINT', 'MATHPIX_DOCUMENT_ENDPOINT'])('requires the split Mathpix endpoint %s for readiness', (missingEndpoint) => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'test',
      GRADING_MATHPIX_ENABLED: 'true',
      GRADING_MATHPIX_POLICY_VERSION: 'mathpix.v1',
      MATHPIX_IMAGE_ENDPOINT: 'https://api.mathpix.com/v3/text',
      MATHPIX_DOCUMENT_ENDPOINT: 'https://api.mathpix.com/v3/pdf',
      MATHPIX_APP_ID: 'mathpix-id',
      MATHPIX_APP_KEY: 'mathpix-key',
    };
    delete env[missingEndpoint];

    const status = getMathDocumentGradingWorkerCapabilityStatus(env);

    expect(status.capabilities.mathpix).toBe(false);
    expect(status.missing).toContain(missingEndpoint);
  });

  it('uses the grading-specific provider flag for worker readiness', () => {
    const status = getMathDocumentGradingWorkerCapabilityStatus({
      NODE_ENV: 'production',
      AI_PROVIDER_ENABLED: 'true',
      GRADING_AI_PROVIDER_ENABLED: 'false',
      AI_BASE_URL: 'https://api.example.com/v1',
      AI_MODEL: 'grading-model',
      AI_API_KEY: 'ai-key',
    });

    expect(status.capabilities.aiProvider).toBe(false);
    expect(status.missing).toContain('GRADING_AI_PROVIDER_ENABLED');
  });

  it('rejects grading readiness when the shared AI provider is explicitly disabled', () => {
    const status = getMathDocumentGradingWorkerCapabilityStatus({
      NODE_ENV: 'production',
      AI_PROVIDER_ENABLED: 'false',
      GRADING_AI_PROVIDER_ENABLED: 'true',
      AI_BASE_URL: 'https://api.example.com/v1',
      AI_MODEL: 'grading-model',
      AI_API_KEY: 'ai-key',
    });

    expect(status.capabilities.aiProvider).toBe(false);
    expect(status.missing).toContain('AI_PROVIDER_ENABLED');
  });

  it('rejects capability records with non-boolean or drifting capability keys', async () => {
    const { parseMathDocumentGradingWorkerCapability } = await import('../math-document-grading-worker-readiness');
    expect(parseMathDocumentGradingWorkerCapability(JSON.stringify({
      version: 'math-document-grading-worker.v1',
      ready: true,
      configReady: true,
      capabilities: {
        database: true,
        redis: true,
        objectStore: true,
        scanner: true,
        aiProvider: true,
        mathpix: true,
        auditSecret: 'true',
      },
      missing: [],
    }))).toBeNull();
  });

  it('surfaces failed conversion state to BullMQ for retry', async () => {
    mocks.conversion.mockResolvedValueOnce({ conversion: { state: 'FAILED' }, evidence: null });
    await expect(processMathDocumentGradingJob({ data: { kind: 'conversion', jobId: 'job-1', conversionId: 'conversion-1' } } as any, {})).rejects.toThrow('document-conversion-retryable');
    expect(mocks.conversion).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job-1' }));
  });

  it('does not re-settle a grading run after durable retryable persistence', async () => {
    mocks.grading.mockResolvedValueOnce({ run: { state: 'RETRYABLE' }, draft: { state: 'retryable' } });
    await expect(processMathDocumentGradingJob({ data: { kind: 'grading', jobId: 'job-retryable', gradingRunId: 'run-retryable' } } as any, {})).resolves.toEqual(expect.objectContaining({ run: { state: 'RETRYABLE' } }));
  });

  it('completes successful conversion and preserves retry-item isolation', async () => {
    mocks.conversion.mockResolvedValueOnce({ conversion: { state: 'SUCCEEDED' }, evidence: { id: 'evidence-1' } });
    await expect(processMathDocumentGradingJob({ data: { kind: 'conversion', jobId: 'job-2', conversionId: 'conversion-2' } } as any, {})).resolves.toEqual(expect.objectContaining({ evidence: { id: 'evidence-1' } }));

    mocks.batch.mockResolvedValueOnce({ batch: { id: 'batch-1' }, itemResults: [{ itemId: 'item-1', state: 'SUCCEEDED' }] });
    await processMathDocumentGradingJob({ data: { kind: 'retry', jobId: 'job-3', batchId: 'batch-1', batchItemId: 'item-1' } } as any, {});
    expect(mocks.batch).toHaveBeenCalledWith(expect.objectContaining({ batchId: 'batch-1', itemId: 'item-1' }));
  });

  it('passes the production rendered-byte writer into conversion processing', async () => {
    const store = { id: 'submission-store' };
    mocks.store.mockReturnValueOnce(store);
    mocks.writer.mockResolvedValueOnce('grading-rendered/conversion-writer-test');
    mocks.conversion.mockImplementationOnce(async (input: any) => {
      expect(input.writeRendered).toEqual(expect.any(Function));
      const key = await input.writeRendered({ key: 'grading-rendered/conversion-writer-test', bytes: new Uint8Array([1]), mimeType: 'application/pdf', checksum: 'sha256:writer-test', ownerId: 'student-writer-test', answerId: 'answer-writer-test' });
      expect(key).toBe('grading-rendered/conversion-writer-test');
      return { conversion: { state: 'SUCCEEDED' }, evidence: null };
    });
    await processMathDocumentGradingJob({ data: { kind: 'conversion', jobId: 'job-writer-test', conversionId: 'conversion-writer-test' } } as any, {});
    expect(mocks.writer).toHaveBeenCalledWith(expect.objectContaining({ store, key: 'grading-rendered/conversion-writer-test', ownerId: 'student-writer-test', answerId: 'answer-writer-test' }));
  });

  it('converges durable records to retryable and then failed after BullMQ attempts are exhausted', async () => {
    const updates: any[] = [];
    const db = {
      gradingJob: { findUnique: vi.fn(async () => ({ state: 'RUNNING', workerClaimToken: 'attempt-token' })), update: vi.fn(async ({ data }: any) => { updates.push(data); return data; }) },
      gradingRun: { update: vi.fn(async ({ data }: any) => { updates.push(data); return data; }) },
    };
    const job = { data: { kind: 'grading', jobId: 'job-settle-1', gradingRunId: 'run-settle-1', workerClaimToken: 'attempt-token' }, attemptsMade: 0, opts: { attempts: 3 } } as any;
    await settleMathDocumentGradingJobFailure({ db, job, error: new Error('network timeout') });
    expect(updates).toEqual(expect.arrayContaining([expect.objectContaining({ state: 'RETRYABLE', lastErrorCode: 'network timeout' })]));
    updates.length = 0;
    job.attemptsMade = 3;
    await settleMathDocumentGradingJobFailure({ db, job, error: new Error('network timeout') });
    expect(updates).toEqual(expect.arrayContaining([expect.objectContaining({ state: 'FAILED', completedAt: expect.any(Date) })]));
  });

  it('settles an exhausted job by the live attempt token before clearing that token', async () => {
    const jobRow: any = { id: 'job-token-state', state: 'RUNNING', workerClaimToken: 'attempt-a', workerClaimedAt: new Date(), workerLeaseExpiresAt: new Date(Date.now() + 60_000) };
    const runRow: any = { id: 'run-token-state', state: 'RUNNING' };
    const jobUpdates: any[] = [];
    const db: any = {
      gradingJob: {
        findUnique: async () => jobRow,
        updateMany: async ({ where, data }: any) => {
          if (where.workerClaimToken && where.workerClaimToken !== jobRow.workerClaimToken) return { count: 0 };
          if (where.state?.in && !where.state.in.includes(jobRow.state)) return { count: 0 };
          jobUpdates.push({ where, data });
          Object.assign(jobRow, data);
          return { count: 1 };
        },
      },
      gradingRun: {
        updateMany: async ({ data }: any) => { Object.assign(runRow, data); return { count: 1 }; },
      },
    };
    const job = { data: { kind: 'grading', jobId: jobRow.id, gradingRunId: runRow.id, workerClaimToken: 'attempt-a' }, attemptsMade: 3, opts: { attempts: 3 } } as any;

    await settleMathDocumentGradingJobFailure({ db, job, error: new Error('provider timeout') });

    expect(jobRow).toEqual(expect.objectContaining({ state: 'FAILED', workerClaimToken: null, completedAt: expect.any(Date) }));
    expect(runRow).toEqual(expect.objectContaining({ state: 'FAILED' }));
    expect(jobUpdates.at(-1)).toEqual(expect.objectContaining({ where: expect.objectContaining({ workerClaimToken: 'attempt-a' }), data: expect.objectContaining({ state: 'FAILED', workerClaimToken: null }) }));
  });

  it('fences the matching token when its persisted lease is expired', async () => {
    const now = new Date('2026-07-17T00:00:00.000Z');
    const jobRow: any = { id: 'job-expired-token', state: 'RUNNING', workerClaimToken: 'attempt-expired', workerClaimedAt: new Date('2026-07-16T23:50:00.000Z'), workerLeaseExpiresAt: new Date('2026-07-16T23:59:59.999Z') };
    const gradingRunUpdate = vi.fn();
    const db: any = {
      gradingJob: mutableModel(jobRow),
      gradingRun: { updateMany: gradingRunUpdate },
    };

    await expect(settleMathDocumentGradingJobFailure({
      db,
      job: { data: { kind: 'grading', jobId: jobRow.id, gradingRunId: 'run-expired-token', workerClaimToken: 'attempt-expired' }, attemptsMade: 3, opts: { attempts: 3 } } as any,
      error: new Error('provider timeout'),
      now,
    })).rejects.toThrow('grading-job-failure-settlement-fenced');

    expect(jobRow).toEqual(expect.objectContaining({ state: 'RUNNING', workerClaimToken: 'attempt-expired', workerLeaseExpiresAt: new Date('2026-07-16T23:59:59.999Z') }));
    expect(gradingRunUpdate).not.toHaveBeenCalled();
  });

  it('accepts the matching token when the legacy persisted lease is null', async () => {
    const jobRow: any = { id: 'job-null-lease', state: 'RUNNING', workerClaimToken: 'attempt-null-lease', workerClaimedAt: null, workerLeaseExpiresAt: null };
    const runRow: any = { id: 'run-null-lease', state: 'RUNNING' };
    const db: any = {
      gradingJob: mutableModel(jobRow),
      gradingRun: mutableModel(runRow),
    };

    await settleMathDocumentGradingJobFailure({
      db,
      job: { data: { kind: 'grading', jobId: jobRow.id, gradingRunId: runRow.id, workerClaimToken: 'attempt-null-lease' }, attemptsMade: 3, opts: { attempts: 3 } } as any,
      error: new Error('provider timeout'),
    });

    expect(jobRow).toEqual(expect.objectContaining({ state: 'FAILED', workerClaimToken: null, workerLeaseExpiresAt: null }));
    expect(runRow).toEqual(expect.objectContaining({ state: 'FAILED' }));
  });

  it('settles a conversion failure that happened before the queued job persisted its claim token', async () => {
    const now = new Date('2026-07-17T00:00:00.000Z');
    const jobRow: any = { id: 'job-unclaimed-conversion', state: 'QUEUED', workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null };
    const conversionRow: any = { id: 'conversion-unclaimed', state: 'QUEUED' };
    const jobUpdates: any[] = [];
    const db: any = {
      gradingJob: {
        findUnique: async () => jobRow,
        updateMany: async ({ where, data }: any) => {
          const exactClaim = where.OR?.some((candidate: any) => candidate.workerClaimToken === jobRow.workerClaimToken && candidate.state?.in?.includes(jobRow.state));
          const unclaimedQueued = where.OR?.some((candidate: any) => candidate.workerClaimToken === null && candidate.state === jobRow.state) && jobRow.workerClaimToken === null;
          const simpleClaim = where.workerClaimToken === undefined || where.workerClaimToken === jobRow.workerClaimToken;
          const active = !where.state?.in || where.state.in.includes(jobRow.state);
          if ((!where.OR && (!simpleClaim || !active)) || (where.OR && !exactClaim && !unclaimedQueued)) return { count: 0 };
          jobUpdates.push({ where, data });
          Object.assign(jobRow, data);
          return { count: 1 };
        },
      },
      documentConversion: {
        updateMany: async ({ data }: any) => { Object.assign(conversionRow, data); return { count: 1 }; },
      },
    };

    await settleMathDocumentGradingJobFailure({
      db,
      job: { data: { kind: 'conversion', jobId: jobRow.id, conversionId: conversionRow.id, workerClaimToken: 'attempt-before-claim' }, attemptsMade: 1, opts: { attempts: 3 } } as any,
      error: new Error('provider timeout'),
      now,
    });

    expect(jobUpdates[0]).toEqual(expect.objectContaining({
      where: expect.objectContaining({
        id: jobRow.id,
        OR: expect.arrayContaining([
          { state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] }, workerClaimToken: 'attempt-before-claim', OR: [{ workerLeaseExpiresAt: null }, { workerLeaseExpiresAt: { gt: now } }] },
          { state: 'QUEUED', workerClaimToken: null },
        ]),
      }),
      data: expect.objectContaining({
        state: 'RUNNING',
        workerClaimToken: 'attempt-before-claim',
        workerClaimedAt: now,
        workerLeaseExpiresAt: expect.any(Date),
      }),
    }));
    expect(conversionRow).toEqual(expect.objectContaining({ state: 'RETRYABLE', failureCode: 'provider timeout' }));
    expect(jobRow).toEqual(expect.objectContaining({ state: 'RETRYABLE', workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null }));
  });

  it('settles an unclaimed queued grading failure with the existing blocked business-state policy', async () => {
    const jobRow: any = { id: 'job-unclaimed-grading', state: 'QUEUED', workerClaimToken: null };
    const runRow: any = { id: 'run-unclaimed-grading', state: 'QUEUED' };
    const db: any = {
      gradingJob: {
        findUnique: async () => jobRow,
        updateMany: async ({ where, data }: any) => {
          const matches = where.OR
            ? where.OR.some((candidate: any) => (
              (candidate.workerClaimToken === jobRow.workerClaimToken && candidate.state?.in?.includes(jobRow.state))
              || (candidate.workerClaimToken === null && candidate.state === jobRow.state && jobRow.workerClaimToken === null)
            ))
            : where.workerClaimToken === jobRow.workerClaimToken && where.state?.in?.includes(jobRow.state);
          if (!matches) return { count: 0 };
          Object.assign(jobRow, data);
          return { count: 1 };
        },
      },
      gradingRun: {
        updateMany: async ({ data }: any) => { Object.assign(runRow, data); return { count: 1 }; },
      },
    };

    await settleMathDocumentGradingJobFailure({
      db,
      job: { data: { kind: 'grading', jobId: jobRow.id, gradingRunId: runRow.id, workerClaimToken: 'attempt-before-grading-claim' }, attemptsMade: 1, opts: { attempts: 3 } } as any,
      error: new Error('grading-content-unavailable:association-missing'),
    });

    expect(runRow).toEqual(expect.objectContaining({ state: 'BLOCKED', blockedReasons: ['grading-content-unavailable:association-missing'] }));
    expect(jobRow).toEqual(expect.objectContaining({ state: 'CONTENT_UNAVAILABLE', workerClaimToken: null }));
  });

  it('does not treat a queued job already tokened by another worker as unclaimed', async () => {
    const jobRow: any = { id: 'job-queued-other-owner', state: 'QUEUED', workerClaimToken: 'other-worker-token' };
    const gradingRunUpdate = vi.fn();
    const db: any = {
      gradingJob: {
        findUnique: async () => jobRow,
        updateMany: async ({ where, data }: any) => {
          const matches = where.OR.some((candidate: any) => (
            (candidate.workerClaimToken === jobRow.workerClaimToken && candidate.state?.in?.includes(jobRow.state))
            || (candidate.workerClaimToken === null && candidate.state === jobRow.state && jobRow.workerClaimToken === null)
          ));
          if (!matches) return { count: 0 };
          Object.assign(jobRow, data);
          return { count: 1 };
        },
      },
      gradingRun: { updateMany: gradingRunUpdate },
    };

    await expect(settleMathDocumentGradingJobFailure({
      db,
      job: { data: { kind: 'grading', jobId: jobRow.id, gradingRunId: 'run-queued-other-owner', workerClaimToken: 'stale-worker-token' }, attemptsMade: 3, opts: { attempts: 3 } } as any,
      error: new Error('provider timeout'),
    })).rejects.toThrow('grading-job-failure-settlement-fenced');

    expect(jobRow).toEqual({ id: 'job-queued-other-owner', state: 'QUEUED', workerClaimToken: 'other-worker-token' });
    expect(gradingRunUpdate).not.toHaveBeenCalled();
  });

  it('rolls back an unclaimed-job CAS when the transactional business update fails', async () => {
    const now = new Date('2026-07-17T00:00:00.000Z');
    const liveJob: any = { id: 'job-transaction-rollback', state: 'QUEUED', attemptCount: 0, workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null };
    const liveConversion: any = { id: 'conversion-transaction-rollback', state: 'QUEUED' };
    const claimedDrafts: any[] = [];
    const db: any = {
      $transaction: async (callback: (tx: any) => Promise<void>) => {
        const draftJob = structuredClone(liveJob);
        const draftConversion = structuredClone(liveConversion);
        const tx = {
          gradingJob: mutableModel(draftJob, claimedDrafts),
          documentConversion: {
            updateMany: vi.fn(async () => {
              throw new Error('conversion-business-update-failed');
            }),
          },
        };
        await callback(tx);
        Object.assign(liveJob, draftJob);
        Object.assign(liveConversion, draftConversion);
      },
    };

    await expect(settleMathDocumentGradingJobFailure({
      db,
      job: { data: { kind: 'conversion', jobId: liveJob.id, conversionId: liveConversion.id, workerClaimToken: 'attempt-rollback' }, attemptsMade: 1, opts: { attempts: 3 } } as any,
      error: new Error('provider timeout'),
      now,
    })).rejects.toThrow('conversion-business-update-failed');

    expect(claimedDrafts[0]?.data).toEqual(expect.objectContaining({ state: 'RUNNING', workerClaimToken: 'attempt-rollback' }));
    expect(liveJob).toEqual({ id: 'job-transaction-rollback', state: 'QUEUED', attemptCount: 0, workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null });
    expect(liveConversion).toEqual({ id: 'conversion-transaction-rollback', state: 'QUEUED' });
  });

  it('allows only one token to CAS an unclaimed job into business settlement', async () => {
    const now = new Date('2026-07-17T00:00:00.000Z');
    const jobRow: any = { id: 'job-competing-tokens', state: 'QUEUED', workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null };
    const runRow: any = { id: 'run-competing-tokens', state: 'QUEUED' };
    const businessUpdates: string[] = [];
    const gradingJob = mutableModel(jobRow);
    const db: any = {
      gradingJob,
      gradingRun: {
        updateMany: vi.fn(async ({ where, data }: any) => {
          if (!matchesWhere(runRow, where)) return { count: 0 };
          businessUpdates.push(data.state);
          Object.assign(runRow, data);
          return { count: 1 };
        }),
      },
    };
    const makeJob = (workerClaimToken: string) => ({ data: { kind: 'grading', jobId: jobRow.id, gradingRunId: runRow.id, workerClaimToken }, attemptsMade: 3, opts: { attempts: 3 } }) as any;

    const results = await Promise.allSettled([
      settleMathDocumentGradingJobFailure({ db, job: makeJob('attempt-race-a'), error: new Error('provider timeout'), now }),
      settleMathDocumentGradingJobFailure({ db, job: makeJob('attempt-race-b'), error: new Error('provider timeout'), now }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(businessUpdates).toEqual(['FAILED']);
    expect(jobRow).toEqual(expect.objectContaining({ state: 'FAILED', workerClaimToken: null }));
  });

  it('settles provider policy drift as blocked without retrying the old job', async () => {
    const updates: any[] = [];
    const db = {
      gradingJob: { findUnique: vi.fn(async () => ({ state: 'RUNNING', workerClaimToken: 'attempt-token' })), update: vi.fn(async ({ data }: any) => { updates.push(data); return data; }) },
      gradingRun: { update: vi.fn(async ({ data }: any) => { updates.push(data); return data; }) },
    };
    await settleMathDocumentGradingJobFailure({
      db,
      job: { data: { kind: 'grading', jobId: 'job-policy-drift', gradingRunId: 'run-policy-drift', workerClaimToken: 'attempt-token' }, attemptsMade: 0, opts: { attempts: 3 } } as any,
      error: new Error('provider-policy-snapshot-mismatch'),
    });
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: 'BLOCKED', completedAt: expect.any(Date) }),
    ]));
    expect(updates).not.toEqual(expect.arrayContaining([expect.objectContaining({ state: 'RETRYABLE' })]));
  });

  it('does not resurrect content-unavailable parents during worker failure settlement', async () => {
    const gradingRunUpdate = vi.fn();
    const db = {
      gradingJob: {
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({ state: 'RUNNING', workerClaimToken: 'new-owner-token' }),
      },
      gradingRun: { update: gradingRunUpdate },
    };
    await expect(settleMathDocumentGradingJobFailure({
      db,
      job: { data: { kind: 'grading', jobId: 'job-fenced', gradingRunId: 'run-fenced', workerClaimToken: 'attempt-token' }, attemptsMade: 0, opts: { attempts: 3 } } as any,
      error: new Error('network timeout'),
    })).rejects.toThrow('grading-job-failure-settlement-fenced');
    expect(gradingRunUpdate).not.toHaveBeenCalled();
    expect(db.gradingJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      id: 'job-fenced',
      OR: expect.arrayContaining([
        { state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] }, workerClaimToken: 'attempt-token', OR: [{ workerLeaseExpiresAt: null }, { workerLeaseExpiresAt: { gt: expect.any(Date) } }] },
        { state: 'QUEUED', workerClaimToken: null },
      ]),
    }) }));
  });

  it('closes missing parent associations as observable blocked content instead of parameter failure', async () => {
    const updates: any[] = [];
    const db: any = {
      gradingJob: { updateMany: vi.fn(async ({ data }: any) => { updates.push(data); return { count: 1 }; }) },
      gradingRun: { updateMany: vi.fn(async ({ data }: any) => { updates.push(data); return { count: 1 }; }) },
    };
    await settleMathDocumentGradingJobFailure({
      db,
      job: { data: { kind: 'grading', jobId: 'job-association-missing', gradingRunId: 'run-association-missing', workerClaimToken: 'attempt-token' }, attemptsMade: 1, opts: { attempts: 3 } } as any,
      error: new Error('grading-content-unavailable:association-missing'),
    });
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: 'BLOCKED', blockedReasons: ['grading-content-unavailable:association-missing'] }),
      expect.objectContaining({ state: 'CONTENT_UNAVAILABLE', workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null }),
    ]));
  });

  it('settles in-flight batch items on top-level failure/cancel without double-incrementing retryCount', async () => {
    const itemUpdates: any[] = [];
    const batchUpdates: any[] = [];
    const db: any = {
      gradingJob: { findUnique: vi.fn(async () => ({ state: 'RUNNING', workerClaimToken: 'attempt-token' })), update: vi.fn(async ({ data }: any) => data) },
      gradingBatchItem: { updateMany: vi.fn(async ({ data }: any) => { itemUpdates.push(data); return { count: 2 }; }) },
      gradingBatch: { update: vi.fn(async ({ data }: any) => { batchUpdates.push(data); return data; }) },
    };
    const job = { data: { kind: 'batch', jobId: 'job-batch-failed', batchId: 'batch-failed', workerClaimToken: 'attempt-token' }, attemptsMade: 3, opts: { attempts: 3 } } as any;

    await settleMathDocumentGradingJobFailure({ db, job, error: new Error('provider timeout') });
    expect(itemUpdates[0]).toEqual(expect.objectContaining({ state: 'FAILED', workerClaimToken: null, workerClaimedAt: null }));
    expect(itemUpdates[0]).not.toHaveProperty('retryCount');
    expect(batchUpdates[0]).toEqual(expect.objectContaining({ state: 'FAILED' }));

    itemUpdates.length = 0;
    batchUpdates.length = 0;
    await settleMathDocumentGradingJobFailure({ db, job: { ...job, data: { ...job.data, jobId: 'job-batch-cancelled' } }, error: new Error('batch-cancelled') });
    expect(itemUpdates[0]).toEqual(expect.objectContaining({ state: 'CANCELLED', workerClaimToken: null, workerClaimedAt: null }));
    expect(batchUpdates[0]).toEqual(expect.objectContaining({ state: 'CANCELLED' }));
  });
});
