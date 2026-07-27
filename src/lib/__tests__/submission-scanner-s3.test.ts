import type { PrismaClient } from '@prisma/client';
import type { S3Client } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { S3ObjectTagSubmissionScanner } from '@/lib/assignments/submission-object-store';
import { runSubmissionScanBatch } from '@/lib/assignments/submission-scanner';

const config = { endpoint: 'https://minio.invalid', bucket: 'private', accessKey: 'scanner', secretKey: 'secret' };

describe('S3 scanner error normalization', () => {
  it('maps AWS 404 to object-not-ready TTL retry without leaking the SDK message', async () => {
    const scanner = new S3ObjectTagSubmissionScanner(config, clientThrowing({ name: 'NoSuchKey', message: 'secret bucket detail', $metadata: { httpStatusCode: 404 } }));
    const fixture = prismaFixture(); const result = await runSubmissionScanBatch(fixture.prisma, scanner, healthyContentScanner());
    expect(result).toMatchObject({ retrying: 1, failed: 0 });
    expect(fixture.asset).toMatchObject({ state: 'QUARANTINED', scanState: 'PENDING', scanRetryCount: 1, lastScanErrorCode: 'object-not-ready' });
    expect(fixture.asset.nextScanAt).toBeInstanceOf(Date); expect(fixture.asset.lastScanErrorCode).not.toContain('secret');
  });

  it('keeps AWS 403 fatal instead of disguising it as a missing upload', async () => {
    const scanner = new S3ObjectTagSubmissionScanner(config, clientThrowing({ name: 'AccessDenied', message: 'credential detail', $metadata: { httpStatusCode: 403 } }));
    const fixture = prismaFixture();
    await expect(runSubmissionScanBatch(fixture.prisma, scanner, healthyContentScanner())).rejects.toMatchObject({ code: 'scanner-object-access-forbidden', status: 503 });
    expect(fixture.asset.lastScanErrorCode).toBeNull();
  });

  it('does not classify a bucket-level 404 as a missing object', async () => {
    const scanner = new S3ObjectTagSubmissionScanner(config, clientThrowing({ name: 'NoSuchBucket', message: 'bucket detail', $metadata: { httpStatusCode: 404 } }));
    await expect(scanner.readForScan('quarantine/missing-bucket')).rejects.toMatchObject({ code: 'scanner-object-read-transient', status: 502 });
  });

  it('keeps PutObjectTagging 403 fatal and does not persist a false FAILED state', async () => {
    const bytes = pdfBytes(); const scanner = new S3ObjectTagSubmissionScanner(config, clientWithTagFailure(bytes, { name: 'AccessDenied', message: 'tag policy secret', $metadata: { httpStatusCode: 403 } }));
    const fixture = prismaFixture(); fixture.asset.checksum = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    await expect(runSubmissionScanBatch(fixture.prisma, scanner, healthyContentScanner())).rejects.toMatchObject({ code: 'scanner-object-access-forbidden', status: 503 });
    expect(fixture.asset).toMatchObject({ state: 'QUARANTINED', scanState: 'PENDING', scanRetryCount: 0, lastScanErrorCode: null });
    const healthScanner = new S3ObjectTagSubmissionScanner({ ...config, probeKey: 'health/probe' }, clientWithTagFailure(bytes, { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } }));
    await expect(healthScanner.healthCheck()).rejects.toMatchObject({ code: 'scanner-object-access-forbidden' });
  });

  it('classifies an object disappearing before tag write as a safe terminal state', async () => {
    const bytes = pdfBytes(); const scanner = new S3ObjectTagSubmissionScanner(config, clientWithTagFailure(bytes, { name: 'NoSuchKey', message: 'internal key', $metadata: { httpStatusCode: 404 } }));
    const fixture = prismaFixture(); fixture.asset.checksum = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    const result = await runSubmissionScanBatch(fixture.prisma, scanner, healthyContentScanner());
    expect(result.failed).toBe(1); expect(fixture.asset).toMatchObject({ state: 'REVOKED', scanState: 'MISSING', lastScanErrorCode: 'object-disappeared' });
  });

  it('maps AWS 5xx and network reads to transient retry and fails after three attempts', async () => {
    const scanner = new S3ObjectTagSubmissionScanner(config, clientThrowing({ name: 'ServiceUnavailable', message: 'internal endpoint', $metadata: { httpStatusCode: 503 } }));
    const fixture = prismaFixture();
    for (let attempt = 0; attempt < 3; attempt += 1) await runSubmissionScanBatch(fixture.prisma, scanner, healthyContentScanner());
    expect(fixture.asset).toMatchObject({ state: 'REVOKED', scanState: 'FAILED', scanRetryCount: 3, lastScanErrorCode: 'scanner-transient', nextScanAt: null });
    expect(fixture.asset.lastScanErrorCode).not.toContain('endpoint');
    const networkScanner = new S3ObjectTagSubmissionScanner(config, clientThrowing(new Error('socket host detail'))); const network = prismaFixture();
    for (let attempt = 0; attempt < 3; attempt += 1) await runSubmissionScanBatch(network.prisma, networkScanner, healthyContentScanner());
    expect(network.asset).toMatchObject({ state: 'REVOKED', scanState: 'FAILED', scanRetryCount: 3, lastScanErrorCode: 'scanner-transient' }); expect(network.asset.lastScanErrorCode).not.toContain('socket');
  });

  it('revokes a clean-scanned object whose bytes do not match the declared format', async () => {
    const bytes = new TextEncoder().encode('not-a-pdf!!');
    const fixture = prismaFixture();
    fixture.asset.sizeBytes = bytes.byteLength;
    fixture.asset.checksum = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    const contentScanner = { async healthCheck() {}, scan: vi.fn(async () => 'CLEAN' as const) };
    let trustedState = '';
    const objectScanner = {
      async healthCheck() {},
      async readForScan() { return bytes; },
      async recordTrustedResult(_key: string, state: 'CLEAN' | 'UNSAFE') { trustedState = state; },
    };

    await expect(runSubmissionScanBatch(fixture.prisma, objectScanner, contentScanner))
      .resolves.toMatchObject({ unsafe: 1, clean: 0 });
    expect(contentScanner.scan).not.toHaveBeenCalled();
    expect(trustedState).toBe('UNSAFE');
    expect(fixture.asset).toMatchObject({
      state: 'REVOKED',
      scanState: 'UNSAFE',
      lastScanErrorCode: 'format-mismatch',
    });
  });
});

