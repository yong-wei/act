import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', '.git']);
const CANARY = 'src/features/assessment/__tests__/c6-adapter-owner-canary.test.ts';

const RETIRED_FILES = [
  'src/lib/data-governance/kaq-evidence-writeback.ts',
  'src/lib/data-governance/role-based-learning-diagnosis.ts',
  'src/lib/data-governance/control-correction-diagnosis-profile.ts',
  'src/lib/control-correction-path-rounds.ts',
] as const;

const RETIRED_IMPORTS = [
  '@/lib/data-governance/kaq-evidence-writeback',
  '@/lib/data-governance/role-based-learning-diagnosis',
  '@/lib/data-governance/control-correction-diagnosis-profile',
  '@/lib/control-correction-path-rounds',
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

describe('C6 Assessment/Personalization adapter ownership', () => {
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

  it('routes Assessment KAQ writeback and Personalization path/diagnosis through domain owners', () => {
    expect(readFileSync('src/features/assessment/public-api.ts', 'utf8')).toContain('materializeKaqEvidenceWriteback');
    expect(readFileSync('src/features/arena/evidence-writeback.ts', 'utf8')).toContain('@/features/assessment/public-api');
    expect(readFileSync('src/app/api/learning-paths/plan/route.ts', 'utf8')).toContain(
      '@/features/personalization/path-planning/control-correction-path-rounds',
    );
    expect(readFileSync('src/app/api/student/competency-snapshot/route.ts', 'utf8')).toContain(
      '@/features/personalization/diagnosis/role-based-learning-diagnosis',
    );
  });
});
