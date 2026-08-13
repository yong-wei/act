/**
 * Translate current published teaching records into the first domain fragment
 * without changing their semantics (#1370 / task 1.3).
 */

import { parse as parseYaml } from 'yaml';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AuthorityNodeIndexEntry } from '../contracts';
import type { RegisteredPeerDomainId } from '@/lib/authority-domain-catalog/contracts';
import {
  DEFAULT_DOMAIN_FRAGMENT_AUTHORING_RELATIVE,
  LIVE_AUTHORITY_DOMAIN_TEACHING_AUTHORING_REVISION,
  LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING,
  LIVE_AUTHORITY_DOMAIN_TEACHING_CAPTURE_REVISION,
  LIVE_AUTHORITY_DOMAIN_TEACHING_SOURCE_DATASET_HASH,
  type DomainFragmentCoreNodeAuthoring,
  type DomainFragmentRelationAuthoring,
  type DomainTeachingAuthorityEnvelope,
  type DomainTeachingFragmentAuthoring,
  type DomainTeachingFragment,
} from './contracts';
import {
  buildDomainTeachingFragment,
  deriveDomainTeachingEdgeId,
} from './builder';
import {
  assertDomainTeachingAuthorityEnvelope,
  createDomainTeachingAuthorityEnvelope,
} from './validate';

/** Map existing moduleId / scope cues onto registered peer domains. */
const MODULE_TO_DOMAIN: Record<string, RegisteredPeerDomainId> = {
  'module-1-modeling': 'system-modeling',
  'module-2-stability': 'stability-analysis',
  'module-3-time': 'time-domain-analysis',
  'module-4-frequency': 'frequency-domain-analysis',
  'module-5-root-locus': 'root-locus',
  'module-6-classical-design': 'classical-control-design',
  'module-7-discrete': 'discrete-time-control-analysis',
  'module-8-state-space': 'state-space-control-analysis-and-design',
};

const DEFAULT_SCOPE_DOMAIN: RegisteredPeerDomainId = 'system-modeling';

export interface PublishedPrerequisiteInventory {
  coreNodesPath?: string;
  edgesPath?: string;
  coreNodesYaml?: string;
  edgesYaml?: string;
}

export interface TranslateFirstFragmentInput {
  inventory?: PublishedPrerequisiteInventory;
  /** Repo root for default inventory paths. */
  repoRoot?: string;
  /** Canonical Authority envelope; endpoints resolve only from envelope.nodes. */
  authority: DomainTeachingAuthorityEnvelope;
  /** If supplied, must equal the recomputed source inventory digest. */
  sourceInventoryDigest?: string;
  fragmentKey?: string;
  fragmentVersion?: string;
}

/** Live Authority selection + authoring revision for the first published fragment. */
export function liveAuthorityBindingForFirstFragment(): {
  authorityBinding: typeof LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING;
  authoringRevision: typeof LIVE_AUTHORITY_DOMAIN_TEACHING_AUTHORING_REVISION;
  captureRevision: typeof LIVE_AUTHORITY_DOMAIN_TEACHING_CAPTURE_REVISION;
  sourceDatasetHash: typeof LIVE_AUTHORITY_DOMAIN_TEACHING_SOURCE_DATASET_HASH;
} {
  return {
    authorityBinding: { ...LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING },
    authoringRevision: LIVE_AUTHORITY_DOMAIN_TEACHING_AUTHORING_REVISION,
    captureRevision: LIVE_AUTHORITY_DOMAIN_TEACHING_CAPTURE_REVISION,
    sourceDatasetHash: LIVE_AUTHORITY_DOMAIN_TEACHING_SOURCE_DATASET_HASH,
  };
}

export function liveAuthorityEnvelopeForFirstFragment(
  nodes: readonly AuthorityNodeIndexEntry[],
): DomainTeachingAuthorityEnvelope {
  const live = liveAuthorityBindingForFirstFragment();
  return createDomainTeachingAuthorityEnvelope({
    binding: live.authorityBinding,
    sourceDatasetHash: live.sourceDatasetHash,
    captureRevision: live.captureRevision,
    authoringRevision: live.authoringRevision,
    nodes,
  });
}

interface RawCoreNodeRow {
  canonicalId: string;
  scopeId?: string;
  pathEligible?: boolean;
  cardPolicy?: 'REQUIRED' | 'OPTIONAL';
  moduleId?: string | null;
  rationale?: string;
  sourceKind?: DomainFragmentCoreNodeAuthoring['sourceKind'];
  sourceEvidence?: string[];
}

interface RawEdgeRow {
  edgeId?: string;
  sourceNodeId: string;
  targetNodeId: string;
  strength: 'REQUIRED' | 'RECOMMENDED';
  scopeId?: string;
  evidenceRefs?: string[];
  curatorId?: string | null;
  curatorRationale?: string | null;
  status?: string;
  authorDecisionId?: string | null;
}

function domainForModule(moduleId: string | null | undefined): RegisteredPeerDomainId {
  if (moduleId && MODULE_TO_DOMAIN[moduleId]) {
    return MODULE_TO_DOMAIN[moduleId];
  }
  return DEFAULT_SCOPE_DOMAIN;
}

function loadYamlDocument(input: {
  explicitYaml?: string;
  path?: string;
  defaultRelative: string;
  repoRoot: string;
}): unknown {
  if (typeof input.explicitYaml === 'string') {
    return parseYaml(input.explicitYaml);
  }
  const filePath =
    input.path
    ?? join(input.repoRoot, input.defaultRelative);
  return parseYaml(readFileSync(filePath, 'utf8'));
}

