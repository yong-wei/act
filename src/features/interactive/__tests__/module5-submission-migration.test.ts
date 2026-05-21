import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildManifestSubmissionEventPayload,
  normalizeManifestSubmissionAnswers,
} from '@/features/interactive/shared/manifest-runtime/submission-controller';
import {
  assertRequiredLessonsInGateInventory,
  collectManifestResponseProducingSteps,
  evaluateManifestSubmissionPageGate,
} from '@/features/interactive/shared/manifest-runtime/submission-gate';
import {
  COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY,
  REQUIRED_RUNTIME_FIRST_GATE_LESSONS,
} from '@/features/interactive/course-submission-gate-inventory';
import { resolveCourseEvidenceSpec } from '@/lib/data-governance/course-evidence-specs';
import {
  type InteractiveRuntimeManifest,
  normalizeInteractiveRuntimeManifest,
} from '@/lib/interactive-lesson-manifest';
import { getUNIT_5_2ManifestStepFromManifest } from '@/lib/unit-5-2-course';
import { getUNIT_5_3ManifestStepFromManifest } from '@/lib/unit-5-3-course';
import { getUNIT_5_5ManifestStepFromManifest } from '@/lib/unit-5-5-course';

const repoRoot = process.cwd();

function readManifest(lessonId: string): InteractiveRuntimeManifest {
  const raw = JSON.parse(
    readFileSync(join(repoRoot, 'course-content/runtime/lessons', lessonId, 'interactive-manifest.json'), 'utf8'),
  );
  const manifest = normalizeInteractiveRuntimeManifest(raw);
  if (!manifest) throw new Error(`${lessonId} interactive manifest is invalid`);
  return manifest;
}

