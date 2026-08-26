export const FITNESS_SCHEMA_VERSION = 'act-architecture-fitness/v1' as const;

export const VIOLATION_KINDS = [
  'feature-to-app',
  'deep-import',
  'domain-core-infrastructure',
  'lib-file',
  'scc',
] as const;

export type ViolationKind = (typeof VIOLATION_KINDS)[number];

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