/**
 * Build domain-fragment authoring from the existing prerequisite inventory
 * without altering edge endpoints, strength, or evidence.
 */
export function translatePublishedRecordsToFirstFragmentAuthoring(
  input: TranslateFirstFragmentInput,
): DomainTeachingFragmentAuthoring {
  const repoRoot = input.repoRoot ?? process.cwd();
  const inventory = input.inventory ?? {};

  const coreDoc = loadYamlDocument({
    explicitYaml: inventory.coreNodesYaml,
    path: inventory.coreNodesPath,
    defaultRelative:
      'course-content/authoring/knowledge/teaching-projection/prerequisites/inventory/core-nodes.yaml',
    repoRoot,
  }) as { nodes?: RawCoreNodeRow[] };

  const edgeDoc = loadYamlDocument({
    explicitYaml: inventory.edgesYaml,
    path: inventory.edgesPath,
    defaultRelative:
      'course-content/authoring/knowledge/teaching-projection/prerequisites/inventory/edges.yaml',
    repoRoot,
  }) as { edges?: RawEdgeRow[] };

  const coreNodes: DomainFragmentCoreNodeAuthoring[] = (coreDoc.nodes ?? []).map(
    (row) => {
      const domainKey = domainForModule(row.moduleId);
      return {
        canonicalId: row.canonicalId,
        domainKeys: [domainKey],
        pathEligible: row.pathEligible !== false,
        cardPolicy: row.cardPolicy === 'OPTIONAL' ? 'OPTIONAL' : 'REQUIRED',
        moduleId: row.moduleId ?? null,
        rationale: row.rationale ?? 'translated from published core-node inventory',
        sourceKind: row.sourceKind ?? 'TEACHER_CURATION',
        sourceEvidence: [...(row.sourceEvidence ?? ['translated:core-nodes-inventory'])],
      };
    },
  );

  const nodeDomain = new Map<string, RegisteredPeerDomainId>();
  for (const node of coreNodes) {
    nodeDomain.set(node.canonicalId, node.domainKeys[0]!);
  }

  const publishedEdges = (edgeDoc.edges ?? []).filter(
    (edge) => edge.status === 'PUBLISHED' || edge.status == null,
  );

  const relations: DomainFragmentRelationAuthoring[] = publishedEdges.map(
    (edge) => {
      const sourceDomain =
        nodeDomain.get(edge.sourceNodeId) ?? DEFAULT_SCOPE_DOMAIN;
      const targetDomain =
        nodeDomain.get(edge.targetNodeId) ?? DEFAULT_SCOPE_DOMAIN;
      const domainKeys = [...new Set([sourceDomain, targetDomain])].sort();
      return {
        edgeId:
          edge.edgeId
          ?? deriveDomainTeachingEdgeId({
            sourceNodeId: edge.sourceNodeId,
            targetNodeId: edge.targetNodeId,
            relationType: 'PREREQUISITE',
            strength: edge.strength,
          }),
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        relationType: 'PREREQUISITE',
        strength: edge.strength,
        domainKeys: domainKeys as RegisteredPeerDomainId[],
        evidenceRefs: [...(edge.evidenceRefs ?? [])],
        curatorId: edge.curatorId ?? null,
        curatorRationale: edge.curatorRationale ?? null,
        authorDecisionId: edge.authorDecisionId ?? null,
      };
    },
  );

  const domainKeys = [
    ...new Set([
      ...coreNodes.flatMap((n) => n.domainKeys),
      ...relations.flatMap((r) => r.domainKeys),
    ]),
  ].sort() as RegisteredPeerDomainId[];

  const evidenceRefs = [
    ...new Set([
      ...coreNodes.flatMap((n) => n.sourceEvidence),
      ...relations.flatMap((r) => r.evidenceRefs ?? []),
    ]),
  ].sort();

  const envelope = assertDomainTeachingAuthorityEnvelope(
    input.authority,
    'translate.authority',
  );
  if (input.sourceInventoryDigest) {
    throw new Error(
      'translate sourceInventoryDigest must be computed from actual source inputs',
    );
  }

  return {
    contract: 'act-domain-teaching-fragment/v1',
    fragmentKey: input.fragmentKey ?? 'foundation-published-v1',
    fragmentVersion: input.fragmentVersion ?? '1',
    domainKeys,
    authorityBinding: envelope.binding,
    authoringRevision: envelope.authoringRevision,
    captureRevision: envelope.captureRevision,
    sourceDatasetHash: envelope.sourceDatasetHash,
    nodeIndexDigest: envelope.nodeIndexDigest,
    evidenceRefs,
    coreNodes,
    relations,
  };
}

/**
 * Translate and build the first immutable domain fragment from current records.
 */
export function translateAndBuildFirstDomainFragment(
  input: TranslateFirstFragmentInput,
): {
  authoring: DomainTeachingFragmentAuthoring;
  fragment: DomainTeachingFragment;
} {
  const authoring = translatePublishedRecordsToFirstFragmentAuthoring(input);
  const fragment = buildDomainTeachingFragment(authoring, input.authority);
  return { authoring, fragment };
}

export function defaultDomainFragmentAuthoringRelative(): string {
  return DEFAULT_DOMAIN_FRAGMENT_AUTHORING_RELATIVE;
}
