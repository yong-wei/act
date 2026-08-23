import {
  FORMAL_RESOURCE_INVENTORY_CONTRACT,
  FORMAL_RESOURCE_SUBTYPES,
  FORBIDDEN_IDENTITY_SIGNALS,
  type FormalReleaseEntry,
  type FormalResourceCandidate,
  type FormalResourceDisposition,
  type FormalResourceSubtype,
  type FormalSourceIdentity,
} from './contracts';
import { FormalResourceError, projectionDigest } from './hash';

export function assertRegisteredSubtype(value: string): FormalResourceSubtype {
  if (!(FORMAL_RESOURCE_SUBTYPES as readonly string[]).includes(value)) {
    throw new FormalResourceError('unregistered-subtype', `unregistered runtime subtype: ${value}`);
  }
  return value as FormalResourceSubtype;
}

export function assertGovernedSource(source: FormalResourceCandidate['source']): void {
  if (!source.contentSha256 || !/^[0-9a-f]{64}$/u.test(source.contentSha256)) {
    throw new FormalResourceError('invalid-source', 'content identity must be a sha256 digest');
  }
  if (source.kind === 'git-blob' && !source.gitObjectId) {
    throw new FormalResourceError('invalid-source', 'git blob source requires gitObjectId');
  }
  if (source.kind === 'external-input' && !source.externalInputId) {
    throw new FormalResourceError('invalid-source', 'external source requires externalInputId');
  }
}

export function assertNotForbiddenIdentity(signal: string): void {
  if ((FORBIDDEN_IDENTITY_SIGNALS as readonly string[]).includes(signal)) {
    throw new FormalResourceError(
      'forbidden-identity-signal',
      `${signal} cannot establish or shrink the formal denominator`,
    );
  }
}

export function classifyReleaseEntries(entries: readonly FormalReleaseEntry[]): void {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.entryId)) {
      throw new FormalResourceError('duplicate-entry', `duplicate release entry ${entry.entryId}`);
    }
    ids.add(entry.entryId);
    if (entry.classification === 'resource') {
      if (!entry.subtype) {
        throw new FormalResourceError(
          'inventory-incomplete',
          `resource entry ${entry.entryId} lacks a registered subtype`,
        );
      }
      assertRegisteredSubtype(entry.subtype);
      assertGovernedSource(entry.source);
    } else if (entry.classification !== 'non-resource') {
      throw new FormalResourceError(
        'inventory-incomplete',
        `entry ${entry.entryId} is neither a registered resource nor an explicit non-resource`,
      );
    }
  }
}

export function sourceIdentityMatches(left: FormalSourceIdentity, right: FormalSourceIdentity): boolean {
  return left.kind === right.kind
    && left.contentSha256 === right.contentSha256
    && left.gitObjectId === right.gitObjectId
    && left.externalInputId === right.externalInputId;
}

export function candidateResourceId(entry: Pick<FormalReleaseEntry, 'entryId' | 'source'>): string {
  return `res-${projectionDigest({ entryId: entry.entryId, source: entry.source }).slice(0, 24)}`;
}

export function buildCandidateInventory(input: {
  courseScopeId: string;
  entries: readonly FormalReleaseEntry[];
  workingTreeExtras?: readonly string[];
}): {
  candidates: FormalResourceCandidate[];
  candidateHash: string;
  includedHash: string;
  excludedHash: string;
} {
  classifyReleaseEntries(input.entries);
  if (input.workingTreeExtras?.length) {
    // Untracked files must not enter or alter the frozen denominator.
  }
  const candidates = input.entries
    .filter((entry) => entry.classification === 'resource')
    .map((entry) => ({
      contract: FORMAL_RESOURCE_INVENTORY_CONTRACT,
      resourceId: candidateResourceId(entry),
      subtype: entry.subtype as FormalResourceSubtype,
      courseScopeId: input.courseScopeId,
      source: entry.source,
      deliveryMode: 'REQUIRED' as const,
      disposition: 'EXCLUDED' as FormalResourceDisposition,
      exclusionReasons: ['awaiting-atomic-closure'] as const,
    }))
    .sort((a, b) => a.resourceId.localeCompare(b.resourceId));
  return {
    candidates,
    candidateHash: setHash(candidates.map((row) => row.resourceId)),
    includedHash: setHash(candidates.filter((row) => row.disposition === 'INCLUDED').map((row) => row.resourceId)),
    excludedHash: setHash(candidates.filter((row) => row.disposition === 'EXCLUDED').map((row) => row.resourceId)),
  };
}

export function setHash(ids: readonly string[]): string {
  return projectionDigest([...ids].sort());
}

export function closeCandidate(
  candidate: FormalResourceCandidate,
  disposition: FormalResourceDisposition,
  reasons: readonly string[] = [],
): FormalResourceCandidate {
  return {
    ...candidate,
    disposition,
    exclusionReasons: disposition === 'EXCLUDED' ? (reasons.length > 0 ? reasons : ['excluded']) : [],
  };
}

export function assertCandidatesMatchFrozenInventory(input: {
  courseScopeId: string;
  entries: readonly FormalReleaseEntry[];
  candidates: readonly FormalResourceCandidate[];
}): ReadonlyMap<string, FormalResourceCandidate> {
  const frozen = buildCandidateInventory({
    courseScopeId: input.courseScopeId,
    entries: input.entries,
  });
  if (setHash(input.candidates.map((row) => row.resourceId)) !== frozen.candidateHash) {
    throw new FormalResourceError('identity-drift', 'candidates drifted from frozen release inventory');
  }
  const frozenById = new Map(frozen.candidates.map((row) => [row.resourceId, row]));
  for (const candidate of input.candidates) {
    const expected = frozenById.get(candidate.resourceId);
    if (!expected) {
      throw new FormalResourceError('identity-drift', `candidate ${candidate.resourceId} is not in the frozen inventory`);
    }
    if (
      candidate.contract !== expected.contract
      || candidate.subtype !== expected.subtype
      || candidate.courseScopeId !== expected.courseScopeId
      || !sourceIdentityMatches(candidate.source, expected.source)
    ) {
      throw new FormalResourceError(
        'identity-drift',
        `candidate ${candidate.resourceId} source drifted from frozen release inventory`,
      );
    }
  }
  return frozenById;
}
