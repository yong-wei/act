import { createHash } from 'node:crypto';

import { objectKeyFor, rejectPublicationTarget } from './keys';
import { assertPortable } from './privacy';
import {
  COHORT_ID,
  DELIVERY_BUCKET,
  MEDIA_TYPE,
  PUBLICATION_SCHEMA,
  type BrowserDeliveryManifest,
  type PublicationObject,
  type PublicationReceipt,
  type SimulationModelId,
} from './types';

export interface StoredObjectMeta {
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly mediaType: string;
}

export interface DeliveryObjectStore {
  head(key: string): StoredObjectMeta | null;
  putIfAbsent(key: string, bytes: Uint8Array, meta: StoredObjectMeta): 'created' | 'reused';
}

const FORBIDDEN_EXTENSIONS = ['.mp4', '.m4a', '.pdf', '.wasm', '.json'];

export function planPublication(manifest: BrowserDeliveryManifest): PublicationReceipt {
  const blockingReasons: string[] = [];
  const missing: string[] = [];
  const objects: PublicationObject[] = [];
  if (manifest.cohortId !== COHORT_ID) blockingReasons.push('cohort-mismatch');
  if (manifest.includedCount + manifest.excludedCount !== manifest.entries.length) {
    blockingReasons.push('denominator-imbalance');
  }
  for (const entry of manifest.entries) {
    if (!entry.publicEligible) blockingReasons.push(`not-public:${entry.logicalId}`);
    if (!entry.included) {
      missing.push(`excluded:${entry.logicalId}:${entry.exclusionReason ?? 'unknown'}`);
      continue;
    }
    if (!entry.outputSha256 || entry.outputBytes === null || !entry.objectKey) {
      missing.push(`output:${entry.logicalId}`);
      continue;
    }
    const derived = objectKeyFor(entry.outputSha256, entry.basename);
    if (derived !== entry.objectKey) blockingReasons.push(`key-mismatch:${entry.logicalId}`);
    const targetError = rejectPublicationTarget(DELIVERY_BUCKET, entry.objectKey, entry.mediaType);
    if (targetError) blockingReasons.push(`${targetError}:${entry.logicalId}`);
    objects.push({
      logicalId: entry.logicalId,
      objectKey: entry.objectKey,
      sha256: entry.outputSha256,
      sizeBytes: entry.outputBytes,
      mediaType: MEDIA_TYPE,
      basename: entry.basename,
    });
  }
  if (objects.length !== 7 && missing.length === 0 && blockingReasons.length === 0) {
    blockingReasons.push('incomplete-cohort');
  }
  const receipt: PublicationReceipt = {
    schemaVersion: PUBLICATION_SCHEMA,
    cohortId: COHORT_ID,
    bucket: DELIVERY_BUCKET,
    manifestDigest: manifest.manifestDigest,
    applied: false,
    objects,
    missing: [...new Set(missing)].sort(),
    blockingReasons: [...new Set(blockingReasons)].sort(),
  };
  assertPortable(receipt, 'browser-delivery-publication');
  return receipt;
}

export function rejectForbiddenAsset(pathOrKey: string): string | null {
  const lowered = pathOrKey.toLowerCase();
  if (FORBIDDEN_EXTENSIONS.some((ext) => lowered.endsWith(ext))) return 'non-glb-type';
  if (/(?:runtime\/|knowledge|assessment)/u.test(lowered)) return 'authority-prefix';
  return null;
}

export function publicationVerified(receipt: PublicationReceipt): boolean {
  return receipt.applied
    && receipt.blockingReasons.length === 0
    && receipt.missing.length === 0
    && receipt.objects.length === 7
    && receipt.bucket === DELIVERY_BUCKET;
}

export function createMemoryObjectStore(): DeliveryObjectStore {
  const objects = new Map<string, { bytes: Uint8Array; meta: StoredObjectMeta }>();
  return {
    head(key) {
      return objects.get(key)?.meta ?? null;
    },
    putIfAbsent(key, bytes, meta) {
      const existing = objects.get(key);
      if (existing) return 'reused';
      objects.set(key, { bytes, meta });
      return 'created';
    },
  };
}

export function publishCohort(
  manifest: BrowserDeliveryManifest,
  bodies: Partial<Record<SimulationModelId, Uint8Array>>,
  store: DeliveryObjectStore,
): PublicationReceipt {
  const planned = planPublication(manifest);
  const blockingReasons = [...planned.blockingReasons];
  const missing = [...planned.missing];
  const objects: PublicationObject[] = [];
  if (planned.bucket !== DELIVERY_BUCKET) blockingReasons.push('origin-bucket-mismatch');
  for (const object of planned.objects) {
    const bytes = bodies[object.logicalId];
    if (!bytes) {
      missing.push(`body:${object.logicalId}`);
      continue;
    }
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== object.sha256 || bytes.byteLength !== object.sizeBytes) {
      blockingReasons.push(`body-mismatch:${object.logicalId}`);
      continue;
    }
    const meta: StoredObjectMeta = {
      sizeBytes: object.sizeBytes,
      sha256: object.sha256,
      mediaType: object.mediaType,
    };
    const existing = store.head(object.objectKey);
    if (existing) {
      if (
        existing.sizeBytes !== meta.sizeBytes
        || existing.sha256 !== meta.sha256
        || existing.mediaType !== meta.mediaType
      ) {
        blockingReasons.push(`overwrite-refused:${object.logicalId}`);
        continue;
      }
      store.putIfAbsent(object.objectKey, bytes, meta);
    } else {
      store.putIfAbsent(object.objectKey, bytes, meta);
    }
    objects.push(object);
  }
  const receipt: PublicationReceipt = {
    ...planned,
    applied: blockingReasons.length === 0 && missing.length === 0 && objects.length === 7,
    objects,
    missing: [...new Set(missing)].sort(),
    blockingReasons: [...new Set(blockingReasons)].sort(),
  };
  assertPortable(receipt, 'browser-delivery-publication');
  return receipt;
}
