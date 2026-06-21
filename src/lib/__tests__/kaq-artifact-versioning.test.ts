import { describe, expect, it } from 'vitest';

import {
  ADAPTIVE_LEARNING_PATH_PLANNER_VERSION,
  buildKaqArtifactVersionRefs,
  buildKaqVersionedArtifactMetadata,
  detectKaqArtifactStaleness,
  KAQ_ARTIFACT_VERSIONING_VERSION,
  RESOURCE_SEMANTIC_PROJECTION_VERSION,
  validateKaqArtifactVersionRefs,
} from '../kaq-artifact-versioning';

describe('K/A/Q artifact versioning', () => {
  it('builds required graph, resource, planner, and goal package refs', () => {
    const metadata = buildKaqVersionedArtifactMetadata({
      artifactId: 'path:control-correction:student-1',
      artifactKind: 'path-artifact',
      generatedAt: '2026-06-21T00:00:00.000Z',
      versionRefs: { learningGoalPackageVersion: 'learning-goal-package.v1' },
      requiredRefs: [
        'learningGoalPackageVersion',
        'graphCatalogVersion',
        'resourceProjectionVersion',
        'plannerVersion',
      ],
    });

    expect(metadata.versionRefs).toMatchObject({
      artifactVersioningVersion: KAQ_ARTIFACT_VERSIONING_VERSION,
      learningGoalPackageVersion: 'learning-goal-package.v1',
      resourceProjectionVersion: RESOURCE_SEMANTIC_PROJECTION_VERSION,
      plannerVersion: ADAPTIVE_LEARNING_PATH_PLANNER_VERSION,
    });
    expect(metadata.limitations).toEqual([]);
  });

  it('blocks production writeback when required version refs are missing', () => {
    const refs = buildKaqArtifactVersionRefs({
      learningGoalPackageVersion: null,
      graphCatalogVersion: null,
    });

    expect(validateKaqArtifactVersionRefs(refs, [
      'learningGoalPackageVersion',
      'graphCatalogVersion',
      'resourceProjectionVersion',
    ])).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing-version-ref', ref: 'learningGoalPackageVersion', severity: 'blocking' }),
      expect.objectContaining({ code: 'missing-version-ref', ref: 'graphCatalogVersion', severity: 'blocking' }),
    ]));
  });

  it('marks stale artifact refs as limitations without rewriting history', () => {
    const staleRefs = buildKaqArtifactVersionRefs({
      graphCatalogVersion: 'autocontrol-kaq-graph.v0',
      resourceProjectionVersion: 'resource-semantic-projection.v0',
    });

    expect(detectKaqArtifactStaleness(staleRefs)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'stale-version-ref', ref: 'graphCatalogVersion' }),
      expect.objectContaining({ code: 'stale-version-ref', ref: 'resourceProjectionVersion' }),
    ]));

    const metadata = buildKaqVersionedArtifactMetadata({
      artifactId: 'path:control-correction:student-1',
      artifactKind: 'path-artifact',
      generatedAt: '2026-06-21T00:00:00.000Z',
      versionRefs: {
        learningGoalPackageVersion: 'learning-goal-package.v1',
        resourceProjectionVersion: 'resource-semantic-projection.v0',
      },
      requiredRefs: [
        'learningGoalPackageVersion',
        'graphCatalogVersion',
        'resourceProjectionVersion',
        'plannerVersion',
      ],
    });
    expect(metadata.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'stale-version-ref', ref: 'resourceProjectionVersion' }),
    ]));
  });
});
