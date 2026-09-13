/**
 * Anchored resource binding release contracts.
 *
 * Resource bindings are an independent runtime artifact family versioned after the
 * Authority release (`<authorityRelease>-<revision>-b<n>`). Every binding names a
 * precise anchor (step / handout heading / media time range / textbook section) and
 * its teaching-order semantics (first appearance vs revisit). Bindings never store
 * delivery URLs; media identity is the runtime path plus content sha256.
 */

import type { TeachingProjectionRole, TeachingResourceType } from '@/lib/teaching-projection/contracts';

export const RESOURCE_BINDING_RELEASE_MANIFEST_CONTRACT = 'act-resource-binding-release-manifest/v1' as const;
export const RESOURCE_BINDING_RELEASE_CURRENT_CONTRACT = 'act-resource-binding-release-current/v1' as const;
export const RESOURCE_BINDING_RELEASE_BUILDER_VERSION = 'act-resource-binding-release-builder/v1' as const;
export const RESOURCE_BINDING_GATE_CONTRACT = 'act-resource-binding-release-gate/v1' as const;
export const RESOURCE_BINDING_AUDIT_CONTRACT = 'act-resource-binding-release-audit/v1' as const;

export const DEFAULT_RESOURCE_BINDING_RUNTIME_RELATIVE = 'course-content/runtime/knowledge/resource-bindings' as const;
export const DEFAULT_RESOURCE_BINDING_AUTHORING_RELATIVE = 'course-content/authoring/knowledge/resource-bindings' as const;

export const RESOURCE_BINDING_RELEASE_FILES = {
  manifest: 'binding-manifest.json',
  resources: 'resources.jsonl',
  bindings: 'bindings.jsonl',
  gate: 'gate.json',
  audit: 'audit-report.json',
} as const;

/** Resource subtypes that cover many knowledge nodes and therefore need precise anchors. */
export const MULTI_KNOWLEDGE_RESOURCE_TYPES = [
  'handout',
  'audio',
  'video',
  'podcast',
  'textbook',
  'textbook-chapter',
  'slides',
] as const satisfies readonly TeachingResourceType[];

/** Resource subtypes that never enter the binding release as resources. */
export const EXCLUDED_RESOURCE_TYPES = ['lesson', 'textbook'] as const satisfies readonly TeachingResourceType[];

export type BindingAnchorKind = 'step' | 'heading' | 'time' | 'section' | 'whole';

export interface StepAnchor {
  kind: 'step';
  stepId: string;
  stepIndex: number;
  label: string;
}

export interface HeadingAnchor {
  kind: 'heading';
  headingId: string;
  order: number;
  level: number;
  label: string;
}

export interface TimeAnchor {
  kind: 'time';
  mediaId: string;
  runtimePath: string;
  mediaSha256: string;
  startSeconds: number;
  endSeconds: number;
  label: string;
}

export interface SectionAnchor {
  kind: 'section';
  sectionPath: string;
  label: string;
}

export interface WholeAnchor {
  kind: 'whole';
}

export type BindingAnchor = StepAnchor | HeadingAnchor | TimeAnchor | SectionAnchor | WholeAnchor;

/**
 * first     earliest unit (course order) in which the canonical node is bound
 * revisit   a later unit binds the same node again
 * reference no teaching-order position (cards, infographics, textbook, simulations)
 */
export type BindingAppearance = 'first' | 'revisit' | 'reference';

export interface BindingTeachingOrder {
  unitId: string;
  unitIndex: number;
  stepIndex: number | null;
}

export type BindingProvenanceMethod =
  | 'sequence-crosswalk'
  | 'step-terminology'
  | 'heading-terminology'
  | 'asr-terminology'
  | 'caption-terminology'
  | 'reviewed'
  | 'carry-forward-exact';

export interface BindingProvenance {
  method: BindingProvenanceMethod;
  matchedLabel: string | null;
  source: string;
}

export interface AnchoredResourceMedia {
  mediaId: string;
  runtimePath: string;
  sha256: string;
  durationSeconds: number | null;
}

export interface AnchoredResourceRuntime {
  resourceId: string;
  resourceType: TeachingResourceType;
  title: string | null;
  sourcePath: string | null;
  unitId: string | null;
  media: AnchoredResourceMedia | null;
  anchorCount: number;
  bindingCount: number;
  bindingStatus: 'BOUND' | 'UNBOUND';
}

export interface AnchoredBindingRuntime {
  bindingId: string;
  resourceId: string;
  resourceType: TeachingResourceType;
  canonicalId: string;
  role: TeachingProjectionRole;
  scopeId: string;
  anchor: BindingAnchor;
  anchorKey: string;
  appearance: BindingAppearance;
  teachingOrder: BindingTeachingOrder | null;
  focus: boolean;
  primary: boolean;
  provenance: BindingProvenance;
}

