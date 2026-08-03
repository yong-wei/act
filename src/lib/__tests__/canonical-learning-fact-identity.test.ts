import { describe, expect, it } from 'vitest';
import path from 'node:path';

import {
  CANONICAL_LEARNING_FACT_IDENTITY_VERSION,
  LEGACY_UNVERSIONED_REVISION,
  PINNED_LEARNING_FACT_AGGREGATE_RELEASE_ID,
  PINNED_LEARNING_FACT_AGGREGATE_RELEASE_SET_ID,
  PINNED_LEARNING_FACT_COVERAGE_OVERLAY_ID,
  assertFormalLearningFactSelectorUnchanged,
  assertHistoricalFactBytesUnchanged,
  assertRegisteredLearningFactSelector,
  assertShadowCannotActivateLearningFactCutover,
  assertVerifiedLearningFactAdmission,
  detectDualKnowledgeIdentity,
  evaluateCanonicalLearningFactWrite,
  formalLearningFactProductionUsesLegacy,
  LearningFactCapabilityError,
  LearningFactCutoverActivationError,
  listGovernedKnowledgeScopedProducers,
  projectCoexistingLearningFactIdentities,
  readVerifiedLearningFactAdmission,
  resolveHistoricalLearningFactDisplayContext,
  runCanonicalLearningFactShadowValidation,
  runCanonicalLearningFactShadowValidationAsync,
  runLearningFactProducerStaticGate,
  selectLearningFactAuthority,
  tryActivateCanonicalLearningFactCutover,
  validateCanonicalLearningFactWrite,
  writeCanonicalKnowledgeScopedLearningFacts,
  writeKnowledgeScopedLearningFacts,
  writeLegacyKnowledgeScopedLearningFacts,
  type CanonicalLearningFactIdentity,
  type LearningFactWriteRow,
} from '@/lib/canonical-learning-fact-identity';
import {
  mintCanonicalLearningFactWriteCapabilityForTests,
  mintFormalWriteLearningFactAdmissionForTests,
} from '@/lib/canonical-learning-fact-identity/testing';
import { mintVerifiedKaqPinnedContextForTests } from '@/lib/canonical-kaq-binding/testing';
import { resolveActiveKnowledgeRevision } from '@/lib/data-governance/knowledge-truth-revision';
import { listEvidenceTimeline } from '@/lib/data-governance/evidence-timeline';

/** Pinned releaseHash is the authoritative knowledgeRevisionRef for Canonical facts. */
const REVISION = 'a'.repeat(64);
const PROJECTION_ID = 'ctr:projection:teaching-v1';
const releaseHash = REVISION;
const sourceDatasetHash = 'b'.repeat(64);
const coverageSourceHash = 'c'.repeat(64);
const coverageCaptureRevision = 'd'.repeat(40);

function pinned(admitted: readonly string[] = [
  'ctr:object:feedback-loop',
  'ctr:object:transfer-function',
]) {
  return mintVerifiedKaqPinnedContextForTests({
    releaseSetId: PINNED_LEARNING_FACT_AGGREGATE_RELEASE_SET_ID,
    releaseId: PINNED_LEARNING_FACT_AGGREGATE_RELEASE_ID,
    releaseHash,
    sourceDatasetHash,
    deltaReceiptId: 'delta-receipt:accepted-aggregate-v1',
    coverageOverlayId: PINNED_LEARNING_FACT_COVERAGE_OVERLAY_ID,
    coverageOverlayVersion: '1',
    coverageSourceHash,
    coverageCaptureRevision,
    admittedCanonicalIds: [...admitted],
  });
}

function baseRow(overrides: Partial<LearningFactWriteRow> = {}): LearningFactWriteRow {
  return {
    userId: 'user-1',
    factType: 'question',
    startedAt: new Date('2026-07-30T00:00:00.000Z'),
    finishedAt: new Date('2026-07-30T00:00:00.000Z'),
    outcome: 'success',
    score: 1,
    competencyContribution: {},
    sourceEventId: 'arena-official:sub-1',
    contextJson: {},
    ...overrides,
  };
}

