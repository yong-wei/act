import type { CensusCore, CensusObservation, MeasurementReceipt } from '@/lib/architecture-census/types';
import { privacyViolation } from '@/lib/architecture-census/privacy';
import { serializeDeterministic, sha256Text } from '@/lib/architecture-census/serialize';
import { assignOwner, classifyGate, gateThreat } from './assign';
import type {
  ArchitectureCharter,
  CharterBlockingRecord,
  CharterCompatibilityRecord,
  CharterGateRecord,
  CharterOwnerRecord,
} from './types';
import { CHARTER_SCHEMA_VERSION, OWNED_KINDS, REQUIRED_BASELINE } from './types';

const OWNED_KIND_SET = new Set<string>(OWNED_KINDS);

function isOwnedKind(kind: string): kind is CharterOwnerRecord['kind'] {
  return OWNED_KIND_SET.has(kind);
}

function followUpFor(identity: string): string {
  if (identity.includes('teacher-diagnosis-report-history')) {
    return 'decouple-teacher-diagnosis-route-contract';
  }
  return 'enforce-modular-domain-dependency-contracts';
}

export function generateArchitectureCharter(
  core: CensusCore,
  receipts: readonly MeasurementReceipt[],
): { charter: ArchitectureCharter; failures: string[] } {
  const failures: string[] = [];
  if (core.schemaVersion !== REQUIRED_BASELINE.schemaVersion) failures.push('baseline-schema-drift');
  if (core.captureIdentity.sourceCommit !== REQUIRED_BASELINE.sourceCommit) failures.push('baseline-commit-drift');
  if (core.captureIdentity.sourceTree !== REQUIRED_BASELINE.sourceTree) failures.push('baseline-tree-drift');
  if (core.manifests.some((manifest) => manifest.totals.unresolved > 0 || manifest.totals.duplicate > 0)) {
    failures.push('baseline-denominator-incomplete');
  }

  const owners: CharterOwnerRecord[] = [];
  const blocking: CharterBlockingRecord[] = [];
  const gates: CharterGateRecord[] = [];
  const compatibility: CharterCompatibilityRecord[] = [];

  for (const observation of core.observations) {
    if (observation.ownership.state === 'ambiguous') {
      blocking.push({
        id: `blocking:${observation.id}`,
        identity: observation.identity,
        candidates: observation.ownership.conflictingEvidence,
        evidence: observation.evidence,
        accountableOwner: assignOwner(observation),
        resolutionCondition: 'adjudicate-exactly-one-target-owner-before-qualification',
      });
      continue;
    }
    if (isOwnedKind(observation.kind)) {
      owners.push({
        id: `owner:${observation.id}`,
        kind: observation.kind,
        identity: observation.identity,
        owner: assignOwner(observation),
        currentOwnerEvidence: observation.ownership.currentOwnerEvidence,
        evidence: observation.evidence,
        state: 'qualified',
      });
    }
    if (observation.kind === 'gate') {
      const gateClass = classifyGate(observation);
      const threat = gateThreat(gateClass);
      gates.push({
        id: `gate:${observation.id}`,
        identity: observation.identity,
        owner: assignOwner(observation),
        class: gateClass,
        validator: String(observation.attributes.validator ?? observation.identity),
        protectedBoundary: String(observation.attributes.protectedBoundary ?? 'unresolved'),
        protectedFact: threat.fact,
        threat: threat.threat,
        failureConsequence: threat.consequence,
        consumers: ['local-verify', 'future-fitness-check'],
        evidence: observation.evidence,
      });
    }
    if (observation.kind === 'compatibility-surface' || (
      observation.kind === 'dependency-edge'
      && observation.attributes.featureToApp === true
      && observation.attributes.context === 'production'
    )) {
      compatibility.push({
        id: `compat:${observation.id}`,
        identity: observation.identity,
        owner: assignOwner(observation),
        consumers: observation.evidence,
        replacement: 'domain-public-api-or-application-use-case',
        deletionCondition: 'callers-import-canonical-public-api-and-old-path-is-absent',
        followUpChange: followUpFor(observation.identity),
        evidence: observation.evidence,
      });
    }
  }

  if (blocking.length > 0) failures.push(`blocking-ownership:${blocking.length}`);

  const ownerIds = new Set(owners.map((item) => item.id));
  if (ownerIds.size !== owners.length) failures.push('duplicate-owner-id');

  const charter: ArchitectureCharter = {
    schemaVersion: CHARTER_SCHEMA_VERSION,
    baseline: REQUIRED_BASELINE,
    receiptIds: receipts.map((item) => item.receiptId).sort(),
    owners: owners.sort((left, right) => left.id.localeCompare(right.id)),
    gates: gates.sort((left, right) => left.id.localeCompare(right.id)),
    compatibility: compatibility.sort((left, right) => left.id.localeCompare(right.id)),
    blocking: blocking.sort((left, right) => left.id.localeCompare(right.id)),
  };
  const serialized = serializeDeterministic(charter);
  const violation = privacyViolation(serialized);
  if (violation) failures.push(violation);
  return { charter, failures };
}

export function qualifyArchitectureCharter(charter: ArchitectureCharter, failures: readonly string[]): void {
  if (charter.schemaVersion !== CHARTER_SCHEMA_VERSION) throw new Error('unsupported-charter-schema');
  if (failures.length > 0) throw new Error(failures[0]);
  if (charter.blocking.length > 0) throw new Error(`blocking-ownership:${charter.blocking[0].identity}`);
}

export function charterIdentity(charter: ArchitectureCharter): string {
  return sha256Text(serializeDeterministic(charter));
}

export type { CensusObservation };
