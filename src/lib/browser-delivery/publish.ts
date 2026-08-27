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
} from './types';

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
