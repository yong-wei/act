import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { assertLifecyclePolicy } from '@/lib/data-governance/math-document-grading-lifecycle';

const migration = readFileSync(join(process.cwd(), 'prisma/migrations/20260714020000_issue916_seed_submission_lifecycle_policies/migration.sql'), 'utf8');

describe('ordinary submission lifecycle policy migration', () => {
  it('seeds valid source-asset and answer-evidence policies idempotently', () => {
    for (const dataClass of ['source-asset', 'answer-evidence']) {
      const policy = {
        id: `grading-lifecycle:${dataClass}:baseline.v1`,
        dataClass,
        version: 'baseline.v1',
        retentionSeconds: 2_592_000,
        governedRecordRule: null,
        deleteStrategy: 'delete-content' as const,
        providerRetentionSeconds: 0,
        enabled: true,
      };

      expect(migration).toContain(`('${policy.id}', '${dataClass}', 'baseline.v1', 2592000, NULL, 'delete-content', 0, true`);
      expect(() => assertLifecyclePolicy(policy)).not.toThrow();
    }

    expect(migration).toContain('ON CONFLICT ("dataClass", "version") DO NOTHING;');
  });
});
