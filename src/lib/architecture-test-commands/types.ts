import { CHARTER_SCHEMA_VERSION, REQUIRED_BASELINE } from '@/lib/architecture-charter';

export const TEST_COMMAND_CORE_SCHEMA_VERSION = 'act-test-command-contracts/v1' as const;
export const TEST_MEASUREMENT_RECEIPT_SCHEMA_VERSION = 'act-test-command-measurement-receipt/v1' as const;
export const RELEASE_QUALIFICATION_MANIFEST_SCHEMA_VERSION = 'act-release-qualification-manifest/v1' as const;

export const REQUIRED_CHARTER = {
  schemaVersion: CHARTER_SCHEMA_VERSION,
  sha256: '76850de671d65e821dd2acebe070ab23d6a3f26a3a7d9f9527e32af75c957396',
} as const;

export const TEST_LAYERS = [
  'unit',
  'contract',
  'integration',
  'e2e-critical',
  'release',
  'nightly',
] as const;

export type TestLayer = (typeof TEST_LAYERS)[number];

export const GOVERNED_COMMAND_IDS = [
  'test',
  'test:unit',
  'test:contract',
  'test:integration',
  'test:e2e:critical',
  'test:release',
  'test:nightly',
] as const;

export type GovernedCommandId = (typeof GOVERNED_COMMAND_IDS)[number];

export interface TestRoot {
  readonly id: string;
  readonly prefix: string;
  readonly owner: string;
}

export interface ExclusionRule {
  readonly id: string;
  readonly owner: string;
  readonly reason: string;
  readonly removalCondition: string;
  readonly match: (path: string) => boolean;
}

export interface ScopeExclusion {
  readonly identity: string;
  readonly owner: string;
  readonly reason: string;
  readonly removalCondition: string;
}

export interface CommandContract {
  readonly id: GovernedCommandId;
  readonly npmScript: string;
  readonly scope: string;
  readonly layers: readonly TestLayer[];
  readonly extraIdentities: readonly string[];
  readonly excludedScopes: readonly string[];
  readonly requiredInputs: readonly string[];
  readonly executionGlobs: readonly string[];
  readonly executionIdentities: readonly string[];
  readonly remainderExecution: boolean;
  readonly ciWorkflow: string | null;
  readonly ciJob: string | null;
  readonly historicalComponents: readonly HistoricalComponent[];
}

export interface HistoricalComponent {
  readonly npmScript: string;
  readonly owner: string;
  readonly role: string;
}

export interface TestMember {
  readonly identity: string;
  readonly layer: TestLayer;
  readonly owner: string;
  readonly rootId: string;
  readonly classificationRule: string;
}

export interface ExclusionRecord {
  readonly identity: string;
  readonly ruleId: string;
  readonly owner: string;
  readonly reason: string;
  readonly removalCondition: string;
}

export interface UnresolvedRecord {
  readonly identity: string;
  readonly code: 'missing-root' | 'missing-classification' | 'unmatched-root' | 'execution-gap';
  readonly detail: string;
}

export interface DenominatorTotals {
  readonly discovered: number;
  readonly classified: number;
  readonly excluded: number;
  readonly unresolved: number;
}

export interface DiscoveryCore {
  readonly schemaVersion: typeof TEST_COMMAND_CORE_SCHEMA_VERSION;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly baseline: {
    readonly schemaVersion: typeof REQUIRED_BASELINE.schemaVersion;
    readonly sourceCommit: string;
    readonly sourceTree: string;
    readonly censusCoreSha256: string;
  };
  readonly charter: {
    readonly schemaVersion: typeof REQUIRED_CHARTER.schemaVersion;
    readonly sha256: string;
  };
  readonly commands: readonly CommandContract[];
  readonly roots: readonly Omit<TestRoot, never>[];
  readonly includeRules: readonly string[];
  readonly excludeRules: readonly string[];
  readonly totals: DenominatorTotals;
  readonly members: readonly TestMember[];
  readonly exclusions: readonly ExclusionRecord[];
  readonly unresolved: readonly UnresolvedRecord[];
}

export interface TestMeasurementReceipt {
  readonly schemaVersion: typeof TEST_MEASUREMENT_RECEIPT_SCHEMA_VERSION;
  readonly receiptId: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly command: GovernedCommandId | 'discover';
  readonly scope: string;
  readonly platform: string;
  readonly toolVersions: Readonly<Record<string, string>>;
  readonly cacheMode: string;
  readonly capturedAt: string;
  readonly exitStatus: number;
  readonly aggregate: Readonly<Record<string, number | string>>;
  readonly fingerprints: readonly string[];
}

export interface QualificationFailure {
  readonly code: string;
  readonly identity: string;
}

export interface FailClosedInput {
  readonly assertionFailures: number;
  readonly unhandledErrors: number;
  readonly unregisteredSkips: readonly string[];
  readonly unresolved: number;
  readonly denominatorGaps: number;
  readonly evidenceDrift: number;
  readonly acceptedFailures: number;
  readonly receiptDrift: number;
}

export interface FailClosedResult {
  readonly ok: boolean;
  readonly reasons: readonly string[];
}

export interface ReleaseEvidenceArtifact {
  readonly path: string;
  readonly sha256: string;
  readonly schema: string;
  readonly scope: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly capturedAt: string;
}

export interface ReleaseQualificationManifest {
  readonly schemaVersion: typeof RELEASE_QUALIFICATION_MANIFEST_SCHEMA_VERSION;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly artifacts: readonly ReleaseEvidenceArtifact[];
}

export { REQUIRED_BASELINE };
