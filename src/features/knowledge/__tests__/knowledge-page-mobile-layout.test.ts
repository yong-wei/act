import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('knowledge page mobile layout', () => {
  it('fills the remaining viewport below AppShell chrome instead of a fixed dvh remainder', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/app/knowledge/page.tsx'), 'utf8');
    expect(source).toContain('fillViewport');
    expect(source).toContain('flex min-h-72 flex-1 flex-col overflow-auto');
    expect(source).not.toContain('100dvh-18.625rem');
    expect(source).not.toContain('100dvh-8rem');
    expect(source).not.toContain('100dvh-11.625rem');
  });
});
