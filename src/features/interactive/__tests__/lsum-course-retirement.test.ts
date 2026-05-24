import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FEATURED_LESSONS, INTERACTIVE_COURSE_MODULES, PREMIUM_LESSONS } from '@/features/interactive/learning-catalog';
import { ALL_PRESETS } from '@/features/teacher/preset-lessons/presets';
import { COURSE_AI_CONTEXT_REGISTRY } from '@/lib/course-ai-contexts';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';
import { resolveRuntimeLessonKeyFromRouteSegment } from '@/lib/session-lesson-snapshot';

const repoRoot = process.cwd();
const retiredSegment = 'lsum-design-feasible-domain';
const retiredPresetKey = 'lsum-design-feasible-domain-v1';

describe('lsum-design-feasible-domain retirement', () => {
  it('removes the lsum-design-feasible-domain App Router tree', () => {
    expect(
      existsSync(join(repoRoot, 'src/app/interactive-learning/courses/lsum-design-feasible-domain'))
    ).toBe(false);
  });

  it('keeps lsum-design-feasible-domain out of public course catalogs', () => {
    const publicLessons = [
      ...FEATURED_LESSONS,
      ...PREMIUM_LESSONS,
      ...INTERACTIVE_COURSE_MODULES.flatMap((module) => module.lessons),
    ];

    expect(
      publicLessons.some((lesson) =>
        [lesson.id, lesson.href].some((value) => String(value).includes(retiredSegment))
      )
    ).toBe(false);
  });

  it('keeps lsum-design-feasible-domain out of presets, AI contexts, and route helpers', () => {
    expect(ALL_PRESETS.some((preset) => preset.key === retiredPresetKey)).toBe(false);
    expect(COURSE_AI_CONTEXT_REGISTRY[retiredPresetKey]).toBeUndefined();
    expect(resolveSessionRouteFromPlanTitle('L-∑：设计可行域——让约束成为指南针')).toEqual({
      routeSegment: null,
      isPremiumCourse: false,
    });
    expect(resolveRuntimeLessonKeyFromRouteSegment(retiredSegment)).toBeNull();
  });

  it('does not leave lsum-design-feasible-domain compatibility registrations in source', () => {
    const sourcePaths = [
      'src/features/interactive/learning-catalog.ts',
      'src/features/teacher/preset-lessons/presets/index.ts',
      'src/lib/classroom-session-route.ts',
      'src/lib/session-lesson-snapshot.ts',
    ];

    for (const sourcePath of sourcePaths) {
      const source = readFileSync(join(repoRoot, sourcePath), 'utf8');

      expect(source).not.toContain(retiredSegment);
      expect(source).not.toContain(retiredPresetKey);
      expect(source).not.toContain('LSUM_');
    }
  });
});
