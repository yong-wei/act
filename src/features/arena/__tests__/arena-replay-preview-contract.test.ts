import { describe, expect, it } from 'vitest';

import { canonicalIdentityHash, projectArenaPreviewIdentity } from '@/lib/practice-lab-run-contract';
import {
  ArenaReplayAccessError,
  assertPersistedArenaPreviewContract,
} from '../blackbox/replay-service';
import type { ArenaVirtualSimulationPreviewRun } from '../blackbox/controller-preview';

function persistedIdentity(ownerUserId = 'student-1', checksum: string | null = 'sha256:trace') {
  return projectArenaPreviewIdentity({
    sourceId: 'preview-1',
    ownerUserId,
    taskId: 'task-1',
    specHash: 'sha256:spec',
    artifactHash: 'sha256:artifact',
    controllerSnapshotRef: 'ArenaControllerArtifact:artifact',
    protocolVersion: '1.0',
    runtimeVersion: 'runtime-v1',
    modelVersion: 'model-v1',
    seed: 1,
    checksum,
  }).identity;
}

function previewWithIdentity(identity: ReturnType<typeof persistedIdentity>): ArenaVirtualSimulationPreviewRun {
  return {
    taskId: 'task-1',
    datasetHash: 'arena-blackbox-dataset-x',
    controllerHash: identity.artifactHash,
    scenarioId: 'scenario',
    trace: [],
    summary: {
      trackingError: 0,
      maxDeviation: 0,
      controlEnergy: 0,
      safetyViolations: 0,
      smoothness: 0,
    },
    createdAt: '2026-05-11T11:31:00.000Z',
    metadata: {
      evaluationVisibility: 'preview',
      officialEligible: false,
      datasetHash: 'arena-blackbox-dataset-x',
      controllerHash: 'controller',
      runContract: {
        identity,
        publicProjection: {
          schemaVersion: identity.schemaVersion,
          sourceKind: identity.sourceKind,
          taskId: identity.taskId,
          specHash: identity.specHash,
          artifactHash: identity.artifactHash,
          evaluationVisibility: identity.evaluationVisibility,
          officialEligible: identity.officialEligible,
          modelRelation: identity.modelRelation,
          teachingSemantics: identity.teachingSemantics,
          prohibitsMixedClaims: true,
          executor: identity.executor,
          authoritySource: identity.authoritySource,
          checksum: identity.checksum,
          summary: null,
          traceRef: null,
        },
      },
    },
  };
}

describe('persisted arena preview contract', () => {
  it.each([
    {
      name: 'matching owner and checksum',
      owner: 'student-1',
      checksum: 'sha256:trace',
      extras: { simulationTrace: { id: 'trace-1', checksum: 'sha256:trace' } as never },
      error: null,
    },
    {
      name: 'foreign persisted owner',
      owner: 'student-other',
      checksum: 'sha256:trace',
      extras: {},
      error: ArenaReplayAccessError,
    },
    {
      name: 'linked SimulationRun owner drift',
      owner: 'student-1',
      checksum: 'sha256:trace',
      extras: { simulationRun: { ownerUserId: 'student-other' } as never },
      error: /Linked SimulationRun owner/,
    },
    {
      name: 'checksum drift',
      owner: 'student-1',
      checksum: 'sha256:left',
      extras: { simulationTrace: { id: 'trace-1', checksum: 'sha256:right' } as never },
      error: /checksum/,
    },
    {
      name: 'tampered identity hash',
      owner: 'student-1',
      checksum: 'sha256:trace',
      extras: {},
      error: /identity hash/,
      mutate: (identity: ReturnType<typeof persistedIdentity>) => ({
        ...identity,
        canonicalIdentityHash: 'sha256:tampered',
      }),
    },
    {
      name: 'task identity drift',
      owner: 'student-1',
      checksum: 'sha256:trace',
      extras: {},
      error: /preview row/,
      mutate: (identity: ReturnType<typeof persistedIdentity>) => {
        const next = { ...identity, taskId: 'task-other' };
        const { canonicalIdentityHash: _stored, ...unsigned } = next;
        return { ...unsigned, canonicalIdentityHash: canonicalIdentityHash(unsigned) };
      },
    },
  ])('handles $name', ({ owner, checksum, extras, error, mutate }) => {
    const identity = persistedIdentity(owner, checksum);
    const run = () => assertPersistedArenaPreviewContract({
      previewUserId: 'student-1',
      preview: previewWithIdentity(mutate ? mutate(identity) : identity),
      ...extras,
    });
    if (error) expect(run).toThrow(error);
    else expect(run).not.toThrow();
  });

  it('does not rewrite historical previews that lack a sealed runContract', () => {
    expect(() => assertPersistedArenaPreviewContract({
      previewUserId: 'student-1',
      preview: {
        taskId: 'task-1',
        datasetHash: 'arena-blackbox-dataset-x',
        controllerHash: 'controller',
        scenarioId: 'scenario',
        trace: [],
        summary: {
          trackingError: 0,
          maxDeviation: 0,
          controlEnergy: 0,
          safetyViolations: 0,
          smoothness: 0,
        },
        createdAt: '2026-05-11T11:31:00.000Z',
      },
    })).not.toThrow();
  });
});
