import { canonicalStringify, sha256Canonical } from './canonical';
import { ResourceRegistryIndexError } from './errors';
import { buildResourceIdentity, compareResourceIdentities } from './identity';
import {
  RESOURCE_REGISTRY_INDEX_CONTRACT,
  RESOURCE_REGISTRY_INDEX_GENERATOR_VERSION,
  type AdapterRecord,
  type IndexedResourceEntry,
  type RegistryIndex,
  type ResourceDescriptor,
  type ResourceForeignRefs,
  type ResourceLauncherDescriptor,
  type SourceAdapter,
  type SourceAdapterResult,
  type SourceCaptureIdentity,
} from './types';

const REQUIRED_RECORD_FIELDS = [
  'sourceRef',
  'sourceVersion',
  'contentHash',
  'scope',
  'title',
  'type',
] as const;

const UNSAFE_VALUE_PATTERN = /(?:^|\/)src\/|\.tsx?$|\.jsx?$|file:|s3:|oss:|signed|x-amz|token=|secret/i;

function fail(
  code: ConstructorParameters<typeof ResourceRegistryIndexError>[0],
  message: string,
  details?: Record<string, unknown>,
): never {
  throw new ResourceRegistryIndexError(code, message, details);
}

function requireNonEmpty(value: unknown, field: string, sourceKind: string, sourceRef: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail('MISSING_REQUIRED_FIELD', `Adapter ${sourceKind} omitted required ${field}.`, {
      sourceKind,
      sourceRef,
      field,
    });
  }
  return value;
}

function assertSafeLauncher(launcher: ResourceLauncherDescriptor | null, sourceRef: string): void {
  if (!launcher) return;
  const values = [launcher.contractClass, launcher.contractVersion, launcher.launcherRef ?? ''];
  if (values.some((value) => UNSAFE_VALUE_PATTERN.test(value))) {
    fail('UNSAFE_DESCRIPTOR', `Launcher for ${sourceRef} exposes an implementation path or secret.`, {
      sourceRef,
      launcher,
    });
  }
}

function assertSafeForeignRefs(refs: ResourceForeignRefs, sourceRef: string): void {
  const values = [
    refs.registryId,
    refs.teachingResourceId,
    refs.runtimeResourceRef,
    refs.resourceNodeId,
    ...(refs.canonicalIds ?? []),
    ...(refs.formalBindingIds ?? []),
  ].filter((value): value is string => typeof value === 'string');
  if (values.some((value) => UNSAFE_VALUE_PATTERN.test(value))) {
    fail('UNSAFE_DESCRIPTOR', `Foreign refs for ${sourceRef} expose an implementation path.`, { sourceRef, refs });
  }
}

function toDescriptor(
  sourceKind: SourceAdapterResult['sourceKind'],
  record: AdapterRecord,
): ResourceDescriptor {
  for (const field of REQUIRED_RECORD_FIELDS) {
    requireNonEmpty(record[field], field, sourceKind, record.sourceRef ?? '');
  }
  assertSafeLauncher(record.launcher, record.sourceRef);
  assertSafeForeignRefs(record.foreignRefs ?? {}, record.sourceRef);

  const identity = buildResourceIdentity({
    sourceKind,
    sourceRef: record.sourceRef,
    sourceVersion: record.sourceVersion,
    contentHash: record.contentHash,
    scope: record.scope,
  });

  const launcherMissing = record.launcher == null;
  const availability = launcherMissing
    ? 'unavailable'
    : record.availability;
  const availabilityCode = launcherMissing
    ? (record.availabilityCode === 'available' ? 'launcher-contract-absent' : record.availabilityCode)
    : record.availabilityCode;
  const status = launcherMissing
    ? (record.availabilityCode === 'available' ? '启动合同缺失，当前条目不可用。' : record.status)
    : record.status;

  return {
    identity,
    title: record.title,
    type: record.type,
    availability,
    availabilityCode,
    status,
    foreignRefs: record.foreignRefs ?? {},
    launcher: record.launcher,
    ...(record.safeConfig ? { safeConfig: record.safeConfig } : {}),
  };
}

function validateAdapter(result: SourceAdapterResult): void {
  if (typeof result.owner !== 'string' || result.owner.trim().length === 0) {
    fail('UNOWNED_ADAPTER', 'A source adapter omitted its owner.', { sourceKind: result.sourceKind });
  }
  if (!result.capture?.inputDigest || result.capture.owner !== result.owner) {
    fail('MISSING_CAPTURE', `Adapter ${result.sourceKind} omitted a complete capture identity.`, {
      sourceKind: result.sourceKind,
    });
  }
  if (result.capture.sourceKind !== result.sourceKind || result.capture.adapterVersion !== result.adapterVersion) {
    fail('IDENTITY_MISMATCH', `Adapter ${result.sourceKind} capture identity drifted from the adapter contract.`, {
      sourceKind: result.sourceKind,
      capture: result.capture,
    });
  }
  if (result.capture.recordCount !== result.records.length) {
    fail('IDENTITY_MISMATCH', `Adapter ${result.sourceKind} capture recordCount does not match emitted records.`, {
      sourceKind: result.sourceKind,
      captured: result.capture.recordCount,
      emitted: result.records.length,
    });
  }
}

