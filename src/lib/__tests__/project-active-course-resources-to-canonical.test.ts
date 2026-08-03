/**
 * Active course resources → Canonical migration (#1268).
 *
 * Tests run against shipped teaching-projection functions (not stubs).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertNoLegacyGraphIdsInAuthoring,
  assertPackageIsolation,
  buildActiveCourseInventory,
  buildPackageAuthoringFromMigration,
  buildTeachingProjection,
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
      const inventory = buildActiveCourseInventory({
        repoRoot,
        authoringRevision: 'a'.repeat(40),
        capturedAt: '2026-08-04T00:00:00.000Z',
      });

      expect(inventory.contract).toBe('act-active-course-inventory/v1');
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
      const a = buildActiveCourseInventory({
        repoRoot,
        authoringRevision: 'b'.repeat(40),
      });
      const b = buildActiveCourseInventory({
        repoRoot,
        authoringRevision: 'b'.repeat(40),
      });
      expect(a.inventoryDigest).toBe(b.inventoryDigest);
      expect(a.packageCount).toBe(b.packageCount);
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
