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

export type WorkerJobData = EventIngestionJob | StudentSnapshotJob | ClassSnapshotJob;
