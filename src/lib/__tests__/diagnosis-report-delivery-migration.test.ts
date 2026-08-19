import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('diagnosis report delivery migration', () => {
  it('uses restrictive audit relations and stable artifact/disposition identities', async () => {
    const sql = await readFile(join(
      process.cwd(),
      'prisma/migrations/20260819180000_add_diagnosis_report_delivery/migration.sql',
    ), 'utf8');
    expect(sql).toContain('"DiagnosisReportExportArtifact_identity_key"');
    expect(sql).toContain('"DiagnosisReportDisposition_idempotency_key"');
    expect(sql.match(/ON DELETE RESTRICT/g)?.length).toBe(6);
    expect(sql).toContain('"artifactBytes" BYTEA NOT NULL');
  });
});
