export interface EventIngestionJob {
  batchDate?: string;
  coordinator?: boolean;
}

export interface StudentSnapshotJob {
  userId?: string;
  coordinator?: boolean;
  simulationTaskCatalogRefresh?: boolean;
  fullRebuild?: boolean;
  /** @deprecated Ignored by the cumulative worker; retained until old producers are removed. */
  rebuildGeneration?: number;
  calculationVersion?: string;
  learnerGeneration?: string;
  queueGeneration?: string;
  cutoverFence?: string;
  migrationRunId?: string;
  reconciliationRequestGeneration?: number;
  reconciliationClaimToken?: string;
  reconciliationClassIds?: string[];
  simulationTaskExpectedInputDigest?: string;
}

export interface ClassSnapshotJob {
  classId?: string;
  coordinator?: boolean;
  scope?: 'cumulative';
  calculationVersion?: string;
  learnerGeneration?: string;
  classGeneration?: string;
  queueGeneration?: string;
  cutoverFence?: string;
  migrationRunId?: string;
  /** @deprecated Ignored by the cumulative worker; retained until old producers are removed. */
  requestedAfter?: string;
  /** @deprecated Ignored by the cumulative worker; retained until old producers are removed. */
  runRef?: string;
}

export interface SessionReportJob {
  sessionId?: string;
}

export interface EvidenceFeatureCacheJob {
  userId?: string;
  coordinator?: boolean;
  rebuildAll?: boolean;
}

export type WorkerJobData =
  | EventIngestionJob
  | StudentSnapshotJob
  | ClassSnapshotJob
  | SessionReportJob
  | EvidenceFeatureCacheJob;
