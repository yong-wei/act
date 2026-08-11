import type { LayeredGraphScope } from './contracts';

/** Canonical package scope for an interactive lesson package id (e.g. `1-1`). */
export function buildCoursePackageLayeredScope(input: {
  packageCanonicalId: string;
  lessonKey?: string | null;
  stepId?: string | null;
  knowledgeRefs?: readonly string[];
}): LayeredGraphScope {
  return {
    scopeId: `course-package:${input.packageCanonicalId}`,
    lessonKey: input.lessonKey ?? input.packageCanonicalId,
    stepId: input.stepId ?? null,
    knowledgeRefs: input.knowledgeRefs,
  };
}
