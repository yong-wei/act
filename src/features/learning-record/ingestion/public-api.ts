export { ingestLearningFact, computeDigests, resolveAnchors } from './ingest';
export { stageLearningFactIngestion } from './stage';
export { applyStagedLearningFactIngestions, applyStagedProjectionTriggers } from './apply-staged';
export { buildProjectionTrigger, recordProjectionTriggerIntent } from './trigger';
export {
  SOURCE_TRUST_POLICIES,
  evaluateSourceTimes,
  orderEnvelopes,
} from './source-trust';
export {
  assertStagingPayload,
  inspectIngestionBoundary,
  minimizedFailureRecord,
  sanitizeStagingPayload,
} from './sanitizer';
export {
  INGESTION_RETENTION,
  assertTerminalBeforeDelete,
  authorizeRawArtifact,
  authorizeReplay,
  successfulPayloadExpired,
  verifyDeletionUnreadability,
} from './retention';
export {
  INGESTION_STATUS,
  LEARNING_FACT_INGESTION_OUTBOX_EVENT_TYPE,
  LEARNING_FACT_TRIGGER_OUTBOX_EVENT_TYPE,
  currentCaptureRevision,
  ingestionDedupeKey,
  projectionTriggerKey,
  rejectDirectAndOutboxDoubleWrite,
  type IngestLearningFactInput,
  type IngestLearningFactResult,
  type IngestionStatus,
  type IngestionTransport,
  type ProjectionTriggerDescriptor,
  type RebaseReceipt,
} from './types';
