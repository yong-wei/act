import { DeleteObjectCommand, GetObjectCommand, GetObjectTaggingCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand, PutObjectTaggingCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, createHmac } from 'node:crypto';

import { opaqueObjectKey, SubmissionError } from './submission-domain';

export interface StoredObjectMetadata { key: string; ownerId: string; answerId: string; sizeBytes: number; mimeType: string; checksum: string; scanState: 'CLEAN' | 'PENDING' | 'UNSAFE'; attemptId?: string; workerClaimFingerprint?: string }
export interface SubmissionObjectStore {
  healthCheck(): Promise<void>;
  signUpload(intent: Omit<StoredObjectMetadata, 'key' | 'scanState'>, ttlSeconds?: number, objectKey?: string): Promise<{ key: string; url: string; expiresAt: string; requiredHeaders: Record<string, string> }>;
  head(key: string): Promise<StoredObjectMetadata | null>;
  readObject(key: string): Promise<Uint8Array>;
  delete(key: string, signal?: AbortSignal): Promise<void>;
}
export interface SubmissionObjectScanner { healthCheck(): Promise<void>; readForScan(key: string): Promise<Uint8Array>; recordTrustedResult(key: string, state: 'CLEAN' | 'UNSAFE'): Promise<void> }
function boundedTtl(ttl = 600) { if (!Number.isInteger(ttl) || ttl < 1 || ttl > 600) throw new SubmissionError('invalid-signed-url-ttl'); return ttl; }
function checksumBase64(checksum: string) { return Buffer.from(checksum.slice(7), 'hex').toString('base64'); }
function checksumHex(checksum: string | undefined) { return checksum ? `sha256:${Buffer.from(checksum, 'base64').toString('hex')}` : ''; }

export class S3CompatibleSubmissionObjectStore implements SubmissionObjectStore {
  private readonly client: S3Client;
  constructor(private readonly config: { endpoint: string; bucket: string; accessKey: string; secretKey: string; region?: string; forcePathStyle?: boolean }) {
    if (!config.endpoint.startsWith('https://') || !config.bucket || !config.accessKey || !config.secretKey) throw new SubmissionError('private-object-store-not-configured', 503);
    this.client = new S3Client({ endpoint: config.endpoint, region: config.region ?? 'us-east-1', forcePathStyle: config.forcePathStyle ?? true, credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey } });
  }
  async healthCheck() { try { await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket })); } catch { throw new SubmissionError('object-store-unhealthy', 503); } }
  async signUpload(intent: Omit<StoredObjectMetadata, 'key' | 'scanState'>, ttlSeconds = 600, objectKey?: string) {
    const ttl = boundedTtl(ttlSeconds); const key = objectKey ?? opaqueObjectKey();
    const command = new PutObjectCommand({ Bucket: this.config.bucket, Key: key, ContentType: intent.mimeType, ContentLength: intent.sizeBytes, ChecksumSHA256: checksumBase64(intent.checksum), Metadata: { owner: intent.ownerId, answer: intent.answerId, ...(intent.attemptId ? { 'attempt-id': intent.attemptId } : {}), ...(intent.workerClaimFingerprint ? { 'worker-claim-fingerprint': intent.workerClaimFingerprint } : {}) }, Tagging: 'scan-state=PENDING' });
    const url = await getSignedUrl(this.client, command, { expiresIn: ttl });
    return { key, url, expiresAt: new Date(Date.now() + ttl * 1000).toISOString(), requiredHeaders: { 'content-type': intent.mimeType, 'content-length': String(intent.sizeBytes), 'x-amz-checksum-sha256': checksumBase64(intent.checksum), 'x-amz-tagging': 'scan-state=PENDING' } };
  }
  async head(key: string): Promise<StoredObjectMetadata | null> {
    try {
      const [head, tags] = await Promise.all([this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key })), this.client.send(new GetObjectTaggingCommand({ Bucket: this.config.bucket, Key: key }))]);
      // The scanner owns object-tag mutation through a separate IAM identity; client metadata is never trusted as a scan verdict.
      const scanTag = tags.TagSet?.find((tag) => tag.Key === 'scan-state')?.Value;
      return { key, ownerId: head.Metadata?.owner ?? '', answerId: head.Metadata?.answer ?? '', sizeBytes: head.ContentLength ?? -1, mimeType: head.ContentType ?? '', checksum: checksumHex(head.ChecksumSHA256), scanState: scanTag === 'CLEAN' ? 'CLEAN' : scanTag === 'UNSAFE' ? 'UNSAFE' : 'PENDING', attemptId: head.Metadata?.['attempt-id'], workerClaimFingerprint: head.Metadata?.['worker-claim-fingerprint'] };
    } catch (error) { if (isExplicitMissingObjectError(error)) return null; throw new SubmissionError('object-store-head-failed', 502); }
  }
  async readObject(key: string) { const response = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key })); if (!response.Body) throw new SubmissionError('object-store-read-empty', 502); return response.Body.transformToByteArray(); }
  async delete(key: string, signal?: AbortSignal) {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }), signal ? { abortSignal: signal } : undefined);
    } catch (error) {
      if (isExplicitMissingObjectError(error)) throw new SubmissionError('object-store-delete-missing', 404);
      throw new SubmissionError(signal?.aborted ? 'object-store-delete-aborted' : 'object-store-delete-failed', signal?.aborted ? 409 : 502);
    }
  }
}

