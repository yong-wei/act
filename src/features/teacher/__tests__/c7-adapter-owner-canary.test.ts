import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', '.git']);
const CANARY = 'src/features/teacher/__tests__/c7-adapter-owner-canary.test.ts';

const RETIRED_FILES = [
  'src/lib/data-governance/arena-insights.ts',
  'src/lib/data-governance/teacher-evidence-governance.ts',
  'src/lib/data-governance/teacher-attainment-scope.ts',
  'src/lib/data-governance/control-correction-teacher-report.ts',
  'src/lib/data-governance/document-rubric-grading-workbench.ts',
] as const;

const RETIRED_IMPORTS = [
  '@/lib/data-governance/arena-insights',
  '@/lib/data-governance/teacher-evidence-governance',
  '@/lib/data-governance/teacher-attainment-scope',
  '@/lib/data-governance/control-correction-teacher-report',
  '@/lib/data-governance/document-rubric-grading-workbench',
] as const;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) out.push(full.replace(/\\/g, '/'));
  }
  return out;
}

describe('C7 Arena/Teacher adapter ownership', () => {
  it('deletes retired data-governance business adapters', () => {
    for (const file of RETIRED_FILES) {
      expect(existsSync(file), file).toBe(false);
    }
  });

  it('has zero production or test imports of retired adapters', () => {
    const files = [...walk('src'), ...walk('scripts')];
    const hits: string[] = [];
    for (const file of files) {
      if (file === CANARY) continue;
      const source = readFileSync(file, 'utf8');
      for (const needle of RETIRED_IMPORTS) {
        if (source.includes(needle)) hits.push(`${file}: ${needle}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('routes Arena insights and Teacher evidence through domain owners', () => {
    expect(readFileSync('src/features/arena/__tests__/arena-teaching-platform-integration.test.ts', 'utf8')).toContain(
      '@/features/arena/arena-insights',
    );
    expect(readFileSync('src/app/api/teacher/classes/[classId]/insights/route.ts', 'utf8')).toContain(
      '@/features/teacher/teacher-evidence-governance',
    );
    expect(readFileSync('src/app/api/teacher/document-grading/submissions/route.ts', 'utf8')).toContain(
      '@/features/teacher/document-rubric-grading-workbench',
    );
  });
});
