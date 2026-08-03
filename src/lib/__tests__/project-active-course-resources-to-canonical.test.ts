/**
 * Active course resources → Canonical migration (#1268).
 *
 * Tests run against shipped teaching-projection functions (not stubs).
 */

import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  ACTIVE_INVENTORY_IDENTITY_REGISTRY_PATH,
  ActiveCourseInventoryError,
  assertInventoryBytesMatchAuthoringRevision,
  assertNoLegacyGraphIdsInAuthoring,
  assertPackageIsolation,
  buildActiveCourseInventory,
  buildPackageAuthoringFromMigration,
  buildTeachingProjection,
  collectInventoryBindingPaths,
  computeMappingInputDigest,
  createAuthorSemanticDecision,
  isLegacyLocalGraphNodeId,
  isPackageInActiveInventory,
  loadLegacyCrosswalk,
  mapActiveCourseResource,
  mapActiveCourseResources,
  normalizeExactLabel,
  parseLegacyCrosswalkDocument,
  readLegacyCrosswalkIds,
  resolveIdentityDenominatorPaths,
  runActiveCourseMigration,
  selectAuthorDecision,
  upsertAuthorDecision,
  type ActiveCourseInventoryResource,
  type AuthorSemanticDecision,
  type MappingContext,
  type MigrationStatusRecord,
} from '../teaching-projection';

const repoRoot = path.resolve(__dirname, '../../..');
const fixturePath = path.join(
  repoRoot,
  'course-content/authoring/knowledge/teaching-projection/fixtures/migration/mapping-cases.json',
);

function gitHead(cwd: string = repoRoot): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd,
    encoding: 'utf8',
  }).trim();
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function createTempInventoryRepo(files: Record<string, string>): {
  dir: string;
  head: string;
} {
  const dir = mkdtempSync(path.join(tmpdir(), 'act-active-inventory-'));
  tempDirs.push(dir);
  for (const [relative, content] of Object.entries(files)) {
    const absolute = path.join(dir, relative);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, content, 'utf8');
  }
  git(dir, ['init']);
  git(dir, ['config', 'user.email', 'inventory-test@example.com']);
  git(dir, ['config', 'user.name', 'inventory-test']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'init inventory fixture']);
  const head = git(dir, ['rev-parse', 'HEAD']);
  expect(head).toMatch(/^[0-9a-f]{40}$/u);
  return { dir, head };
}

function loadFixture() {
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    authorityNodes: Array<{
      canonicalId: string;
      lifecycleStatus: string;
      successorCanonicalId?: string | null;
    }>;
    crosswalk: Array<{
      legacyId: string;
      canonicalId: string;
      role?: string | null;
      sourceEvidence?: string;
      stale?: boolean;
    }>;
    cards: Array<{
      cardId: string;
      canonicalId: string;
      active: boolean;
      legacyNodeId?: string;
      title?: string;
    }>;
    authorityLabels: Array<{
      canonicalId: string;
      labels: string[];
      lifecycleStatus?: string;
    }>;
  };
}

function baseResource(
  overrides: Partial<ActiveCourseInventoryResource> &
    Pick<ActiveCourseInventoryResource, 'resourceId' | 'resourceType'>,
): ActiveCourseInventoryResource {
  return {
    lessonKey: 'fixture-lesson',
    scopeId: 'course-package:fixture-a',
    packageId: 'fixture-a',
    projectionMode: 'REQUIRED',
    title: 'fixture',
    sourcePath: 'fixtures/a.json',
    sourceDigest: 'd'.repeat(64),
    legacyIds: [],
    labels: [],
    cardIds: [],
    knowledgeRefs: [],
    manifestKnowledge: null,
    ...overrides,
  };
}

function mappingContextFromFixture(
  overrides: Partial<MappingContext> = {},
): MappingContext {
  const fixture = loadFixture();
  const authorityCanonicalIds = new Set(
    fixture.authorityNodes
      .filter((n) => String(n.lifecycleStatus).toLowerCase() === 'active')
      .map((n) => n.canonicalId),
  );
  return {
    crosswalk: fixture.crosswalk.map((e) => ({
      legacyId: e.legacyId,
      canonicalId: e.canonicalId,
      role: (e.role as MappingContext['crosswalk'][number]['role']) ?? null,
      sourceEvidence: e.sourceEvidence ?? null,
      stale: e.stale === true,
    })),
    cards: fixture.cards,
    authorityLabels: fixture.authorityLabels,
    authorityCanonicalIds,
    authorDecisions: [],
    defaultRole: 'PRACTICES',
    ...overrides,
  };
}

