import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('knowledge page mobile layout', () => {
  it('keeps a non-zero scrollable workspace when the viewport is 320 by 270', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/app/knowledge/page.tsx'), 'utf8');
    expect(source).toContain('h-[max(18rem,calc(100dvh-18.625rem))]');
    expect(source).toContain('min-h-72 overflow-auto');
    expect(source).not.toContain('max-lg:h-[calc(100dvh-18.625rem)]');
  });
});
