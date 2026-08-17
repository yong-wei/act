import type { PublicAuthorityRootShard } from '@/lib/authority-domain-shards/contracts';
import type { KnowledgeNodeData } from './knowledge-graph-system';
import {
  packKnowledgeGraphRootNodes,
  type KnowledgeRootPackingViewport,
} from './graph/root-layout';

export const ACTIVE_AUTHORITY_ROOT_UNAVAILABLE_LABEL = '该领域暂不可用';
export const ACTIVE_AUTHORITY_ROOT_AGGREGATE_UNAVAILABLE_LABEL = '综合入口暂不可用';

export type ActiveAuthorityRootEntryKind = 'domain' | 'aggregate';

export interface ActiveAuthorityRootPackedEntry {
  packingId: string;
  kind: ActiveAuthorityRootEntryKind;
  visualRole: string | null;
  name: string;
  summary: string;
  unavailable: boolean;
  x: number;
  y: number;
  radius: number;
}

type ActiveRootCatalog = PublicAuthorityRootShard['root'];

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

export function packingIdForRootEntry(index: number): string {
  return `root-entry-${String(index).padStart(2, '0')}`;
}

export function isUnavailableRootCatalogDomain(domain: ActiveRootCatalog['domains'][number]): boolean {
  return isBlank(domain.displayName) || isBlank(domain.summary);
}

export function isUnavailableRootCatalogAggregate(aggregate: ActiveRootCatalog['aggregate']): boolean {
  return isBlank(aggregate.displayName) || isBlank(aggregate.summary);
}

export function toActiveAuthorityRootPackingNodes(
  catalog: ActiveRootCatalog,
): KnowledgeNodeData[] {
  const domainNodes = catalog.domains.map((domain, index) => {
    const unavailable = isUnavailableRootCatalogDomain(domain);
    return {
      id: packingIdForRootEntry(index),
      name: unavailable ? ACTIVE_AUTHORITY_ROOT_UNAVAILABLE_LABEL : domain.displayName.trim(),
      nodeType: 'THEORY' as const,
      description: '',
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      metadata: {
        isCollapsedRoot: true,
        presentationKind: 'domain',
        nodeCount: unavailable ? 16 : Math.max(16, domain.memberCount),
      },
    } satisfies KnowledgeNodeData;
  });

  const aggregateUnavailable = isUnavailableRootCatalogAggregate(catalog.aggregate);
  domainNodes.push({
    id: packingIdForRootEntry(catalog.domains.length),
    name: aggregateUnavailable
      ? ACTIVE_AUTHORITY_ROOT_AGGREGATE_UNAVAILABLE_LABEL
      : catalog.aggregate.displayName.trim(),
    nodeType: 'THEORY',
    description: '',
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    metadata: {
      isCollapsedRoot: true,
      presentationKind: 'aggregate',
      nodeCount: 96,
    },
  });

  return domainNodes;
}

export function packActiveAuthorityRootEntries(
  catalog: ActiveRootCatalog,
  viewport: Pick<KnowledgeRootPackingViewport, 'viewportWidth' | 'viewportHeight'>,
): ActiveAuthorityRootPackedEntry[] {
  const packingNodes = toActiveAuthorityRootPackingNodes(catalog);
  const packed = packKnowledgeGraphRootNodes(
    packingNodes,
    {
      viewportWidth: viewport.viewportWidth,
      viewportHeight: viewport.viewportHeight,
      graphVersion: 'active-root-catalog',
    },
    undefined,
    (left, right) => left.id.localeCompare(right.id),
  );

  return packed.map((node) => {
    const index = Number.parseInt(node.id.slice('root-entry-'.length), 10);
    const isAggregate = index >= catalog.domains.length;
    const domain = isAggregate ? null : catalog.domains[index];
    const unavailable = isAggregate
      ? isUnavailableRootCatalogAggregate(catalog.aggregate)
      : Boolean(domain && isUnavailableRootCatalogDomain(domain));
    return {
      packingId: node.id,
      kind: isAggregate ? 'aggregate' : 'domain',
      visualRole: isAggregate ? null : domain?.visualRole ?? null,
      name: node.name,
      summary: unavailable
        ? ''
        : (isAggregate ? catalog.aggregate.summary.trim() : domain?.summary.trim() ?? ''),
      unavailable,
      x: node.x,
      y: node.y,
      radius: node.__knowledgeRootPacking.collisionRadius,
    };
  });
}

export function activeAuthorityRootPackingMetadataKeys(
  catalog: ActiveRootCatalog,
): string[] {
  return toActiveAuthorityRootPackingNodes(catalog).flatMap((node) => Object.keys(node.metadata ?? {}));
}
