import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('portrait task attainment UI contract', () => {
  it.each([
    'src/app/(main)/profile/growth/page.tsx',
    'src/app/teacher/classes/[classId]/students/[studentId]/page.tsx',
  ])('%s uses accessible disclosure and separates read refresh from portrait update', (path) => {
    const source = readFileSync(join(process.cwd(), path), 'utf8');
    expect(source).toContain('<details');
    expect(source).toContain('<summary');
    expect(source).toContain('刷新数据');
    expect(source).toContain('更新画像');
    expect(source).toContain('disabled={');
    expect(source).toContain('部分进度');
    expect(
      source.includes("taskAttainment.personal?.state === 'EVIDENCE'")
      || source.includes("taskAttainment?.state === 'EVIDENCE'"),
    ).toBe(true);
    expect(source).toContain('data-simulation-task-no-evidence');
  });
});
