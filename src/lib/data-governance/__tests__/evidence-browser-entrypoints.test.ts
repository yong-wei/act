import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readSource(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('evidence browser entry points', () => {
  it('links the student growth page to the full student evidence browser', () => {
    const source = readSource('src/app/(main)/profile/growth/page.tsx');

    expect(source).toContain('href="/profile/evidence"');
    expect(source).toContain('查看全部证据');
  });

  it('links the class-scoped teacher student detail page to full evidence browsing', () => {
    const source = readSource('src/app/teacher/classes/[classId]/students/[studentId]/page.tsx');

    expect(source).toContain('href={`/teacher/classes/${classId}/students/${studentId}/evidence`}');
    expect(source).toContain('查看完整证据');
  });

  it('links the legacy teacher diagnosis page to a guarded teacher evidence browser', () => {
    const source = readSource('src/app/(main)/teacher/students/[studentId]/diagnosis/page.tsx');

    expect(source).toContain('href={`/teacher/students/${studentId}/evidence`}');
    expect(source).toContain('查看完整证据');
  });

  it('defines browser pages for student, class-scoped teacher, and legacy teacher entry points', () => {
    expect(existsSync(join(repoRoot, 'src/app/(main)/profile/evidence/page.tsx'))).toBe(true);
    expect(existsSync(join(repoRoot, 'src/app/teacher/classes/[classId]/students/[studentId]/evidence/page.tsx'))).toBe(true);
    expect(existsSync(join(repoRoot, 'src/app/(main)/teacher/students/[studentId]/evidence/page.tsx'))).toBe(true);
  });

  it('guards evidence browser state updates from stale filter requests', () => {
    const source = readSource('src/features/data-governance/evidence-timeline-browser.tsx');

    expect(source).toContain('requestSequenceRef');
    expect(source).toContain('requestId !== requestSequenceRef.current');
  });
});
