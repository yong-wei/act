export interface EventIngestionJob {
  batchDate?: string;
}

export interface StudentSnapshotJob {
  userId: string;
}

export interface ClassSnapshotJob {
  classId: string;
}

export type WorkerJobData = EventIngestionJob | StudentSnapshotJob | ClassSnapshotJob;