export function buildResourceRegistryIndex(adapters: readonly SourceAdapter[]): RegistryIndex {
  if (!Array.isArray(adapters) || adapters.length === 0) {
    fail('UNOWNED_ADAPTER', 'RegistryIndex requires at least one declared source adapter.');
  }

  const captures: SourceCaptureIdentity[] = [];
  const entries: IndexedResourceEntry[] = [];
  const sourceRefs = new Map<string, string>();
  const identityKeys = new Map<string, string>();
  let sharedRevision: string | undefined;

  for (const adapter of adapters) {
    if (typeof adapter !== 'function') {
      fail('UNOWNED_ADAPTER', 'RegistryIndex received an undeclared adapter.');
    }
    const result = adapter();
    validateAdapter(result);

    if (result.capture.sharedRevision) {
      if (sharedRevision && sharedRevision !== result.capture.sharedRevision) {
        fail('MIXED_CAPTURE', 'Adapters were captured from different source revisions.', {
          expected: sharedRevision,
          observed: result.capture.sharedRevision,
          sourceKind: result.sourceKind,
        });
      }
      sharedRevision = result.capture.sharedRevision;
    }

    captures.push(result.capture);

    for (const record of result.records) {
      const sourceKey = `${result.sourceKind}\0${record.sourceRef}`;
      const previousSource = sourceRefs.get(sourceKey);
      if (previousSource) {
        fail('DUPLICATE_SOURCE_REF', `Duplicate ${result.sourceKind} sourceRef ${record.sourceRef}.`, {
          sourceKind: result.sourceKind,
          sourceRef: record.sourceRef,
        });
      }
      sourceRefs.set(sourceKey, result.owner);

      const descriptor = toDescriptor(result.sourceKind, record);
      const previousIdentity = identityKeys.get(descriptor.identity.key);
      if (previousIdentity) {
        fail('DUPLICATE_IDENTITY', `Identity collision for ${descriptor.identity.sourceRef}.`, {
          identityKey: descriptor.identity.key,
          previous: previousIdentity,
          sourceRef: descriptor.identity.sourceRef,
        });
      }
      identityKeys.set(descriptor.identity.key, descriptor.identity.sourceRef);

      entries.push({
        descriptor,
        access: record.access ?? {},
        required: record.required,
      });
    }
  }

  entries.sort((left, right) => compareResourceIdentities(left.descriptor.identity, right.descriptor.identity));
  captures.sort((left, right) => left.sourceKind.localeCompare(right.sourceKind)
    || left.owner.localeCompare(right.owner)
    || left.inputDigest.localeCompare(right.inputDigest));

  const body = {
    contract: RESOURCE_REGISTRY_INDEX_CONTRACT,
    generatorVersion: RESOURCE_REGISTRY_INDEX_GENERATOR_VERSION,
    captures,
    entries: entries.map((entry) => ({
      identity: entry.descriptor.identity,
      launcher: entry.descriptor.launcher,
      availability: entry.descriptor.availability,
      availabilityCode: entry.descriptor.availabilityCode,
      foreignRefs: entry.descriptor.foreignRefs,
      title: entry.descriptor.title,
      type: entry.descriptor.type,
      status: entry.descriptor.status,
      safeConfig: entry.descriptor.safeConfig ?? null,
      required: entry.required,
    })),
  };
  const digest = sha256Canonical(body);
  const identity = sha256Canonical({
    contract: body.contract,
    generatorVersion: body.generatorVersion,
    captures: captures.map((capture) => ({
      owner: capture.owner,
      sourceKind: capture.sourceKind,
      adapterVersion: capture.adapterVersion,
      inputDigest: capture.inputDigest,
    })),
    entryKeys: entries.map((entry) => entry.descriptor.identity.key),
    launchers: entries.map((entry) => entry.descriptor.launcher),
  });

  return {
    contract: RESOURCE_REGISTRY_INDEX_CONTRACT,
    generatorVersion: RESOURCE_REGISTRY_INDEX_GENERATOR_VERSION,
    identity,
    captures,
    entries,
    digest,
  };
}

export function serializeResourceRegistryIndex(index: RegistryIndex): string {
  return canonicalStringify({
    contract: index.contract,
    generatorVersion: index.generatorVersion,
    identity: index.identity,
    captures: index.captures,
    entries: index.entries,
    digest: index.digest,
  });
}
