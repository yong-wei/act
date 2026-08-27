import { createHash } from 'node:crypto';

import {
  AUTHORITY_BUCKET,
  CACHE_RULE,
  DELIVERY_BUCKET,
  MEDIA_TYPE,
  OBJECT_BASENAME,
  OBJECT_SCHEMA,
  SHA256,
  STATIC_HOSTNAME,
  type ObjectReceipt,
} from './types';

export function objectKeyForDigest(digest: string): string {
  if (!SHA256.test(digest)) throw new Error('invalid-object-digest');
  return `assets/${digest}/${OBJECT_BASENAME}`;
}

export function objectUrlPath(digest: string): string {
  return `/${objectKeyForDigest(digest)}`;
}

export function matchesCacheRule(urlPath: string): boolean {
  return urlPath.startsWith('/assets/') && CACHE_RULE === '/assets/*';
}

export function planObject(sourcePath: string, bytes: Uint8Array): ObjectReceipt {
  if (sourcePath.startsWith('/') || sourcePath.includes('..') || /^[A-Za-z]:\\/.test(sourcePath)) {
    throw new Error('source-path-must-be-repository-relative');
  }
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (!Number.isSafeInteger(bytes.byteLength) || bytes.byteLength < 1) {
    throw new Error('invalid-object-size');
  }
  return {
    schemaVersion: OBJECT_SCHEMA,
    sourcePath,
    sourceSha256: digest,
    objectSha256: digest,
    sizeBytes: bytes.byteLength,
    mediaType: MEDIA_TYPE,
    objectKey: objectKeyForDigest(digest),
    bucket: DELIVERY_BUCKET,
    publicAcl: false,
    overwriteAttempted: false,
    etagFingerprint: null,
  };
}

export function rejectAuthorityOrigin(bucket: string): string | null {
  if (bucket === AUTHORITY_BUCKET) return 'origin-authority-bucket';
  if (bucket !== DELIVERY_BUCKET) return 'origin-bucket-mismatch';
  return null;
}

export function staticObjectUrl(digest: string): string {
  return `https://${STATIC_HOSTNAME}${objectUrlPath(digest)}`;
}
