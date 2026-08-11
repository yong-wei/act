import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  startMicroIntervention: vi.fn(),
  readMicroIntervention: vi.fn(),
  recordMicroInterventionEvent: vi.fn(),
  submitMicroInterventionValidation: vi.fn(),
  readMicroInterventionValidationQuestion: vi.fn(),
  MicroInterventionRequestError: class MicroInterventionRequestError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  },
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession: mocks.getServerAuthSession }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/features/assessment/micro-intervention-outcomes', () => ({
  MicroInterventionRequestError: mocks.MicroInterventionRequestError,
  startMicroIntervention: mocks.startMicroIntervention,
  readMicroIntervention: mocks.readMicroIntervention,
  recordMicroInterventionEvent: mocks.recordMicroInterventionEvent,
  submitMicroInterventionValidation: mocks.submitMicroInterventionValidation,
  readMicroInterventionValidationQuestion: mocks.readMicroInterventionValidationQuestion,
}));

import { GET, POST as start } from '@/app/api/assessment/remediation/interventions/route';
import { POST as event } from '@/app/api/assessment/remediation/interventions/events/route';
import { GET as readValidationQuestion, POST as validation } from '@/app/api/assessment/remediation/interventions/validation/route';

describe('micro intervention routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'learner-1', role: 'STUDENT' } });
  });

  it('requires a learner before creating an intervention', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await start(new Request('http://localhost/api/assessment/remediation/interventions', {
      method: 'POST',
      body: JSON.stringify({ remediationResultId: 'result-1', startEventKey: 'start-1' }),
    }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'LEARNER_REQUIRED' });
    expect(mocks.startMicroIntervention).not.toHaveBeenCalled();
  });

  it('starts only a complete, learner-scoped request', async () => {
    mocks.startMicroIntervention.mockResolvedValue({
      id: 'intervention-1',
      status: 'STARTED',
      startedAt: '2026-08-05T00:00:00.000Z',
      progress: { resourceUseCount: 0, hintCount: 0, completedAt: null, durationSeconds: null },
      validation: null,
      recommendation: null,
    });

    const response = await start(new Request('http://localhost/api/assessment/remediation/interventions', {
      method: 'POST',
      body: JSON.stringify({ remediationResultId: 'result-1', startEventKey: 'start-1' }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.startMicroIntervention).toHaveBeenCalledWith(expect.objectContaining({
      authenticatedUserId: 'learner-1',
      remediationResultId: 'result-1',
      startEventKey: 'start-1',
    }));
    expect(JSON.stringify(await response.clone().json())).not.toContain('session-1');
  });

  it('does not disclose foreign interventions and reports controlled drift', async () => {
    mocks.readMicroIntervention.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'intervention-1', status: 'UNAVAILABLE', unavailableReason: 'REFERENCE_DRIFT',
    });

    const foreign = await GET(new Request('http://localhost/api/assessment/remediation/interventions?interventionId=foreign'));
    const unavailable = await GET(new Request('http://localhost/api/assessment/remediation/interventions?interventionId=intervention-1'));

    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toEqual({ error: 'INTERVENTION_NOT_FOUND' });
    expect(unavailable.status).toBe(409);
    expect(await unavailable.json()).toEqual(expect.objectContaining({ unavailableReason: 'REFERENCE_DRIFT' }));
  });

  it('rejects malformed progress and validation requests before domain calls', async () => {
    const invalidEvent = await event(new Request('http://localhost/api/assessment/remediation/interventions/events', {
      method: 'POST',
      body: JSON.stringify({ interventionId: 'intervention-1', eventKey: 'event-1', eventType: 'UNKNOWN' }),
    }));
    const invalidValidation = await validation(new Request('http://localhost/api/assessment/remediation/interventions/validation', {
      method: 'POST',
      body: JSON.stringify({ interventionId: 'intervention-1', eventKey: 'answer-1', questionId: 'question-1' }),
    }));

    expect(invalidEvent.status).toBe(400);
    expect(await invalidEvent.json()).toEqual({ error: 'EVENT_IDENTIFIERS_REQUIRED' });
    expect(invalidValidation.status).toBe(400);
    expect(await invalidValidation.json()).toEqual({ error: 'VALIDATION_FIELDS_REQUIRED' });
    expect(mocks.recordMicroInterventionEvent).not.toHaveBeenCalled();
    expect(mocks.submitMicroInterventionValidation).not.toHaveBeenCalled();
  });

  it('returns conflicts for substituted event and validation submissions', async () => {
    const RequestError = mocks.MicroInterventionRequestError;
    mocks.recordMicroInterventionEvent.mockRejectedValueOnce(new RequestError('IDEMPOTENCY_CONFLICT'));
    mocks.submitMicroInterventionValidation.mockRejectedValueOnce(new RequestError('IDEMPOTENCY_CONFLICT'));

    const eventResponse = await event(new Request('http://localhost/api/assessment/remediation/interventions/events', {
      method: 'POST',
      body: JSON.stringify({ interventionId: 'intervention-1', eventKey: 'event-1', eventType: 'HINT_REQUESTED' }),
    }));
    const validationResponse = await validation(new Request('http://localhost/api/assessment/remediation/interventions/validation', {
      method: 'POST',
      body: JSON.stringify({
        interventionId: 'intervention-1', eventKey: 'answer-1', questionId: 'question-1', selectedOption: 'A', durationSeconds: 30,
      }),
    }));

    expect(eventResponse.status).toBe(409);
    expect(await eventResponse.json()).toEqual({ error: 'IDEMPOTENCY_CONFLICT' });
    expect(validationResponse.status).toBe(409);
    expect(await validationResponse.json()).toEqual({ error: 'IDEMPOTENCY_CONFLICT' });
  });

  it('reads only a learner-safe validation question after intervention authorization', async () => {
    mocks.readMicroInterventionValidationQuestion.mockResolvedValue({
      id: 'validation-1',
      prompt: '请选择合适的控制器。',
      options: [{ label: 'A', text: '选项 A' }, { label: 'B', text: '选项 B' }],
    });

    const response = await readValidationQuestion(new Request(
      'http://localhost/api/assessment/remediation/interventions/validation?interventionId=intervention-1',
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      id: 'validation-1',
      prompt: '请选择合适的控制器。',
      options: [{ label: 'A', text: '选项 A' }, { label: 'B', text: '选项 B' }],
    });
    expect(JSON.stringify(payload)).not.toContain('isCorrect');
    expect(mocks.readMicroInterventionValidationQuestion).toHaveBeenCalledWith(expect.objectContaining({
      authenticatedUserId: 'learner-1', interventionId: 'intervention-1',
    }));
  });

  it('does not disclose validation content when the intervention is unavailable', async () => {
    mocks.readMicroInterventionValidationQuestion.mockResolvedValue({
      id: 'intervention-1', status: 'UNAVAILABLE', unavailableReason: 'REFERENCE_DRIFT',
    });

    const response = await readValidationQuestion(new Request(
      'http://localhost/api/assessment/remediation/interventions/validation?interventionId=intervention-1',
    ));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      id: 'intervention-1', status: 'UNAVAILABLE', unavailableReason: 'REFERENCE_DRIFT',
    });
  });
});
