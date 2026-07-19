export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface Drift {
  code: string;
  scope: string;
  expected?: Json;
  observed?: Json;
  detail?: string;
}

export interface SnapshotProof {
  profile: 'immutable_export' | 'repeatable_read_read_only';
  export_object_id?: string;
  generated_at?: string;
  export_digest?: string;
  transaction_isolation?: string;
  transaction_started_at?: string;
  exported_snapshot_token?: string;
  shared_snapshot_import_count?: number;
}

export interface DatabaseDataset {
  id: string;
  table: string;
  count: number;
  watermark: string | null;
  shape: string[];
  versions: string[];
  dispositions?: Record<string, number | 'suppressed'>;
}

export interface DatabaseSnapshot {
  snapshot_id: string;
  captured_at: string;
  snapshot_proof: SnapshotProof;
  datasets: DatabaseDataset[];
  dataset_watermarks: Record<string, string | null>;
}

export interface InventoryOptions {
  root: string;
  registryPath?: string;
  databaseExportPath?: string;
  databaseExportProofPath?: string;
  capturedAt?: string;
  anchorFixturePath?: string;
}
