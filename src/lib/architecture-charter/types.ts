export const CHARTER_SCHEMA_VERSION = 'act-architecture-charter/v1' as const;

export const REQUIRED_BASELINE = {
  schemaVersion: 'act-architecture-census/v1',
  sourceCommit: '58c77cbf6e0f6cd284e1eea6a39ca4df8854ebac',
  sourceTree: '189dfeb5ad35f1d88e8ea5509a48b388424bf88f',
} as const;

export const OWNER_CATALOG = [
  { id: 'assessment', label: 'Assessment' },
  { id: 'personalization', label: 'Personalization' },
  { id: 'learning-record', label: 'Learning Record' },
  { id: 'course', label: 'Course' },
  { id: 'classroom', label: 'Classroom' },
  { id: 'assignment', label: 'Assignment' },
  { id: 'practice-lab', label: 'Practice Lab' },
  { id: 'arena', label: 'Arena' },
  { id: 'knowledge', label: 'Knowledge/Resource governance' },
  { id: 'identity', label: 'Identity/Authorization' },
  { id: 'platform', label: 'Platform/Delivery infrastructure' },
] as const;

export type OwnerId = (typeof OWNER_CATALOG)[number]['id'];
export type GateClass = 'hard' | 'contract' | 'soft' | 'removable';

export const OWNED_KINDS = [
  'entrypoint',
  'route',
  'api',
  'prisma-model',
  'prisma-access',
  'event-contract',
  'worker',
  'script',
  'test',
  'registry',
  'openspec-capability',
] as const;

export interface CharterOwnerRecord {
  readonly id: string;
  readonly kind: string;
  readonly identity: string;
  readonly owner: OwnerId;
  readonly currentOwnerEvidence: readonly string[];
  readonly evidence: readonly string[];
  readonly state: 'qualified';
}

export interface CharterGateRecord {
  readonly id: string;
  readonly identity: string;
  readonly owner: OwnerId;
  readonly class: GateClass;
  readonly validator: string;
  readonly protectedBoundary: string;
  readonly protectedFact: string;
  readonly threat: string;
  readonly failureConsequence: string;
  readonly consumers: readonly string[];
  readonly evidence: readonly string[];
}

export interface CharterCompatibilityRecord {
  readonly id: string;
  readonly identity: string;
  readonly owner: OwnerId;
  readonly consumers: readonly string[];
  readonly replacement: string;
  readonly deletionCondition: string;
  readonly followUpChange: string;
  readonly evidence: readonly string[];
}

export interface CharterBlockingRecord {
  readonly id: string;
  readonly identity: string;
  readonly candidates: readonly string[];
  readonly evidence: readonly string[];
  readonly accountableOwner: OwnerId;
  readonly resolutionCondition: string;
}

export interface ArchitectureCharter {
  readonly schemaVersion: typeof CHARTER_SCHEMA_VERSION;
  readonly baseline: typeof REQUIRED_BASELINE;
  readonly receiptIds: readonly string[];
  readonly owners: readonly CharterOwnerRecord[];
  readonly gates: readonly CharterGateRecord[];
  readonly compatibility: readonly CharterCompatibilityRecord[];
  readonly blocking: readonly CharterBlockingRecord[];
}
