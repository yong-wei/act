import { describe, expect, it } from 'vitest';

import { REQUIRED_BASELINE } from '@/lib/architecture-charter';
import {
  generateCurrentHeadDelta,
  projectCurrentHeadFiles,
  qualifyCurrentHeadDelta,
  snapshotFromFiles,
  type CaptureIdentity,
  type CensusSourceFile,
} from '@/lib/architecture-census';

const identity: CaptureIdentity = {
  sourceCommit: 'c'.repeat(40),
  sourceTree: 'd'.repeat(40),
  commitTime: '2026-09-01T00:00:00Z',
  nodeVersion: 'v22.0.0',
  npmVersion: '11.0.0',
  typescriptVersion: '5.8.3',
};

function file(path: string, content: string): CensusSourceFile {
  return { path, content, byteLength: Buffer.byteLength(content) };
}

function fixture(files: CensusSourceFile[], flags?: Parameters<typeof snapshotFromFiles>[2]) {
  return snapshotFromFiles(identity, [
    file('package.json', JSON.stringify({
      scripts: { lint: 'eslint .', typecheck: 'tsc', test: 'vitest', 'verify:commit': 'tsc' },
    })),
    file('prisma/schema.prisma', 'model User {\n  id String @id\n}\n'),
    ...files,
  ], flags);
}