describe('manifest submission migration gates', () => {
  it('enumerates all runtime-first response-producing lessons through CourseEvidenceSpec', () => {
    const inventory = Object.fromEntries(
      COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY.map((lesson) => {
        const manifest = readManifest(lesson.lessonId);
        const evidenceSpec = resolveCourseEvidenceSpec({ manifest });
        if (evidenceSpec.status !== 'supported') {
          throw new Error(`${lesson.lessonId} evidence spec is ${evidenceSpec.reason}`);
        }
        return [
          lesson.lessonId,
          collectManifestResponseProducingSteps(manifest, lesson.lessonId)
            .filter((step) => evidenceSpec.spec.responseProducingStepIds.includes(step.stepId)),
        ];
      }),
    );

    expect(assertRequiredLessonsInGateInventory(
      [...COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY],
      [...REQUIRED_RUNTIME_FIRST_GATE_LESSONS],
    )).toEqual([]);

    for (const lesson of COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY) {
      expect(inventory[lesson.lessonId].length).toBeGreaterThanOrEqual(lesson.minimumResponseSteps);
    }
    expect(inventory['2-1'].some((step) => step.categories.includes('objective'))).toBe(true);
    expect(inventory['3-8'].some((step) => step.categories.includes('objective'))).toBe(true);
    expect(inventory['4-1'].some((step) => step.categories.includes('parameter'))).toBe(true);
    expect(inventory['5-2'].some((step) => step.categories.includes('parameter'))).toBe(true);
    expect(inventory['5-3'].some((step) => step.categories.includes('drag-match-sort'))).toBe(true);
    expect(inventory['5-4'].some((step) => step.categories.includes('simulation'))).toBe(true);
    expect(inventory['5-5'].some((step) => step.categories.includes('training-result'))).toBe(true);
    expect(inventory['5-6'].some((step) => step.categories.includes('simulation'))).toBe(true);
  });

  it('guards runtime-first student pages against bypassing the shared submission path', () => {
    for (const lesson of COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY) {
      const manifest = readManifest(lesson.lessonId);
      const evidenceSpec = resolveCourseEvidenceSpec({ manifest });
      if (evidenceSpec.status !== 'supported') {
        throw new Error(`${lesson.lessonId} evidence spec is ${evidenceSpec.reason}`);
      }
      const result = evaluateManifestSubmissionPageGate({
        lessonId: lesson.lessonId,
        routeSegment: lesson.routeSegment,
        manifestGetterName: lesson.manifestGetterName,
        studentPageSource: readFileSync(join(repoRoot, lesson.studentPagePath), 'utf8'),
        responseSteps: collectManifestResponseProducingSteps(manifest, lesson.lessonId)
          .filter((step) => evidenceSpec.spec.responseProducingStepIds.includes(step.stepId)),
        minimumResponseSteps: lesson.minimumResponseSteps,
      });

      expect(result, lesson.lessonId).toMatchObject({
        lessonId: lesson.lessonId,
        passed: true,
        violations: [],
      });
    }
  });

  it('reports a deliberately invalid student page fixture with missing shared evidence integration', () => {
    const fixtureSource = `
      import { COURSE_EVENT_TYPES } from '@/lib/classroom-analytics/event-taxonomy';
      export function BrokenStudentPage({ trackCourseEvent }) {
        trackCourseEvent(COURSE_EVENT_TYPES.LESSON_SUBMIT, {
          stepId: 'step-03',
          attemptKey: 'manual',
          clientEventAt: Date.now(),
          data: { answers: {} },
        });
        return null;
      }
    `;

    const result = evaluateManifestSubmissionPageGate({
      lessonId: 'fixture-5-2',
      routeSegment: 'fixture-missing-shared-path',
      manifestGetterName: 'getUNIT_5_2ManifestStepFromManifest',
      studentPageSource: fixtureSource,
      responseSteps: [
        {
          lessonId: 'fixture-5-2',
          stepId: 'step-03',
          interactionKind: 'quiz_group',
          categories: ['objective'],
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations.map((item) => item.code)).toEqual([
      'missing-useManifestSubmissionController',
      'missing-submitManifestStepResponse',
      'missing-manifest-step-getter',
      'direct-course-submit-event',
    ]);
  });

  it('builds answer-rich payloads for an ordinary module 5 quiz page', () => {
    const manifest = readManifest('5-2');
    const payload = buildManifestSubmissionEventPayload({
      stepId: 'step-03',
      response: {
        stepId: 'step-03',
        submittedAt: 1778550650000,
        answers: {
          'state-point': '系统从某个位置和速度出发的状态',
          'sine-meaning': '幅值和角频率',
        },
      },
      stepManifest: getUNIT_5_2ManifestStepFromManifest(manifest, 'step-03'),
      submittedAt: 1778550650000,
      attemptKey: 'step-03:response:1778550650000',
    });

    expect(payload.data).toMatchObject({
      schemaVersion: 'manifest-submission-v2',
      stepId: 'step-03',
      evidenceQuality: 'rich',
      answers: {
        'state-point': '系统从某个位置和速度出发的状态',
        'sine-meaning': '幅值和角频率',
      },
      scoringSupported: true,
    });
  });

  it('normalizes array answers without JSON wrapping before objective scoring', () => {
    const manifest = readManifest('5-3');
    const answers = normalizeManifestSubmissionAnswers({
      'role-match': ['perception', 'estimation', 'planning', 'control', 'actuation', 'supervision'],
    });
    const payload = buildManifestSubmissionEventPayload({
      stepId: 'step-04',
      response: {
        stepId: 'step-04',
        submittedAt: 1778550652000,
        answers,
      },
      stepManifest: getUNIT_5_3ManifestStepFromManifest(manifest, 'step-04'),
      submittedAt: 1778550652000,
      attemptKey: 'step-04:response:1778550652000',
    });

    expect(answers['role-match']).toBe('perception|estimation|planning|control|actuation|supervision');
    expect(payload.data).toMatchObject({
      evidenceQuality: 'rich',
      correctCount: 1,
      objectiveTotal: 1,
      score: 100,
      questionSummaries: [
        expect.objectContaining({
          questionId: 'role-match',
          answered: true,
          isCorrect: true,
        }),
      ],
    });
  });

  it('preserves training panel output as structured extra evidence', () => {
    const manifest = readManifest('5-5');
    const trainingResult = {
      panelKind: 'rust_heading_rl_training_panel',
      trainingType: 'direct_rl',
      seed: 5515,
      metrics: { rmsHeadingError: 4.2 },
    };
    const payload = buildManifestSubmissionEventPayload({
      stepId: 'step-15',
      response: {
        stepId: 'step-15',
        submittedAt: 1778550655000,
        answers: {
          'rl_result:direct_rl': JSON.stringify(trainingResult),
        },
      },
      stepManifest: getUNIT_5_5ManifestStepFromManifest(manifest, 'step-15'),
      submittedAt: 1778550655000,
      attemptKey: 'step-15:response:1778550655000',
      extraEvidence: {
        trainingSubmitted: true,
        trainingResults: {
          'rl_result:direct_rl': trainingResult,
        },
      },
    });

    expect(payload.data).toMatchObject({
      schemaVersion: 'manifest-submission-v2',
      stepId: 'step-15',
      evidenceQuality: 'partial',
      answers: {
        'rl_result:direct_rl': JSON.stringify(trainingResult),
      },
      extraEvidence: {
        trainingSubmitted: true,
        trainingResults: {
          'rl_result:direct_rl': trainingResult,
        },
      },
    });
  });
});
