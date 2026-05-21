export interface EventIngestionJob {
  batchDate?: string;
  coordinator?: boolean;
}

export interface StudentSnapshotJob {
  userId?: string;
  coordinator?: boolean;
}

export interface ClassSnapshotJob {
  classId?: string;
  coordinator?: boolean;
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
