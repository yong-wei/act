import { describe, expect, it } from 'vitest';

import {
  overlayTeachingBindingsFromLiveRelease,
} from '@/lib/resource-binding-release/project-teaching-bindings';
import {
  readAgreedLiveCourseProjection,
  readAgreedLiveResourceBindingRelease,
} from '@/lib/teaching-projection/live-course-pointer';
import type { TeachingBindingRuntime } from '@/lib/teaching-projection/contracts';

const fallback: TeachingBindingRuntime[] = [{
  bindingId: 'fixture-binding',
  resourceId: 'act:handout:1-3',
  canonicalId: 'ctc:fixture',
  role: 'EXPLAINS',
  scopeId: 'act-control-theory',
  sourcePath: null,
  primary: true,
  rationale: 'fixture',
}];

describe('overlayTeachingBindingsFromLiveRelease', () => {
  it('keeps the supplied fallback when the requested projection is not the live course', () => {
    const result = overlayTeachingBindingsFromLiveRelease(fallback, process.cwd(), {
      projectionId: 'proj-not-the-live-course',
    });
    expect(result.overlaid).toBe(false);
    expect(result.bindingReleaseId).toBeNull();
    expect(result.bindings).toEqual(fallback);
  });

  it('overlays the live binding family when the course identity matches', () => {
    const course = readAgreedLiveCourseProjection(process.cwd());
    const live = readAgreedLiveResourceBindingRelease(process.cwd());
    if (!course || !live) return;
    const result = overlayTeachingBindingsFromLiveRelease(fallback, process.cwd(), {
      projectionId: course.projectionId,
      authorityReleaseId: live.authorityReleaseId,
    });
    expect(result.overlaid).toBe(true);
    expect(result.bindingReleaseId).toBe(live.bindingReleaseId);
    expect(result.bindings.some((row) => row.bindingId === 'fixture-binding')).toBe(false);
    expect(result.bindings.length).toBeGreaterThan(0);
  });
});
