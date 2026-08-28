export const PERSONALIZATION_OUTBOX_EVENT_TYPE = 'micro-intervention-evidence';

/** Spec `staged` / `deduplicated` / `applied` mapped onto durable EvidenceOutbox.status. */
export const EVIDENCE_OUTBOX_STATE = {
  staged: 'pending',
  applied: 'projected',
  deduplicated: 'superseded',
} as const;

export type EvidenceOutboxDurableStatus =
  | typeof EVIDENCE_OUTBOX_STATE.staged
  | typeof EVIDENCE_OUTBOX_STATE.applied
  | typeof EVIDENCE_OUTBOX_STATE.deduplicated
  | 'shadow'
  | 'failed';

export interface RecommendationEvidenceDb {
  studentEvidenceFeatureCache: {
    findUnique(args: { where: { userId: string } }): Promise<unknown>;
  };
  studentCompetencySnapshot: {
    findFirst(args: unknown): Promise<{ evidenceSummary?: unknown } | null>;
  };
  studentRiskFlag: {
    findMany(args: unknown): Promise<Array<{
      flagType: string;
      severity: string;
      description: string;
      evidenceJson: unknown;
      triggeredAt: Date;
    }>>;
  };
  learningFact: {
    findMany(args: unknown): Promise<Array<{
      id: string;
      factType: string;
      outcome: string;
      startedAt: Date;
      score?: number | null;
      contextJson: unknown;
    }>>;
  };
  userProgress: {
    count(args: unknown): Promise<number>;
  };
}

export interface LearningRecordFactWriteGuard {
  rejectDirectAndOutboxDoubleWrite(input: {
    writesLearningFact: boolean;
    stagesOutbox: boolean;
  }): void;
}

export class LearningRecordDoubleWriteError extends Error {
  readonly code = 'LEARNING_RECORD_DOUBLE_WRITE';

  constructor() {
    super('asynchronous intervention must not write LearningFact and EvidenceOutbox on the same producer path');
    this.name = 'LearningRecordDoubleWriteError';
  }
}
