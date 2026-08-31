import { sha256Canonical } from '../canonical';
import { ResourceRegistryIndexError } from '../errors';
import {
  PUBLISHED_ARTIFACT_ADAPTER_VERSION,
  PUBLISHED_ARTIFACT_SOURCE_KIND,
  type AdapterRecord,
  type ResourceAvailability,
  type SourceAdapterResult,
} from '../types';

export interface PublishedArtifactRecord {
  artifactRef: string;
  title: string;
  type: string;
  contentHash: string;
  sourceVersion: string;
  scope: string;
  required?: boolean;
  runtimeResourceRef?: string;
  canonicalIds?: readonly string[];
  launcherRef?: string;
  present?: boolean;
}

function availabilityFor(record: PublishedArtifactRecord): {
  availability: ResourceAvailability;
  availabilityCode: string;
  status: string;
} {
  if (record.present === false) {
    return {
      availability: record.required ? 'unavailable' : 'unavailable',
      availabilityCode: 'optional-artifact-missing',
      status: '可选发布工件缺失。',
    };
  }
  return {
    availability: 'available',
    availabilityCode: 'available',
    status: '发布工件可用。',
  };
}

export function createPublishedArtifactAdapter(input: {
  owner: string;
  records: readonly PublishedArtifactRecord[];
  sharedRevision?: string;
}): () => SourceAdapterResult {
  for (const record of input.records) {
    if (record.required === true && record.present === false) {
      throw new ResourceRegistryIndexError(
        'MISSING_REQUIRED_FIELD',
        `Required published artifact ${record.artifactRef} is absent.`,
        { artifactRef: record.artifactRef },
      );
    }
    if (record.required === true && record.present !== false && !record.launcherRef) {
      throw new ResourceRegistryIndexError(
        'MISSING_REQUIRED_FIELD',
        `Required published artifact ${record.artifactRef} omitted launcherRef.`,
        { artifactRef: record.artifactRef },
      );
    }
  }
  const records: AdapterRecord[] = input.records.map((record) => {
    const availability = availabilityFor(record);
    const present = record.present !== false;
    return {
      sourceRef: record.artifactRef,
      sourceVersion: record.sourceVersion,
      contentHash: record.contentHash,
      scope: record.scope,
      title: record.title,
      type: record.type,
      required: record.required === true,
      availability: availability.availability,
      availabilityCode: availability.availabilityCode,
      status: availability.status,
      foreignRefs: {
        ...(record.runtimeResourceRef ? { runtimeResourceRef: record.runtimeResourceRef } : {}),
        ...(record.canonicalIds ? { canonicalIds: record.canonicalIds } : {}),
      },
      launcher: present && record.launcherRef
        ? {
            contractClass: 'published-artifact',
            contractVersion: 'published-artifact.v1',
            launcherRef: record.launcherRef,
          }
        : null,
    };
  });

  const capture = {
    owner: input.owner,
    sourceKind: PUBLISHED_ARTIFACT_SOURCE_KIND,
    adapterVersion: PUBLISHED_ARTIFACT_ADAPTER_VERSION,
    inputDigest: sha256Canonical({
      owner: input.owner,
      records: input.records.map((record) => ({
        artifactRef: record.artifactRef,
        title: record.title,
        type: record.type,
        contentHash: record.contentHash,
        sourceVersion: record.sourceVersion,
        scope: record.scope,
        required: record.required === true,
        runtimeResourceRef: record.runtimeResourceRef ?? null,
        canonicalIds: [...(record.canonicalIds ?? [])].sort(),
        launcherRef: record.launcherRef ?? null,
        present: record.present !== false,
      })),
    }),
    recordCount: records.length,
    ...(input.sharedRevision ? { sharedRevision: input.sharedRevision } : {}),
  } as const;

  return () => ({
    owner: input.owner,
    sourceKind: PUBLISHED_ARTIFACT_SOURCE_KIND,
    adapterVersion: PUBLISHED_ARTIFACT_ADAPTER_VERSION,
    capture,
    records,
  });
}
