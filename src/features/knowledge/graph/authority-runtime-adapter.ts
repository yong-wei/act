import type { PublicAuthorityRootShard } from '@/lib/authority-domain-shards/contracts';

import type { KnowledgeLinkData, KnowledgeNodeData, NodeType } from '../knowledge-graph-system';
import { toActiveAuthorityRootPackingNodes } from '../active-authority-root-entries';
import {
  toSharedRuntimeRelationType,
  type AuthorityGraphViewModel,
} from '../authority-graph-view-model';
import { toRuntimePresentationShape } from './active-node-decoration';

export const ACTIVE_RUNTIME_GRAPH_VERSION = 'active-authority';
export const ACTIVE_ROOT_RUNTIME_GRAPH_VERSION = 'active-root-catalog';
export const ACTIVE_ROOT_PRESENTATION_KIND = 'active-root-navigation';

function runtimeNodeTypeFor(shape: string): NodeType {
  if (shape === 'hexagon') return 'ETHICS';
  if (shape === 'square' || shape === 'rounded') return 'SCENARIO';
  return 'THEORY';
}

export function toActiveRuntimeNodes(view: AuthorityGraphViewModel): KnowledgeNodeData[] {
  return view.nodes.map((node) => ({
    id: node.canonicalId,
    name: node.label,
    nodeType: runtimeNodeTypeFor(node.presentation.type.shape),
    description: node.description ?? '',
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    conceptKind: node.canonicalType,
    metadata: {
      sourceMode: 'active',
      registeredType: node.canonicalType,
      presentationShape: toRuntimePresentationShape(node.presentation.type.shape),
      decoration: node.decoration,
    },
    richTitle: node.presentation.richTitle,
  }));
}

export function toActiveRuntimeLinks(view: AuthorityGraphViewModel): KnowledgeLinkData[] {
  return view.edges.map((edge) => ({
    id: edge.edgeId,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    relation: edge.predicate,
    relationType: toSharedRuntimeRelationType({
      predicate: edge.predicate,
      relationFamily: edge.relationFamily,
    }),
  }));
}

export function toActiveRootRuntimeNodes(
  catalog: PublicAuthorityRootShard['root'],
): KnowledgeNodeData[] {
  return toActiveAuthorityRootPackingNodes(catalog).map((node) => {
    const metadata = {
      ...(node.metadata ?? {}),
      sourceMode: 'active',
      presentationKind: ACTIVE_ROOT_PRESENTATION_KIND,
      canonicalObjectId: null,
    };
    return {
      ...node,
      metadata,
    };
  });
}

export function isActiveRootNavigationNode(node: Pick<KnowledgeNodeData, 'id' | 'metadata'>): boolean {
  const metadata = (node.metadata ?? {}) as Record<string, unknown>;
  return metadata.presentationKind === ACTIVE_ROOT_PRESENTATION_KIND
    || metadata.presentationKind === 'domain'
    || metadata.presentationKind === 'aggregate'
    || node.id.startsWith('root-entry-');
}

export function activeRootEntryVisualRole(node: Pick<KnowledgeNodeData, 'metadata'>): string | null {
  const metadata = (node.metadata ?? {}) as Record<string, unknown>;
  return typeof metadata.visualRole === 'string' && metadata.visualRole.trim()
    ? metadata.visualRole
    : null;
}

export function activeRootEntryUnavailable(node: Pick<KnowledgeNodeData, 'metadata'>): boolean {
  return Boolean((node.metadata as { unavailable?: boolean } | undefined)?.unavailable);
}
