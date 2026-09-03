import { describe, expect, it } from 'vitest';

import {
  REQUIRED_SUCCESSOR,
  RESIDUAL_SCHEMA_VERSION,
  adjudicateResidualDataGovernance,
  evaluateCoordinationGate,
  memberSetDigest,
  projectResidualDocuments,
  type Issue1876Snapshot,
  type ResidualAdjudication,
  type ResidualAdjudicationInput,
  type ResidualMemberInput,
  type ResidualSubjectIdentity,
  type ResidualToolIdentity,
} from '@/lib/architecture-charter/residual-data-governance';

const closedGate: Issue1876Snapshot = {
  number: 1876,
  state: 'CLOSED',
  labels: ['status:archived', 'type:change'],
  blockedBy: [
    { number: 1805, state: 'CLOSED' },
    { number: 1810, state: 'CLOSED' },
  ],
};

const tool: ResidualToolIdentity = {
  toolCommit: 'b'.repeat(40),
  toolTree: 'c'.repeat(40),
  schemaVersion: RESIDUAL_SCHEMA_VERSION,
  toolVersions: { nodeVersion: 'v22.0.0', npmVersion: '11.0.0', typescriptVersion: '5.8.3' },
  entryBundleDigest: 'd'.repeat(64),
};

function subjectFor(members: readonly ResidualMemberInput[], verified = true): ResidualSubjectIdentity {
  return {
    successorCaptureId: REQUIRED_SUCCESSOR.successorCaptureId,
    sourceCommit: REQUIRED_SUCCESSOR.sourceCommit,
    sourceTree: REQUIRED_SUCCESSOR.sourceTree,
    schemaVersion: REQUIRED_SUCCESSOR.schemaVersion,
    packageDigest: REQUIRED_SUCCESSOR.packageDigest,
    ownerResidueLocator: REQUIRED_SUCCESSOR.ownerResidueLocator,
    ownerResidueSha256: REQUIRED_SUCCESSOR.ownerResidueSha256,
    fullInventoryLocator: REQUIRED_SUCCESSOR.fullInventoryLocator,
    fullInventorySha256: REQUIRED_SUCCESSOR.fullInventorySha256,
    memberSetDigest: memberSetDigest(members.map((member) => member.path)),
    fullInventoryBytesVerified: verified,
  };
}

function input(partial: Partial<ResidualAdjudicationInput> & Pick<ResidualAdjudicationInput, 'members'>): ResidualAdjudicationInput {
  return {
    gate: closedGate,
    subject: subjectFor(partial.members, partial.subject?.fullInventoryBytesVerified ?? true),
    tool,
    callers: [],
    ...partial,
    subject: partial.subject ?? subjectFor(partial.members, true),
  };
}

function asAdjudication(result: ReturnType<typeof adjudicateResidualDataGovernance>): ResidualAdjudication {
  expect(result.kind).toBe('residual-adjudication');
  return result as ResidualAdjudication;
}

