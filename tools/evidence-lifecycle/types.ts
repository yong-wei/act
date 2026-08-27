export const QA_EVIDENCE_SCHEMA_VERSION = 'act-qa-evidence-artifact-lifecycle/v1' as const;

export const EVIDENCE_CLASSES = [
  'representative-fixture',
  'portable-manifest',
  'run-specific-output',
  'audit-closure-document',
] as const;

export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];
export type PrivacyClass = 'public-fixture' | 'private-run-evidence' | 'none';
export type RetentionDecision = 'retain-in-repo' | 'externalize-then-delete' | 'keep-as-audit-ledger';

export interface ClassifiedArtifact {
  readonly path: string;
  readonly evidenceClass: EvidenceClass;
  readonly owner: string;
  readonly privacyClass: PrivacyClass;
  readonly retentionDecision: RetentionDecision;
  readonly blobHash: string;
}

export interface EvidenceManifest {
  readonly schemaVersion: typeof QA_EVIDENCE_SCHEMA_VERSION;
  readonly sourceRevision: string;
  readonly sourceTree: string;
  readonly route: string;
  readonly theme: string;
  readonly viewport: string;
  readonly role: string;
  readonly toolVersion: string;
  readonly captureRevision: string;
  readonly outputHash: string;
  readonly outputReference: string;
  readonly privacyClass: PrivacyClass;
  readonly status: 'accepted' | 'missing' | 'stale' | 'privacy-unsafe';
}

export interface DeletionReceipt {
  readonly schemaVersion: typeof QA_EVIDENCE_SCHEMA_VERSION;
  readonly sourceRevision: string;
  readonly sourceTree: string;
  readonly deletedCount: number;
  readonly retainedCount: number;
  readonly digest: string;
  readonly entries: readonly {
    readonly path: string;
    readonly blobHash: string;
    readonly reason: string;
    readonly recovery: 'git-history-blob';
    readonly outputReference: string;
  }[];
}
