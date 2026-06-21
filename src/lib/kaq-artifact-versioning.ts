import { AUTOCONTROL_KAQ_GRAPH_VERSION } from './data-governance/autocontrol-kaq-graph-catalog';

export const KAQ_ARTIFACT_VERSIONING_VERSION = 'kaq-artifact-versioning.v1';
export const LEARNING_GOAL_PACKAGE_VERSION = 'learning-goal-package/v1';
export const KAQ_OBJECTIVE_CATALOG_VERSION = 'autocontrol-kaq-objectives.v1';
export const RESOURCE_NODE_REGISTRY_VERSION = 'resource-node-registry.v1';
export const RESOURCE_SEMANTIC_PROJECTION_VERSION = 'resource-semantic-projection.v1';
export const ADAPTIVE_LEARNING_PATH_PLANNER_VERSION = 'adaptive-learning-path-planner.v1';
export const KONLING_GRAPH_GROUNDING_VERSION = 'konling-graph-grounding.v1';
export const GRAPH_CENTER_OVERLAY_VERSION = 'graph-center-overlay.v1';

export type KaqArtifactKind =
  | 'learning-goal-package'
  | 'graph-catalog'
  | 'resource-projection'
  | 'overlay'
  | 'path-artifact'
  | 'path-round'
  | 'konling-grounding'
  | 'citation-chip';

export type KaqArtifactLimitationCode =
  | 'missing-version-ref'
  | 'stale-version-ref'
  | 'migrated-version-ref'
  | 'legacy-artifact-unversioned';

export interface KaqArtifactVersionRefs {
  artifactVersioningVersion: typeof KAQ_ARTIFACT_VERSIONING_VERSION;
  learningGoalPackageVersion?: string | null;
  objectiveCatalogVersion?: string | null;
  graphCatalogVersion?: string | null;
  resourceRegistryVersion?: string | null;
  resourceProjectionVersion?: string | null;
  overlayVersion?: string | null;
  plannerVersion?: string | null;
  groundingVersion?: string | null;
  citationVersion?: string | null;
}

export interface KaqArtifactVersionLimitation {
  code: KaqArtifactLimitationCode;
  ref: keyof KaqArtifactVersionRefs;
  severity: 'blocking' | 'warning';
  message: string;
}

export interface KaqVersionedArtifactMetadata {
  artifactId: string;
  artifactKind: KaqArtifactKind;
  generatedAt: string;
  versionRefs: KaqArtifactVersionRefs;
  limitations: KaqArtifactVersionLimitation[];
}

export const DEFAULT_KAQ_ARTIFACT_VERSION_REFS: KaqArtifactVersionRefs = {
  artifactVersioningVersion: KAQ_ARTIFACT_VERSIONING_VERSION,
  learningGoalPackageVersion: LEARNING_GOAL_PACKAGE_VERSION,
  objectiveCatalogVersion: KAQ_OBJECTIVE_CATALOG_VERSION,
  graphCatalogVersion: AUTOCONTROL_KAQ_GRAPH_VERSION,
  resourceRegistryVersion: RESOURCE_NODE_REGISTRY_VERSION,
  resourceProjectionVersion: RESOURCE_SEMANTIC_PROJECTION_VERSION,
  plannerVersion: ADAPTIVE_LEARNING_PATH_PLANNER_VERSION,
};

export function buildKaqArtifactVersionRefs(
  refs: Partial<KaqArtifactVersionRefs> = {},
): KaqArtifactVersionRefs {
  return {
    ...DEFAULT_KAQ_ARTIFACT_VERSION_REFS,
    ...refs,
    artifactVersioningVersion: KAQ_ARTIFACT_VERSIONING_VERSION,
  };
}

export function validateKaqArtifactVersionRefs(
  refs: KaqArtifactVersionRefs | null | undefined,
  requiredRefs: Array<keyof KaqArtifactVersionRefs>,
): KaqArtifactVersionLimitation[] {
  if (!refs) {
    return requiredRefs.map((ref) => missingVersionRef(ref));
  }
  return requiredRefs
    .filter((ref) => !refs[ref])
    .map((ref) => missingVersionRef(ref));
}

export function detectKaqArtifactStaleness(
  refs: KaqArtifactVersionRefs,
  currentRefs: KaqArtifactVersionRefs = DEFAULT_KAQ_ARTIFACT_VERSION_REFS,
): KaqArtifactVersionLimitation[] {
  return ([
    'learningGoalPackageVersion',
    'objectiveCatalogVersion',
    'graphCatalogVersion',
    'resourceRegistryVersion',
    'resourceProjectionVersion',
    'overlayVersion',
    'plannerVersion',
    'groundingVersion',
    'citationVersion',
  ] satisfies Array<keyof KaqArtifactVersionRefs>)
    .filter((ref) => Boolean(refs[ref]) && Boolean(currentRefs[ref]) && refs[ref] !== currentRefs[ref])
    .map((ref) => ({
      code: 'stale-version-ref' as const,
      ref,
      severity: 'warning' as const,
      message: `Artifact version ref ${ref} is stale: ${refs[ref]} != ${currentRefs[ref]}.`,
    }));
}

export function buildKaqVersionedArtifactMetadata(input: {
  artifactId: string;
  artifactKind: KaqArtifactKind;
  generatedAt: string;
  versionRefs?: Partial<KaqArtifactVersionRefs>;
  currentRefs?: KaqArtifactVersionRefs;
  requiredRefs: Array<keyof KaqArtifactVersionRefs>;
}): KaqVersionedArtifactMetadata {
  const versionRefs = buildKaqArtifactVersionRefs(input.versionRefs);
  return {
    artifactId: input.artifactId,
    artifactKind: input.artifactKind,
    generatedAt: input.generatedAt,
    versionRefs,
    limitations: [
      ...validateKaqArtifactVersionRefs(versionRefs, input.requiredRefs),
      ...detectKaqArtifactStaleness(versionRefs, input.currentRefs),
    ],
  };
}

function missingVersionRef(ref: keyof KaqArtifactVersionRefs): KaqArtifactVersionLimitation {
  return {
    code: 'missing-version-ref',
    ref,
    severity: 'blocking',
    message: `Required artifact version ref is missing: ${ref}.`,
  };
}
