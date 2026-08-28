import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createPublishedArtifactAdapter } from '../../resource-index/adapters/published-artifact';
import { createRenderMetadataAdapter } from '../../resource-index/adapters/render-metadata';
import { createResourceNodeAdapter } from '../../resource-index/adapters/resource-node';
import { buildResourceRegistryIndex } from '../../resource-index/builder';
import { RESOURCE_ELIGIBILITY_DIMENSIONS } from '../types';
import { evidenceFromIndexedEntry } from '../adapters';
import {
  observeBrowseEligibility,
  observeFormalBindEligibility,
  observeLaunchEligibility,
  observePathEligibility,
  observeRecommendEligibility,
} from '../callers';
import { evaluateResourceEligibility, hashResourceEligibilityContext } from '../evaluate';
import { observeIndexedResourceEligibility } from '../observe';
import {
  formalDispositionFromTeachingMode,
  mergeEligibilityObservations,
  observationFromConsumerActivation,
  observationFromFormalReleaseQualification,
  observationFromTeachingProjectionConsumer,
} from '../owners';
import type { ResourceEligibilityContext, ResourceEligibilityPurpose } from '../types';

const SHARED = 'rev-eligibility-1';

function metadata(id: string) {
  return {
    id,
    label: id,
    type: 'INTERACTIVE_COMP',
    launchTarget: id,
  };
}

function consumerCombination(captureRevision: string, overrides: {
  authorityReleaseId?: string | null;
  consumerId?: string;
  scopeId?: string | null;
  projectionId?: string | null;
  projectionHash?: string | null;
} = {}) {
  return {
    authorityReleaseId: overrides.authorityReleaseId ?? null,
    authoritySnapshotId: null,
    authoritySnapshotHash: null,
    projectionId: overrides.projectionId ?? null,
    projectionHash: overrides.projectionHash ?? null,
    scopeId: overrides.scopeId ?? null,
    captureRevision,
  };
}

function browseContext(indexIdentity: string, scope: string): ResourceEligibilityContext {
  return {
    role: 'student',
    scope,
    purpose: 'browse',
    resourceIndexIdentity: indexIdentity,
    requestedRevision: 'render-metadata.v1',
    launcherContract: {
      contractClass: 'render-registry',
      contractVersion: 'resource-registry.v1',
    },
  };
}

