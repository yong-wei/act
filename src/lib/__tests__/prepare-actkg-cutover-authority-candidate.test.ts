import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Client } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import {
  assertLocalDatabaseUrl,
  assertPointerStatesUnchanged,
  captureDefaultPointerState,
  fingerprintPublicSchema,
} from '../../../scripts/knowledge-cutover/prepare-actkg-cutover-authority-candidate';

describe('prepare-actkg-cutover-authority-candidate helpers', () => {
  it('allows only local loopback PostgreSQL URLs', () => {
    expect(() => assertLocalDatabaseUrl('postgresql://user:password@localhost:5432/act_obe')).not.toThrow();
    expect(() => assertLocalDatabaseUrl('postgresql://user:password@127.0.0.1:5432/act_obe')).not.toThrow();
    expect(() => assertLocalDatabaseUrl('postgresql://user:password@[::1]:5432/act_obe')).not.toThrow();
    expect(() => assertLocalDatabaseUrl('postgresql://user:password@db.example.test:5432/act_obe'))
      .toThrow(/local loopback/u);
  });

  it('fingerprints only validated public migrations and ActKG relations with row counts', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({
        rows: [{ migration_name: '20260810_cutover', checksum: 'abc', finished_at: '2026-08-10T00:00:00.000Z' }],
      })
      .mockResolvedValueOnce({ rows: [{ name: 'ActkgRelease' }] })
      .mockResolvedValueOnce({ rows: [{ row_count: '7' }] });
    const client = { query } as unknown as Client;

    const fingerprint = await fingerprintPublicSchema(client);

    expect(fingerprint.schema).toBe('public');
    expect(fingerprint.migrations).toEqual([{
      migrationName: '20260810_cutover',
      checksum: 'abc',
      finishedAt: '2026-08-10T00:00:00.000Z',
    }]);
    expect(fingerprint.actkgRelations).toEqual([{ name: 'ActkgRelease', rowCount: '7' }]);
    expect(fingerprint.digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('CREATE DATABASE'))).toBe(false);
  });

  it('compares default pointer bytes and detects a changed pointer', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'actkg-cutover-pointer-'));
    const pointer = path.join(root, 'course-content/authoring/knowledge/authority/current.json');
    try {
      await mkdir(path.dirname(pointer), { recursive: true });
      await writeFile(pointer, '{"snapshotId":"before"}\n');
      const before = await captureDefaultPointerState(root);
      const same = await captureDefaultPointerState(root);
      expect(() => assertPointerStatesUnchanged(before, same)).not.toThrow();

      await writeFile(pointer, '{"snapshotId":"after"}\n');
      const after = await captureDefaultPointerState(root);
      expect(() => assertPointerStatesUnchanged(before, after)).toThrow(/default pointer changed/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
