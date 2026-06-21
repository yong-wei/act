import { describe, expect, it } from 'vitest';

import { normalizeRegistrationError } from '../register-error';

describe('normalizeRegistrationError', () => {
  it('returns a password field message from Zod flattened field errors', () => {
    expect(normalizeRegistrationError({
      formErrors: [],
      fieldErrors: {
        password: ['密码至少需要 8 位'],
      },
    })).toBe('密码至少需要 8 位');
  });

  it('returns a readable fallback instead of a raw object', () => {
    expect(normalizeRegistrationError({
      formErrors: [],
      fieldErrors: {},
    })).toBe('注册信息有误，请检查后重试。');
  });
});
