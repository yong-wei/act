import { createHash } from 'node:crypto';
import { createConnection } from 'node:net';
import type { PrismaClient } from '@prisma/client';

import { SUBMISSION_LIMITS, SubmissionError } from './submission-domain';
import type { MemorySubmissionObjectStore, SubmissionObjectScanner } from './submission-object-store';

export interface SubmissionContentScanner { healthCheck(): Promise<void>; scan(bytes: Uint8Array): Promise<'CLEAN' | 'UNSAFE'> }

export class HttpSubmissionContentScanner implements SubmissionContentScanner {
  constructor(private readonly config: { url: string; token: string }) { if (!config.url.startsWith('https://') || !config.token) throw new SubmissionError('scanner-service-not-configured', 503); }
  async healthCheck() { const response = await fetch(`${this.config.url}/health`, { headers: { authorization: `Bearer ${this.config.token}` }, cache: 'no-store' }); if (!response.ok) throw new SubmissionError('scanner-service-unhealthy', 503); }
  async scan(bytes: Uint8Array) { const response = await fetch(`${this.config.url}/scan`, { method: 'POST', headers: { authorization: `Bearer ${this.config.token}`, 'content-type': 'application/octet-stream', 'content-length': String(bytes.byteLength) }, body: Buffer.from(bytes) }); if (!response.ok) throw new SubmissionError('scanner-service-failed', 502); const payload = await response.json() as { state?: string }; if (payload.state !== 'CLEAN' && payload.state !== 'UNSAFE') throw new SubmissionError('scanner-service-invalid-result', 502); return payload.state; }
}

export class ClamAvTcpSubmissionContentScanner implements SubmissionContentScanner {
  constructor(private readonly config: { host: string; port: number }) { if (!config.host || !Number.isInteger(config.port) || config.port < 1) throw new SubmissionError('clamav-not-configured', 503); }
  async healthCheck() { const response = await clamCommand(this.config, Buffer.from('zPING\0')); if (!response.includes('PONG')) throw new SubmissionError('clamav-unhealthy', 503); }
  async scan(bytes: Uint8Array) { const chunks: Buffer[] = [Buffer.from('zINSTREAM\0')]; for (let offset = 0; offset < bytes.byteLength; offset += 64 * 1024) { const chunk = Buffer.from(bytes.slice(offset, offset + 64 * 1024)); const length = Buffer.alloc(4); length.writeUInt32BE(chunk.byteLength); chunks.push(length, chunk); } chunks.push(Buffer.alloc(4)); const response = await clamCommand(this.config, Buffer.concat(chunks)); if (response.includes(' FOUND')) return 'UNSAFE'; if (response.includes(' OK')) return 'CLEAN'; throw new SubmissionError('clamav-invalid-result', 502); }
}

export class LocalSubmissionObjectScanner implements SubmissionObjectScanner {
  constructor(private readonly store: MemorySubmissionObjectStore) {}
  async healthCheck() {}
  async readForScan(key: string) { return this.store.readObject(key); }
  async recordTrustedResult(key: string, state: 'CLEAN' | 'UNSAFE') { const metadata = await this.store.head(key); if (!metadata) throw new SubmissionError('scanner-object-missing', 404); this.store.put({ ...metadata, scanState: state }); }
}