describe('project-active-course-resources-to-canonical (#1268)', () => {
  describe('1. Active inventory', () => {
    it('enumerates published interactive packages with digests for lessons/handouts/steps', () => {
      const authoringRevision = gitHead();
      const inventory = buildActiveCourseInventory({
        repoRoot,
        authoringRevision,
        capturedAt: '2026-08-04T00:00:00.000Z',
      });

      expect(inventory.contract).toBe('act-active-course-inventory/v1');
      expect(inventory.authoringRevision).toBe(authoringRevision);
      expect(inventory.packageCount).toBeGreaterThan(10);
      expect(inventory.resourceCount).toBeGreaterThan(20);
      expect(inventory.inventoryDigest).toMatch(/^[a-f0-9]{64}$/u);

      const unit11 = inventory.packages.find((p) => p.packageId === '1-1');
      expect(unit11).toBeDefined();
      expect(unit11!.runtimeLessonDir).toBe('1-1');
      expect(unit11!.resources.some((r) => r.resourceType === 'lesson')).toBe(true);
      expect(unit11!.resources.some((r) => r.resourceType === 'step')).toBe(true);
      expect(
        unit11!.resources.every(
          (r) => r.sourceDigest.length === 64 && r.sourcePath.length > 0,
        ),
      ).toBe(true);

      // Historical/unreachable packages are not silently claimed complete.
      expect(isPackageInActiveInventory(inventory, 'retired-historical-course')).toBe(
        false,
      );
    });

    it('is deterministic for identical revision + sources', () => {
      const authoringRevision = gitHead();
      const a = buildActiveCourseInventory({
        repoRoot,
        authoringRevision,
      });
      const b = buildActiveCourseInventory({
        repoRoot,
        authoringRevision,
      });
      expect(a.inventoryDigest).toBe(b.inventoryDigest);
      expect(a.packageCount).toBe(b.packageCount);
    });

    it('fails closed when interactive-manifest.json exists but is invalid JSON', () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'act-inventory-bad-manifest-'));
      tempDirs.push(dir);
      const lessonDir = path.join(
        dir,
        'course-content/runtime/lessons/bad-pkg',
      );
      mkdirSync(lessonDir, { recursive: true });
      writeFileSync(
        path.join(lessonDir, 'lesson.json'),
        JSON.stringify({ title: 'Bad package' }),
        'utf8',
      );
      writeFileSync(
        path.join(lessonDir, 'interactive-manifest.json'),
        '{ not-valid-json',
        'utf8',
      );

      expect(() =>
        buildActiveCourseInventory({
          repoRoot: dir,
          authoringRevision: 'a'.repeat(40),
          allowWorkingTreeBytes: true,
          packages: [
            {
              packageId: 'bad-pkg',
              runtimeLessonDir: 'bad-pkg',
              lessonKey: 'bad-pkg',
            },
          ],
        }),
      ).toThrow(ActiveCourseInventoryError);

      try {
        buildActiveCourseInventory({
          repoRoot: dir,
          authoringRevision: 'a'.repeat(40),
          allowWorkingTreeBytes: true,
          packages: [
            {
              packageId: 'bad-pkg',
              runtimeLessonDir: 'bad-pkg',
              lessonKey: 'bad-pkg',
            },
          ],
        });
        expect.unreachable('expected inventory build to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ActiveCourseInventoryError);
        expect((error as ActiveCourseInventoryError).code).toBe('json-parse-failed');
        expect((error as Error).message).toMatch(/interactive-manifest\.json/i);
      }
    });

    it('reads per-step projectionMode and knowledgeRefs into inventory resources', () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'act-inventory-step-fields-'));
      tempDirs.push(dir);
      const lessonDir = path.join(
        dir,
        'course-content/runtime/lessons/step-fields',
      );
      mkdirSync(lessonDir, { recursive: true });
      writeFileSync(
        path.join(lessonDir, 'lesson.json'),
        JSON.stringify({ title: 'Step fields package' }),
        'utf8',
      );
      writeFileSync(
        path.join(lessonDir, 'interactive-manifest.json'),
        JSON.stringify({
          steps: {
            'step-none': {
              title: 'Explicit none',
              projectionMode: 'NONE',
            },
            'step-bound': {
              title: 'Manifest refs',
              projectionMode: 'REQUIRED',
              knowledgeRefs: [
                {
                  canonicalId: 'ctc:exact-stability',
                  role: 'PRACTICES',
                  primary: true,
                  rationale: 'step-level knowledgeRefs',
                },
              ],
            },
            'step-default': {
              title: 'Default mode',
            },
          },
        }),
        'utf8',
      );

      const inventory = buildActiveCourseInventory({
        repoRoot: dir,
        authoringRevision: 'b'.repeat(40),
        allowWorkingTreeBytes: true,
        packages: [
          {
            packageId: 'step-fields',
            runtimeLessonDir: 'step-fields',
            lessonKey: 'step-fields',
            defaultStepMode: 'REQUIRED',
          },
        ],
      });

      const steps = inventory.packages[0]!.resources.filter(
        (r) => r.resourceType === 'step',
      );
      const byId = Object.fromEntries(steps.map((s) => [s.stepId, s]));

      expect(byId['step-none']?.projectionMode).toBe('NONE');
      expect(byId['step-none']?.knowledgeRefs).toEqual([]);

      expect(byId['step-bound']?.projectionMode).toBe('REQUIRED');
      expect(byId['step-bound']?.knowledgeRefs).toEqual([
        expect.objectContaining({
          canonicalId: 'ctc:exact-stability',
          role: 'PRACTICES',
          primary: true,
        }),
      ]);
      expect(byId['step-bound']?.manifestKnowledge?.canonicalIds).toEqual([
        'ctc:exact-stability',
      ]);

      // Absent step projectionMode falls back to package default (REQUIRED).
      expect(byId['step-default']?.projectionMode).toBe('REQUIRED');
    });

    it('rejects inventory when authoringRevision does not match inventoried bytes', () => {
      const lessonPath =
        'course-content/runtime/lessons/rev-bind/interactive-manifest.json';
      const { dir, head } = createTempInventoryRepo({
        [lessonPath]: JSON.stringify({
          steps: { 'step-01': { title: 'Bound step' } },
        }),
        'course-content/runtime/lessons/rev-bind/lesson.json': JSON.stringify({
          title: 'Revision bind',
        }),
      });

      // Clean HEAD binding succeeds.
      const clean = buildActiveCourseInventory({
        repoRoot: dir,
        authoringRevision: head,
        packages: [
          {
            packageId: 'rev-bind',
            runtimeLessonDir: 'rev-bind',
            lessonKey: 'rev-bind',
          },
        ],
      });
      expect(clean.packageCount).toBe(1);

      // Dirty inventoried path → fail closed (mixed capture).
      writeFileSync(
        path.join(dir, lessonPath),
        JSON.stringify({
          steps: { 'step-01': { title: 'Dirty step' } },
        }),
        'utf8',
      );
      expect(() =>
        buildActiveCourseInventory({
          repoRoot: dir,
          authoringRevision: head,
          packages: [
            {
              packageId: 'rev-bind',
              runtimeLessonDir: 'rev-bind',
              lessonKey: 'rev-bind',
            },
          ],
        }),
      ).toThrow(/dirty|mixed capture|authoringRevision/i);

      // Forged revision fails closed even when allowWorkingTreeBytes is off.
      expect(() =>
        assertInventoryBytesMatchAuthoringRevision({
          repoRoot: dir,
          authoringRevision: 'c'.repeat(40),
          sourcePaths: [lessonPath],
        }),
      ).toThrow(ActiveCourseInventoryError);
    });

    it('resolves identity denominator paths from registry + @/lib imports', () => {
      const paths = resolveIdentityDenominatorPaths(repoRoot);
      expect(paths).toContain(ACTIVE_INVENTORY_IDENTITY_REGISTRY_PATH);
      expect(paths).toContain('src/lib/cruise-course.ts');
      expect(paths).toContain('src/lib/unit-1-1-course.ts');
      expect(paths.length).toBeGreaterThan(10);
      // collectInventoryBindingPaths merges package content + identity sources.
      const bound = collectInventoryBindingPaths({
        repoRoot,
        packageSourcePaths: [
          'course-content/runtime/lessons/1-1/interactive-manifest.json',
        ],
        includeIdentityDenominator: true,
      });
      expect(bound).toContain(ACTIVE_INVENTORY_IDENTITY_REGISTRY_PATH);
      expect(bound).toContain(
        'course-content/runtime/lessons/1-1/interactive-manifest.json',
      );
      expect(
        collectInventoryBindingPaths({
          repoRoot,
          packageSourcePaths: ['course-content/runtime/lessons/1-1/lesson.json'],
          includeIdentityDenominator: false,
        }),
      ).toEqual(['course-content/runtime/lessons/1-1/lesson.json']);
    });

    it('fails closed when identity registry is dirty even if remaining package bytes match HEAD', () => {
      // Simulates packagesFromRegistry after a dirty edit drops a course: only
      // keep-me remains in the package list, keep-me content still matches HEAD,
      // but the registry file no longer matches authoringRevision.
      const registryPath = ACTIVE_INVENTORY_IDENTITY_REGISTRY_PATH;
      const keepLesson =
        'course-content/runtime/lessons/keep-me/interactive-manifest.json';
      const keepLessonJson =
        'course-content/runtime/lessons/keep-me/lesson.json';
      const dropLesson =
        'course-content/runtime/lessons/drop-me/interactive-manifest.json';
      const dropLessonJson =
        'course-content/runtime/lessons/drop-me/lesson.json';
      const registryAtHead = [
        "export const INTERACTIVE_LESSON_IDENTITY_REGISTRY = [",
        "  { canonicalId: 'keep-me', routeSegments: ['keep-me'], runtimeLessonDir: 'keep-me', lessonKeys: [], presetKeys: [], planTitleAliases: [], evidenceAliases: [] },",
        "  { canonicalId: 'drop-me', routeSegments: ['drop-me'], runtimeLessonDir: 'drop-me', lessonKeys: [], presetKeys: [], planTitleAliases: [], evidenceAliases: [] },",
        '];',
        '',
      ].join('\n');
      const dirtyRegistry = [
        "export const INTERACTIVE_LESSON_IDENTITY_REGISTRY = [",
        "  { canonicalId: 'keep-me', routeSegments: ['keep-me'], runtimeLessonDir: 'keep-me', lessonKeys: [], presetKeys: [], planTitleAliases: [], evidenceAliases: [] },",
        '];',
        '',
      ].join('\n');

      const { dir, head } = createTempInventoryRepo({
        [registryPath]: registryAtHead,
        [keepLesson]: JSON.stringify({
          steps: { 'step-01': { title: 'Keep' } },
        }),
        [keepLessonJson]: JSON.stringify({ title: 'Keep me' }),
        [dropLesson]: JSON.stringify({
          steps: { 'step-01': { title: 'Drop' } },
        }),
        [dropLessonJson]: JSON.stringify({ title: 'Drop me' }),
      });

      // Clean binding with both packages succeeds and includes identity path.
      const clean = buildActiveCourseInventory({
        repoRoot: dir,
        authoringRevision: head,
        includeIdentityDenominator: true,
        packages: [
          {
            packageId: 'keep-me',
            runtimeLessonDir: 'keep-me',
            lessonKey: 'keep-me',
          },
          {
            packageId: 'drop-me',
            runtimeLessonDir: 'drop-me',
            lessonKey: 'drop-me',
          },
        ],
      });
      expect(clean.packageCount).toBe(2);

      // Dirty registry drops drop-me from the denominator while keep-me bytes
      // still match HEAD — without identity binding this would silently pass.
      writeFileSync(path.join(dir, registryPath), dirtyRegistry, 'utf8');
      expect(() =>
        buildActiveCourseInventory({
          repoRoot: dir,
          authoringRevision: head,
          includeIdentityDenominator: true,
          packages: [
            {
              packageId: 'keep-me',
              runtimeLessonDir: 'keep-me',
              lessonKey: 'keep-me',
            },
          ],
        }),
      ).toThrow(/dirty|mixed capture|authoringRevision|interactive-lesson-identity/i);

      // Without identity denominator binding, the incomplete package list would
      // still bind to HEAD (documents why includeIdentityDenominator is required).
      const incompleteWithoutIdentity = buildActiveCourseInventory({
        repoRoot: dir,
        authoringRevision: head,
        includeIdentityDenominator: false,
        packages: [
          {
            packageId: 'keep-me',
            runtimeLessonDir: 'keep-me',
            lessonKey: 'keep-me',
          },
        ],
      });
      expect(incompleteWithoutIdentity.packageCount).toBe(1);
      expect(
        incompleteWithoutIdentity.packages.map((p) => p.packageId),
      ).toEqual(['keep-me']);
    });

    it('binds identity denominator by default when packages come from the registry', () => {
      const authoringRevision = gitHead();
      // Registry-driven inventory (no packages override) must include identity
      // paths in revision binding. On a clean tree this succeeds; the identity
      // path set is non-empty and includes the registry module.
      const identityPaths = resolveIdentityDenominatorPaths(repoRoot);
      expect(identityPaths).toContain(ACTIVE_INVENTORY_IDENTITY_REGISTRY_PATH);

      const inventory = buildActiveCourseInventory({
        repoRoot,
        authoringRevision,
      });
      expect(inventory.packageCount).toBeGreaterThan(0);
      expect(inventory.authoringRevision).toBe(authoringRevision);
    });

    it('fails closed when a declared runtime lesson directory is missing under revision binding', () => {
      // Registry still lists drop-rt, but the whole runtime dir is deleted from
      // the worktree. Previously skipMissingRuntime=true dropped the package
      // before sourcePaths collection, so git checks never saw the hole and the
      // incomplete inventory still bound authoringRevision.
      const keepLesson =
        'course-content/runtime/lessons/keep-rt/interactive-manifest.json';
      const keepLessonJson =
        'course-content/runtime/lessons/keep-rt/lesson.json';
      const dropLesson =
        'course-content/runtime/lessons/drop-rt/interactive-manifest.json';
      const dropLessonJson =
        'course-content/runtime/lessons/drop-rt/lesson.json';

      const { dir, head } = createTempInventoryRepo({
        [keepLesson]: JSON.stringify({
          steps: { 'step-01': { title: 'Keep' } },
        }),
        [keepLessonJson]: JSON.stringify({ title: 'Keep runtime' }),
        [dropLesson]: JSON.stringify({
          steps: { 'step-01': { title: 'Drop' } },
        }),
        [dropLessonJson]: JSON.stringify({ title: 'Drop runtime' }),
      });

      const packages = [
        {
          packageId: 'keep-rt',
          runtimeLessonDir: 'keep-rt',
          lessonKey: 'keep-rt',
        },
        {
          packageId: 'drop-rt',
          runtimeLessonDir: 'drop-rt',
          lessonKey: 'drop-rt',
        },
      ] as const;

      const clean = buildActiveCourseInventory({
        repoRoot: dir,
        authoringRevision: head,
        packages,
      });
      expect(clean.packageCount).toBe(2);

      rmSync(path.join(dir, 'course-content/runtime/lessons/drop-rt'), {
        recursive: true,
        force: true,
      });

      // Even an explicit skipMissingRuntime=true must not bypass fail-closed
      // for revision-bound inventory.
      expect(() =>
        buildActiveCourseInventory({
          repoRoot: dir,
          authoringRevision: head,
          packages,
          skipMissingRuntime: true,
        }),
      ).toThrow(ActiveCourseInventoryError);

      try {
        buildActiveCourseInventory({
          repoRoot: dir,
          authoringRevision: head,
          packages,
          skipMissingRuntime: true,
        });
        expect.unreachable(
          'expected missing declared runtime to fail closed under revision binding',
        );
      } catch (error) {
        expect(error).toBeInstanceOf(ActiveCourseInventoryError);
        expect((error as ActiveCourseInventoryError).code).toBe(
          'runtime-missing',
        );
        expect((error as Error).message).toMatch(/drop-rt/);
      }

      // Fixture builds with allowWorkingTreeBytes may still skip missing runtimes.
      const skipped = buildActiveCourseInventory({
        repoRoot: dir,
        authoringRevision: head,
        allowWorkingTreeBytes: true,
        packages,
      });
      expect(skipped.packageCount).toBe(1);
      expect(skipped.packages.map((p) => p.packageId)).toEqual(['keep-rt']);
    });
  });

  describe('2. Deterministic mapping fixtures', () => {
    it('exact one-to-one crosswalk → BOUND with CROSSWALK method', () => {
      const resource = baseResource({
        resourceId: 'act:step:fixture-lesson:exact',
        resourceType: 'step',
        stepId: 'exact',
        legacyIds: ['稳定性_1_1'],
      });
      const record = mapActiveCourseResource(resource, mappingContextFromFixture());
      expect(record.status).toBe('BOUND');
      expect(record.mappingMethod).toBe('CROSSWALK');
      expect(record.bindings).toEqual([
        expect.objectContaining({
          canonicalId: 'ctc:exact-stability',
          role: 'PRACTICES',
        }),
      ]);
      expect(record.evidence.length).toBeGreaterThan(0);
    });

    it('split (one legacy → many canonical) → REVIEW_REQUIRED and cannot publish', () => {
      const resource = baseResource({
        resourceId: 'act:step:fixture-lesson:split',
        resourceType: 'step',
        stepId: 'split',
        legacyIds: ['Bode图_1_1'],
      });
      const record = mapActiveCourseResource(resource, mappingContextFromFixture());
      expect(record.status).toBe('REVIEW_REQUIRED');
      expect(record.mappingMethod).toBe('CROSSWALK');
      expect(record.bindings).toEqual([]);
      expect(record.rationale).toMatch(/multi-canonical|split/i);
    });

    it('merge (many legacy → one canonical) → REVIEW_REQUIRED', () => {
      const resource = baseResource({
        resourceId: 'act:lesson:fixture-lesson',
        resourceType: 'lesson',
        legacyIds: ['开环控制_1_1', '闭环控制_1_1'],
        projectionMode: 'OPTIONAL',
      });
      const record = mapActiveCourseResource(resource, mappingContextFromFixture());
      expect(record.status).toBe('REVIEW_REQUIRED');
      expect(record.rationale).toMatch(/merge/i);
      expect(record.bindings).toEqual([]);
    });

    it('duplicate active cards for same legacy → REVIEW_REQUIRED', () => {
      const resource = baseResource({
        resourceId: 'act:step:fixture-lesson:dup-card',
        resourceType: 'step',
        stepId: 'dup-card',
        legacyIds: ['反馈_fixture'],
        cardIds: ['card-feedback', 'card-feedback-dup'],
      });
      // Clear crosswalk so CARD method is reached with two active cards.
      const ctx = mappingContextFromFixture({ crosswalk: [] });
      const record = mapActiveCourseResource(resource, ctx);
      expect(record.status).toBe('REVIEW_REQUIRED');
      expect(record.mappingMethod).toBe('CARD');
    });

    it('fuzzy-only / no deterministic signal → REVIEW_REQUIRED for REQUIRED', () => {
      const resource = baseResource({
        resourceId: 'act:step:fixture-lesson:fuzzy',
        resourceType: 'step',
        stepId: 'fuzzy',
        labels: ['something vaguely like stability maybe'],
        legacyIds: [],
      });
      const record = mapActiveCourseResource(
        resource,
        mappingContextFromFixture({
          crosswalk: [],
          cards: [],
          authorityLabels: [],
        }),
      );
      expect(record.status).toBe('REVIEW_REQUIRED');
      expect(record.rationale).toMatch(/no-deterministic|fuzzy|unresolved/i);
    });

    it('stale crosswalk target → REVIEW_REQUIRED', () => {
      const resource = baseResource({
        resourceId: 'act:step:fixture-lesson:stale',
        resourceType: 'step',
        stepId: 'stale',
        legacyIds: ['过时节点_9_9'],
      });
      const record = mapActiveCourseResource(resource, mappingContextFromFixture());
      expect(record.status).toBe('REVIEW_REQUIRED');
      expect(record.bindings).toEqual([]);
    });

    it('exact normalized label/alias → BOUND with EXACT_LABEL', () => {
      const resource = baseResource({
        resourceId: 'act:step:fixture-lesson:label',
        resourceType: 'step',
        stepId: 'label',
        labels: ['  Feedback  '],
        legacyIds: [],
      });
      const ctx = mappingContextFromFixture({ crosswalk: [], cards: [] });
      const record = mapActiveCourseResource(resource, ctx);
      expect(normalizeExactLabel('  Feedback  ')).toBe(
        normalizeExactLabel('feedback'),
      );
      expect(record.status).toBe('BOUND');
      expect(record.mappingMethod).toBe('EXACT_LABEL');
      expect(record.bindings[0]?.canonicalId).toBe('ctc:label-feedback');
    });

    it('NONE projectionMode → EXPLICIT_NONE', () => {
      const resource = baseResource({
        resourceId: 'act:handout:fixture-lesson',
        resourceType: 'handout',
        projectionMode: 'NONE',
      });
      const record = mapActiveCourseResource(resource, mappingContextFromFixture());
      expect(record.status).toBe('EXPLICIT_NONE');
      expect(record.mappingMethod).toBe('NONE');
    });

    it('manifest knowledgeRefs → BOUND with MANIFEST method', () => {
      const resource = baseResource({
        resourceId: 'act:step:fixture-lesson:manifest',
        resourceType: 'step',
        stepId: 'manifest',
        knowledgeRefs: [
          {
            canonicalId: 'ctc:exact-bode',
            role: 'EXPLAINS',
            primary: true,
            rationale: 'authoring knowledgeRefs',
          },
        ],
        manifestKnowledge: {
          canonicalIds: ['ctc:exact-bode'],
          roles: ['EXPLAINS'],
          sourcePath: 'fixtures/manifest.json',
        },
      });
      const ctx = mappingContextFromFixture({ crosswalk: [], cards: [] });
      const record = mapActiveCourseResource(resource, ctx);
      expect(record.status).toBe('BOUND');
      expect(record.mappingMethod).toBe('MANIFEST');
    });
  });

  describe('3. Author decisions and package gates', () => {
    it('author decision is reused deterministically when inputDigest matches', () => {
      const resource = baseResource({
        resourceId: 'act:step:fixture-lesson:split',
        resourceType: 'step',
        stepId: 'split',
        legacyIds: ['Bode图_1_1'],
      });
      const ctx = mappingContextFromFixture();
      const unresolved = mapActiveCourseResource(resource, ctx);
      expect(unresolved.status).toBe('REVIEW_REQUIRED');

      const inputDigest = computeMappingInputDigest(resource, unresolved.candidates);
      const decision = createAuthorSemanticDecision({
        resourceId: resource.resourceId,
        scopeId: resource.scopeId,
        inputDigest,
        kind: 'BIND',
        rationale: 'course author picks split-a',
        bindings: [
          {
            canonicalId: 'ctc:split-a',
            role: 'EXPLAINS',
            primary: true,
          },
        ],
      });

      const reused = mapActiveCourseResource(resource, {
        ...ctx,
        authorDecisions: [decision],
      });
      expect(reused.status).toBe('BOUND');
      expect(reused.mappingMethod).toBe('AUTHOR_DECISION');
      expect(reused.authorDecisionId).toBe(decision.decisionId);
      expect(reused.bindings[0]?.canonicalId).toBe('ctc:split-a');

      // Stale decision with wrong digest is ignored.
      const stale: AuthorSemanticDecision = {
        ...decision,
        inputDigest: '0'.repeat(64),
      };
      const ignored = mapActiveCourseResource(resource, {
        ...ctx,
        authorDecisions: [stale],
      });
      expect(ignored.status).toBe('REVIEW_REQUIRED');

      const selected = selectAuthorDecision(
        [decision],
        resource.resourceId,
        resource.scopeId,
        inputDigest,
      );
      expect(selected?.decisionId).toBe(decision.decisionId);

      const upserted = upsertAuthorDecision([], decision);
      expect(upserted).toHaveLength(1);
    });

    it('unresolved REQUIRED blocks only its package; sibling package can stay ready', () => {
      const fixture = loadFixture();
      const authorityNodes = fixture.authorityNodes.map((n) => ({
        canonicalId: n.canonicalId,
        lifecycleStatus: n.lifecycleStatus,
        successorCanonicalId: n.successorCanonicalId ?? null,
      }));
      const ctx = mappingContextFromFixture();

      const blockedPkgResources: ActiveCourseInventoryResource[] = [
        baseResource({
          resourceId: 'act:step:blocked:step-01',
          resourceType: 'step',
          lessonKey: 'blocked',
          stepId: 'step-01',
          packageId: 'blocked',
          scopeId: 'course-package:blocked',
          legacyIds: ['Bode图_1_1'], // split → REVIEW_REQUIRED
          projectionMode: 'REQUIRED',
        }),
        baseResource({
          resourceId: 'act:handout:blocked',
          resourceType: 'handout',
          lessonKey: 'blocked',
          packageId: 'blocked',
          scopeId: 'course-package:blocked',
          projectionMode: 'NONE',
        }),
      ];

      const readyPkgResources: ActiveCourseInventoryResource[] = [
        baseResource({
          resourceId: 'act:step:ready:step-01',
          resourceType: 'step',
          lessonKey: 'ready',
          stepId: 'step-01',
          packageId: 'ready',
          scopeId: 'course-package:ready',
          legacyIds: ['稳定性_1_1'],
          projectionMode: 'REQUIRED',
        }),
        baseResource({
          resourceId: 'act:handout:ready',
          resourceType: 'handout',
          lessonKey: 'ready',
          packageId: 'ready',
          scopeId: 'course-package:ready',
          projectionMode: 'NONE',
        }),
      ];

      const inventory = {
        contract: 'act-active-course-inventory/v1' as const,
        authoringRevision: 'c'.repeat(40),
        capturedAt: null,
        packageCount: 2,
        resourceCount: 4,
        inventoryDigest: 'e'.repeat(64),
        packages: [
          {
            packageId: 'blocked',
            scopeId: 'course-package:blocked',
            routeSegment: 'blocked',
            runtimeLessonDir: 'blocked',
            lessonKey: 'blocked',
            title: 'Blocked package',
            sourcePaths: [],
            resources: blockedPkgResources,
          },
          {
            packageId: 'ready',
            scopeId: 'course-package:ready',
            routeSegment: 'ready',
            runtimeLessonDir: 'ready',
            lessonKey: 'ready',
            title: 'Ready package',
            sourcePaths: [],
            resources: readyPkgResources,
          },
        ],
      };

      const result = runActiveCourseMigration({
        inventory,
        mappingContext: ctx,
        authorityReleaseId: 'ctr:release:fixture',
        authorityNodes,
      });

      expect(result.packageReports).toHaveLength(2);
      const isolation = assertPackageIsolation(result.packageReports, 'blocked');
      expect(isolation.blocked.ready).toBe(false);
      expect(isolation.blocked.unresolvedResourceIds).toContain(
        'act:step:blocked:step-01',
      );
      expect(isolation.othersReady).toBe(true);

      const readyReport = result.packageReports.find((p) => p.packageId === 'ready');
      expect(readyReport?.ready).toBe(true);
      expect(readyReport?.gateStatus).toBe('PUBLISHED');
    });

    it('ambiguous package cannot publish Teaching Projection slice', () => {
      const resource = baseResource({
        resourceId: 'act:step:fixture-lesson:split',
        resourceType: 'step',
        stepId: 'split',
        legacyIds: ['Bode图_1_1'],
        projectionMode: 'REQUIRED',
      });
      const records = mapActiveCourseResources([resource], mappingContextFromFixture());
      expect(records[0]?.status).toBe('REVIEW_REQUIRED');

      const authoring = buildPackageAuthoringFromMigration({
        packageId: 'fixture-a',
        scopeId: resource.scopeId,
        authoringRevision: 'd'.repeat(40),
        authorityReleaseId: 'ctr:release:fixture',
        authorityNodes: loadFixture().authorityNodes,
        records,
        lessonKeyByResourceId: new Map([
          [resource.resourceId, { lessonKey: 'fixture-lesson', stepId: 'split' }],
        ]),
      });
      const artifacts = buildTeachingProjection(authoring);
      expect(artifacts.gate.passed).toBe(false);
      expect(artifacts.gate.status).toBe('REVIEW_REQUIRED');
      expect(artifacts.gate.unboundRequiredResourceIds).toContain(resource.resourceId);
    });

    it('new authoring rejects legacy graph IDs while crosswalk remains readable', () => {
      expect(isLegacyLocalGraphNodeId('反馈_1_1')).toBe(true);
      expect(isLegacyLocalGraphNodeId('比较元件_1_ec1f7070')).toBe(true);
      expect(isLegacyLocalGraphNodeId('ctc:exact-stability')).toBe(false);
      expect(isLegacyLocalGraphNodeId('node-stability')).toBe(false);

      expect(() =>
        assertNoLegacyGraphIdsInAuthoring({
          resources: [],
          bindings: [
            {
              resourceId: 'act:step:fixture-lesson:x',
              canonicalId: '反馈_1_1',
              role: 'PRACTICES',
              scopeId: 'course-package:fixture-a',
            },
          ],
        }),
      ).toThrow(/legacy local graph/i);

      const crosswalkPath = path.join(
        repoRoot,
        'course-content/authoring/knowledge/teaching-projection/legacy-crosswalk.jsonl',
      );
      const doc = loadLegacyCrosswalk(crosswalkPath);
      expect(doc.contract).toBe('act-legacy-id-crosswalk/v1');
      // Fixture crosswalk parse still accepts legacy ids as legacyId column.
      const parsed = parseLegacyCrosswalkDocument(
        JSON.stringify({
          contract: 'act-legacy-id-crosswalk/v1',
          entries: [
            {
              legacyId: '反馈_1_1',
              canonicalId: 'ctc:label-feedback',
              role: 'EXPLAINS',
            },
          ],
        }),
      );
      expect(readLegacyCrosswalkIds(parsed.entries)).toEqual(['反馈_1_1']);
    });

    it('knowledgeRefs on authoring expand into runtime bindings without hand-editing runtime', () => {
      const artifacts = buildTeachingProjection({
        contract: 'act-teaching-projection-authoring/v1',
        scopeId: 'course-package:knowledge-refs',
        authoringRevision: 'f'.repeat(40),
        authorityReleaseId: 'ctr:release:fixture',
        resources: [
          {
            resourceType: 'step',
            lessonKey: 'kr',
            stepId: 's1',
            projectionMode: 'REQUIRED',
            scopeId: 'course-package:knowledge-refs',
            knowledgeRefs: [
              {
                canonicalId: 'ctc:exact-stability',
                role: 'PRACTICES',
                primary: true,
                rationale: 'from knowledgeRefs',
              },
            ],
          },
        ],
        bindings: [],
        authorityNodes: [
          { canonicalId: 'ctc:exact-stability', lifecycleStatus: 'active' },
        ],
      });

      expect(artifacts.bindings).toHaveLength(1);
      expect(artifacts.bindings[0]?.canonicalId).toBe('ctc:exact-stability');
      expect(artifacts.resources[0]?.projectionStatus).toBe('BOUND');
      expect(artifacts.resources[0]?.bindingDigest).toMatch(/^[a-f0-9]{64}$/u);
      expect(artifacts.gate.passed).toBe(true);
    });
  });

  describe('4. Mapping report digests', () => {
    it('emits BOUND / EXPLICIT_NONE / REVIEW_REQUIRED records with evidence and package scope', () => {
      const resources: ActiveCourseInventoryResource[] = [
        baseResource({
          resourceId: 'act:step:fixture-lesson:exact',
          resourceType: 'step',
          stepId: 'exact',
          legacyIds: ['稳定性_1_1'],
        }),
        baseResource({
          resourceId: 'act:handout:fixture-lesson',
          resourceType: 'handout',
          projectionMode: 'NONE',
        }),
        baseResource({
          resourceId: 'act:step:fixture-lesson:split',
          resourceType: 'step',
          stepId: 'split',
          legacyIds: ['Bode图_1_1'],
        }),
      ];
      const records: MigrationStatusRecord[] = mapActiveCourseResources(
        resources,
        mappingContextFromFixture(),
      );
      const byId = new Map(records.map((r) => [r.resourceId, r]));
      expect(byId.get('act:step:fixture-lesson:exact')?.status).toBe('BOUND');
      expect(byId.get('act:handout:fixture-lesson')?.status).toBe('EXPLICIT_NONE');
      expect(byId.get('act:step:fixture-lesson:split')?.status).toBe(
        'REVIEW_REQUIRED',
      );
      for (const record of records) {
        expect(record.scopeId).toBe('course-package:fixture-a');
        expect(record.packageId).toBe('fixture-a');
        expect(Array.isArray(record.evidence)).toBe(true);
      }
    });
  });
});