export class MemorySubmissionObjectStore implements SubmissionObjectStore {
  readonly objects = new Map<string, StoredObjectMetadata>();
  readonly payloads = new Map<string, Uint8Array>();
  private readonly intents = new Map<string, { metadata: Omit<StoredObjectMetadata, 'key' | 'scanState'>; expiresAt: number; signature: string }>();
  async healthCheck() {}
  async signUpload(intent: Omit<StoredObjectMetadata, 'key' | 'scanState'>, ttlSeconds = 600, objectKey?: string) { const ttl = boundedTtl(ttlSeconds); const key = objectKey ?? opaqueObjectKey(); const expiresAt = Date.now() + ttl * 1000; const signature = createHmac('sha256', process.env.SUBMISSION_LOCAL_SIGNING_SECRET ?? 'test-only-local-submission-secret').update(`${key}:${expiresAt}`).digest('hex'); this.intents.set(key, { metadata: structuredClone(intent), expiresAt, signature }); const origin = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'; return { key, url: `${origin}/api/student/submission-objects/local-upload?key=${encodeURIComponent(key)}&expires=${expiresAt}&signature=${signature}`, expiresAt: new Date(expiresAt).toISOString(), requiredHeaders: { 'content-type': intent.mimeType, 'content-length': String(intent.sizeBytes), 'x-amz-checksum-sha256': checksumBase64(intent.checksum) } }; }
  acceptSignedUpload(input: { key: string; expires: number; signature: string; bytes: Uint8Array; mimeType: string; checksumBase64: string }) { const intent = this.intents.get(input.key); if (!intent || intent.expiresAt !== input.expires || intent.signature !== input.signature || Date.now() > intent.expiresAt) throw new SubmissionError('invalid-local-upload-signature', 403); const checksum = `sha256:${createHash('sha256').update(input.bytes).digest('hex')}`; if (input.bytes.byteLength !== intent.metadata.sizeBytes || input.mimeType !== intent.metadata.mimeType || checksum !== intent.metadata.checksum || input.checksumBase64 !== checksumBase64(intent.metadata.checksum)) throw new SubmissionError('local-upload-contract-mismatch', 409); this.objects.set(input.key, { key: input.key, ...intent.metadata, scanState: 'PENDING' }); this.payloads.set(input.key, input.bytes.slice()); this.intents.delete(input.key); }
  put(metadata: StoredObjectMetadata) { this.objects.set(metadata.key, structuredClone(metadata)); }
  async head(key: string) { return this.objects.get(key) ?? null; }
  async readObject(key: string) { const bytes = this.payloads.get(key); if (!bytes) throw new SubmissionError('object-store-read-missing', 404); return bytes.slice(); }
  async delete(key: string, signal?: AbortSignal) {
    if (signal?.aborted) throw signal.reason ?? new SubmissionError('object-store-delete-aborted', 409);
    this.objects.delete(key);
    this.payloads.delete(key);
    if (signal?.aborted) throw signal.reason ?? new SubmissionError('object-store-delete-aborted', 409);
  }
}
export class S3ObjectTagSubmissionScanner implements SubmissionObjectScanner {
  private readonly client: S3Client;
  constructor(private readonly config: { endpoint: string; bucket: string; accessKey: string; secretKey: string; region?: string; probeKey?: string }, client?: S3Client) { if (!config.endpoint.startsWith('https://') || !config.bucket || !config.accessKey || !config.secretKey) throw new SubmissionError('trusted-scanner-not-configured', 503); this.client = client ?? new S3Client({ endpoint: config.endpoint, region: config.region ?? 'us-east-1', forcePathStyle: true, credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey } }); }
  async healthCheck() { try { await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket })); if (this.config.probeKey) { const current = await this.client.send(new GetObjectTaggingCommand({ Bucket: this.config.bucket, Key: this.config.probeKey })); await this.client.send(new PutObjectTaggingCommand({ Bucket: this.config.bucket, Key: this.config.probeKey, Tagging: { TagSet: current.TagSet ?? [] } })); } } catch (error) { if (this.config.probeKey) throw normalizeScannerS3Error(error); throw new SubmissionError('trusted-scanner-unhealthy', 503); } }
  async readForScan(key: string) { try { const response = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key })); if (!response.Body) throw new SubmissionError('scanner-object-empty', 502); return response.Body.transformToByteArray(); } catch (error) { const normalized = normalizeScannerS3Error(error); if (normalized.code === 'scanner-object-disappeared') throw new SubmissionError('object-store-read-missing', 404); throw normalized; } }
  async recordTrustedResult(key: string, state: 'CLEAN' | 'UNSAFE') { try { await this.client.send(new PutObjectTaggingCommand({ Bucket: this.config.bucket, Key: key, Tagging: { TagSet: [{ Key: 'scan-state', Value: state }] } })); } catch (error) { throw normalizeScannerS3Error(error); } }
}
export function createSubmissionObjectStore() {
  if (process.env.NODE_ENV === 'test' || (process.env.NODE_ENV === 'development' && process.env.SUBMISSION_OBJECT_STORE === 'memory')) return localTestSubmissionObjectStore;
  if (process.env.SUBMISSION_OBJECT_STORE === 'memory') throw new SubmissionError('memory-object-store-forbidden-in-production', 503);
  if (process.env.NODE_ENV === 'production' && (process.env.SUBMISSION_OBJECT_STORE !== 's3' || process.env.SUBMISSION_SCANNER_MODE !== 's3-object-tag' || !['clamav-tcp', 'https'].includes(process.env.SUBMISSION_CONTENT_SCANNER ?? ''))) throw new SubmissionError('submission-security-pipeline-not-configured', 503);
  return new S3CompatibleSubmissionObjectStore({ endpoint: process.env.SUBMISSION_S3_ENDPOINT ?? '', bucket: process.env.SUBMISSION_S3_BUCKET ?? '', accessKey: process.env.SUBMISSION_S3_ACCESS_KEY ?? '', secretKey: process.env.SUBMISSION_S3_SECRET_KEY ?? '', region: process.env.SUBMISSION_S3_REGION });
}
const localTestSubmissionObjectStore = new MemorySubmissionObjectStore();
export function getLocalTestSubmissionObjectStore() { if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') throw new SubmissionError('local-object-store-forbidden', 503); return localTestSubmissionObjectStore; }
export function createSubmissionObjectScanner() {
  if (process.env.NODE_ENV === 'test') return { async healthCheck() {}, async readForScan() { throw new SubmissionError('test-scanner-read-not-configured'); }, async recordTrustedResult() {} } satisfies SubmissionObjectScanner;
  if (process.env.SUBMISSION_SCANNER_MODE !== 's3-object-tag') throw new SubmissionError('trusted-scanner-mode-required', 503);
  return new S3ObjectTagSubmissionScanner({ endpoint: process.env.SUBMISSION_S3_ENDPOINT ?? '', bucket: process.env.SUBMISSION_S3_BUCKET ?? '', accessKey: process.env.SUBMISSION_SCANNER_ACCESS_KEY ?? '', secretKey: process.env.SUBMISSION_SCANNER_SECRET_KEY ?? '', region: process.env.SUBMISSION_S3_REGION, probeKey: process.env.SUBMISSION_SCANNER_PROBE_KEY });
}
export function createSubmissionGcObjectStore() {
  if (process.env.NODE_ENV === 'test') return localTestSubmissionObjectStore;
  return new S3CompatibleSubmissionObjectStore({ endpoint: process.env.SUBMISSION_S3_ENDPOINT ?? '', bucket: process.env.SUBMISSION_S3_BUCKET ?? '', accessKey: process.env.SUBMISSION_GC_ACCESS_KEY ?? '', secretKey: process.env.SUBMISSION_GC_SECRET_KEY ?? '', region: process.env.SUBMISSION_S3_REGION });
}

function isExplicitMissingObjectError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: unknown; code?: unknown; statusCode?: unknown; $metadata?: { httpStatusCode?: unknown } };
  const codes = new Set(['NoSuchKey', 'NoSuchObject', 'ObjectNotFound', 'NotFound', 'object-store-read-missing', 'object-store-delete-missing']);
  if (codes.has(String(candidate.name)) || codes.has(String(candidate.code))) return true;
  return Number(candidate.statusCode) === 404 && (codes.has(String(candidate.name)) || codes.has(String(candidate.code)));
}

function normalizeScannerS3Error(error: unknown): SubmissionError {
  if (error instanceof SubmissionError) return error;
  const status = error && typeof error === 'object' && '$metadata' in error ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode : undefined;
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name?: unknown }).name) : '';
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : '';
  const explicitObjectMissing = new Set(['NoSuchKey', 'NoSuchObject', 'ObjectNotFound', 'NotFound', 'object-store-read-missing']);
  if (explicitObjectMissing.has(name) || explicitObjectMissing.has(code)) return new SubmissionError('scanner-object-disappeared', 409);
  if (status === 403 || name === 'AccessDenied') return new SubmissionError('scanner-object-access-forbidden', 503);
  return new SubmissionError('scanner-object-read-transient', 502);
}
