import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildManifestSubmissionEventPayload } from '@/features/interactive/shared/manifest-runtime/submission-controller';
import {
  type InteractiveRuntimeManifest,
  type InteractiveRuntimeStepManifest,
  normalizeInteractiveRuntimeManifest,
} from '@/lib/interactive-lesson-manifest';
import { getUNIT_5_2ManifestStepFromManifest } from '@/lib/unit-5-2-course';
import { getUNIT_5_5ManifestStepFromManifest } from '@/lib/unit-5-5-course';

const repoRoot = process.cwd();

const module5Lessons = [
  {
    lessonId: '5-2',
    routeSegment: 'unit-5-2-nonlinear-analysis-entry',
    manifestGetter: 'getUNIT_5_2ManifestStepFromManifest',
    minimumResponseSteps: 12,
  },
  {
    lessonId: '5-3',
    routeSegment: 'unit-5-3-mass-coordination-chain',
    manifestGetter: 'getUNIT_5_3ManifestStepFromManifest',
    minimumResponseSteps: 12,
  },
  {
    lessonId: '5-4',
    routeSegment: 'unit-5-4-data-driven-mpc-transition',
    manifestGetter: 'getUNIT_5_4ManifestStepFromManifest',
    minimumResponseSteps: 12,
  },
  {
    lessonId: '5-5',
    routeSegment: 'unit-5-5-policy-learning-entry-risk',
    manifestGetter: 'getUNIT_5_5ManifestStepFromManifest',
    minimumResponseSteps: 12,
  },
  {
    lessonId: '5-6',
    routeSegment: 'unit-5-6-method-comparison-cold-chain',
    manifestGetter: 'getUNIT_5_6ManifestStepFromManifest',
    minimumResponseSteps: 12,
  },
] as const;

function readManifest(lessonId: string): InteractiveRuntimeManifest {
  const raw = JSON.parse(
    readFileSync(join(repoRoot, 'course-content/runtime/lessons', lessonId, 'interactive-manifest.json'), 'utf8'),
  );
  const manifest = normalizeInteractiveRuntimeManifest(raw);
  if (!manifest) throw new Error(`${lessonId} interactive manifest is invalid`);
  return manifest;
}

function classifyStep(step: InteractiveRuntimeStepManifest) {
  const responseKinds = (step.interactionSpec.activityCards ?? []).map((card) => card.responseKind);
  const categories = new Set<string>();

  for (const kind of responseKinds) {
    if (kind === 'single_choice' || kind === 'binary_choice' || kind === 'multi_choice' || kind === 'multi_select') {
      categories.add('objective');
    } else if (kind === 'drag_match' || kind === 'triple_match' || kind === 'drag_sort' || kind === 'card_sort') {
      categories.add('drag-match-sort');
    } else if (kind === 'parameter_set' || step.interactionSpec.interactionKind === 'parameter_slider') {
      categories.add('parameter');
    } else {
      categories.add('subjective');
    }
  }

  if (step.interactionSpec.interactionKind === 'interactive_figure_submit') {
    categories.add('simulation');
  }
  if (
    step.interactionSpec.interactionKind === 'rust_toy_training_panel'
    || step.interactionSpec.interactionKind === 'rust_heading_rl_training_panel'
  ) {
    categories.add('training-result');
  }

  return Array.from(categories).sort();
}

function responseProducingSteps(manifest: InteractiveRuntimeManifest) {
  return manifest.steps
    .map((step) => ({
      stepId: step.id,
      interactionKind: step.interactionSpec.interactionKind,
      categories: classifyStep(step),
    }))
    .filter((item) => item.categories.length > 0);
}

describe('module 5 submission migration', () => {
  it('enumerates response-producing steps and classifies their evidence shape', () => {
    const inventory = Object.fromEntries(
      module5Lessons.map((lesson) => [
        lesson.lessonId,
        responseProducingSteps(readManifest(lesson.lessonId)),
      ]),
    );

    for (const lesson of module5Lessons) {
      expect(inventory[lesson.lessonId].length).toBeGreaterThanOrEqual(lesson.minimumResponseSteps);
    }
    expect(inventory['5-2'].some((step) => step.categories.includes('parameter'))).toBe(true);
    expect(inventory['5-3'].some((step) => step.categories.includes('drag-match-sort'))).toBe(true);
    expect(inventory['5-4'].some((step) => step.categories.includes('simulation'))).toBe(true);
    expect(inventory['5-5'].some((step) => step.categories.includes('training-result'))).toBe(true);
    expect(inventory['5-6'].some((step) => step.categories.includes('simulation'))).toBe(true);
  });

  it('guards module 5 student pages against bypassing the shared submission path', () => {
    for (const lesson of module5Lessons) {
      const studentPageSource = readFileSync(
        join(repoRoot, 'src/features/interactive', lesson.routeSegment, 'student-page.tsx'),
        'utf8',
      );

      expect(studentPageSource, lesson.lessonId).toContain('useManifestSubmissionController');
      expect(studentPageSource, lesson.lessonId).toContain('submitManifestStepResponse');
      expect(studentPageSource, lesson.lessonId).toContain(lesson.manifestGetter);
      expect(studentPageSource, lesson.lessonId).not.toContain('COURSE_EVENT_TYPES.LESSON_SUBMIT');
      expect(studentPageSource, lesson.lessonId).not.toContain('COURSE_EVENT_TYPES.LESSON_RESUBMIT');
    }
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