describe('residual data-governance adjudication', () => {
  it('rejects the parent gate without consuming A', () => {
    const open = evaluateCoordinationGate({
      number: 1876,
      state: 'OPEN',
      labels: ['status:ready'],
      blockedBy: [{ number: 1805, state: 'OPEN' }],
    });
    expect(open).toEqual(expect.arrayContaining([
      'gate-1876-not-closed',
      'gate-1876-not-archived',
      'gate-1876-blockedBy-unresolved',
    ]));
    const result = adjudicateResidualDataGovernance(input({
      gate: { number: 1876, state: 'OPEN', labels: ['status:ready'], blockedBy: [] },
      members: [{ path: 'src/lib/data-governance/event-protocol.ts' }],
      subject: {
        ...subjectFor([{ path: 'src/lib/data-governance/event-protocol.ts' }]),
        packageDigest: '0'.repeat(64),
      },
    }));
    expect(result).toEqual({
      kind: 'parent-coordination-gate-rejection',
      reasons: ['gate-1876-not-closed', 'gate-1876-not-archived'],
    });
  });

  it('fails closed on missing or drifted A identities and dirty source', () => {
    const members: ResidualMemberInput[] = [{ path: 'src/lib/data-governance/event-protocol.ts' }];
    const drifted = asAdjudication(adjudicateResidualDataGovernance(input({
      members,
      dirtySource: true,
      mixedSource: true,
      subject: {
        ...subjectFor(members),
        successorCaptureId: '0'.repeat(64),
        sourceCommit: '1'.repeat(40),
        packageDigest: '2'.repeat(64),
        ownerResidueSha256: '3'.repeat(64),
        fullInventorySha256: '4'.repeat(64),
        fullInventoryBytesVerified: false,
      },
    })));
    expect(drifted.kind).toBe('residual-adjudication');
    expect(drifted.qualified).toBe(false);
    expect(drifted.blockers).toEqual(expect.arrayContaining([
      'dirty-source',
      'mixed-source',
      'subject-capture-mismatch',
      'subject-commit-mismatch',
      'subject-package-digest-mismatch',
      'owner-residue-digest-mismatch',
      'full-inventory-digest-mismatch',
      'full-inventory-bytes-unverified',
    ]));
  });

  it('rejects duplicate ids, omitted members, heterogeneous candidates, and missing kernel steward proof', () => {
    const members: ResidualMemberInput[] = [
      { path: 'src/lib/data-governance/event-protocol.ts' },
      { path: 'src/lib/data-governance/event-protocol.ts' },
    ];
    const duplicate = asAdjudication(adjudicateResidualDataGovernance(input({
      members,
      subject: { ...subjectFor(members), memberSetDigest: memberSetDigest(members.map((item) => item.path)) },
    })));
    expect(duplicate.blockers.some((item) => item.startsWith('duplicate-id:'))).toBe(true);

    const kernel = asAdjudication(adjudicateResidualDataGovernance(input({
      members: [{ path: 'src/lib/data-governance/event-protocol.ts' }],
      callers: [],
    })));
    expect(kernel.records[0]?.outcome).toBe('business-domain');
    expect(kernel.records[0]?.accountableOwner).toBe('learning-record');

    const conflicted = asAdjudication(adjudicateResidualDataGovernance(input({
      members: [{
        path: 'src/lib/data-governance/math-document-grading-lifecycle.ts',
        candidateOwnerIds: ['assignment', 'learning-record'],
      }],
    })));
    expect(conflicted.records[0]?.status).toBe('unresolved');
    expect(conflicted.qualified).toBe(false);
    expect(conflicted.blockers).toContain('unresolved-records');
  });

  it('rejects an out-of-scope compatibility outcome without an accountable owner', () => {
    const result = asAdjudication(adjudicateResidualDataGovernance(input({
      members: [{ path: 'src/lib/data-governance/index.ts' }],
      outOfScopeSurfaces: [{
        identity: 'src/app/api/health/route.ts',
        residualOutcome: 'compatibility',
        accountableOwner: null,
      }],
    })));
    expect(result.blockers.some((item) => item.startsWith('out-of-scope-compatibility-without-owner:'))).toBe(true);
    expect(result.qualified).toBe(false);
  });

  it('fails closed on unsafe payloads and keeps locators repository-relative', () => {
    const result = asAdjudication(adjudicateResidualDataGovernance(input({
      members: [{ path: 'src/lib/data-governance/event-protocol.ts' }],
      callers: [{
        memberPath: 'src/lib/data-governance/event-protocol.ts',
        callerPath: '/Users/me/secret.ts',
        relationship: 'import',
      }],
    })));
    expect(result.blockers).toContain('privacy:absolute-path');
    expect(result.qualified).toBe(false);
    const clean = asAdjudication(adjudicateResidualDataGovernance(input({
      members: [{ path: 'src/lib/data-governance/event-protocol.ts' }],
    })));
    const docs = projectResidualDocuments(clean);
    expect(JSON.stringify(clean)).not.toMatch(/\/Users\//u);
    expect(docs['handoff.md']).not.toMatch(/\/Users\//u);
    expect(clean.records[0]?.evidenceLocators.every((locator) => !locator.startsWith('/'))).toBe(true);
  });

  it('is deterministic for identical subject/tool/schema/inputs and distinct on drift', () => {
    const members: ResidualMemberInput[] = [
      { path: 'src/lib/data-governance/event-protocol.ts' },
      { path: 'src/lib/data-governance/index.ts' },
      { path: 'src/lib/data-governance/__tests__/event-protocol.test.ts' },
      { path: 'src/lib/data-governance/course-evidence-backfill.ts' },
    ];
    const callers = [
      {
        memberPath: 'src/lib/data-governance/event-protocol.ts',
        callerPath: 'src/features/learning-record/ingestion/index.ts',
        relationship: 'import',
      },
      {
        memberPath: 'src/lib/data-governance/event-protocol.ts',
        callerPath: 'src/features/classroom/session.ts',
        relationship: 'import',
      },
    ];
    const first = asAdjudication(adjudicateResidualDataGovernance(input({ members, callers })));
    const second = asAdjudication(adjudicateResidualDataGovernance(input({ members, callers })));
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.decisionIdentity).toBe(second.decisionIdentity);
    expect(first.records.find((record) => record.path.endsWith('event-protocol.ts'))?.outcome).toBe('processing-kernel');
    expect(first.records.find((record) => record.path.endsWith('index.ts'))?.outcome).toBe('compatibility');
    expect(first.records.find((record) => record.path.includes('__tests__'))?.outcome).toBe('fixture-asset');
    expect(first.records.find((record) => record.path.includes('backfill'))?.outcome).toBe('operator-tooling');

    const driftedTool = asAdjudication(adjudicateResidualDataGovernance(input({
      members,
      callers,
      tool: { ...tool, entryBundleDigest: 'e'.repeat(64) },
    })));
    expect(driftedTool.decisionIdentity).not.toBe(first.decisionIdentity);
  });

  it('does not move source, mutate Prisma, or treat a slice as authorization', () => {
    const members: ResidualMemberInput[] = [{ path: 'src/lib/data-governance/portrait-v2-model.ts' }];
    const result = asAdjudication(adjudicateResidualDataGovernance(input({ members })));
    const docs = projectResidualDocuments(result);
    expect(result.records.map((record) => record.path)).toEqual(members.map((member) => member.path));
    expect(docs['future-slices.md']).toContain('migration input, not authorization');
    expect(docs['handoff.md']).toContain('does not move source');
    expect(docs['handoff.md']).toMatch(/COMPLETE-(qualified|non-qualified-BLOCKER)/u);
  });

  it('qualifies only when denominator, callers, owners and outcomes close', () => {
    const members: ResidualMemberInput[] = [
      { path: 'src/lib/data-governance/portrait-v2-model.ts' },
    ];
    const qualified = asAdjudication(adjudicateResidualDataGovernance(input({
      members,
      callers: [{
        memberPath: 'src/lib/data-governance/portrait-v2-model.ts',
        callerPath: 'src/features/personalization/portrait.ts',
        relationship: 'import',
      }],
    })));
    expect(qualified.records).toHaveLength(1);
    expect(qualified.records[0]?.accountableOwner).toBe('personalization');
    expect(qualified.records[0]?.outcome).toBe('business-domain');
    const replay = asAdjudication(adjudicateResidualDataGovernance(input({
      members: [{ path: 'src/lib/data-governance/session-fact-replay.ts' }],
    })));
    expect(replay.records[0]?.accountableOwner).toBe('learning-record');
    expect(replay.records[0]?.outcome).toBe('business-domain');
    expect(qualified.records[0]?.status).toBe('qualified');
    expect(qualified.blockers).toEqual([]);
    expect(qualified.qualified).toBe(true);
    expect(projectResidualDocuments(qualified)['handoff.md']).toContain('COMPLETE-qualified');
  });
});
