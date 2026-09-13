import { describe, expect, it } from 'vitest';

import {
  parseLessonMediaDeepLink,
  matchLessonMediaDeepLink,
  buildLessonMediaDeepLinkQuery,
} from '@/features/interactive/shared/lesson-media-deep-link';
import { resolveAnchoredLaunchHref, anchorDisplayLabel } from '@/lib/layered-graph/teaching-resource-launch-maps';

describe('anchored launch maps', () => {
  it('builds step, heading, and media deep links for a known lesson', () => {
    const step = resolveAnchoredLaunchHref(
      { resourceId: 'act:step:1-3:step-04', resourceType: 'step', unitId: '1-3' },
      { kind: 'step', stepId: 'step-04', stepIndex: 4, label: '步骤 4' },
      '/fallback',
    );
    expect(step).toContain('/interactive-learning/courses/');
    expect(step).toContain('step=step-04');

    const heading = resolveAnchoredLaunchHref(
      { resourceId: 'act:handout:1-3', resourceType: 'handout', unitId: '1-3' },
      { kind: 'heading', headingId: 'h2-shi-jian-chang-shu', order: 2, level: 2, label: '时间常数' },
      '/fallback',
    );
    expect(heading).toContain('handout-print');
    expect(heading).toContain('#h2-shi-jian-chang-shu');

    const media = resolveAnchoredLaunchHref(
      { resourceId: 'act:audio:1-3', resourceType: 'audio', unitId: '1-3' },
      {
        kind: 'time',
        mediaId: '1-3-audio',
        runtimePath: 'lessons/1-3/media/1-3-audio.mp3',
        mediaSha256: 'ab'.repeat(32),
        startSeconds: 12.6,
        endSeconds: 20,
        label: '12–20s',
      },
      '/fallback',
    );
    expect(media).toContain('media=1-3-audio');
    expect(media).toContain('t=12');
    expect(anchorDisplayLabel({ kind: 'heading', headingId: 'h2-x', order: 2, level: 2, label: '时间常数' })).toBe('时间常数');
  });

  it('does not invent a lesson entry href', () => {
    expect(resolveAnchoredLaunchHref(
      { resourceId: 'act:lesson:1-3', resourceType: 'lesson', unitId: '1-3' },
      { kind: 'whole' },
      null,
    )).toBeNull();
  });
});

describe('lesson media deep link', () => {
  it('parses seek and reports sha drift', () => {
    const query = buildLessonMediaDeepLinkQuery({
      mediaId: '1-3-audio',
      startSeconds: 12.9,
      mediaSha256: 'abcdef1234567890',
    });
    const params = new URLSearchParams(query);
    const link = parseLessonMediaDeepLink(params);
    expect(link).toEqual({ mediaId: '1-3-audio', seconds: 12, shaPrefix: 'abcdef123456' });
    expect(matchLessonMediaDeepLink(link, { id: '1-3-audio', sha256: 'abcdef123456ffff' })).toEqual({
      state: 'seek',
      seconds: 12,
    });
    expect(matchLessonMediaDeepLink(link, { id: '1-3-audio', sha256: 'ffffffffffff' })).toEqual({
      state: 'drift',
      seconds: 12,
    });
  });
});
