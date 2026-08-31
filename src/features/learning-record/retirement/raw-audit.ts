import { LearningRecordContractError } from '@/features/learning-record/event-contract/errors';
import { authorizeRawArtifact, authorizeReplay } from '@/features/learning-record/event-contract/replay';
import { containsForbiddenExportField } from '@/features/learning-record/event-contract/export-policy';
import { RetirementGateError } from './ledger';

export const RETIREMENT_STORE_ISOLATION = {
  transport: { store: 'redis-secondary-processing', acl: 'queue-worker' },
  fact: { store: 'postgres-learning-fact', acl: 'fact-writer' },
  failure: { store: 'postgres-learning-event-batch', acl: 'ingestion-worker' },
  restrictedRaw: { store: 'approved-raw-artifact', acl: 'audit-dual-control' },
  publicAudit: { store: 'public-audit-aggregate', acl: 'public-export' },
} as const;

const PAGE_ROLES = new Set(['student', 'teacher', 'queue', 'fact-consumer']);

export function authorizeLegacyRawAccess(input: {
  purpose: 'audit' | 'debug' | 'migration' | 'drilldown';
  ticket: string;
  scope: string;
  role: string;
  dualControl: boolean;
  elevatedUntil: Date;
  approved: boolean;
}, now = new Date()): void {
  if (PAGE_ROLES.has(input.role)) {
    throw new LearningRecordContractError(
      'raw-artifact-forbidden',
      'Page and queue roles cannot inherit raw Learning Record access',
    );
  }
  authorizeRawArtifact({ approved: input.approved, role: input.role });
  authorizeReplay({
    scope: input.scope,
    purpose: input.purpose,
    ticket: input.ticket,
    elevatedUntil: input.elevatedUntil,
    dualControl: input.dualControl,
    role: input.role,
  }, now);
}

export function assertNoPermissionInheritance(): void {
  const acls = Object.values(RETIREMENT_STORE_ISOLATION).map((item) => item.acl);
  if (new Set(acls).size !== acls.length) {
    throw new Error('retirement-acl-collision');
  }
}

export function assertPublicExportClean(payload: unknown): void {
  const hits = containsForbiddenExportField(payload);
  if (hits.length > 0) {
    throw new LearningRecordContractError('forbidden-field', 'Public export contains forbidden fields', { hits });
  }
}

export function assertRetirementRollbackSafe(action: {
  restoresCodeOrPointer: boolean;
  mutatesHistoricalFacts: boolean;
  restoresBroadRawAcl: boolean;
}): void {
  if (action.mutatesHistoricalFacts || action.restoresBroadRawAcl) {
    throw new RetirementGateError('retirement-rollback-forbidden', 'Rollback cannot mutate history or restore raw ACL');
  }
  if (!action.restoresCodeOrPointer) {
    throw new RetirementGateError('retirement-rollback-forbidden', 'Rollback must restore code or a qualified pointer');
  }
}
