import { describe, expect, it, vi } from 'vitest';

import { createTeacherAiGradingLabOperationsHandler } from '../route';

function post(handler: ReturnType<typeof createTeacherAiGradingLabOperationsHandler>, body: unknown) {
  return handler(new Request('http://localhost/api/teacher/ai-grading-lab/operations', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
}

function dependencies(overrides: Partial<Parameters<typeof createTeacherAiGradingLabOperationsHandler>[0]> = {}) {
  const core = { execute: vi.fn(async () => ({ datasetId: 'dataset-t1', datasetVersion: 'v1', sampleCount: 1 })) };
  const disconnect = vi.fn(async () => undefined);
  return {
    core,
    disconnect,
    handler: createTeacherAiGradingLabOperationsHandler({
      getSession: async () => ({ user: { id: 'c123456789012345678901234', role: 'TEACHER' } }),
      readConfig: () => ({ ownerTeacherUserId: 'c123456789012345678901234' }),
      createCore: async () => ({ core, disconnect }),
      ...overrides,
    }),
  };
}

describe('POST /api/teacher/ai-grading-lab/operations', () => {
  it('rejects unauthenticated users without creating the core', async () => {
    const { core, handler } = dependencies({ getSession: async () => null });

    const response = await post(handler, { operation: 'create-split', input: {} });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: 'UNAUTHENTICATED' } });
    expect(core.execute).not.toHaveBeenCalled();
  });

  it.each([
    { id: 'c123456789012345678901234', role: 'ADMIN' },
    { id: 'c999999999999999999999999', role: 'TEACHER' },
    { id: 'student-1', role: 'STUDENT' },
  ])('rejects non-owner actors without exposing data', async (user) => {
    const { core, handler } = dependencies({ getSession: async () => ({ user }) });

    const response = await post(handler, { operation: 'build-report', input: {} });

    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).toEqual(JSON.stringify({ error: { code: 'FORBIDDEN' } }));
    expect(core.execute).not.toHaveBeenCalled();
  });

  it('projects missing local lab configuration without exposing details', async () => {
    const { core, handler } = dependencies({ readConfig: () => { throw new Error('E:/private/data-root credential=secret'); } });

    const response = await post(handler, { operation: 'build-report', input: {} });

    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).toEqual(JSON.stringify({ error: { code: 'LAB_UNAVAILABLE' } }));
    expect(core.execute).not.toHaveBeenCalled();
  });

  it('rejects malformed operation inputs before creating the core', async () => {
    const { core, handler } = dependencies();

    const response = await post(handler, { operation: 'create-split', input: { datasetId: 'dataset-t1', datasetVersion: 'v1', randomSeed: 'seed', tuningRatio: 1 } });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: 'INVALID_INPUT' } });
    expect(core.execute).not.toHaveBeenCalled();
  });

  it('uses the shared core and returns only its operation result', async () => {
    const { core, disconnect, handler } = dependencies();

    const response = await post(handler, {
      operation: 'create-split',
      input: { datasetId: 'dataset-t1', datasetVersion: 'v1', randomSeed: 'seed-1', tuningRatio: 0.7 },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      operation: 'create-split',
      result: { datasetId: 'dataset-t1', datasetVersion: 'v1', sampleCount: 1 },
    });
    expect(core.execute).toHaveBeenCalledWith({
      kind: 'create-split',
      input: { datasetId: 'dataset-t1', datasetVersion: 'v1', randomSeed: 'seed-1', tuningRatio: 0.7 },
    });
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('accepts the hidden acceptance reveal operation without accepting extra input', async () => {
    const { core, handler } = dependencies();

    const response = await post(handler, {
      operation: 'reveal-hidden-acceptance',
      input: { acceptanceId: 'acceptance-1', configuration: { configurationVersion: 'config-1' } },
    });

    expect(response.status).toBe(200);
    expect(core.execute).toHaveBeenCalledWith({
      kind: 'reveal-hidden-acceptance',
      input: { acceptanceId: 'acceptance-1', configuration: { configurationVersion: 'config-1' } },
    });
  });

  it('overrides a client-supplied judgment operator with the authenticated owner', async () => {
    const { core, handler } = dependencies();

    const response = await post(handler, {
      operation: 'record-human-judgment',
      input: {
        judgmentKind: 'blind-annotation', executionId: 'execution-1', gradingAnnotationId: 'annotation-1',
        locationCorrect: true, reasonCorrect: true, suggestionCorrect: true, seriouslyMisleading: false,
        operatorUserId: 'c999999999999999999999999',
      },
    });

    expect(response.status).toBe(400);
    expect(core.execute).not.toHaveBeenCalled();
  });

  it('accepts a visual-evidence blind judgment without exposing an operator override', async () => {
    const { core, handler } = dependencies();

    const response = await post(handler, {
      operation: 'record-human-judgment',
      input: {
        judgmentKind: 'blind-visual-evidence', executionId: 'execution-1', visualEvidenceId: 'visual-evidence-1',
        evidenceContentHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        faithful: true, sufficientForScoring: true, misattributed: false,
      },
    });

    expect(response.status).toBe(200);
    expect(core.execute).toHaveBeenCalledWith({
      kind: 'record-human-judgment',
      input: {
        judgmentKind: 'blind-visual-evidence', executionId: 'execution-1', visualEvidenceId: 'visual-evidence-1',
        evidenceContentHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        faithful: true, sufficientForScoring: true, misattributed: false,
        operatorUserId: 'c123456789012345678901234',
      },
    });
  });

  it('requires an independent reason when a structured review adds an annotation', async () => {
    const { core, handler } = dependencies();
    const baseInput = {
      judgmentKind: 'structured-review', executionId: 'execution-1', parentVersionId: null,
      decision: 'correct', scoreCorrections: [],
      annotationCorrections: [{
        action: 'add', annotationKey: 'annotation-2', criterionId: 'criterion-1',
        comment: 'Student-visible correction', location: { pageNumber: 1 },
      }],
    };

    const rejected = await post(handler, { operation: 'record-human-judgment', input: baseInput });
    expect(rejected.status).toBe(400);
    expect(core.execute).not.toHaveBeenCalled();

    const rejectedLocation = await post(handler, {
      operation: 'record-human-judgment',
      input: {
        ...baseInput,
        annotationCorrections: [{
          ...baseInput.annotationCorrections[0],
          reason: 'The stated deduction has a missing intermediate step.', location: { blockId: 'block-1' },
        }],
      },
    });
    expect(rejectedLocation.status).toBe(400);
    expect(core.execute).not.toHaveBeenCalled();

    const reason = 'The stated deduction has a missing intermediate step.';
    const accepted = await post(handler, {
      operation: 'record-human-judgment',
      input: {
        ...baseInput,
        annotationCorrections: [{ ...baseInput.annotationCorrections[0], reason }],
      },
    });
    expect(accepted.status).toBe(200);
    expect(core.execute).toHaveBeenCalledWith({
      kind: 'record-human-judgment',
      input: expect.objectContaining({
        operatorUserId: 'c123456789012345678901234',
        annotationCorrections: [expect.objectContaining({ reason })],
      }),
    });
  });

  it('projects core failures without leaking paths or credentials', async () => {
    const { core, disconnect, handler } = dependencies();
    core.execute.mockRejectedValueOnce(new Error('E:/private/dataset/student.docx credential=secret'));

    const response = await post(handler, {
      operation: 'create-split',
      input: { datasetId: 'dataset-t1', datasetVersion: 'v1', randomSeed: 'seed-1', tuningRatio: 0.7 },
    });

    expect(response.status).toBe(409);
    const body = JSON.stringify(await response.json());
    expect(body).toContain('OPERATION_FAILED');
    expect(body).not.toContain('private');
    expect(body).not.toContain('secret');
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
