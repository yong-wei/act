import { describe, expect, it } from 'vitest';

import {
  appendLoginPageHashToRedirectPath,
  normalizeSafeCallbackPath,
} from '@/lib/auth-redirect';

describe('login redirect fragments', () => {
  it('appends the login page fragment when the safe callback has none', () => {
    const callback = normalizeSafeCallbackPath(
      '/textbooks/hu-shousong-auto-control-8th/%E7%AC%AC%E5%85%AB%E7%89%88/chapter-chapter-01',
      'https://act.local',
    );
    expect(callback).not.toBeNull();
    expect(appendLoginPageHashToRedirectPath(callback!, '#figure-001')).toBe(
      `${callback}#figure-001`,
    );
  });

  it('does not override a callback fragment', () => {
    expect(appendLoginPageHashToRedirectPath(
      '/textbooks/book/edition/unit#formula-002',
      '#figure-001',
    )).toBe('/textbooks/book/edition/unit#formula-002');
  });

  it('ignores empty or malformed login page fragments', () => {
    expect(appendLoginPageHashToRedirectPath('/profile', '')).toBe('/profile');
    expect(appendLoginPageHashToRedirectPath('/profile', 'figure-001')).toBe('/profile');
    expect(appendLoginPageHashToRedirectPath('/profile', '#bad fragment')).toBe('/profile');
  });
});
