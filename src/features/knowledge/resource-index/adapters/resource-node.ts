import { sha256Canonical } from '../canonical';
import {
  RESOURCE_NODE_ADAPTER_VERSION,
  RESOURCE_NODE_SOURCE_KIND,
  type AdapterRecord,
  type SourceAdapterResult,
} from '../types';

export interface ResourceNodeAdapterRecord {
  nodeId: string;
  title: string;
  type: string;
  sourceKind: string;
  sourceRef: string;
  registryId?: string;
  teachingResourceId?: string;
  runtimeResourceRef?: string;
  canonicalIds?: readonly string[];
  formalBindingIds?: readonly string[];
  required?: boolean;
}

export function createResourceNodeAdapter(input: {
  owner: string;
  records: readonly ResourceNodeAdapterRecord[];
  sharedRevision?: string;
}): () => SourceAdapterResult {
  const records: AdapterRecord[] = input.records.map((record) => ({
    sourceRef: record.nodeId,
    sourceVersion: RESOURCE_NODE_ADAPTER_VERSION,
    contentHash: sha256Canonical({
      nodeId: record.nodeId,
      title: record.title,
      type: record.type,
      sourceKind: record.sourceKind,
      sourceRef: record.sourceRef,
      registryId: record.registryId ?? null,
      teachingResourceId: record.teachingResourceId ?? null,
      runtimeResourceRef: record.runtimeResourceRef ?? null,
      canonicalIds: record.canonicalIds ?? [],
      formalBindingIds: record.formalBindingIds ?? [],
    }),
    scope: 'planning',
    title: record.title,
    type: record.type,
    required: record.required !== false,
    availability: 'available',
    availabilityCode: 'available',
    status: '规划记录可用。',
    foreignRefs: {
      ...(record.registryId ? { registryId: record.registryId } : {}),
      ...(record.teachingResourceId ? { teachingResourceId: record.teachingResourceId } : {}),
      ...(record.runtimeResourceRef ? { runtimeResourceRef: record.runtimeResourceRef } : {}),
      ...(record.canonicalIds ? { canonicalIds: record.canonicalIds } : {}),
      resourceNodeId: record.nodeId,
      ...(record.formalBindingIds ? { formalBindingIds: record.formalBindingIds } : {}),
    },
    launcher: {
      contractClass: 'resource-node-workspace',
      contractVersion: 'resource-node-workspace.v1',
      launcherRef: record.nodeId,
    },
  }));

  const capture = {
    owner: input.owner,
    sourceKind: RESOURCE_NODE_SOURCE_KIND,
    adapterVersion: RESOURCE_NODE_ADAPTER_VERSION,
    inputDigest: sha256Canonical({
      owner: input.owner,
      ids: records.map((record) => record.sourceRef),
      hashes: records.map((record) => record.contentHash),
    }),
    recordCount: records.length,
    ...(input.sharedRevision ? { sharedRevision: input.sharedRevision } : {}),
  } as const;

  return () => ({
    owner: input.owner,
    sourceKind: RESOURCE_NODE_SOURCE_KIND,
    adapterVersion: RESOURCE_NODE_ADAPTER_VERSION,
    capture,
    records,
  });
}
