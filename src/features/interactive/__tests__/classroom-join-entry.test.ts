import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('classroom join entry', () => {
  it('keeps session join and adds class join on the same page', () => {
    const source = readFileSync(join(repoRoot, 'src/app/classroom/join/page.tsx'), 'utf8');

    expect(source).toContain('/api/session/join');
    expect(source).toContain('/api/classes/join');
    expect(source).toContain("type JoinMode = 'session' | 'class'");
  });

  it('allows alphanumeric class codes instead of digit-only input', () => {
    const source = readFileSync(join(repoRoot, 'src/app/classroom/join/page.tsx'), 'utf8');

    expect(source).toContain("value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)");
    expect(source).toContain("inputMode={isClassMode ? 'text' : 'numeric'}");
    expect(source).toContain("searchParams.get('mode') === 'class' ? 'class' : 'session'");
    expect(source).not.toContain('/[a-zA-Z]/.test(rawCodeFromUrl)');
  });

  it('updates the student dashboard entry copy for classroom and class codes', () => {
    const source = readFileSync(join(repoRoot, 'src/app/(main)/dashboard/page.tsx'), 'utf8');

    expect(source).toContain('加入课堂 / 班级');
    expect(source).toContain('输入课堂码或班级加入码');
  });
});
