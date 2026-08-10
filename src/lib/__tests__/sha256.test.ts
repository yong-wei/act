import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { sha256 } from '@/lib/sha256';

describe('sha256', () => {
  it.each(['', 'abc', '控制系统校正设计', 'a'.repeat(1000)])('matches Node SHA-256 for %j', (value) => {
    const expected = createHash('sha256').update(value).digest('hex');
    expect(sha256(value)).toBe(expected);
  });
});
