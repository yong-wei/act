import { BACKFILL_LANE_CAPTURE_SHA, type BackfillLaneRow } from './types';

function row(
  id: string,
  kind: BackfillLaneRow['kind'],
  path: string,
  owner: string,
  mode: BackfillLaneRow['mode'],
  authorization: string,
  deletionCondition: string,
): BackfillLaneRow {
  return { id, kind, path, owner, mode, authorization, deletionCondition };
}

export const BACKFILL_LANE_ROWS: readonly BackfillLaneRow[] = [
  row('online.student', 'online-reader', 'src/features/learning-record/consumers/ports.ts', 'learning-record', 'online', 'role-safe current port', 'keep'),
  row('online.teacher', 'online-reader', 'src/features/learning-record/consumers/ports.ts', 'learning-record', 'online', 'role-safe current port', 'keep'),
  row('online.profile-api', 'online-reader', 'src/app/api/user/profile/route.ts', 'platform', 'online', 'current projection only', 'keep'),
  row('pointer.current', 'pointer-writer', 'src/features/learning-record/projections/pointer.ts', 'learning-record', 'authorized-cutover', 'generation/cutover fence', 'keep'),
  row('worker.ingest', 'worker', 'scripts/workers/data-governance-worker.ts', 'ingestion', 'online', 'idempotent ingest', 'keep'),
  row('backfill.historical', 'backfill-command', 'src/lib/data-governance/historical-evidence-materialization.ts', 'data-governance', 'ordinary-backfill', 'operationId+authorizedBy+frozenCutoff', 'retained-authorized'),
  row('backfill.historical-cli', 'backfill-command', 'scripts/db/materialize-historical-learning-facts.ts', 'data-governance', 'ordinary-backfill', 'CLI --apply --operation-id --authorize', 'retained-authorized'),
  row('backfill.course-evidence', 'backfill-command', 'src/lib/data-governance/course-evidence-backfill.ts', 'data-governance', 'ordinary-backfill', 'operationId+authorizedBy+frozenCutoff', 'retained-authorized'),
  row('backfill.course-evidence-cli', 'backfill-command', 'scripts/db/backfill-course-evidence-and-reporting.ts', 'data-governance', 'ordinary-backfill', 'CLI --apply plus operation identity', 'retained-authorized'),
  row('backfill.event-batches', 'backfill-command', 'scripts/db/backfill-learning-facts-from-event-batches.ts', 'data-governance', 'ordinary-backfill', 'CLI --apply plus operation identity', 'retained-authorized'),
  row('backfill.interaction-logs', 'backfill-command', 'scripts/db/backfill-learning-facts-from-interaction-logs.ts', 'data-governance', 'ordinary-backfill', 'CLI --apply plus operation identity', 'retained-authorized'),
  row('report.course-evidence', 'report', 'src/lib/data-governance/course-evidence-backfill.ts', 'data-governance', 'ordinary-backfill', 'apply-only regenerateReports', 'retained-authorized'),
  row('legacy.enqueue-snapshots', 'legacy-isolated', 'scripts/db/backfill-learning-facts-from-event-batches.ts', 'data-governance', 'ordinary-backfill', 'throws if --enqueue-snapshots', 'already-removed'),
];

export function listOrdinaryBackfillPaths(): string[] {
  return BACKFILL_LANE_ROWS
    .filter((item) => item.mode === 'ordinary-backfill')
    .map((item) => item.path);
}