describe('current-head consolidation delta', () => {
  it('fails dirty, mixed, unresolved, predecessor mismatch, and absolute-path evidence', () => {
    expect(() => qualifyCurrentHeadDelta(
      generateCurrentHeadDelta(fixture([], { dirty: true })).pack,
      generateCurrentHeadDelta(fixture([], { dirty: true })).failures,
    )).toThrow(/dirty-worktree/);
    expect(() => qualifyCurrentHeadDelta(
      generateCurrentHeadDelta(fixture([], { mixedWorktree: true })).pack,
      generateCurrentHeadDelta(fixture([], { mixedWorktree: true })).failures,
    )).toThrow(/mixed-worktree/);
    expect(() => qualifyCurrentHeadDelta(
      generateCurrentHeadDelta(fixture([], { detachedUnresolved: true })).pack,
      generateCurrentHeadDelta(fixture([], { detachedUnresolved: true })).failures,
    )).toThrow(/unresolved-identity/);
    expect(() => qualifyCurrentHeadDelta(
      generateCurrentHeadDelta(fixture([]), { ...REQUIRED_BASELINE, sourceCommit: 'e'.repeat(40) }).pack,
      generateCurrentHeadDelta(fixture([]), { ...REQUIRED_BASELINE, sourceCommit: 'e'.repeat(40) }).failures,
    )).toThrow(/predecessor-identity-mismatch/);
    expect(() => qualifyCurrentHeadDelta(
      generateCurrentHeadDelta(fixture([file('/Users/YW/secret.ts', 'export const value = 1;\n')])).pack,
      generateCurrentHeadDelta(fixture([file('/Users/YW/secret.ts', 'export const value = 1;\n')])).failures,
    )).toThrow(/absolute-path/);
  });

  it('binds every record to the current identity, keeps the predecessor, and is byte-identical on rerun', () => {
    const snapshot = fixture([
      file('src/features/assessment/public-api.ts', 'export const api = 1;\n'),
      file('src/features/adaptive-assessment/generated-catalog-runtime.ts', 'import { api } from "@/features/assessment/public-api";\nexport const catalog = api;\n'),
      file('src/features/adaptive/path-workspace-module.tsx', 'export const panel = 1;\n'),
      file('src/features/personalization/path-planning/internal/assemble-plan.ts', `${'export const assemble = 1;\n'.repeat(80)}`),
      file('src/lib/adaptive-path-comparison.ts', 'export const compare = 1;\n'),
      file('src/app/api/assessment/attempt/route.ts', 'import { api } from "@/features/assessment/public-api";\nexport function GET() { return api; }\n'),
    ]);
    const first = generateCurrentHeadDelta(snapshot);
    const second = generateCurrentHeadDelta(snapshot);
    qualifyCurrentHeadDelta(first.pack, first.failures);
    expect(first.files['delta.json']).toBe(second.files['delta.json']);
    expect(projectCurrentHeadFiles(first.pack)['summary.md']).toBe(first.files['summary.md']);
    expect(first.pack.predecessor).toEqual(REQUIRED_BASELINE);
    expect(first.pack.captureTime).toBe(identity.commitTime);
    expect(first.pack.records.every((row) => row.sourceCommit === identity.sourceCommit && row.sourceTree === identity.sourceTree)).toBe(true);
    expect(JSON.stringify(first.files)).not.toContain('/Users/');
  });

  it('keeps competing Assessment/Adaptive owners and does not mark a replacement as deletable', () => {
    const snapshot = fixture([
      file('src/features/assessment/public-api.ts', 'export const api = 1;\n'),
      file('src/features/adaptive-assessment/generated-catalog-runtime.ts', 'export const catalog = 1;\n'),
      file('src/lib/adaptive-path-comparison.ts', 'export const compare = 1;\n'),
    ]);
    const { pack, failures } = generateCurrentHeadDelta(snapshot);
    qualifyCurrentHeadDelta(pack, failures);
    const conflict = pack.records.find((row) => row.category === 'owner-conflict' && row.identity.includes('adaptive-assessment'));
    expect(conflict?.candidateTargetOwners).toContain('assessment');
    expect(conflict?.currentOwnerEvidence).toEqual(expect.arrayContaining(['feature:adaptive-assessment', 'feature:assessment']));
    expect(conflict?.observationVsFinding).not.toBe('finding');
    const retirement = pack.records.find((row) => row.category === 'retirement' && row.identity === 'src/lib/adaptive-path-comparison.ts');
    expect(retirement?.consumerClass).toBe('none-discovered');
    expect(retirement?.deletionCondition).toContain('zero-production-consumers');
    expect(retirement?.observationVsFinding).toBe('unresolved');
    expect(retirement?.notes).toContain('not-deletable-without-zero-production-consumers');
  });

  it('classifies a production importer and treats archived OpenSpec mentions as historical', () => {
    const snapshot = fixture([
      file('src/features/assessment/public-api.ts', 'export const api = 1;\n'),
      file('src/app/api/assessment/attempt/route.ts', 'import { api } from "@/features/assessment/public-api";\nexport function GET() { return api; }\n'),
      file('openspec/changes/archive/2026-08-01-old/proposal.md', 'Touches src/features/assessment/public-api.ts\n'),
      file('openspec/changes/complete-assessment-runtime-owner-migration/proposal.md', 'Migrate src/features/adaptive-assessment/generated-catalog-runtime.ts\n'),
      file('openspec/changes/capture-current-head-consolidation-delta/proposal.md', 'Capture src/features/adaptive-assessment/generated-catalog-runtime.ts\n'),
      file('src/features/adaptive-assessment/generated-catalog-runtime.ts', 'export const catalog = 1;\n'),
    ]);
    const { pack, failures } = generateCurrentHeadDelta(snapshot);
    qualifyCurrentHeadDelta(pack, failures);
    const assessment = pack.records.find((row) => row.category === 'owner-conflict' && row.identity.includes('adaptive-assessment'));
    expect(assessment?.consumers.some((item) => item.path === 'src/app/api/assessment/attempt/route.ts' && item.kind === 'production')).toBe(true);
    expect(assessment?.consumerClass).toBe('production');
    expect(assessment?.consumers.some((item) => item.path.includes('openspec/changes/archive/') && item.kind === 'historical')).toBe(true);
    expect(assessment?.consumers.filter((item) => item.path.includes('openspec/changes/archive/')).every((item) => item.kind === 'historical')).toBe(true);
    const overlap = pack.openspecConflicts.find((item) => item.changeIds.includes('complete-assessment-runtime-owner-migration'));
    expect(overlap?.overlapKind).toBe('predecessor-delta');
    expect(pack.exclusions).toContain('openspec/changes/archive');
  });

  it('records named hotspots as size observations, not defects', () => {
    const snapshot = fixture([
      file('src/features/personalization/path-planning/internal/assemble-plan.ts', `${'export const assemble = 1;\n'.repeat(200)}`),
      file('src/features/personalization/learner-state/internal.ts', `${'export const state = 1;\n'.repeat(80)}`),
      file('src/features/adaptive/path-workspace-module.tsx', 'export const panel = 1;\n'),
    ]);
    const { pack, failures } = generateCurrentHeadDelta(snapshot);
    qualifyCurrentHeadDelta(pack, failures);
    const hotspot = pack.records.find((row) => row.identity.endsWith('assemble-plan.ts'));
    expect(hotspot?.category).toBe('hotspot');
    expect(hotspot?.notes).toContain('size-is-not-a-finding');
    expect(hotspot?.observationVsFinding).toBe('observation');
    expect(Number(hotspot?.attributes.byteLength ?? 0)).toBeGreaterThan(0);
  });

  it('does not invent reverse-edge consumers and classifies export * as re-export', () => {
    const snapshot = fixture([
      file('src/features/personalization/path-planning/internal/prerequisite-planner/index.ts', 'export const planner = 1;\n'),
      file('src/features/personalization/path-planning/public-api.ts', 'export * from "./internal/prerequisite-planner/index";\n'),
    ]);
    const { pack, failures } = generateCurrentHeadDelta(snapshot);
    qualifyCurrentHeadDelta(pack, failures);
    const personalization = pack.records.find((row) => row.category === 'owner-conflict' && row.identity.includes('personalization'));
    const publicApi = pack.records.find((row) => row.identity.endsWith('path-planning/public-api.ts'));
    expect(personalization?.consumers.some((item) => item.path.endsWith('path-planning/public-api.ts') && item.relationship === 're-export')).toBe(true);
    expect(personalization?.consumers.some((item) => item.path.endsWith('prerequisite-planner/index.ts'))).toBe(false);
    expect(publicApi?.consumers.some((item) => item.path.endsWith('prerequisite-planner/index.ts'))).toBe(false);
  });

  it('records owner overlap when two active changes share an owner but not the same src path', () => {
    const snapshot = fixture([
      file('src/features/personalization/path-planning/internal/assemble-plan.ts', 'export const assemble = 1;\n'),
      file('src/features/personalization/learner-state/internal.ts', 'export const state = 1;\n'),
      file('openspec/changes/simplify-personalization-path-assembly/proposal.md', 'Personalization path assembly\n'),
      file('openspec/changes/simplify-personalization-learner-state/proposal.md', 'Personalization learner state\n'),
    ]);
    const { pack, failures } = generateCurrentHeadDelta(snapshot);
    qualifyCurrentHeadDelta(pack, failures);
    const overlap = pack.openspecConflicts.find((item) => (
      item.changeIds.includes('simplify-personalization-path-assembly')
      && item.changeIds.includes('simplify-personalization-learner-state')
    ));
    expect(overlap?.overlapKind).toBe('owner');
    expect(overlap?.paths).toContain('personalization');
    expect(pack.openspecConflicts.length).toBeLessThan(20);
  });

  it('does not treat an oversized in-scope test as a hotspot record', () => {
    const snapshot = fixture([
      file('src/features/personalization/path-planning/__tests__/assemble-plan.test.ts', `${'export const test = 1;\n'.repeat(400)}`),
      file('src/features/personalization/path-planning/internal/assemble-plan.ts', `${'export const assemble = 1;\n'.repeat(80)}`),
    ]);
    const { pack, failures } = generateCurrentHeadDelta(snapshot);
    qualifyCurrentHeadDelta(pack, failures);
    expect(pack.records.some((row) => row.identity.includes('__tests__/assemble-plan.test.ts'))).toBe(false);
    expect(pack.records.some((row) => row.identity.endsWith('assemble-plan.ts') && row.category === 'hotspot')).toBe(true);
  });
});
