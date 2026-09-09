import { describe, expect, it } from 'vitest';

import { sanitizePublicLaunchHref } from '@/lib/knowledge-surface/launch';
import { resolveSafeLaunchTarget } from '@/features/knowledge/launch-target';

/**
 * #2043: governed unified-reader routes carry percent-encoded spaces in the
 * edition segment (14th%20Global%20Edition) and must survive the public API
 * launch sanitization; every other encoded-space shape stays rejected.
 */
describe('governed textbook route launch sanitization', () => {
  it('admits reader hrefs whose edition segment percent-encodes spaces', () => {
    expect(sanitizePublicLaunchHref(
      '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-chapter-03/section-3.8/example-3.6',
      'ctc:some-node',
    )).toBe('/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-chapter-03/section-3.8/example-3.6');
    expect(sanitizePublicLaunchHref(
      '/textbooks/feedback-control-of-dynamic-systems/7th%20edition/chapter-chapter-07/section-7.2',
      'ctc:some-node',
    )).toBe('/textbooks/feedback-control-of-dynamic-systems/7th%20edition/chapter-chapter-07/section-7.2');
  });

  it('keeps rejecting encoded spaces outside the governed textbook route form', () => {
    expect(sanitizePublicLaunchHref('/safe%20path', 'ctc:some-node')).toBeNull();
    expect(sanitizePublicLaunchHref('/textbooks/dorf-modern-control-systems/14th%20Global%20Edition', 'ctc:some-node')).toBeNull();
    // The generic guard itself is unchanged for arbitrary targets.
    expect(resolveSafeLaunchTarget('/safe%20path').href).toBeNull();
  });

  it('still applies the unsafe-path checks to governed routes', () => {
    expect(sanitizePublicLaunchHref(
      '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/course-content/leak',
      'ctc:some-node',
    )).toBeNull();
    expect(sanitizePublicLaunchHref(
      '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/ctc:some-node',
      'ctc:some-node',
    )).toBeNull();
  });
});
