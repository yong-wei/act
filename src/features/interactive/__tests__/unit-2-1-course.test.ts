import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { getUNIT_2_1MediaSrc, UNIT_2_1_LESSON_STEPS } from '@/lib/unit-2-1-course';

const repoRoot = process.cwd();

describe('unit 2-1 interactive course', () => {
  it('defines the full 16-step lesson flow', () => {
    expect(UNIT_2_1_LESSON_STEPS).toHaveLength(16);
    expect(UNIT_2_1_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(UNIT_2_1_LESSON_STEPS[15]?.id).toBe('step-16');
  });

  it('exposes AI quick questions for the initial-state comparison step', () => {
    const quickQuestions = getStepQuickQuestions('unit-2-1-modeling-language-v1', 'step-07');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('初值');
  });

  it('maps runtime media for representative modeling-language steps', () => {
    expect(getUNIT_2_1MediaSrc('step-02')).toContain('2-1-cover-comic.png');
    expect(getUNIT_2_1MediaSrc('step-10')).toContain('2-1-md-05-ship-heading-physical-blocks.png');
    expect(getUNIT_2_1MediaSrc('step-16')).toContain('2-1-info.png');
  });

  it('adds the new 2-1 public course routes and removes the old 1-1/1-2 public routes', () => {
    expect(existsSync(join(repoRoot, 'src/app/interactive-learning/courses/unit-2-1-modeling-language/page.tsx'))).toBe(true);
    expect(existsSync(join(repoRoot, 'src/app/interactive-learning/courses/unit-2-1-modeling-language/student/[sessionId]/page.tsx'))).toBe(true);
    expect(existsSync(join(repoRoot, 'src/app/interactive-learning/courses/unit-2-1-modeling-language/teacher/[sessionId]/page.tsx'))).toBe(true);

    expect(existsSync(join(repoRoot, 'src/app/interactive-learning/courses/unit-1-1-laplace-transfer-function/page.tsx'))).toBe(false);
    expect(existsSync(join(repoRoot, 'src/app/interactive-learning/courses/unit-1-2-block-diagram-simplification/page.tsx'))).toBe(false);
  });
});
