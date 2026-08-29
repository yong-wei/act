import { RETIREMENT_FREEZE_REVISION, type RetirementRow } from './types';

export class RetirementGateError extends Error {
  constructor(
    public readonly code: 'retirement-unknown-row' | 'retirement-not-closed' | 'retirement-rollback-forbidden',
    message: string,
  ) {
    super(message);
    this.name = 'RetirementGateError';
  }
}

export const RETIREMENT_ROWS: readonly RetirementRow[] = [
  row('producer.interactive.direct', 'producer', 'ingestLearningFact', 'interactive', 'current-replacement', true),
  row('producer.redis.secondary-buffer', 'producer', 'claim-lease + ingest', 'data-governance-worker', 'retained-authorized', false),
  row('producer.assessment', 'producer', 'assessment owner + ingest', 'assessment', 'current-replacement', true),
  row('producer.personalization.micro-intervention', 'producer', 'plugin projector + trigger', 'personalization', 'current-replacement', true),
  row('producer.arena.official', 'producer', 'Arena official submission', 'arena', 'retained-authorized', false),
  row('producer.historical.backfill', 'backfill', 'writeLegacyKnowledgeScopedLearningFacts', 'data-governance', 'retained-authorized', false),
  row('worker.secondary.drain', 'worker', 'per-message receipt + confirmed ack', 'data-governance-worker', 'current-replacement', true),
  row('queue.rpop.destructive', 'queue', 'rpoplpush claim/lease', 'data-governance', 'code-retired', true),
  row('queue.ltrim.destructive', 'queue', 'reject writes at capacity', 'data-governance', 'code-retired', true),
  row('materializer.session-fact-replay', 'materializer', 'ingestLearningFact', 'interactive', 'code-retired', true),
  row('materializer.persist-core.ingest-only', 'materializer', 'ingestLearningFact only', 'ingestion', 'current-replacement', true),
  row('consumer.student.port', 'consumer', 'readStudentEvidencePort', 'learning-record consumers', 'current-replacement', true),
  row('consumer.teacher.port', 'consumer', 'teacher evidence ports', 'learning-record consumers', 'current-replacement', true),
  row('consumer.ai.port', 'consumer', 'readAuthorizedCumulativePortrait', 'learning-record consumers', 'current-replacement', true),
  row('consumer.copilot', 'consumer', 'resolveEvidenceCopilotContext', 'copilot', 'retained-authorized', false),
  row('consumer.personalization.plugin', 'consumer', 'plugin registry', 'personalization', 'retained-authorized', false),
  row('aggregator.interaction-log.profile', 'report', 'profile activity (not current scores)', 'profile', 'retained-authorized', false),
  row('aggregator.interaction-log.session-reports', 'report', 'session reports', 'session-reports', 'retained-authorized', false),
  row('aggregator.interaction-log.admin-audit', 'report', 'operator audit', 'admin', 'retained-authorized', false),
  row('projection.student-competency-snapshot', 'consumer', 'historical compatibility adapter', 'personalization', 'retained-authorized', false),
  row('privacy.sanitizer-allowlist', 'test', 'versioned sanitizer/allowlist', 'ingestion', 'current-replacement', true),
  row('privacy.raw-artifact', 'test', 'dual-control raw/replay auth', 'ingestion', 'current-replacement', true),
];

function row(
  id: string,
  kind: RetirementRow['kind'],
  replacement: string,
  owner: string,
  disposition: RetirementRow['disposition'],
  deletionConditionClosed: boolean,
): RetirementRow {
  return {
    id,
    kind,
    replacement,
    owner,
    disposition,
    deletionConditionClosed,
    privacyProof: 'ingestion-sanitizer-allowlist-retention',
  };
}

export function getRetirementRow(id: string): RetirementRow {
  const found = RETIREMENT_ROWS.find((item) => item.id === id);
  if (!found) {
    throw new RetirementGateError('retirement-unknown-row', `Unknown retirement row: ${id}`);
  }
  return found;
}

export function assertRetirementDeletionAllowed(id: string): RetirementRow {
  const found = getRetirementRow(id);
  if (found.disposition !== 'code-retired' || !found.deletionConditionClosed) {
    throw new RetirementGateError('retirement-not-closed', `Retirement row is not closed: ${id}`);
  }
  return found;
}

export function freezeRevision(): string {
  return RETIREMENT_FREEZE_REVISION;
}
