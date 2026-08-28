import { describe, expect, it } from 'vitest';

import {
  buildSessionParticipantHref,
  resolveSessionRouteSegment,
} from '../classroom-session-route';

describe('resolveSessionRouteSegment', () => {
  it('resolves the route from the captured bundle canonical id', () => {
    const resolved = resolveSessionRouteSegment({
      bundleCanonicalLessonId: '1-2',
      bundleBound: true,
      planTitle: '完全无关的可变标题',
    });
    expect(resolved).toEqual({
      routeSegment: 'unit-1-2-modeling-from-object-to-system',
      isPremiumCourse: true,
      source: 'bundle-binding',
    });
  });

  it('never lets a changed plan title move a bound session to another course', () => {
    const resolved = resolveSessionRouteSegment({
      bundleCanonicalLessonId: '1-2',
      bundleBound: true,
      planTitle: '1-3：参数变化与极点迁移：根轨迹的第一眼',
    });
    expect(resolved.routeSegment).toBe('unit-1-2-modeling-from-object-to-system');
    expect(resolved.source).toBe('bundle-binding');
  });

  it('keeps a bound non-interactive session on the generic classroom shell instead of the title', () => {
    // A bound plan:/generated: session whose title later matches an interactive
    // course alias must NOT redirect to that course (redirect-loop guard).
    expect(resolveSessionRouteSegment({
      bundleCanonicalLessonId: 'plan:plan-1',
      bundleBound: true,
      planTitle: '1-3：参数变化与极点迁移：根轨迹的第一眼',
    })).toEqual({ routeSegment: null, isPremiumCourse: false, source: 'none' });
    expect(resolveSessionRouteSegment({
      bundleCanonicalLessonId: 'generated-courseware:pub-1',
      bundleBound: true,
      planTitle: '1-3：参数变化与极点迁移：根轨迹的第一眼',
    })).toEqual({ routeSegment: null, isPremiumCourse: false, source: 'none' });
    expect(resolveSessionRouteSegment({
      bundleCanonicalLessonId: null,
      bundleBound: true,
      planTitle: '1-3：参数变化与极点迁移：根轨迹的第一眼',
    })).toEqual({ routeSegment: null, isPremiumCourse: false, source: 'none' });
  });

  it('keeps the plan-title compatibility reader for legacy sessions only', () => {
    const resolved = resolveSessionRouteSegment({
      bundleCanonicalLessonId: null,
      bundleBound: false,
      planTitle: '1-3：参数变化与极点迁移：根轨迹的第一眼',
    });
    expect(resolved.routeSegment).toBe('unit-1-3-parameter-pole-migration');
    expect(resolved.source).toBe('plan-title-compatibility');
  });

  it('returns no route when neither binding nor title resolves', () => {
    expect(resolveSessionRouteSegment({ bundleCanonicalLessonId: null, bundleBound: false, planTitle: '不存在的课' }))
      .toEqual({ routeSegment: null, isPremiumCourse: false, source: 'none' });
    expect(resolveSessionRouteSegment({ bundleCanonicalLessonId: 'generated-courseware:pub-1', bundleBound: true, planTitle: 'x' }))
      .toEqual({ routeSegment: null, isPremiumCourse: false, source: 'none' });
  });
});

describe('buildSessionParticipantHref', () => {
  it('builds the course route for a bound ordinary session', () => {
    expect(buildSessionParticipantHref({
      role: 'teacher',
      sessionId: 's1',
      planTitle: null,
      bundleCanonicalLessonId: '1-1',
      bundleBound: true,
    })).toBe('/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/s1');
  });

  it('falls back to the classroom shell when nothing resolves', () => {
    expect(buildSessionParticipantHref({
      role: 'student',
      sessionId: 's2',
      planTitle: '普通教案',
      bundleCanonicalLessonId: null,
      bundleBound: false,
    })).toBe('/classroom/student/s2');
  });
});
