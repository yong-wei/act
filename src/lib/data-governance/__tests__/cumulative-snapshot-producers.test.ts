import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readSource(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('cumulative snapshot producer contract', () => {
  it('does not enqueue unfenced snapshots during session finalization', () => {
    const helper = readSource('src/lib/data-governance/session-finalization-snapshots.ts');
    const route = readSource('src/app/api/session/[sessionId]/route.ts');

    expect(helper).not.toContain('snapshot-student');
    expect(helper).not.toContain('snapshot-class');
    expect(helper).not.toContain('enqueueSessionFinalizationSnapshots');
    expect(route).not.toContain('enqueueSessionFinalizationSnapshots');
  });

  it('keeps worker-client scoped to event ingestion', () => {
    const source = readSource('src/lib/data-governance/worker-client.ts');

    expect(source).not.toContain('scheduleStudentSnapshot');
    expect(source).not.toContain('scheduleClassSnapshot');
    expect(source).not.toContain('getStudentSnapshotQueue');
    expect(source).not.toContain('getClassSnapshotQueue');
    expect(source).not.toContain("'snapshot-student'");
    expect(source).not.toContain("'snapshot-class'");
  });

  it('rejects the removed snapshot flag in historical fact importers', () => {
    for (const path of [
      'scripts/db/backfill-learning-facts-from-event-batches.ts',
      'scripts/db/backfill-learning-facts-from-interaction-logs.ts',
    ]) {
      const source = readSource(path);
      expect(source).toContain('--enqueue-snapshots has been removed');
      expect(source).toContain('db:backfill-cumulative-attainment');
      expect(source).not.toContain("new Queue<StudentSnapshotJob>('snapshot-student'");
    }
  });
});
