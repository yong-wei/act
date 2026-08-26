import { describe, expect, it } from 'vitest';

import {
  createMeasurementReceipt,
  generateCensusCore,
  isMixedWorktree,
  projectWithReceipts,
  qualifyCensusCore,
  readCaptureIdentity,
  serializeDeterministic,
  snapshotFromFiles,
  type CaptureIdentity,
  type CensusSourceFile,
} from '@/lib/architecture-census';
import { privacyViolation } from '@/lib/architecture-census/privacy';

const identity: CaptureIdentity = {
  sourceCommit: 'a'.repeat(40),
  sourceTree: 'b'.repeat(40),
  commitTime: '2026-08-26T00:00:00Z',
  nodeVersion: 'v22.0.0',
  npmVersion: '11.0.0',
  typescriptVersion: '5.9.0',
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

describe('architecture census', () => {
  it('discovers App Router pages, routes, APIs, and excludes generated files from primary inventories', () => {
    const snapshot = fixture([
      file('src/app/page.tsx', 'export default function Page() { return null }'),
      file('src/app/api/health/route.ts', 'export function GET() {}'),
      file('src/app/(main)/layout.tsx', 'export default function Layout() { return null }'),
      file('.next/server/app/page.js', 'export {}'),
    ]);
    const { core, failures } = generateCensusCore(snapshot);
    qualifyCensusCore(core, failures);
    expect(core.observations.some((row) => row.kind === 'entrypoint' && row.identity === 'src/app/page.tsx')).toBe(true);
    expect(core.observations.some((row) => row.kind === 'api' && row.identity === 'src/app/api/health/route.ts')).toBe(true);
    expect(core.observations.some((row) => row.identity.includes('.next/'))).toBe(false);
  });

  it('keeps production and test import observations distinct and records reverse edges', () => {
    const snapshot = fixture([
      file('src/features/teacher/public.ts', 'export const value = 1;\n'),
      file('src/features/teacher/client.ts', 'import { value } from "./public";\n'),
      file('src/features/teacher/__tests__/client.test.ts', 'import { value } from "../public";\n'),
    ]);
    const { core, failures } = generateCensusCore(snapshot);
    qualifyCensusCore(core, failures);
    const prod = core.observations.find((row) => (
      row.kind === 'dependency-edge' && String(row.attributes.from).includes('client.ts') && !String(row.attributes.from).includes('__tests__')
    ));
    const testEdge = core.observations.find((row) => (
      row.kind === 'dependency-edge' && String(row.attributes.from).includes('__tests__')
    ));
    expect(prod?.attributes.context).toBe('production');
    expect(testEdge?.attributes.context).toBe('test');
    expect(core.observations.some((row) => row.kind === 'reverse-edge')).toBe(true);
  });

  it('records production feature-to-app imports separately from test route imports', () => {
    const snapshot = fixture([
      file('src/features/teacher/prod.ts', 'import { GET } from "@/app/api/health/route";\n'),
      file('src/app/api/health/route.ts', 'export function GET() {}\n'),
      file('src/features/teacher/__tests__/route.test.ts', 'import { GET } from "@/app/api/health/route";\n'),
    ]);
    const { core, failures } = generateCensusCore(snapshot);
    qualifyCensusCore(core, failures);
    const prod = core.observations.find((row) => (
      row.kind === 'dependency-edge'
      && row.attributes.featureToApp === true
      && row.attributes.context === 'production'
    ));
    expect(prod).toBeTruthy();
  });

  it('records cross-domain deep imports without requiring a cycle', () => {
    const snapshot = fixture([
      file('src/features/teacher/service.ts', 'import { x } from "@/features/knowledge/internal";\n'),
      file('src/features/knowledge/internal.ts', 'export const x = 1;\n'),
    ]);
    const { core, failures } = generateCensusCore(snapshot);
    qualifyCensusCore(core, failures);
    const deep = core.observations.find((row) => row.kind === 'deep-import');
    expect(deep).toBeTruthy();
    expect(core.observations.some((row) => row.kind === 'scc')).toBe(false);
  });

  it('emits bidirectional and longer SCCs with constituent edges', () => {
    const snapshot = fixture([
      file('src/features/a/one.ts', 'import { two } from "@/features/b/two";\nexport const one = 1;\n'),
      file('src/features/b/two.ts', 'import { one } from "@/features/a/one";\nexport const two = 2;\n'),
      file('src/features/c/three.ts', 'import { four } from "@/features/d/four";\nexport const three = 3;\n'),
      file('src/features/d/four.ts', 'import { five } from "@/features/e/five";\nexport const four = 4;\n'),
      file('src/features/e/five.ts', 'import { three } from "@/features/c/three";\nexport const five = 5;\n'),
    ]);
    const { core, failures } = generateCensusCore(snapshot);
    qualifyCensusCore(core, failures);
    const sccs = core.observations.filter((row) => row.kind === 'scc');
    expect(sccs.length).toBeGreaterThanOrEqual(2);
    expect(sccs.every((row) => Number(row.attributes.edgeCount) >= 2)).toBe(true);
  });

  it('inventories Prisma models and access sites without promoting them to findings', () => {
    const snapshot = fixture([
      file('src/lib/users.ts', 'import { PrismaClient } from "@prisma/client";\n'),
    ]);
    const { core, failures } = generateCensusCore(snapshot);
    qualifyCensusCore(core, failures);
    expect(core.observations.some((row) => row.kind === 'prisma-model' && row.identity === 'User')).toBe(true);
    const access = core.observations.find((row) => row.kind === 'prisma-access');
    expect(access).toBeTruthy();
    expect(JSON.stringify(core)).not.toContain('architecture-violation');
  });

  it('covers workers, scripts, tests, registries, gates, compatibility and oversized files', () => {
    const big = `${'export const value = 1;\n'.repeat(8000)}`;
    const snapshot = fixture([
      file('scripts/workers/demo.ts', 'export const worker = true;\n'),
      file('src/lib/event-dictionary.ts', 'export const eventType = "COMPLETED";\n'),
      file('src/lib/resource-registry.tsx', 'export const registry = {};\n'),
      file('src/features/teacher/legacy-facade.ts', 'export * from "./service";\n'),
      file('src/features/teacher/service.ts', 'export const service = 1;\n'),
      file('.github/workflows/ci.yml', 'name: CI\n'),
      file('src/lib/huge.ts', big),
      file('openspec/specs/demo/spec.md', '# spec\n'),
    ]);
    const { core, failures } = generateCensusCore(snapshot);
    qualifyCensusCore(core, failures);
    expect(core.observations.some((row) => row.kind === 'worker')).toBe(true);
    expect(core.observations.some((row) => row.kind === 'script')).toBe(true);
    expect(core.observations.some((row) => row.kind === 'registry')).toBe(true);
    expect(core.observations.some((row) => row.kind === 'gate')).toBe(true);
    expect(core.observations.some((row) => row.kind === 'compatibility-surface' && row.notes.includes('deletion-eligibility-unknown'))).toBe(true);
    const center = core.observations.find((row) => row.kind === 'change-center');
    expect(center?.notes).toContain('size-is-not-a-finding');
    expect(core.observations.some((row) => row.kind === 'openspec-capability')).toBe(true);
  });

  it('fails dirty, mixed-worktree, unresolved, privacy and schema-version paths', () => {
    expect(() => qualifyCensusCore(
      generateCensusCore(fixture([], { dirty: true })).core,
      generateCensusCore(fixture([], { dirty: true })).failures,
    )).toThrow(/dirty-worktree/);
    expect(() => qualifyCensusCore(
      generateCensusCore(fixture([], { mixedWorktree: true })).core,
      generateCensusCore(fixture([], { mixedWorktree: true })).failures,
    )).toThrow(/mixed-worktree/);
    expect(() => qualifyCensusCore(
      generateCensusCore(fixture([], { detachedUnresolved: true })).core,
      generateCensusCore(fixture([], { detachedUnresolved: true })).failures,
    )).toThrow(/unresolved-identity/);
    const leaked = fixture([
      file('/Users/YW/secret.ts', 'export const value = 1;\n'),
    ]);
    expect(() => qualifyCensusCore(generateCensusCore(leaked).core, generateCensusCore(leaked).failures)).toThrow(/absolute-path/);
    const { core } = generateCensusCore(fixture([]));
    expect(() => qualifyCensusCore({ ...core, schemaVersion: 'nope' as typeof core.schemaVersion }, [])).toThrow(/unsupported-schema-version/);
  });

  it('regenerates a byte-identical census core and new receipt identities on rerun measurements', () => {
    const snapshot = fixture([
      file('src/app/page.tsx', 'export default function Page() { return null }'),
      file('src/features/teacher/a.ts', 'import { b } from "@/features/knowledge/b";\nexport const a = 1;\n'),
      file('src/features/knowledge/b.ts', 'export const b = 2;\n'),
    ]);
    const first = serializeDeterministic(generateCensusCore(snapshot).core);
    const second = serializeDeterministic(generateCensusCore(snapshot).core);
    expect(first).toBe(second);
    const receiptA = createMeasurementReceipt({
      sourceCommit: identity.sourceCommit,
      sourceTree: identity.sourceTree,
      command: 'tsc --incremental false',
      scope: 'tsconfig.json',
      platform: 'darwin',
      toolVersions: { node: 'v22' },
      cacheMode: 'cold',
      capturedAt: '2026-08-26T00:00:00Z',
      exitStatus: 0,
      aggregate: { durationMs: 10 },
      fingerprints: ['ok'],
    });
    const receiptB = createMeasurementReceipt({
      ...receiptA,
      capturedAt: '2026-08-26T00:00:01Z',
      aggregate: { durationMs: 11 },
    });
    expect(receiptA.receiptId).not.toBe(receiptB.receiptId);
    const projected = projectWithReceipts('corehash', [receiptA]);
    expect(projectWithReceipts('corehash', [receiptA])).toBe(projected);
  });

  it('reconciles dependency-edge denominators', () => {
    const snapshot = fixture([
      file('src/features/teacher/a.ts', 'import { b } from "./b";\n'),
      file('src/features/teacher/b.ts', 'export const b = 1;\n'),
    ]);
    const { core, failures } = generateCensusCore(snapshot);
    qualifyCensusCore(core, failures);
    const manifest = core.manifests.find((item) => item.kind === 'dependency-edge');
    expect(manifest?.totals.unresolved).toBe(0);
    expect(manifest?.totals.duplicate).toBe(0);
    expect(manifest?.totals.discovered).toBe(manifest?.totals.represented);
  });

  it('resolves dotted basenames that are not source extensions', () => {
    const snapshot = fixture([
      file('src/lib/pid-evidence-runtime-manifest.generated.ts', 'export const generated = 1;\n'),
      file('src/lib/actkg-projection.fixture.ts', 'export const fixture = 1;\n'),
      file('src/lib/route.test.ts', 'export const routeTest = 1;\n'),
      file('src/features/teacher/load.ts', [
        'import { generated } from "@/lib/pid-evidence-runtime-manifest.generated";',
        'import { fixture } from "@/lib/actkg-projection.fixture";',
        'import { routeTest } from "@/lib/route.test";',
        '',
      ].join('\n')),
    ]);
    const { core, failures } = generateCensusCore(snapshot);
    qualifyCensusCore(core, failures);
    const targets = core.observations
      .filter((row) => row.kind === 'dependency-edge' && String(row.attributes.from).endsWith('teacher/load.ts'))
      .map((row) => String(row.attributes.to))
      .sort();
    expect(targets).toEqual([
      'src/lib/actkg-projection.fixture.ts',
      'src/lib/pid-evidence-runtime-manifest.generated.ts',
      'src/lib/route.test.ts',
    ]);
  });

  it('ignores import-like strings and records side-effect imports', () => {
    const snapshot = fixture([
      file('src/features/teacher/strings.ts', 'export const example = "from \\"./public\\"";\n'),
      file('src/features/teacher/side-effect.ts', 'import "./public";\n'),
      file('src/features/teacher/public.ts', 'export const value = 1;\n'),
    ]);
    const { core, failures } = generateCensusCore(snapshot);
    qualifyCensusCore(core, failures);
    const fromStrings = core.observations.filter((row) => (
      row.kind === 'dependency-edge' && String(row.attributes.from).endsWith('strings.ts')
    ));
    const sideEffect = core.observations.find((row) => (
      row.kind === 'dependency-edge' && String(row.attributes.from).endsWith('side-effect.ts')
    ));
    expect(fromStrings).toHaveLength(0);
    expect(sideEffect?.attributes.to).toBe('src/features/teacher/public.ts');
  });

  it('deduplicates equivalent import specifiers into one dependency edge', () => {
    const snapshot = fixture([
      file('src/features/teacher/a.ts', 'import { b } from "./b";\nimport { b2 } from "./b.ts";\n'),
      file('src/features/teacher/b.ts', 'export const b = 1;\nexport const b2 = 2;\n'),
    ]);
    const { core, failures } = generateCensusCore(snapshot);
    qualifyCensusCore(core, failures);
    const edges = core.observations.filter((row) => (
      row.kind === 'dependency-edge' && String(row.attributes.from).endsWith('teacher/a.ts')
    ));
    expect(edges).toHaveLength(1);
    expect(core.manifests.find((item) => item.kind === 'dependency-edge')?.totals.duplicate).toBe(0);
  });

  it('keeps ordinary task-1 paths while rejecting token-like secrets', () => {
    expect(privacyViolation('src/lib/task-1-brief.ts')).toBeNull();
    expect(privacyViolation('.superpowers/sdd/task-center-320.png')).toBeNull();
    expect(privacyViolation('src/lib/sk-abcdefghijklmnopqrstuvwxyz.ts')).toBe('secret');
    const ordinary = fixture([file('src/lib/task-1-brief.ts', 'export const value = 1;\n')]);
    expect(() => qualifyCensusCore(generateCensusCore(ordinary).core, generateCensusCore(ordinary).failures)).not.toThrow();
    const secret = fixture([file('src/lib/sk-abcdefghijklmnopqrstuvwxyz.ts', 'export const value = 1;\n')]);
    expect(() => qualifyCensusCore(generateCensusCore(secret).core, generateCensusCore(secret).failures)).toThrow(/secret/);
  });

  it('records conflicting ownership evidence for cross-feature re-exports', () => {
    const snapshot = fixture([
      file('src/features/teacher/legacy-facade.ts', 'export * from "@/features/knowledge/internal";\n'),
      file('src/features/knowledge/internal.ts', 'export const x = 1;\n'),
    ]);
    const { core, failures } = generateCensusCore(snapshot);
    qualifyCensusCore(core, failures);
    const compat = core.observations.find((row) => (
      row.kind === 'compatibility-surface' && row.identity.includes('legacy-facade')
    ));
    expect(compat?.ownership.state).toBe('ambiguous');
    expect(compat?.ownership.conflictingEvidence.join(' ')).toContain('feature:teacher');
    expect(compat?.ownership.conflictingEvidence.join(' ')).toContain('feature:knowledge');
  });

  it('does not treat a linked git worktree as mixed capture', () => {
    expect(isMixedWorktree(process.cwd())).toBe(false);
  });

  it('records the installed TypeScript version instead of unknown or a dependency range', () => {
    const captured = readCaptureIdentity(process.cwd());
    expect(captured.typescriptVersion).toMatch(/^\d+\.\d+\.\d+/u);
    expect(captured.typescriptVersion).not.toBe('unknown');
    expect(captured.typescriptVersion.includes('^')).toBe(false);
  });
});
