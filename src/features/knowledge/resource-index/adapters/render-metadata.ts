import { sha256Canonical } from '../canonical';
import {
  RENDER_METADATA_ADAPTER_VERSION,
  RENDER_METADATA_SOURCE_KIND,
  type AdapterRecord,
  type IndexedResourceAccess,
  type ResourceAvailability,
  type ResourceLauncherDescriptor,
  type SafeConfigValue,
  type SourceAdapterResult,
} from '../types';

export interface RenderMetadataRecord {
  id: string;
  label: string;
  type: string;
  renderTarget?: string | null;
  launchTarget?: string | null;
  knowledgeNodeIds?: string[];
  prerequisiteNodeIds?: string[];
  planningOverride?: {
    teacherPolicy?: string;
    privacyLevel?: string;
    availability?: string;
  };
  defaultConfig?: Record<string, unknown>;
}

const UNSAFE_CONFIG_KEYS = /path|url|href|hash|secret|token|component|answer|payload|eval|hint|signature/i;
const FILE_OR_MODULE_PATH = /(?:^|\/)src\/|\.(?:tsx?|jsx?|cjs|mjs)$/;
const UNSAFE_CONFIG_VALUE = /(?:^|\/)src\/|\.(?:tsx?|jsx?|cjs|mjs)$|file:|s3:|oss:|signed|x-amz|token=|secret/i;

function projectSafeConfigValue(value: unknown): SafeConfigValue | undefined {
  if (typeof value === 'string') {
    return FILE_OR_MODULE_PATH.test(value) || UNSAFE_CONFIG_VALUE.test(value) ? undefined : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => projectSafeConfigValue(item))
      .filter((item): item is SafeConfigValue => item !== undefined);
  }
  if (value && typeof value === 'object') {
    const nested: Record<string, SafeConfigValue> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (UNSAFE_CONFIG_KEYS.test(key)) continue;
      const projected = projectSafeConfigValue(child);
      if (projected !== undefined) nested[key] = projected;
    }
    return Object.keys(nested).length > 0 ? nested : undefined;
  }
  return undefined;
}

function asSafeConfig(config: Record<string, unknown> | undefined): { readonly [key: string]: SafeConfigValue } | undefined {
  if (!config) return undefined;
  const projected = projectSafeConfigValue(config);
  if (!projected || typeof projected !== 'object' || Array.isArray(projected)) return undefined;
  return projected as { readonly [key: string]: SafeConfigValue };
}

function launcherFor(record: RenderMetadataRecord): ResourceLauncherDescriptor | null {
  const launchTarget = typeof record.launchTarget === 'string' ? record.launchTarget : '';
  if (launchTarget && FILE_OR_MODULE_PATH.test(launchTarget)) {
    return null;
  }
  if (launchTarget.startsWith('/') && !launchTarget.startsWith('//')) {
    return {
      contractClass: 'owned-route',
      contractVersion: 'resource-launch-route.v1',
      launcherRef: launchTarget,
    };
  }
  if (record.type === 'INTERACTIVE_COMP' || record.type === 'SIMULATION_APP') {
    return {
      contractClass: 'render-registry',
      contractVersion: 'resource-registry.v1',
      launcherRef: record.id,
    };
  }
  return null;
}

function availabilityFor(record: RenderMetadataRecord): {
  availability: ResourceAvailability;
  availabilityCode: string;
  status: string;
  access: IndexedResourceAccess;
} {
  const planning = record.planningOverride ?? {};
  const access: IndexedResourceAccess = {
    ...(planning.teacherPolicy ? { teacherPolicy: planning.teacherPolicy } : {}),
    ...(planning.privacyLevel ? { privacyLevel: planning.privacyLevel } : {}),
    ...(planning.availability ? { sourceAvailability: planning.availability } : {}),
  };
  if (planning.availability === 'archived' || planning.teacherPolicy === 'blocked') {
    return {
      availability: 'unavailable',
      availabilityCode: 'source-archived-or-blocked',
      status: '源记录已归档或封禁。',
      access,
    };
  }
  if (!launcherFor(record)) {
    return {
      availability: 'unavailable',
      availabilityCode: 'launcher-contract-absent',
      status: '缺少可验证的启动合同。',
      access,
    };
  }
  return {
    availability: 'available',
    availabilityCode: 'available',
    status: '可用。',
    access,
  };
}

function resourceNodeIdFor(record: RenderMetadataRecord): string {
  const config = record.defaultConfig ?? {};
  if (config.resourceKind === 'arena-workbench' && typeof config.arenaTaskId === 'string' && config.arenaTaskId) {
    return `arena-task:${config.arenaTaskId}`;
  }
  return `registry:${record.id}`;
}

function toRecord(record: RenderMetadataRecord): AdapterRecord {
  const availability = availabilityFor(record);
  const launcher = launcherFor(record);
  return {
    sourceRef: record.id,
    sourceVersion: RENDER_METADATA_ADAPTER_VERSION,
    contentHash: sha256Canonical({
      id: record.id,
      label: record.label,
      type: record.type,
      renderTarget: record.renderTarget ?? null,
      launchTarget: record.launchTarget ?? null,
      knowledgeNodeIds: record.knowledgeNodeIds ?? [],
      prerequisiteNodeIds: record.prerequisiteNodeIds ?? [],
      planningOverride: record.planningOverride ?? null,
      defaultConfig: record.defaultConfig ?? null,
    }),
    scope: record.planningOverride?.privacyLevel || 'registry',
    title: record.label,
    type: record.type,
    required: true,
    availability: availability.availability,
    availabilityCode: availability.availabilityCode,
    status: availability.status,
    foreignRefs: {
      registryId: record.id,
      resourceNodeId: resourceNodeIdFor(record),
    },
    launcher,
    access: availability.access,
    safeConfig: asSafeConfig(record.defaultConfig),
  };
}

export function createRenderMetadataAdapter(input: {
  records: readonly RenderMetadataRecord[];
  sharedRevision?: string;
}): () => SourceAdapterResult {
  const records = input.records.map(toRecord);
  const capture = {
    owner: 'resource-registry-metadata',
    sourceKind: RENDER_METADATA_SOURCE_KIND,
    adapterVersion: RENDER_METADATA_ADAPTER_VERSION,
    inputDigest: sha256Canonical({
      owner: 'resource-registry-metadata',
      ids: records.map((record) => record.sourceRef),
      hashes: records.map((record) => record.contentHash),
    }),
    recordCount: records.length,
    ...(input.sharedRevision ? { sharedRevision: input.sharedRevision } : {}),
  } as const;

  return () => ({
    owner: 'resource-registry-metadata',
    sourceKind: RENDER_METADATA_SOURCE_KIND,
    adapterVersion: RENDER_METADATA_ADAPTER_VERSION,
    capture,
    records,
  });
}
