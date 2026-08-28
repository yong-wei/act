import {
  AUTHORITY_BUCKET,
  DELIVERY_BUCKET,
  MEDIA_TYPE,
  SHA256,
  STATIC_HOSTNAME,
} from './types';

export function objectKeyFor(digest: string, basename: string): string {
  if (!SHA256.test(digest)) throw new Error('invalid-object-digest');
  if (!/^[A-Za-z0-9._-]+\.glb$/u.test(basename)) throw new Error('invalid-object-basename');
  return `assets/${digest}/${basename}`;
}

export function esaObjectUrl(digest: string, basename: string): string {
  return `https://${STATIC_HOSTNAME}/${objectKeyFor(digest, basename)}`;
}

export function rejectPublicationTarget(bucket: string, objectKey: string, mediaType: string): string | null {
  if (bucket === AUTHORITY_BUCKET) return 'origin-authority-bucket';
  if (bucket !== DELIVERY_BUCKET) return 'origin-bucket-mismatch';
  if (mediaType !== MEDIA_TYPE) return 'media-type-mismatch';
  if (!objectKey.startsWith('assets/') || !objectKey.endsWith('.glb')) return 'object-key-mismatch';
  if (objectKey.includes('..') || objectKey.includes('\\')) return 'object-key-mismatch';
  if (/^(?:runtime|knowledge|assessment)\b/u.test(objectKey)) return 'authority-prefix';
  return null;
}
