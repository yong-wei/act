import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspaceSource = readFileSync(
  join(process.cwd(), 'src/features/teacher/smart-lesson-plan-workspace.tsx'),
  'utf8',
);

describe('smart lesson plan workspace request contracts', () => {
  it('uses a fresh advisory-review idempotency key for each new click intent', () => {
    expect(workspaceSource).toContain('`smart-prep:${draft.id}:review:${crypto.randomUUID()}`');
    expect(workspaceSource).not.toContain('`smart-prep:${draft.id}:review:${draft.version}`');
  });

  it('does not offer recovery controls for a superseded generation job', () => {
    expect(workspaceSource).toContain("job && !job.supersededAt && ['PAUSED', 'RETRYABLE', 'FAILED', 'CANCELLED'].includes(job.state)");
    expect(workspaceSource).toContain("job && !job.supersededAt && ['QUEUED', 'RUNNING', 'PAUSED', 'RETRYABLE'].includes(job.state)");
  });
});
