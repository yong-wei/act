export const MIGRATION_BACKFILL_SCHEMA_VERSION = 'act-migration-backfill-competition-toolchains/v1' as const;

export type OneOffClass = 'migration-repair' | 'historical-backfill' | 'competition-material';
export type SafetyMode = 'read-only' | 'dry-run-default' | 'apply-gated';

export interface OneOffCommand {
  readonly path: string;
  readonly commandId: string;
  readonly owner: string;
  readonly oneOffClass: OneOffClass;
  readonly safetyMode: SafetyMode;
  readonly retirementCondition: string;
}

export interface ApplyGateInput {
  readonly mode: 'dry-run' | 'apply';
  readonly approval: string | null;
  readonly planHash: string;
  readonly currentInputHash: string;
  readonly targetIdentity: string;
}

export interface ApplyGateResult {
  readonly allowed: boolean;
  readonly executed: false;
  readonly status: 'dry-run' | 'apply-rejected' | 'apply-authorized-not-executed';
  readonly reason: string | null;
}

export interface CommandReceipt {
  readonly schemaVersion: typeof MIGRATION_BACKFILL_SCHEMA_VERSION;
  readonly commandId: string;
  readonly sourceRevision: string;
  readonly sourceTree: string;
  readonly planHash: string;
  readonly inputHash: string;
  readonly targetIdentity: string;
  readonly approvalState: 'absent' | 'stale' | 'fixture-approved' | 'not-required';
  readonly status: ApplyGateResult['status'];
  readonly executed: false;
}