describe('resource eligibility evaluator', () => {
  it('reports all seven dimensions independently without an aggregate ready flag', () => {
    const index = buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        sharedRevision: SHARED,
        records: [metadata('lesson-eligibility-studio')],
      }),
    ]);
    const entry = index.entries[0];
    const context = browseContext(index.identity, entry.descriptor.identity.scope);
    const snapshot = evaluateResourceEligibility({
      context,
      entry,
      index,
      evidence: evidenceFromIndexedEntry({ index, entry, context }),
    });

    expect(snapshot.contract).toBe('resource-eligibility/v1');
    expect(Object.keys(snapshot.dimensions)).toEqual([...RESOURCE_ELIGIBILITY_DIMENSIONS]);
    expect(snapshot).not.toHaveProperty('ready');
    expect(snapshot.dimensions.retrievalReadiness.status).toBe('available');
    expect(snapshot.dimensions.pathEligibility.status).toBe('unavailable');
    expect(snapshot.dimensions.formalBinding.status).toBe('unavailable');
    expect(snapshot.dimensions.launchAvailability.status).toBe('available');
    expect(snapshot.dimensions.formalReleaseQualification.status).toBe('unavailable');
    expect(snapshot.eligibleForContext).toBe(true);
    expect(snapshot.dimensions.formalBinding.eligibleForContext).toBe(false);
  });

  it('keeps retrieval available when path is not audited', () => {
    const index = buildResourceRegistryIndex([
      createPublishedArtifactAdapter({
        owner: 'runtime-media',
        sharedRevision: SHARED,
        records: [{
          artifactRef: 'runtime-media:1-1/intro',
          title: '导入片',
          type: 'video',
          contentHash: 'abc123',
          sourceVersion: 'runtime-media.v1',
          scope: 'lesson-1-1',
          runtimeResourceRef: 'lessons/1-1/media/1-1-intro-video.mp4',
          launcherRef: 'runtime-media:1-1/intro',
        }],
      }),
    ]);
    const entry = {
      ...index.entries[0],
      descriptor: {
        ...index.entries[0].descriptor,
        foreignRefs: { ...index.entries[0].descriptor.foreignRefs, resourceNodeId: undefined },
      },
    };
    const context: ResourceEligibilityContext = {
      role: 'student',
      scope: 'lesson-1-1',
      purpose: 'path',
      resourceIndexIdentity: index.identity,
      requestedRevision: 'runtime-media.v1',
    };
    const snapshot = evaluateResourceEligibility({
      context,
      entry,
      index,
      evidence: {
        ...evidenceFromIndexedEntry({ index, entry, context }),
        pathAudited: false,
        pathEvidenceIds: [],
      },
    });
    expect(snapshot.dimensions.retrievalReadiness.status).toBe('available');
    expect(snapshot.dimensions.pathEligibility.status).toBe('unavailable');
    expect(snapshot.eligibleForContext).toBe(false);
  });

  it('distinguishes teacher preview from student path', () => {
    const index = buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        sharedRevision: SHARED,
        records: [{
          ...metadata('teacher-preview-card'),
          planningOverride: { teacherPolicy: 'teacher-only', privacyLevel: 'teacher-scoped' },
        }],
      }),
    ]);
    const entry = index.entries[0];
    const teacher: ResourceEligibilityContext = {
      role: 'teacher',
      scope: entry.descriptor.identity.scope,
      purpose: 'browse',
      resourceIndexIdentity: index.identity,
      requestedRevision: entry.descriptor.identity.sourceVersion,
    };
    const student: ResourceEligibilityContext = { ...teacher, role: 'student', purpose: 'path' };
    const teacherSnap = evaluateResourceEligibility({
      context: teacher,
      entry,
      index,
      evidence: evidenceFromIndexedEntry({ index, entry, context: teacher }),
    });
    const studentSnap = evaluateResourceEligibility({
      context: student,
      entry,
      index,
      evidence: evidenceFromIndexedEntry({ index, entry, context: student }),
    });
    expect(teacherSnap.contextHash).not.toBe(studentSnap.contextHash);
    expect(teacherSnap.dimensions.retrievalReadiness.eligibleForContext).toBe(true);
    expect(studentSnap.dimensions.pathEligibility.eligibleForContext).toBe(false);
    expect(studentSnap.dimensions.launchAvailability.status).toBe('blocked');
  });

  it('does not let OPTIONAL or NONE satisfy formal binding or release qualification', () => {
    const index = buildResourceRegistryIndex([
      createResourceNodeAdapter({
        owner: 'resource-node-registry',
        sharedRevision: SHARED,
        records: [{
          nodeId: 'node-optional',
          title: '可选卡片',
          type: 'knowledge_card',
          sourceKind: 'resource-node',
          sourceRef: 'node-optional',
          canonicalIds: ['KAQ-optional'],
          formalBindingIds: ['bind-optional'],
        }],
      }),
    ]);
    const entry = index.entries[0];
    const context: ResourceEligibilityContext = {
      role: 'teacher',
      scope: 'planning',
      purpose: 'formal-bind',
      resourceIndexIdentity: index.identity,
      requestedRevision: entry.descriptor.identity.sourceVersion,
    };
    const snapshot = evaluateResourceEligibility({
      context,
      entry,
      index,
      evidence: evidenceFromIndexedEntry({
        index,
        entry,
        context,
        observation: { formalDisposition: 'OPTIONAL', formalBindingValid: true, releaseQualified: true },
      }),
    });
    expect(snapshot.dimensions.formalBinding.status).toBe('unavailable');
    expect(snapshot.dimensions.formalReleaseQualification.status).toBe('blocked');
    expect(snapshot.eligibleForContext).toBe(false);
  });

  it('fails closed on index identity or revision drift', () => {
    const index = buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        sharedRevision: SHARED,
        records: [metadata('drift-card')],
      }),
    ]);
    const entry = index.entries[0];
    const context = browseContext('not-the-index', entry.descriptor.identity.scope);
    const snapshot = evaluateResourceEligibility({
      context,
      entry,
      index,
      evidence: evidenceFromIndexedEntry({ index, entry, context }),
    });
    expect(snapshot.dimensions.launchAvailability.status).toBe('blocked');
    expect(snapshot.dimensions.pathEligibility.status).toBe('blocked');
    expect(snapshot.dimensions.retrievalReadiness.status).toBe('unavailable');
    expect(JSON.stringify(snapshot)).not.toMatch(/src\/lib|secret/);
  });

  it('degrades optional browse without weakening a required formal package', () => {
    const index = buildResourceRegistryIndex([
      createPublishedArtifactAdapter({
        owner: 'runtime-media',
        sharedRevision: SHARED,
        records: [{
          artifactRef: 'runtime-media:optional-card',
          title: '可选媒体',
          type: 'video',
          contentHash: 'def456',
          sourceVersion: 'runtime-media.v1',
          scope: 'lesson-1-1',
          runtimeResourceRef: 'lessons/1-1/media/optional.mp4',
          required: false,
        }],
      }),
    ]);
    const entry = {
      ...index.entries[0],
      required: false,
      descriptor: {
        ...index.entries[0].descriptor,
        availability: 'degraded' as const,
        availabilityCode: 'optional-media-missing',
      },
    };
    const browse = evaluateResourceEligibility({
      context: {
        role: 'student',
        scope: 'lesson-1-1',
        purpose: 'browse',
        resourceIndexIdentity: index.identity,
        requestedRevision: 'runtime-media.v1',
      },
      entry,
      index,
      evidence: evidenceFromIndexedEntry({
        index,
        entry,
        context: {
          role: 'student',
          scope: 'lesson-1-1',
          purpose: 'browse',
          resourceIndexIdentity: index.identity,
          requestedRevision: 'runtime-media.v1',
        },
      }),
    });
    const formal = evaluateResourceEligibility({
      context: {
        role: 'student',
        scope: 'lesson-1-1',
        purpose: 'formal-bind',
        resourceIndexIdentity: index.identity,
        requestedRevision: 'runtime-media.v1',
      },
      entry: { ...entry, required: true },
      index,
      evidence: {
        ...evidenceFromIndexedEntry({
          index,
          entry: { ...entry, required: true },
          context: {
            role: 'student',
            scope: 'lesson-1-1',
            purpose: 'formal-bind',
            resourceIndexIdentity: index.identity,
            requestedRevision: 'runtime-media.v1',
          },
        }),
        formalDisposition: 'NONE',
      },
    });
    expect(browse.dimensions.retrievalReadiness.status).toBe('degraded');
    expect(browse.eligibleForContext).toBe(true);
    expect(formal.dimensions.formalReleaseQualification.status).toBe('blocked');
    expect(formal.eligibleForContext).toBe(false);
  });

  it('marks engineering-only projection as not applicable without copying that exception to teaching', () => {
    const index = buildResourceRegistryIndex([
      createResourceNodeAdapter({
        owner: 'resource-node-registry',
        sharedRevision: SHARED,
        records: [{
          nodeId: 'eng-node',
          title: '工程图',
          type: 'knowledge_node',
          sourceKind: 'resource-node',
          sourceRef: 'eng-node',
        }],
      }),
    ]);
    const entry = index.entries[0];
    const engineering: ResourceEligibilityContext = {
      role: 'admin',
      scope: 'planning',
      purpose: 'named-consumer',
      resourceIndexIdentity: index.identity,
      requestedRevision: entry.descriptor.identity.sourceVersion,
      engineeringOnly: true,
      consumerId: 'engineering-graph',
    };
    const teaching: ResourceEligibilityContext = {
      ...engineering,
      engineeringOnly: false,
      consumerId: 'teaching-path',
    };
    const engSnap = evaluateResourceEligibility({
      context: engineering,
      entry,
      index,
      evidence: evidenceFromIndexedEntry({
        index,
        entry,
        context: engineering,
        observation: observationFromConsumerActivation({
          consumerId: 'engineering-graph',
          status: 'READY',
          combination: consumerCombination(entry.descriptor.identity.sourceVersion),
        }),
      }),
    });
    const teachSnap = evaluateResourceEligibility({
      context: teaching,
      entry,
      index,
      evidence: evidenceFromIndexedEntry({ index, entry, context: teaching }),
    });
    expect(engSnap.dimensions.teachingProjectionActivation.status).toBe('not-applicable');
    expect(engSnap.eligibleForContext).toBe(true);
    expect(teachSnap.dimensions.teachingProjectionActivation.status).toBe('unavailable');
    expect(teachSnap.dimensions.teachingProjectionActivation.reason).not.toBe(
      'engineering-only-no-projection-required',
    );
  });

  it('changes the context hash when purpose or role changes and never writes selector or learning state', () => {
    const index = buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        sharedRevision: SHARED,
        records: [metadata('hash-card')],
      }),
    ]);
    const left = browseContext(index.identity, index.entries[0].descriptor.identity.scope);
    const right: ResourceEligibilityContext = { ...left, purpose: 'recommend' };
    expect(hashResourceEligibilityContext(left)).not.toBe(hashResourceEligibilityContext(right));
    const source = [
      'evaluate.ts',
      'adapters.ts',
      'observe.ts',
      'callers.ts',
      'owners.ts',
    ].map((file) => readFileSync(path.join(process.cwd(), 'src/features/knowledge/resource-eligibility', file), 'utf8')).join('\n');
    expect(source).not.toMatch(/prisma|LearningFact|createPathNode|selector|mastery|promoteCandidate/i);
  });

  it('keeps recommendation context from ranking or selecting a resource', () => {
    const purposes: ResourceEligibilityPurpose[] = ['recommend'];
    expect(purposes).toEqual(['recommend']);
    const index = buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        sharedRevision: SHARED,
        records: [metadata('recommend-card')],
      }),
    ]);
    const entry = index.entries[0];
    const context: ResourceEligibilityContext = {
      ...browseContext(index.identity, entry.descriptor.identity.scope),
      purpose: 'recommend',
    };
    const snapshot = evaluateResourceEligibility({
      context,
      entry,
      index,
      evidence: evidenceFromIndexedEntry({ index, entry, context }),
    });
    expect(snapshot.eligibleForContext).toBe(true);
    expect(snapshot.dimensions.pathEligibility.eligibleForContext).toBe(false);
    expect(Object.keys(snapshot)).not.toContain('rank');
    expect(Object.keys(snapshot)).not.toContain('selectedPathNodeId');
  });

  it('migrates representative callers without treating retrieval as path or optional as formal', () => {
    const index = buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        sharedRevision: SHARED,
        records: [metadata('caller-studio')],
      }),
      createResourceNodeAdapter({
        owner: 'resource-node-registry',
        sharedRevision: SHARED,
        records: [{
          nodeId: 'caller-node',
          title: '路径节点',
          type: 'knowledge_card',
          sourceKind: 'resource-node',
          sourceRef: 'caller-node',
          canonicalIds: ['KAQ-caller'],
          formalBindingIds: ['bind-caller'],
        }],
      }),
    ]);
    const studio = index.entries.find((entry) => entry.descriptor.identity.sourceRef === 'caller-studio');
    const node = index.entries.find((entry) => entry.descriptor.identity.sourceRef === 'caller-node');
    expect(studio && node).toBeTruthy();
    if (!studio || !node) return;
    const base = {
      role: 'student' as const,
      scope: studio.descriptor.identity.scope,
      resourceIndexIdentity: index.identity,
      requestedRevision: studio.descriptor.identity.sourceVersion,
    };
    const browse = observeBrowseEligibility({ index, entry: studio, context: base });
    const recommend = observeRecommendEligibility({ index, entry: studio, context: base });
    const launch = observeLaunchEligibility({ index, entry: studio, context: base });
    const path = observePathEligibility({
      index,
      entry: node,
      context: {
        role: 'teacher',
        scope: node.descriptor.identity.scope,
        resourceIndexIdentity: index.identity,
        requestedRevision: node.descriptor.identity.sourceVersion,
      },
      observation: { pathAudited: true },
    });
    const formal = observeFormalBindEligibility({
      index,
      entry: node,
      context: {
        role: 'teacher',
        scope: node.descriptor.identity.scope,
        resourceIndexIdentity: index.identity,
        requestedRevision: node.descriptor.identity.sourceVersion,
      },
      observation: {
        pathAudited: true,
        formalBindingValid: true,
        formalDisposition: formalDispositionFromTeachingMode('OPTIONAL'),
        ...observationFromFormalReleaseQualification({
          ready: true,
          scope: {
            packageId: 'pkg-1',
            blocksEngineeringAuthority: false,
            blocksUnrelatedConsumers: false,
            consumerState: 'READY',
          },
        }),
      },
    });
    expect(browse.eligibleForContext).toBe(true);
    expect(recommend.eligibleForContext).toBe(true);
    expect(launch.eligibleForContext).toBe(true);
    expect(path.eligibleForContext).toBe(true);
    expect(observePathEligibility({ index, entry: studio, context: base }).eligibleForContext).toBe(false);
    expect(formal.eligibleForContext).toBe(false);
    expect(formal.dimensions.formalReleaseQualification.status).toBe('blocked');
  });

  it('reads Teaching Projection and consumer activation through existing owner records', () => {
    const index = buildResourceRegistryIndex([
      createResourceNodeAdapter({
        owner: 'resource-node-registry',
        sharedRevision: SHARED,
        records: [{
          nodeId: 'owner-node',
          title: '绑定节点',
          type: 'knowledge_node',
          sourceKind: 'resource-node',
          sourceRef: 'owner-node',
        }],
      }),
    ]);
    const entry = index.entries[0];
    const teaching = observationFromTeachingProjectionConsumer({
      consumerId: 'learning-path',
      requiresProjection: true,
      readiness: 'NOT_PROJECTED',
    });
    const engineering = observationFromTeachingProjectionConsumer({
      consumerId: 'engineering-graph',
      requiresProjection: false,
      readiness: 'READY',
    });
    const consumer = observationFromConsumerActivation({
      consumerId: 'learning-path',
      status: 'PINNED_PREVIOUS',
      combination: consumerCombination(entry.descriptor.identity.sourceVersion),
    });
    const snapshot = observeIndexedResourceEligibility({
      index,
      entry,
      context: {
        role: 'teacher',
        scope: entry.descriptor.identity.scope,
        purpose: 'named-consumer',
        resourceIndexIdentity: index.identity,
        requestedRevision: entry.descriptor.identity.sourceVersion,
        consumerId: 'learning-path',
      },
      observation: mergeEligibilityObservations(teaching, consumer),
    });
    const engineeringSnap = observeIndexedResourceEligibility({
      index,
      entry,
      context: {
        role: 'admin',
        scope: entry.descriptor.identity.scope,
        purpose: 'named-consumer',
        resourceIndexIdentity: index.identity,
        requestedRevision: entry.descriptor.identity.sourceVersion,
        consumerId: 'engineering-graph',
        engineeringOnly: true,
      },
      observation: mergeEligibilityObservations(engineering, observationFromConsumerActivation({
        consumerId: 'engineering-graph',
        status: 'READY',
        combination: consumerCombination(entry.descriptor.identity.sourceVersion),
      })),
    });
    expect(snapshot.dimensions.teachingProjectionActivation.status).toBe('unavailable');
    expect(snapshot.dimensions.consumerActivation.status).toBe('blocked');
    expect(engineeringSnap.dimensions.teachingProjectionActivation.status).toBe('not-applicable');
    expect(engineeringSnap.eligibleForContext).toBe(true);
  });

  it('does not treat a Canonical identity as an atomic formal binding', () => {
    const index = buildResourceRegistryIndex([
      createResourceNodeAdapter({
        owner: 'resource-node-registry',
        sharedRevision: SHARED,
        records: [{
          nodeId: 'canonical-only',
          title: '仅有 Canonical',
          type: 'knowledge_card',
          sourceKind: 'resource-node',
          sourceRef: 'canonical-only',
          canonicalIds: ['KAQ-only'],
        }],
      }),
    ]);
    const entry = index.entries[0];
    const snapshot = observeFormalBindEligibility({
      index,
      entry,
      context: {
        role: 'teacher',
        scope: entry.descriptor.identity.scope,
        resourceIndexIdentity: index.identity,
        requestedRevision: entry.descriptor.identity.sourceVersion,
      },
    });
    expect(snapshot.dimensions.formalBinding.status).toBe('unavailable');
    expect(snapshot.eligibleForContext).toBe(false);
  });

  it('fails closed when a named consumer observation does not match the requested combination', () => {
    const index = buildResourceRegistryIndex([
      createResourceNodeAdapter({
        owner: 'resource-node-registry',
        sharedRevision: SHARED,
        records: [{
          nodeId: 'combo-node',
          title: '组合节点',
          type: 'knowledge_node',
          sourceKind: 'resource-node',
          sourceRef: 'combo-node',
        }],
      }),
    ]);
    const entry = index.entries[0];
    const context = {
      role: 'teacher' as const,
      scope: entry.descriptor.identity.scope,
      resourceIndexIdentity: index.identity,
      requestedRevision: entry.descriptor.identity.sourceVersion,
      consumerId: 'learning-path',
      authorityId: 'authority-current',
    };
    const mismatched = observeIndexedResourceEligibility({
      index,
      entry,
      context: { ...context, purpose: 'named-consumer' },
      observation: observationFromConsumerActivation({
        consumerId: 'engineering-graph',
        status: 'READY',
        combination: consumerCombination(entry.descriptor.identity.sourceVersion, {
          authorityReleaseId: 'authority-previous',
        }),
      }),
    });
    const stale = observeIndexedResourceEligibility({
      index,
      entry,
      context: { ...context, purpose: 'named-consumer' },
      observation: observationFromConsumerActivation({
        consumerId: 'learning-path',
        status: 'READY',
        combination: consumerCombination('old-capture', {
          authorityReleaseId: 'authority-current',
        }),
      }),
    });
    expect(mismatched.eligibleForContext).toBe(false);
    expect(mismatched.dimensions.consumerActivation.status).toBe('blocked');
    expect(stale.eligibleForContext).toBe(false);
    expect(stale.dimensions.consumerActivation.status).toBe('blocked');
    const unscoped = observeIndexedResourceEligibility({
      index,
      entry,
      context: {
        ...context,
        purpose: 'named-consumer',
        courseId: 'course-a',
        projectionId: 'proj-a',
        projectionHash: 'hash-a',
      },
      observation: observationFromConsumerActivation({
        consumerId: 'learning-path',
        status: 'READY',
        combination: consumerCombination(entry.descriptor.identity.sourceVersion, {
          authorityReleaseId: 'authority-current',
        }),
      }),
    });
    expect(unscoped.eligibleForContext).toBe(false);
    expect(unscoped.dimensions.consumerActivation.status).toBe('blocked');
  });

  it('requires owner audit and published formal-binding observations instead of index fields', () => {
    const index = buildResourceRegistryIndex([
      createResourceNodeAdapter({
        owner: 'resource-node-registry',
        sharedRevision: SHARED,
        records: [{
          nodeId: 'unaudited-node',
          title: '未审计节点',
          type: 'knowledge_card',
          sourceKind: 'resource-node',
          sourceRef: 'unaudited-node',
          canonicalIds: ['KAQ-unaudited'],
          formalBindingIds: ['bind-stale'],
        }],
      }),
    ]);
    const entry = index.entries[0];
    const context = {
      role: 'teacher' as const,
      scope: entry.descriptor.identity.scope,
      resourceIndexIdentity: index.identity,
      requestedRevision: entry.descriptor.identity.sourceVersion,
    };
    const path = observePathEligibility({ index, entry, context });
    const formal = observeFormalBindEligibility({ index, entry, context });
    const audited = observePathEligibility({
      index,
      entry,
      context,
      observation: { pathAudited: true },
    });
    const bound = observeFormalBindEligibility({
      index,
      entry,
      context,
      observation: { formalBindingValid: true },
    });
    expect(path.eligibleForContext).toBe(false);
    expect(formal.eligibleForContext).toBe(false);
    expect(audited.eligibleForContext).toBe(true);
    expect(bound.eligibleForContext).toBe(true);
  });
});
