/**
 * Authority-to-course identity crosswalk (#1515, review unblock).
 *
 * The relation review packs carry `ctc:*` Authority member ids whose
 * readable names live in the Authority multilingual label index; the
 * course-side canonical nodes use Chinese canonical names. The crosswalk
 * layers these two sources honestly: only exact label↔course-name matches
 * become tier-A mappings admissible for formal course-owner decisions;
 * labeled-but-unmatched members stay tier-B (name-assisted review only),
 * and unlabeled members stay tier-C. No fabricated or fuzzy matches.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import { FormalResourceRemediationError } from '../contracts';
import type { ReopenedScope } from './scope';

export interface LabelIndexRow {
  readonly entityId: string;
  readonly label: string;
  readonly labelType: string;
  readonly language: string;
}

/** One node of an Authority review/runtime projection artifact. */
export interface ProjectionNodeRow {
  readonly entityId: string | null;
  readonly id?: string;
  readonly displayName?: string | null;
  readonly description?: string | null;
}

/**
 * Load entity labels from an Authority projection artifact (the complete
 * member-name source for a sealed scope). Every node must carry an entity
 * id; labels fall back to descriptions when the display name is a slug.
 */
export function loadProjectionLabels(
  nodes: readonly ProjectionNodeRow[],
): Readonly<Record<string, string>> {
  const labels: Record<string, string> = {};
  for (const node of nodes) {
    const entityId = node.entityId ?? node.id ?? null;
    if (!entityId) {
      throw new FormalResourceRemediationError(
        'projection-node-invalid',
        'A projection node carries no entity id.',
      );
    }
    const displayName = node.displayName?.trim();
    const description = node.description?.trim();
    const label = displayName && displayName.length > 0 ? displayName : (description ?? '');
    const existing = labels[entityId];
    if (existing !== undefined && existing !== label) {
      throw new FormalResourceRemediationError(
        'projection-label-conflict',
        `Entity ${entityId} has conflicting projection labels.`,
      );
    }
    labels[entityId] = label;
  }
  return labels;
}

export interface CourseNodeRow {
  readonly canonicalName: string;
  readonly canonicalNodeId: string;
  readonly ownerLesson: string | null;
}

/** Union of the two Authority-side label sources. */
export type AuthorityLabelSource =
  | { readonly kind: 'label-index'; readonly rows: readonly LabelIndexRow[] }
  | { readonly kind: 'projection'; readonly nodes: readonly ProjectionNodeRow[] };

export interface CrosswalkEntry {
  readonly canonicalId: string;
  readonly zhLabel: string | null;
  readonly tier: 'A_EXACT_COURSE_NODE' | 'B_LABEL_ONLY' | 'C_UNLABELED';
  readonly courseNodeId: string | null;
  readonly ownerLesson: string | null;
}

export interface CrosswalkResult {
  readonly tierA: readonly CrosswalkEntry[];
  readonly tierB: readonly CrosswalkEntry[];
  readonly tierC: readonly CrosswalkEntry[];
  readonly memberCount: number;
  readonly crosswalkHash: string;
}

/**
 * Parse the Authority multilingual label index, keeping one zh-CN
 * canonical_preferred label per entity. Duplicate conflicting labels fail
 * closed.
 */
export function loadPreferredZhLabels(rows: readonly LabelIndexRow[]): Readonly<Record<string, string>> {
  const labels: Record<string, string> = {};
  for (const row of rows) {
    if (row.labelType !== 'canonical_preferred' || row.language !== 'zh-CN') continue;
    if (!row.entityId || !row.label) {
      throw new FormalResourceRemediationError(
        'label-index-row-invalid',
        'A label index row lacks its entity id or label.',
      );
    }
    const existing = labels[row.entityId];
    if (existing !== undefined && existing !== row.label) {
      throw new FormalResourceRemediationError(
        'label-index-conflict',
        `Entity ${row.entityId} has conflicting zh-CN preferred labels: ${existing} vs ${row.label}`,
      );
    }
    labels[row.entityId] = row.label;
  }
  return labels;
}

/**
 * Build the layered crosswalk over one reopened scope. Course nodes are
 * matched by exact canonical-name equality only.
 */
export function buildCrosswalk(input: {
  scope: ReopenedScope;
  labelSource: AuthorityLabelSource;
  courseNodes: readonly CourseNodeRow[];
}): CrosswalkResult {
  const labels = input.labelSource.kind === 'label-index'
    ? loadPreferredZhLabels(input.labelSource.rows)
    : loadProjectionLabels(input.labelSource.nodes);
  const nodesByName = new Map<string, CourseNodeRow>();
  for (const node of input.courseNodes) {
    const existing = nodesByName.get(node.canonicalName);
    if (existing !== undefined && existing.canonicalNodeId !== node.canonicalNodeId) {
      throw new FormalResourceRemediationError(
        'course-node-ambiguous',
        `Course node name ${node.canonicalName} maps to two node ids; exact matching cannot proceed.`,
      );
    }
    nodesByName.set(node.canonicalName, node);
  }
  const tierA: CrosswalkEntry[] = [];
  const tierB: CrosswalkEntry[] = [];
  const tierC: CrosswalkEntry[] = [];
  for (const member of input.scope.members) {
    const label = labels[member.canonicalId] ?? null;
    if (label === null) {
      tierC.push({
        canonicalId: member.canonicalId,
        zhLabel: null,
        tier: 'C_UNLABELED',
        courseNodeId: null,
        ownerLesson: null,
      });
      continue;
    }
    const node = nodesByName.get(label) ?? null;
    if (node) {
      tierA.push({
        canonicalId: member.canonicalId,
        zhLabel: label,
        tier: 'A_EXACT_COURSE_NODE',
        courseNodeId: node.canonicalNodeId,
        ownerLesson: node.ownerLesson,
      });
    } else {
      tierB.push({
        canonicalId: member.canonicalId,
        zhLabel: label,
        tier: 'B_LABEL_ONLY',
        courseNodeId: null,
        ownerLesson: null,
      });
    }
  }
  const crosswalkHash = projectionDigest({
    scopeHash: input.scope.scopeHash,
    tierA: tierA.map((entry) => [entry.canonicalId, entry.courseNodeId]),
    tierBCount: tierB.length,
    tierCCount: tierC.length,
  });
  return { tierA, tierB, tierC, memberCount: input.scope.memberCount, crosswalkHash };
}