function clientThrowing(error: object): S3Client {
  return { async send(command: object) { if (command.constructor.name === 'HeadBucketCommand') return {}; throw error; } } as unknown as S3Client;
}

function clientWithTagFailure(bytes: Uint8Array, error: object): S3Client { return { async send(command: object) { const name = command.constructor.name; if (name === 'HeadBucketCommand') return {}; if (name === 'GetObjectCommand') return { Body: { async transformToByteArray() { return bytes; } } }; if (name === 'PutObjectTaggingCommand') throw error; return { TagSet: [] }; } } as unknown as S3Client; }

function healthyContentScanner() { return { async healthCheck() {}, async scan() { return 'CLEAN' as const; } }; }
function pdfBytes() { return new TextEncoder().encode('%PDF-1.7\nEOF'); }

function prismaFixture() {
  const asset = { id: 'asset', objectKey: 'quarantine/aa/key', checksum: `sha256:${'a'.repeat(64)}`, sizeBytes: 12, mimeType: 'application/pdf', state: 'QUARANTINED', scanState: 'PENDING', scanRetryCount: 0, lastScanErrorCode: null as string | null, nextScanAt: null as Date | null, quarantineExpiresAt: new Date(Date.now() + 600_000), createdAt: new Date() };
  const prisma = { submissionAsset: { async findMany() { return asset.state === 'QUARANTINED' && asset.scanState === 'PENDING' ? [asset] : []; }, async updateMany(args: { data: Record<string, unknown> }) { Object.assign(asset, args.data); return { count: 1 }; } }, submissionObjectTombstone: { async upsert() { return {}; } }, async $transaction(operations: Array<Promise<unknown>>) { return Promise.all(operations); } } as unknown as PrismaClient;
  return { asset, prisma };
}
