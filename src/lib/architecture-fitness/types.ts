export const FITNESS_SCHEMA_VERSION = 'act-architecture-fitness/v1' as const;
export const FITNESS_BUDGET_SCHEMA_VERSION = 'act-architecture-fitness-budget/v2' as const;
export const FITNESS_REPORT_SCHEMA_VERSION = 'act-architecture-fitness-report/v1' as const;

export const REQUIRED_FITNESS_BUDGET = {
  ledgerSha256: 'd2ff999e91e965429c66369c75f6f35cfd3abc200ae8ecb04dd8d275d66b0255',
  allowlistSha256: '0d29851dcb123f0f2bb78346c9562753b163b33239e6ef7737a8a7190f9ba608',
} as const;

export const VIOLATION_KINDS = [
  'feature-to-app',
  'deep-import',
  'domain-core-infrastructure',
  'lib-file',
  'scc',
] as const;

export type ViolationKind = (typeof VIOLATION_KINDS)[number];

export const BUDGET_METRIC_KINDS = [
  'dependency-edge',
  'reverse-edge',
  'deep-import',
  'feature-to-app',
  'scc',
  'domain-core-infrastructure',
  'src-lib-freeze',
  'file-size',
  'center-node',
  'compile-resource',
] as const;

export type BudgetMetricKind = (typeof BUDGET_METRIC_KINDS)[number];
export type BudgetDirection = 'non-increasing' | 'frozen' | 'observed';
export type BudgetStatus = 'qualified' | 'blocked' | 'observed' | 'trend' | 'unresolved' | 'failed';
export type ExceptionState = 'none' | 'inherited' | 'removed' | 'blocker' | 'unresolved';

export type BudgetValue =
  | number
  | string
  | null
  | readonly string[]
  | Readonly<Record<string, boolean | number | string | null>>;

export interface BudgetTotals {
  readonly included: number;
  readonly excluded: number;
  readonly unresolved: number;
}

export interface FitnessBudgetRecord {
  readonly budgetId: string;
  readonly metricKind: BudgetMetricKind;
  readonly scope: string;
  readonly baselineIdentity: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly observedValue: BudgetValue;
  readonly direction: BudgetDirection;
  readonly owner: string;
  readonly evidenceRefs: readonly string[];
  readonly exceptionState: ExceptionState;
  readonly deletionCondition: string;
  readonly followUpChange: string;
  readonly status: BudgetStatus;
  readonly totals: BudgetTotals;
}

/**
 * Immutable identity of a frozen TypeScript graph receipt. The ledger pins
 * these identities before a later fitness run is allowed to compare against
 * the receipt, so a different historical receipt cannot become a baseline by
 * merely being placed in the frozen-artifact directory.
 */
export interface FrozenGraphReceiptIdentity {
  readonly graph: string;
  readonly receiptId: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly manifestHash: string;
}

export interface FitnessBudgetLedger {
  readonly schemaVersion: typeof FITNESS_BUDGET_SCHEMA_VERSION;
  readonly baselineIdentity: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly dependencyAllowlistIdentity: string;
  readonly charterIdentity: string;
  readonly baselineGraphReceipts: readonly FrozenGraphReceiptIdentity[];
  readonly budgets: readonly FitnessBudgetRecord[];
}

export interface FitnessBudgetFailure {
  readonly code: string;
  readonly identity: string;
  readonly budgetId?: string;
  readonly scope?: string;
  readonly detail?: string;
  readonly evidenceRefs?: readonly string[];
}

export interface FitnessBudgetSummary {
  readonly included: number;
  readonly excluded: number;
  readonly unresolved: number;
  readonly duplicate: number;
  readonly qualified: number;
  readonly observed: number;
  readonly trend: number;
  readonly blocked: number;
  readonly failed: number;
  readonly removedExceptions: number;
}

export interface FitnessBudgetReport {
  readonly schemaVersion: typeof FITNESS_REPORT_SCHEMA_VERSION;
  readonly baselineIdentity: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly status: BudgetStatus;
  readonly ok: boolean;
  readonly budgets: readonly FitnessBudgetRecord[];
  readonly failures: readonly FitnessBudgetFailure[];
  readonly summary: FitnessBudgetSummary;
}

export interface FitnessViolation {
  readonly id: string;
  readonly kind: ViolationKind;
  readonly identity: string;
  readonly owner: string;
  readonly classification: 'production' | 'test' | 'generated' | 'compatibility' | 'framework-convention';
  readonly consumers: readonly string[];
  readonly reason: string;
  readonly deletionCondition: string;
  readonly followUpChange: string;
}

export interface FitnessAllowlist {
  readonly schemaVersion: typeof FITNESS_SCHEMA_VERSION;
  readonly baselineSourceCommit: string;
  readonly baselineSourceTree: string;
  readonly charterSha256: string;
  readonly entries: readonly FitnessViolation[];
}

export interface FitnessReport {
  readonly ok: boolean;
  readonly allowlistCount: number;
  readonly currentCount: number;
  readonly newViolations: readonly FitnessViolation[];
  readonly remaining: readonly FitnessViolation[];
}
