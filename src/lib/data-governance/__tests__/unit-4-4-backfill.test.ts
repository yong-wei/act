import { describe, expect, it } from 'vitest';

import {
  buildUnit44BackfillPlan,
  readUnit44Responses,
} from '../unit-4-4-backfill';

describe('unit 4-4 limited backfill helpers', () => {
  it('reads only structured unit 4-4 step responses with answer evidence', () => {
    expect(readUnit44Responses({
      kind: 'unit44_student_state',
      responses: {
        'step-08': {
          stepId: 'step-08',
          submittedAt: 1778550421493,
          answers: { 'weight-preference': 'C' },
        },
        'step-10': {
          stepId: 'step-10',
          submittedAt: 1778550500000,
          answers: {},
        },
      },
    })).toEqual({
      'step-08': {
        stepId: 'step-08',
        submittedAt: 1778550421493,
        answers: { 'weight-preference': 'C' },
      },
    });
  });

  it('plans immutable responses only for logs with the same user, step, and submittedAt evidence', () => {
    const plan = buildUnit44BackfillPlan({
      states: [
        {
          userId: 'student-1',
          data: {
            kind: 'unit44_student_state',
            responses: {
              'step-08': {
                stepId: 'step-08',
                submittedAt: 1778550421493,
                answers: { 'weight-preference': 'C' },
              },
              'step-13': {
                stepId: 'step-13',
                submittedAt: 1778551432404,
                answers: { 'post-quiz-1': '因为还没有经过 4-5 的工程复核' },
              },
            },
          },
        },
      ],
      logs: [
        {
          id: 'old-log',
          userId: 'student-1',
          stepId: 'step-08',
          lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
          clientEventId: 'old-client',
          attemptKey: 'step-08:response:1778550400000',
          clientEventAt: new Date('2026-05-12T01:46:40.000Z'),
          createdAt: new Date('2026-05-12T01:46:40.100Z'),
          eventData: {
            eventType: 'lesson_submit',
            clientEventAt: 1778550400000,
          },
        },
        {
          id: 'matched-log',
          userId: 'student-1',
          stepId: 'step-08',
          lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
          clientEventId: 'client-1',
          attemptKey: 'step-08:response:1778550421493',
          clientEventAt: new Date('2026-05-12T01:47:01.493Z'),
          createdAt: new Date('2026-05-12T01:47:01.600Z'),
          eventData: {
            eventType: 'lesson_submit',
            clientEventId: 'client-1',
            clientEventAt: 1778550421493,
          },
        },
      ],
      existingSourceLogIds: new Set(),
    });

    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]).toMatchObject({
      sourceLogId: 'matched-log',
      userId: 'student-1',
      stepId: 'step-08',
      clientEventId: 'client-1',
      score: 100,
      outcome: 'success',
      responseData: expect.objectContaining({
        answerDigest: { 'weight-preference': 'C' },
      }),
    });
    expect(plan.summary).toMatchObject({
      states: 1,
      responses: 2,
      rows: 1,
      missingLog: 1,
      skippedExisting: 0,
      unsupportedTelemetry: 0,
    });
  });

  it('does not score a response when required questions are missing', () => {
    const plan = buildUnit44BackfillPlan({
      states: [
        {
          userId: 'student-1',
          data: {
            kind: 'unit44_student_state',
            responses: {
              'step-13': {
                stepId: 'step-13',
                submittedAt: 1778551432404,
                answers: {
                  'post-quiz-3': '因为任务通道变了，收益项和代价项必须跟着改写',
                },
              },
            },
          },
        },
      ],
      logs: [
        {
          id: 'matched-log',
          userId: 'student-1',
          stepId: 'step-13',
          lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
          clientEventId: 'client-1',
          attemptKey: 'step-13:response:1778551432404',
          clientEventAt: new Date('2026-05-12T02:03:52.404Z'),
          createdAt: new Date('2026-05-12T02:03:52.600Z'),
          eventData: {
            eventType: 'lesson_submit',
            clientEventId: 'client-1',
            clientEventAt: 1778551432404,
          },
        },
      ],
      existingSourceLogIds: new Set(),
    });

    expect(plan.rows).toHaveLength(0);
    expect(plan.summary).toMatchObject({
      responses: 1,
      rows: 0,
      incompleteResponse: 1,
    });
  });

  it('does not score a response when a required answer is blank', () => {
    const plan = buildUnit44BackfillPlan({
      states: [
        {
          userId: 'student-1',
          data: {
            kind: 'unit44_student_state',
            responses: {
              'step-08': {
                stepId: 'step-08',
                submittedAt: 1778550421493,
                answers: { 'weight-preference': '   ' },
              },
            },
          },
        },
      ],
      logs: [
        {
          id: 'matched-log',
          userId: 'student-1',
          stepId: 'step-08',
          lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
          clientEventId: 'client-1',
          attemptKey: 'step-08:response:1778550421493',
          clientEventAt: new Date('2026-05-12T01:47:01.493Z'),
          createdAt: new Date('2026-05-12T01:47:01.600Z'),
          eventData: {
            eventType: 'lesson_submit',
            clientEventId: 'client-1',
            clientEventAt: 1778550421493,
          },
        },
      ],
      existingSourceLogIds: new Set(),
    });

    expect(plan.rows).toHaveLength(0);
    expect(plan.summary).toMatchObject({
      responses: 0,
      rows: 0,
    });
  });
});
