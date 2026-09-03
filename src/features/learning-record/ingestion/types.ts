import type { LearningRecordEnvelope } from '@/features/learning-record/event-contract';
import type { LearningEvent } from '@/lib/data-governance/event-protocol';
import { LearningRecordDoubleWriteError } from '@/features/learning-record/personalization-ports/types';

export const LEARNING_FACT_INGESTION_OUTBOX_EVENT_TYPE = 'learning-fact-ingestion';
export const LEARNING_FACT_TRIGGER_OUTBOX_EVENT_TYPE = 'learning-fact-projection-trigger';

export const INGESTION_STATUS = {
  staged: 'staged',
  deduplicated: 'deduplicated',
  applied: 'applied',
  retryableFailed: 'retryable_failed',
  terminalFailed: 'terminal_failed',
} as const;

export type IngestionStatus = (typeof INGESTION_STATUS)[keyof typeof INGESTION_STATUS];

export type IngestionTransport = 'direct' | 'outbox-apply';

export type TrustedTimeSet = {
  trustedOccurredAt: string;
  receivedAt: string;
  materializedAt?: string;
  reportedClientAt?: string;
};

export interface IngestionAnchors {
  sourceEventId: string;
  sourceLogId?: string;
  canonicalActivityId?: string;
  canonicalResourceId?: string;
  canonicalKnowledgeId?: string;
  revision: string;
  captureRevision: string;
  schemaVersion: string;
  decoderVersion: string;
  materializerVersion: string;
}

export interface ProjectionTriggerDescriptor {
  triggerKey: string;
  subjectUserId: string;
  captureRevision: string;
  inputDigest: string;
  classId?: string;
}

export interface IngestLearningFactResult {
  status: IngestionStatus;
  profileRefreshed: false;
  transport: IngestionTransport;
  inputDigest: string;
  trustedSetDigest: string;
  trigger: ProjectionTriggerDescriptor | null;
  factsCreated: number;
  anchors?: IngestionAnchors;
  times?: TrustedTimeSet;
  rematerialization?: { decoderVersion: string; materializerVersion: string };
  failure?: { code: string; fingerprint: string; stage?: string };
  adapter?: {
    status: 'mapped' | 'not-applicable' | 'rejected';
    reason?: string;
    adapterVersion?: string;
    captureRevision?: string;
  };
}

export interface EvidenceOutboxDelegate {
  upsert(args: unknown): Promise<unknown>;
  findFirst?(args: unknown): Promise<{
    id?: string;
    status?: string;
    payload?: unknown;
    dedupeKey?: string;
    ownerUserId?: string;
    causationId?: string;
  } | null>;
  findMany?(args: unknown): Promise<Array<{
    id: string;
    status: string;
    payload: unknown;
    dedupeKey: string;
    ownerUserId: string;
    causationId: string;
    availableAt?: Date;
  }>>;
  updateMany?(args: unknown): Promise<{ count: number }>;
  update?(args: unknown): Promise<unknown>;
}

export interface IngestionWriteDb {
  learningFact: {
    createMany(args: { data: unknown[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
    findFirst?(args: unknown): Promise<{ sourceEventId?: string | null; contextJson?: unknown } | null>;
  };
  evidenceOutbox?: EvidenceOutboxDelegate;
  $transaction?<T>(fn: (tx: IngestionWriteDb) => Promise<T>): Promise<T>;
}

export interface RebaseReceipt {
  sourceRevision: string;
  targetRevision: string;
  reason: string;
  authorizedBy: string;
}

export interface IngestLearningFactInput {
  db: IngestionWriteDb;
  transport: IngestionTransport;
  event: LearningEvent;
  envelope?: LearningRecordEnvelope;
  actorUserId: string;
  captureRevision: string;
  classId?: string;
  now?: Date;
  receivedAt?: string;
  rebaseReceipt?: RebaseReceipt;
  captureRebaseReceipt?: RebaseReceipt;
}

export function rejectDirectAndOutboxDoubleWrite(input: {
  writesLearningFact: boolean;
  stagesOutbox: boolean;
}): void {
  if (input.writesLearningFact && input.stagesOutbox) {
    throw new LearningRecordDoubleWriteError();
  }
}

export function projectionTriggerKey(input: {
  subjectUserId: string;
  inputDigest: string;
  captureRevision: string;
}): string {
  return `learning-fact-trigger:${input.subjectUserId}:${input.inputDigest}:${input.captureRevision}`;
}

export function ingestionDedupeKey(input: {
  sourceEventId: string;
  captureRevision: string;
}): string {
  return `learning-fact-ingestion:${input.sourceEventId}:${input.captureRevision}`;
}

export function readExistingInputDigest(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const digest = (payload as { inputDigest?: unknown }).inputDigest;
  return typeof digest === 'string' ? digest : undefined;
}

export function currentCaptureRevision(env: NodeJS.ProcessEnv = process.env): string {
  return env.APP_REVISION || env.GIT_SHA || 'working-tree';
}