export interface ResourceBindingGateFinding {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  resourceId?: string;
  canonicalId?: string;
  bindingId?: string;
  unitId?: string;
}

export interface ResourceBindingGateResult {
  contract: typeof RESOURCE_BINDING_GATE_CONTRACT;
  status: 'passed' | 'failed';
  passed: boolean;
  findings: ResourceBindingGateFinding[];
  excludedResourceIds: string[];
  noAnchorResourceIds: string[];
  unmappedCourseNodes: string[];
  driftedMediaIds: string[];
  ambiguousLabels: string[];
}

export interface ResourceBindingSourceHashes {
  anchors: string;
  unitScopes: string;
  crosswalk: string;
  review: string;
  courseOrder: string;
  activeRuntimeMediaIndex: string;
  carryForwardResources: string;
  carryForwardBindings: string;
  resources: string;
  bindings: string;
  gate: string;
}

export interface ResourceBindingReleaseManifestBody {
  contract: typeof RESOURCE_BINDING_RELEASE_MANIFEST_CONTRACT;
  builderVersion: typeof RESOURCE_BINDING_RELEASE_BUILDER_VERSION;
  scopeId: string;
  authorityReleaseId: string;
  authorityReleaseSetId: string | null;
  authoritySnapshotId: string | null;
  authoritySnapshotHash: string | null;
  authorityRevisionLabel: string;
  bindingRevision: number;
  prerequisitePublicationId: string | null;
  /** Course projection whose exact channels (cards, infographics, textbook sections, simulations) were carried forward. */
  carryForwardProjectionId: string | null;
  carryForwardProjectionHash: string | null;
  activeRuntimeReleaseId: string | null;
  sourceHashes: ResourceBindingSourceHashes;
  resourceCount: number;
  bindingCount: number;
  canonicalCount: number;
  unitCount: number;
  appearanceCounts: Record<BindingAppearance, number>;
  anchorKindCounts: Record<BindingAnchorKind, number>;
  gateStatus: 'passed' | 'failed';
  gatePassed: boolean;
}

export interface ResourceBindingReleaseManifest extends ResourceBindingReleaseManifestBody {
  bindingReleaseId: string;
  bindingHash: string;
}

export interface ResourceBindingReleaseCurrentPointer {
  contract: typeof RESOURCE_BINDING_RELEASE_CURRENT_CONTRACT;
  bindingReleaseId: string;
  bindingHash: string;
  authorityReleaseId: string;
  activatedAt: string;
}

export interface ResourceBindingAuditReport {
  contract: typeof RESOURCE_BINDING_AUDIT_CONTRACT;
  bindingReleaseId: string;
  resourceCount: number;
  bindingCount: number;
  canonicalCount: number;
  perNodeBindingCount: {
    min: number;
    p50: number;
    p90: number;
    max: number;
    nodesAtOrAbove50: number;
    nodesAtOrAbove100: number;
  };
  topFanoutResources: Array<{ resourceId: string; resourceType: string; bindingCount: number }>;
  topBoundNodes: Array<{ canonicalId: string; bindingCount: number; unitCount: number }>;
  roleCounts: Record<string, number>;
  provenanceCounts: Record<string, number>;
  appearanceCounts: Record<string, number>;
  anchorKindCounts: Record<string, number>;
  resourceTypeCounts: Record<string, number>;
  baseline: {
    kind: 'course-projection' | 'binding-release' | 'none';
    id: string | null;
    resourceCount: number | null;
    bindingCount: number | null;
    canonicalCount: number | null;
    maxPerNode: number | null;
  };
}

export class ResourceBindingReleaseError extends Error {
  constructor(readonly code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ResourceBindingReleaseError';
  }
}

export function isMultiKnowledgeResourceType(type: TeachingResourceType): boolean {
  return (MULTI_KNOWLEDGE_RESOURCE_TYPES as readonly string[]).includes(type);
}

export function anchorKeyOf(anchor: BindingAnchor): string {
  switch (anchor.kind) {
    case 'step':
      return `step:${anchor.stepId}`;
    case 'heading':
      return `heading:${anchor.headingId}`;
    case 'time':
      return `time:${anchor.startSeconds.toFixed(2)}-${anchor.endSeconds.toFixed(2)}`;
    case 'section':
      return `section:${anchor.sectionPath}`;
    case 'whole':
      return 'whole';
    default:
      return 'whole';
  }
}

export function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function timeAnchorLabel(startSeconds: number, endSeconds: number): string {
  return `${formatSeconds(startSeconds)}–${formatSeconds(endSeconds)}`;
}