function identity(
  overrides: Partial<CanonicalLearningFactIdentity> = {},
): CanonicalLearningFactIdentity {
  return {
    schemaVersion: CANONICAL_LEARNING_FACT_IDENTITY_VERSION,
    identityNamespace: 'CANONICAL',
    canonicalObjectId: 'ctr:object:feedback-loop',
    aggregateReleaseSetId: PINNED_LEARNING_FACT_AGGREGATE_RELEASE_SET_ID,
    aggregateReleaseId: PINNED_LEARNING_FACT_AGGREGATE_RELEASE_ID,
    knowledgeProjectionId: PROJECTION_ID,
    knowledgeRevisionRef: REVISION,
    sourceEventId: 'arena-official:sub-1',
    sourceLogId: null,
    releasePublicationState: 'ACTIVE',
    ...overrides,
  };
}

function formalWriteCapability() {
  return mintCanonicalLearningFactWriteCapabilityForTests({
    pinned: pinned(),
    allowedSourcePrefixes: ['arena-official', 'adaptive-assessment'],
    resourceOrKaqSupportedCanonicalIds: [
      'ctr:object:feedback-loop',
      'ctr:object:transfer-function',
    ],
    projectionId: PROJECTION_ID,
    releasePublicationState: 'ACTIVE',
  });
}

function memorySink() {
  const rows: LearningFactWriteRow[] = [];
  return {
    rows,
    sink: {
      learningFact: {
        createMany: async (args: { data: LearningFactWriteRow[]; skipDuplicates?: boolean }) => {
          rows.push(...args.data);
          return { count: args.data.length };
        },
      },
    },
  };
}