export async function runSubmissionScanBatch(prisma: PrismaClient, objectScanner: SubmissionObjectScanner, contentScanner: SubmissionContentScanner, limit = 25) {
  await objectScanner.healthCheck(); await contentScanner.healthCheck();
  const now = new Date();
  const assets = await prisma.submissionAsset.findMany({ where: { state: 'QUARANTINED', scanState: 'PENDING', OR: [{ nextScanAt: null }, { nextScanAt: { lte: now } }] }, orderBy: { createdAt: 'asc' }, take: Math.min(Math.max(limit, 1), 100) });
  let clean = 0; let unsafe = 0; let retrying = 0; let failed = 0;
  for (const asset of assets) {
    try {
      const bytes = await objectScanner.readForScan(asset.objectKey);
      const actualChecksum = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
      if (bytes.byteLength > SUBMISSION_LIMITS.file || bytes.byteLength !== asset.sizeBytes || actualChecksum !== asset.checksum) {
        await markIntegrityFailure(prisma, objectScanner, asset);
        unsafe += 1; continue;
      }
      const state = await contentScanner.scan(bytes); await objectScanner.recordTrustedResult(asset.objectKey, state);
      await prisma.submissionAsset.updateMany({ where: { id: asset.id, state: 'QUARANTINED', scanState: 'PENDING' }, data: { scanState: state, scanRetryCount: 0, lastScanErrorCode: null, nextScanAt: null, ...(state === 'UNSAFE' ? { state: 'REVOKED' as const } : {}) } });
      if (state === 'CLEAN') clean += 1; else unsafe += 1;
    } catch (error) {
      if (error instanceof SubmissionError && error.code === 'scanner-object-access-forbidden') throw error;
      if (error instanceof SubmissionError && error.code === 'scanner-object-disappeared') {
        await prisma.$transaction([
          prisma.submissionAsset.updateMany({ where: { id: asset.id, state: 'QUARANTINED', scanState: 'PENDING' }, data: { state: 'REVOKED', scanState: 'MISSING', scanRetryCount: 0, lastScanErrorCode: 'object-disappeared', nextScanAt: null } }),
          prisma.submissionObjectTombstone.upsert({ where: { objectKey: asset.objectKey }, create: { objectKey: asset.objectKey, reason: 'scanner-object-disappeared', checksum: asset.checksum }, update: {} }),
        ]);
        failed += 1; continue;
      }
      const missing = error instanceof SubmissionError && ['object-store-read-missing', 'scanner-object-missing'].includes(error.code);
      const retryCount = asset.scanRetryCount + 1;
      if (missing) {
        const expired = !asset.quarantineExpiresAt || asset.quarantineExpiresAt <= now;
        await prisma.submissionAsset.updateMany({ where: { id: asset.id, state: 'QUARANTINED', scanState: 'PENDING' }, data: { scanRetryCount: retryCount, lastScanErrorCode: 'object-not-ready', nextScanAt: expired ? null : new Date(Math.min(asset.quarantineExpiresAt!.getTime(), now.getTime() + Math.min(60, 5 * 2 ** Math.min(retryCount - 1, 6)) * 1000)), ...(expired ? { state: 'REVOKED' as const, scanState: 'EXPIRED' } : {}) } });
        if (expired) { await prisma.submissionObjectTombstone.upsert({ where: { objectKey: asset.objectKey }, create: { objectKey: asset.objectKey, reason: 'upload-intent-expired', checksum: asset.checksum }, update: {} }); failed += 1; } else retrying += 1;
        continue;
      }
      const exhausted = retryCount >= 3;
      await prisma.submissionAsset.updateMany({ where: { id: asset.id, state: 'QUARANTINED', scanState: 'PENDING' }, data: { scanRetryCount: retryCount, lastScanErrorCode: 'scanner-transient', nextScanAt: exhausted ? null : new Date(now.getTime() + Math.min(60, 15 * 2 ** (retryCount - 1)) * 1000), ...(exhausted ? { state: 'REVOKED' as const, scanState: 'FAILED' } : {}) } });
      if (exhausted) failed += 1; else retrying += 1;
    }
  }
  return { processed: assets.length, clean, unsafe, retrying, failed };
}

async function markIntegrityFailure(prisma: PrismaClient, objectScanner: SubmissionObjectScanner, asset: { id: string; objectKey: string; checksum: string }) {
  await prisma.$transaction([
    prisma.submissionAsset.updateMany({ where: { id: asset.id, state: 'QUARANTINED', scanState: 'PENDING' }, data: { state: 'REVOKED', scanState: 'UNSAFE', scanRetryCount: 0, lastScanErrorCode: 'integrity-mismatch', nextScanAt: null } }),
    prisma.submissionObjectTombstone.upsert({ where: { objectKey: asset.objectKey }, create: { objectKey: asset.objectKey, reason: 'scanner-integrity-mismatch', checksum: asset.checksum }, update: {} }),
  ]);
  await objectScanner.recordTrustedResult(asset.objectKey, 'UNSAFE');
}

export function createSubmissionContentScanner() {
  if (process.env.SUBMISSION_CONTENT_SCANNER === 'clamav-tcp') return new ClamAvTcpSubmissionContentScanner({ host: process.env.SUBMISSION_CLAMAV_HOST ?? '', port: Number(process.env.SUBMISSION_CLAMAV_PORT ?? '3310') });
  if (process.env.SUBMISSION_CONTENT_SCANNER === 'https') return new HttpSubmissionContentScanner({ url: process.env.SUBMISSION_SCANNER_URL ?? '', token: process.env.SUBMISSION_SCANNER_TOKEN ?? '' });
  throw new SubmissionError('content-scanner-mode-required', 503);
}

function clamCommand(config: { host: string; port: number }, payload: Buffer): Promise<string> { return new Promise((resolve, reject) => { const socket = createConnection(config); const chunks: Buffer[] = []; socket.setTimeout(30_000); socket.on('connect', () => socket.end(payload)); socket.on('data', (chunk) => chunks.push(chunk)); socket.on('end', () => resolve(Buffer.concat(chunks).toString('utf8'))); socket.on('timeout', () => socket.destroy(new Error('clamav-timeout'))); socket.on('error', reject); }); }