describe('canonical-learning-fact-identity (#1116 remediation)', () => {
  describe('authority selector capability', () => {
    it('mints registered LEGACY/SHADOW selectors and rejects structural clones', () => {
      const selector = selectLearningFactAuthority('FORMAL_PRODUCTION');
      expect(formalLearningFactProductionUsesLegacy(selector)).toBe(true);
      assertRegisteredLearningFactSelector(selector);

      const clone = { ...selector };
      expect(() => assertRegisteredLearningFactSelector(clone)).toThrow(
        LearningFactCapabilityError,
      );

      const shadow = selectLearningFactAuthority('SHADOW_VALIDATION');
      assertRegisteredLearningFactSelector(shadow);
      expect(shadow.authority).toBe('CANONICAL_SHADOW');

      expect(() => selectLearningFactAuthority('CUTOVER_ACTIVATION')).toThrow(
        LearningFactCutoverActivationError,
      );
      expect(() => tryActivateCanonicalLearningFactCutover({
        cutoverReceiptId: 'minted',
        shadowSucceeded: true,
        admissionReady: true,
        identityComplete: true,
      })).toThrow(LearningFactCutoverActivationError);

      assertFormalLearningFactSelectorUnchanged({
        requestedConsumer: 'FORMAL_PRODUCTION',
        selected: selector,
        shadowSucceeded: true,
        admissionReady: true,
      });
      assertShadowCannotActivateLearningFactCutover({
        shadowSucceeded: true,
        cutoverReceiptId: 'minted',
        admissionReady: true,
        identityComplete: true,
      });
    });
  });

  describe('admission / write capability non-forgeability', () => {
    it('rejects plain admission objects and structural clones', () => {
      const cap = formalWriteCapability();
      assertVerifiedLearningFactAdmission(cap.admission);
      const clone = { ...cap.admission };
      expect(() => assertVerifiedLearningFactAdmission(clone)).toThrow(
        LearningFactCapabilityError,
      );

      const forged = {
        admittedCanonicalIds: ['ctr:object:feedback-loop'],
        resourceOrKaqSupportedCanonicalIds: ['ctr:object:feedback-loop'],
        expectedReleaseSetId: PINNED_LEARNING_FACT_AGGREGATE_RELEASE_SET_ID,
        expectedReleaseId: PINNED_LEARNING_FACT_AGGREGATE_RELEASE_ID,
        allowedSourcePrefixes: ['arena-official'],
      };
      expect(() => assertVerifiedLearningFactAdmission(forged)).toThrow(
        LearningFactCapabilityError,
      );
    });

    it('rejects formal Canonical write without registered write capability', async () => {
      const { sink } = memorySink();
      await expect(writeCanonicalKnowledgeScopedLearningFacts(sink, {
        rows: [baseRow()],
        identity: identity(),
        writeCapability: {
          schemaVersion: 'act-canonical-learning-fact-write-capability/v1',
          admission: formalWriteCapability().admission,
          selector: formalWriteCapability().selector,
        } as never,
      })).rejects.toThrow(LearningFactCapabilityError);
    });

    it('rejects injected forged CANONICAL selector on writeKnowledgeScopedLearningFacts', async () => {
      const { sink } = memorySink();
      const forgedSelector = {
        consumer: 'CUTOVER_ACTIVATION',
        authority: 'CANONICAL',
        productionAuthoritative: true,
        canonicalWriterEnabled: true,
      } as never;
      await expect(writeKnowledgeScopedLearningFacts(
        sink,
        { rows: [baseRow()], knowledgeScoped: true, canonicalIdentity: identity() },
        { selector: forgedSelector },
      )).rejects.toThrow(LearningFactCapabilityError);
    });

    it('writes Canonical only with test-only registered write capability', async () => {
      const { sink, rows } = memorySink();
      const writeCapability = formalWriteCapability();
      const result = await writeCanonicalKnowledgeScopedLearningFacts(sink, {
        rows: [baseRow()],
        identity: identity(),
        writeCapability,
      });
      expect(result).toMatchObject({ authority: 'CANONICAL', written: 1, sinkInvoked: true });
      expect(rows[0]).toMatchObject({
        knowledgeIdentityNamespace: 'CANONICAL',
        canonicalObjectId: 'ctr:object:feedback-loop',
      });
    });
  });

  describe('Legacy adapter', () => {
    it('writes Legacy facts without Canonical columns', async () => {
      const { sink, rows } = memorySink();
      const historicalCreatedAt = new Date('2024-01-15T08:30:00.000Z');
      const result = await writeLegacyKnowledgeScopedLearningFacts(
        sink,
        [baseRow({ createdAt: historicalCreatedAt })],
        { knowledgeRevisionRef: 'legacy-rev-1' },
      );
      expect(result.authority).toBe('LEGACY');
      expect(rows[0]).toMatchObject({
        knowledgeIdentityNamespace: 'LEGACY',
        canonicalObjectId: null,
        knowledgeRevisionRef: 'legacy-rev-1',
        createdAt: historicalCreatedAt,
      });
    });

    it('production selector entrypoint uses Legacy adapter', async () => {
      const { sink, rows } = memorySink();
      const selector = selectLearningFactAuthority('FORMAL_PRODUCTION');
      const result = await writeKnowledgeScopedLearningFacts(
        sink,
        { rows: [baseRow()], knowledgeScoped: true },
        { selector, knowledgeRevisionRef: 'legacy-active' },
      );
      expect(result.authority).toBe('LEGACY');
      expect(rows[0]?.canonicalObjectId).toBeNull();
    });
  });

  describe('Canonical fail-closed validation (pure)', () => {
    it('rejects candidate / incomplete / coverage / support / dual-write / revision drift', () => {
      const admission = mintFormalWriteLearningFactAdmissionForTests({
        pinned: pinned(),
        allowedSourcePrefixes: ['arena-official'],
        resourceOrKaqSupportedCanonicalIds: ['ctr:object:feedback-loop'],
        projectionId: PROJECTION_ID,
      });
      const fields = {
        admittedCanonicalIds: admission.admittedCanonicalIds,
        resourceOrKaqSupportedCanonicalIds: admission.resourceOrKaqSupportedCanonicalIds,
        expectedReleaseSetId: admission.expectedReleaseSetId,
        expectedReleaseId: admission.expectedReleaseId,
        expectedProjectionId: admission.expectedProjectionId,
        expectedKnowledgeRevisionRef: admission.expectedKnowledgeRevisionRef,
        allowedSourcePrefixes: admission.allowedSourcePrefixes,
      };

      expect(admission.expectedKnowledgeRevisionRef).toBe(releaseHash);
      expect(admission.expectedProjectionId).toBe(PROJECTION_ID);

      expect(evaluateCanonicalLearningFactWrite({
        rows: [baseRow()],
        identity: identity({ releasePublicationState: 'CANDIDATE' }),
        admission: fields,
      }).rejectionCodes).toContain('candidate-release-set');

      expect(evaluateCanonicalLearningFactWrite({
        rows: [baseRow()],
        identity: identity({ knowledgeRevisionRef: '', knowledgeProjectionId: null }),
        admission: fields,
      }).rejectionCodes).toContain('incomplete-identity');

      // Omit revision/projection to evade comparison → identity-drift.
      expect(evaluateCanonicalLearningFactWrite({
        rows: [baseRow()],
        identity: identity({ knowledgeRevisionRef: 'e'.repeat(64) }),
        admission: fields,
      }).rejectionCodes).toContain('identity-drift');

      expect(evaluateCanonicalLearningFactWrite({
        rows: [baseRow()],
        identity: identity({ knowledgeProjectionId: 'ctr:projection:other' }),
        admission: fields,
      }).rejectionCodes).toContain('identity-drift');

      expect(evaluateCanonicalLearningFactWrite({
        rows: [baseRow()],
        identity: identity({ knowledgeProjectionId: null as unknown as string }),
        admission: fields,
      }).rejectionCodes).toContain('incomplete-identity');

      expect(evaluateCanonicalLearningFactWrite({
        rows: [baseRow()],
        identity: identity({ canonicalObjectId: 'ctr:object:not-covered' }),
        admission: fields,
      }).rejectionCodes).toContain('not-in-course-coverage');

      expect(evaluateCanonicalLearningFactWrite({
        rows: [baseRow()],
        identity: identity(),
        admission: {
          ...fields,
          resourceOrKaqSupportedCanonicalIds: ['ctr:object:transfer-function'],
        },
      }).rejectionCodes).toContain('resource-or-kaq-support-missing');

      expect(detectDualKnowledgeIdentity({
        identity: identity(),
        rows: [baseRow({ contextJson: { knowledgeNodeIds: ['legacy-node-1'] } })],
      }).some((item) => item.includes('legacy-knowledge-node'))).toBe(true);

      expect(() => validateCanonicalLearningFactWrite({
        rows: [baseRow({ contextJson: { knowledgeNodeIds: ['legacy-node-1'] } })],
        identity: identity(),
        admission: fields,
      })).toThrow(/dual-write/i);
    });
  });

  describe('shadow validation', () => {
    it('zero-write even when ready', async () => {
      const writeCapability = formalWriteCapability();
      const report = await runCanonicalLearningFactShadowValidationAsync({
        rows: [baseRow()],
        identity: identity(),
        admission: writeCapability.admission,
      });
      // formal write admission used only for field validation in shadow path;
      // sink still never called.
      expect(report.sinkInvoked).toBe(false);
      expect(report.written).toBe(0);
      expect(report.productionAuthority).toBe('LEGACY');
    });

    it('candidate identity remains zero-write and not ready', () => {
      const writeCapability = formalWriteCapability();
      const report = runCanonicalLearningFactShadowValidation({
        rows: [baseRow()],
        identity: identity({ releasePublicationState: 'CANDIDATE' }),
        admission: writeCapability.admission,
      });
      expect(report.ready).toBe(false);
      expect(report.written).toBe(0);
      expect(report.rejectionCodes).toContain('candidate-release-set');
    });
  });

  describe('serving coexistence via evidence timeline reader', () => {
    it('public timeline items retain each fact namespace/revision without current-graph rewrite', async () => {
      const page = await listEvidenceTimeline({
        userId: 'student-1',
        db: {
          learningFact: {
            findMany: async () => ([
              {
                id: 'legacy-fact',
                factType: 'question',
                outcome: 'success',
                score: 80,
                moduleId: 'm1',
                lessonId: 'l1',
                sessionId: 's1',
                sourceLogId: null,
                sourceEventId: 'event-legacy',
                startedAt: new Date('2026-05-01T00:00:00.000Z'),
                finishedAt: new Date('2026-05-01T00:00:00.000Z'),
                createdAt: new Date('2026-05-01T00:00:01.000Z'),
                timeSpent: 10,
                competencyContribution: {},
                contextJson: {
                  knowledgeNodeIds: ['反馈_1_1'],
                  knowledgeRevisionRef: 'legacy-rev-9',
                },
                knowledgeIdentityNamespace: null,
                canonicalObjectId: null,
                aggregateReleaseSetId: null,
                aggregateReleaseId: null,
                knowledgeProjectionId: null,
                knowledgeRevisionRef: null,
              },
              {
                id: 'canonical-fact',
                factType: 'question',
                outcome: 'success',
                score: 90,
                moduleId: 'm2',
                lessonId: 'l2',
                sessionId: 's2',
                sourceLogId: null,
                sourceEventId: 'arena-official:1',
                startedAt: new Date('2026-07-30T00:00:00.000Z'),
                finishedAt: new Date('2026-07-30T00:00:00.000Z'),
                createdAt: new Date('2026-07-30T00:00:01.000Z'),
                timeSpent: 12,
                competencyContribution: {},
                contextJson: {},
                knowledgeIdentityNamespace: 'CANONICAL',
                canonicalObjectId: 'ctr:object:feedback-loop',
                aggregateReleaseSetId: PINNED_LEARNING_FACT_AGGREGATE_RELEASE_SET_ID,
                aggregateReleaseId: PINNED_LEARNING_FACT_AGGREGATE_RELEASE_ID,
                knowledgeProjectionId: PROJECTION_ID,
                knowledgeRevisionRef: REVISION,
              },
              {
                id: 'unversioned-fact',
                factType: 'question',
                outcome: 'partial',
                score: 40,
                moduleId: null,
                lessonId: null,
                sessionId: null,
                sourceLogId: null,
                sourceEventId: 'event-old',
                startedAt: new Date('2026-01-01T00:00:00.000Z'),
                finishedAt: null,
                createdAt: new Date('2026-01-01T00:00:01.000Z'),
                timeSpent: null,
                competencyContribution: {},
                contextJson: { knowledgeNodeIds: ['old-node'] },
                knowledgeIdentityNamespace: null,
                canonicalObjectId: null,
                aggregateReleaseSetId: null,
                aggregateReleaseId: null,
                knowledgeProjectionId: null,
                knowledgeRevisionRef: null,
              },
            ]),
          },
          studentStepResponse: {
            findMany: async () => [],
          },
        },
      });

      const byId = new Map(page.items.map((item) => [item.id, item]));
      expect(byId.get('legacy-fact')?.knowledgeIdentity).toMatchObject({
        identityNamespace: 'LEGACY',
        knowledgeRevisionRef: 'legacy-rev-9',
        canonicalObjectId: null,
        historicalRevisionBound: true,
        legacyKnowledgeNodeIds: ['反馈_1_1'],
      });
      expect(byId.get('canonical-fact')?.knowledgeIdentity).toMatchObject({
        identityNamespace: 'CANONICAL',
        knowledgeRevisionRef: REVISION,
        canonicalObjectId: 'ctr:object:feedback-loop',
        aggregateReleaseSetId: PINNED_LEARNING_FACT_AGGREGATE_RELEASE_SET_ID,
        knowledgeProjectionId: PROJECTION_ID,
        historicalRevisionBound: true,
      });
      expect(byId.get('unversioned-fact')?.knowledgeIdentity).toMatchObject({
        identityNamespace: 'LEGACY_UNVERSIONED',
        knowledgeRevisionRef: LEGACY_UNVERSIONED_REVISION,
        historicalRevisionBound: true,
      });

      // Isolated helper still coexists with the public reader contract.
      expect(projectCoexistingLearningFactIdentities([
        { id: 'x', knowledgeIdentityNamespace: null },
      ])[0]?.identityNamespace).toBe('LEGACY_UNVERSIONED');
    });
  });

  describe('producer inventory / static gate / worker', () => {
    it('classifies the realtime worker as governed knowledge-scoped', () => {
      const producers = listGovernedKnowledgeScopedProducers();
      expect(producers.some((item) => item.path.endsWith('data-governance-worker.ts'))).toBe(true);
    });

    it('static gate passes closed discovery inventory', () => {
      const root = path.resolve(import.meta.dirname, '../../..');
      const findings = runLearningFactProducerStaticGate(root);
      expect(findings).toEqual([]);
    });

    it('rejects historical writers that use the generic writer instead of Legacy adapter', () => {
      // Inventory requires writeLegacyKnowledgeScopedLearningFacts only.
      const historical = path.resolve(
        import.meta.dirname,
        '../../../scripts/db/backfill-learning-facts-from-event-batches.ts',
      );
      const source = require('node:fs').readFileSync(historical, 'utf8') as string;
      expect(source).toContain('writeLegacyKnowledgeScopedLearningFacts');
      expect(source).not.toContain('writeKnowledgeScopedLearningFacts');
      expect(source).not.toContain("selectLearningFactAuthority('FORMAL_PRODUCTION')");
    });
  });

  describe('knowledge truth revision', () => {
    it('resolves stable pre-cutover Legacy active revision', async () => {
      const revision = await resolveActiveKnowledgeRevision();
      expect(revision.authority).toBe('LEGACY');
      expect(revision.id.length).toBeGreaterThan(0);
    });
  });

  describe('Projection-bound identity and historical crosswalk (#1275)', () => {
    it('accepts Projection-bound facts with complete four-field identity and stamps context aliases', async () => {
      const { sink, rows } = memorySink();
      const writeCapability = formalWriteCapability();
      const result = await writeCanonicalKnowledgeScopedLearningFacts(sink, {
        rows: [baseRow()],
        identity: identity({
          resourceId: 'lesson:feedback-loop',
          resourceRole: 'COVERS',
          resourceScopeId: 'act-control-theory-core',
        }),
        writeCapability,
      });
      expect(result.written).toBe(1);
      expect(rows[0]).toMatchObject({
        knowledgeIdentityNamespace: 'CANONICAL',
        canonicalObjectId: 'ctr:object:feedback-loop',
        knowledgeProjectionId: PROJECTION_ID,
        contextJson: expect.objectContaining({
          canonicalId: 'ctr:object:feedback-loop',
          authorityReleaseId: PINNED_LEARNING_FACT_AGGREGATE_RELEASE_ID,
          projectionId: PROJECTION_ID,
          resourceId: 'lesson:feedback-loop',
          resourceRole: 'COVERS',
        }),
      });
    });

    it('fails closed when Projection-bound writer lacks resource identity', () => {
      // Managed capability path must forward projection/resource gates through
      // readVerifiedLearningFactAdmission — not only hand-built admission fields.
      const writeCapability = mintCanonicalLearningFactWriteCapabilityForTests({
        pinned: pinned([
          'ctr:object:feedback-loop',
          'ctr:object:engineering-only',
          'ctr:object:transfer-function',
        ]),
        allowedSourcePrefixes: ['arena-official'],
        resourceOrKaqSupportedCanonicalIds: [
          'ctr:object:feedback-loop',
          'ctr:object:engineering-only',
          'ctr:object:transfer-function',
        ],
        projectionId: PROJECTION_ID,
        releasePublicationState: 'ACTIVE',
        requireProjectionBoundResourceIdentity: true,
        projectedCanonicalIds: [
          'ctr:object:feedback-loop',
          'ctr:object:transfer-function',
        ],
        accessibleResourceIds: ['lesson:feedback-loop', 'lesson:tf'],
        projectedResourceBindings: [
          {
            canonicalId: 'ctr:object:feedback-loop',
            resourceId: 'lesson:feedback-loop',
          },
          {
            canonicalId: 'ctr:object:transfer-function',
            resourceId: 'lesson:tf',
          },
        ],
      });
      // Simulate formal writer: only fields exposed by the capability view.
      const fields = readVerifiedLearningFactAdmission(writeCapability.admission);

      expect(fields.requireProjectionBoundResourceIdentity).toBe(true);
      expect(fields.projectedCanonicalIds).toEqual([
        'ctr:object:feedback-loop',
        'ctr:object:transfer-function',
      ]);
      expect(fields.accessibleResourceIds).toEqual([
        'lesson:feedback-loop',
        'lesson:tf',
      ]);
      expect(fields.projectedResourceBindings).toEqual([
        {
          canonicalId: 'ctr:object:feedback-loop',
          resourceId: 'lesson:feedback-loop',
        },
        {
          canonicalId: 'ctr:object:transfer-function',
          resourceId: 'lesson:tf',
        },
      ]);

      expect(evaluateCanonicalLearningFactWrite({
        rows: [baseRow()],
        identity: identity({ resourceId: null }),
        admission: fields,
      }).rejectionCodes).toContain('resource-identity-missing');

      expect(evaluateCanonicalLearningFactWrite({
        rows: [baseRow()],
        identity: identity({ resourceId: 'lesson:other' }),
        admission: fields,
      }).rejectionCodes).toContain('resource-or-kaq-support-missing');

      // Cross-pairing an existing resource onto the wrong canonical fails closed.
      expect(evaluateCanonicalLearningFactWrite({
        rows: [baseRow()],
        identity: identity({
          resourceId: 'lesson:tf',
          canonicalObjectId: 'ctr:object:feedback-loop',
        }),
        admission: fields,
      }).rejectionCodes).toContain('resource-or-kaq-support-missing');

      expect(evaluateCanonicalLearningFactWrite({
        rows: [baseRow()],
        identity: identity({
          resourceId: 'lesson:feedback-loop',
          canonicalObjectId: 'ctr:object:engineering-only',
        }),
        admission: fields,
      }).rejectionCodes).toContain('node-not-projected');
    });

    it('rejects Projection-bound formal writes missing resourceId via managed capability', async () => {
      const { sink } = memorySink();
      const writeCapability = mintCanonicalLearningFactWriteCapabilityForTests({
        pinned: pinned(),
        allowedSourcePrefixes: ['arena-official'],
        resourceOrKaqSupportedCanonicalIds: ['ctr:object:feedback-loop'],
        projectionId: PROJECTION_ID,
        releasePublicationState: 'ACTIVE',
        requireProjectionBoundResourceIdentity: true,
        projectedCanonicalIds: ['ctr:object:feedback-loop'],
        accessibleResourceIds: ['lesson:feedback-loop'],
      });

      await expect(
        writeCanonicalKnowledgeScopedLearningFacts(sink, {
          rows: [baseRow()],
          identity: identity({ resourceId: null }),
          writeCapability,
        }),
      ).rejects.toMatchObject({ code: 'resource-identity-missing' });
    });

    it('resolves historical Legacy facts through crosswalk without mutation or backfill', () => {
      const historical = {
        id: 'hist-1',
        knowledgeIdentityNamespace: 'LEGACY' as const,
        knowledgeRevisionRef: 'legacy-rev-pre-cutover',
        canonicalObjectId: null,
        aggregateReleaseSetId: null,
        aggregateReleaseId: null,
        knowledgeProjectionId: null,
        contextJson: {
          knowledgeNodeIds: ['反馈_1_1', 'unknown-legacy'],
          knowledgeRevisionRef: 'legacy-rev-pre-cutover',
        },
      };
      const before = structuredClone(historical);
      const display = resolveHistoricalLearningFactDisplayContext({
        fact: historical,
        crosswalk: [
          {
            legacyId: '反馈_1_1',
            canonicalId: 'ctr:object:feedback-loop',
            role: 'COVERS',
            sourceEvidence: 'crosswalk/feedback.md',
            stale: false,
          },
        ],
      });

      expect(display).toMatchObject({
        factId: 'hist-1',
        identityNamespace: 'LEGACY',
        knowledgeRevisionRef: 'legacy-rev-pre-cutover',
        legacyKnowledgeNodeIds: ['反馈_1_1', 'unknown-legacy'],
        displayCanonicalIds: ['ctr:object:feedback-loop'],
        originalFactUnchanged: true,
        crosswalkApplied: true,
        unresolvedLegacyIds: ['unknown-legacy'],
      });
      expect(display.displayResourceContext).toEqual([
        expect.objectContaining({
          legacyId: '反馈_1_1',
          canonicalId: 'ctr:object:feedback-loop',
          role: 'COVERS',
        }),
      ]);

      // Source fact bytes remain unchanged (no backfill).
      assertHistoricalFactBytesUnchanged({ before, after: historical });
      expect(historical.canonicalObjectId).toBeNull();
      expect(historical.knowledgeIdentityNamespace).toBe('LEGACY');
      expect(historical.knowledgeProjectionId).toBeNull();
    });
  });
});
