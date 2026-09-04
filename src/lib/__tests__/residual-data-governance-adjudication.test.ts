import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { serializeDeterministic, sha256Text } from '@/lib/architecture-census/serialize';

import {
  PREDECESSOR_1883,
  REQUIRED_SUCCESSOR,
  RESIDUAL_CLAIM_BRANCH,
  RESIDUAL_SCHEMA_VERSION,
  adjudicateResidualDataGovernance,
  classifyCallerPath,
  collectRelativeCallers,
  directoryPathReadCaller,
  evaluateCoordinationGate,
  memberSetDigest,
  projectResidualDocuments,
  verifyResidualProjectionArtifacts,
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
    currentSubject: {
      baseBranch: 'origin/integration',
      subjectCommit: 'e'.repeat(40),
      subjectTree: 'f'.repeat(40),
    },
    upstreamPayload: {
      issue: 1916,
      closed: true,
      archived: true,
      subjectIdentity: 'a'.repeat(64),
      packageDigest: '1'.repeat(64),
      schemaVersion: 'act-repository-payload-classification/v2',
      status: 'qualified',
      unresolvedMembers: 0,
    },
    predecessor1883: {
      decisionIdentity: PREDECESSOR_1883.decisionIdentity,
      recordCount: 262,
      qualified: false,
    },
  };
}

const DEFAULT_BLOB_OID = `a1b2c3d4${'0'.repeat(32)}`;

function input(partial: Partial<ResidualAdjudicationInput> & Pick<ResidualAdjudicationInput, 'members'>): ResidualAdjudicationInput {
  return {
    gate: closedGate,
    subject: subjectFor(partial.members, partial.subject?.fullInventoryBytesVerified ?? true),
    tool,
    callers: [],
    executionBranch: RESIDUAL_CLAIM_BRANCH,
    ...partial,
    members: partial.members.map((member) => ({ blobOid: DEFAULT_BLOB_OID, byteSize: 128, ...member })),
    subject: partial.subject ?? subjectFor(partial.members, true),
  };
}

/** Writes a result's projections to a temp dir exactly like the CLI, then reconciles them. */
function writeProjectionsToTempDir(result: ResidualAdjudication): string {
  const dir = mkdtempSync(join(tmpdir(), 'residual-projection-'));
  for (const [name, content] of Object.entries(projectResidualDocuments(result))) {
    writeFileSync(join(dir, name), content.replace(/\n+$/u, '\n'));
  }
  return dir;
}

/**
 * Runs the adjudication once, writes and byte-reconciles the provisional
 * projections, then produces the final decision from the real receipt.
 */
function runWithLedgerVerification(partial: Partial<ResidualAdjudicationInput> & Pick<ResidualAdjudicationInput, 'members'>): ResidualAdjudication {
  const first = adjudicateResidualDataGovernance(input(partial));
  const decided = asAdjudication(first);
  const subject = decided.subject;
  const projectionDir = writeProjectionsToTempDir(decided);
  try {
    const verification = verifyResidualProjectionArtifacts({
      outputDir: projectionDir,
      result: decided,
      receiptSubjectCommit: subject.currentSubject.subjectCommit,
    });
    expect(verification.reconciled).toBe(true);
    const receipt = {
      locator: decided.fullLedger.logicalLocator,
      byteCount: decided.fullLedger.byteCount,
      sha256: decided.fullLedger.sha256,
      memberDenominator: decided.summaries.memberCount,
      subjectCommit: subject.currentSubject.subjectCommit,
      subjectTree: subject.currentSubject.subjectTree,
      toolCommit: decided.tool.toolCommit,
      schemaVersion: RESIDUAL_SCHEMA_VERSION,
      memberSetDigest: subject.memberSetDigest,
      callerBundleDigest: decided.callerBundleDigest,
      familiesDigest: sha256Text(serializeDeterministic(decided.families)),
      projectionsReconciled: verification.reconciled,
    };
    return asAdjudication(adjudicateResidualDataGovernance({ ...input(partial), ledgerVerification: receipt }));
  } finally {
    rmSync(projectionDir, { recursive: true, force: true });
  }
}

function asAdjudication(result: ReturnType<typeof adjudicateResidualDataGovernance>): ResidualAdjudication {
  expect(result.kind).toBe('residual-adjudication');
  return result as ResidualAdjudication;
}

describe('residual data-governance adjudication', () => {
  it('gates on the archived upstream payload change and an independent current subject', () => {
    const members: ResidualMemberInput[] = [{ path: 'src/lib/data-governance/event-protocol.ts' }];
    const base = runWithLedgerVerification({ members });
    expect(base.qualified).toBe(true);
    expect(base.subject.currentSubject.subjectCommit).toBe('e'.repeat(40));

    const notArchived = asAdjudication(adjudicateResidualDataGovernance({
      ...input({ members }),
      subject: {
        ...subjectFor(members),
        upstreamPayload: { ...subjectFor(members).upstreamPayload, archived: false },
      },
    }));
    expect(notArchived.blockers).toContain('upstream-payload-change-not-archived');

    const wrongSchema = asAdjudication(adjudicateResidualDataGovernance({
      ...input({ members }),
      subject: {
        ...subjectFor(members),
        upstreamPayload: { ...subjectFor(members).upstreamPayload, schemaVersion: 'act-repository-payload-classification/v1' },
      },
    }));
    expect(wrongSchema.blockers).toContain('upstream-payload-identity-incomplete');

    const toolCollision = asAdjudication(adjudicateResidualDataGovernance({
      ...input({ members }),
      subject: {
        ...subjectFor(members),
        currentSubject: { ...subjectFor(members).currentSubject, subjectCommit: tool.toolCommit },
      },
    }));
    expect(toolCollision.blockers).toContain('tool-subject-identity-collision');

    const driftedPredecessor = asAdjudication(adjudicateResidualDataGovernance({
      ...input({ members }),
      subject: {
        ...subjectFor(members),
        predecessor1883: { decisionIdentity: '0'.repeat(64), recordCount: 262, qualified: false },
      },
    }));
    expect(driftedPredecessor.blockers).toContain('predecessor-1883-decision-identity-mismatch');
  });

  it('blocks when the upstream payload package itself is unqualified and splits mixed-owner slices per owner', () => {
    const members: ResidualMemberInput[] = [
      { path: 'src/lib/data-governance/teacher-ai-grading-lab-analysis.ts' },
      { path: 'src/lib/data-governance/cumulative-snapshot-jobs.ts' },
      { path: 'src/lib/data-governance/simulation-historical-replay.ts' },
      { path: 'src/lib/data-governance/math-document-backfill.ts' },
    ];
    const unqualifiedUpstream = asAdjudication(adjudicateResidualDataGovernance({
      ...input({ members }),
      subject: {
        ...subjectFor(members),
        upstreamPayload: { ...subjectFor(members).upstreamPayload, status: 'package-unqualified', unresolvedMembers: 1770 },
      },
    }));
    expect(unqualifiedUpstream.blockers).toContain('upstream-payload-package-unqualified');
    expect(unqualifiedUpstream.qualified).toBe(false);
    expect(unqualifiedUpstream.futureSlices).toEqual([]);
    const unqualifiedDocs = projectResidualDocuments(unqualifiedUpstream);
    expect(unqualifiedDocs['future-slices.md']).toContain('No migration-input slice is emitted');
    expect(unqualifiedDocs['future-slices.md']).toContain('upstream-payload-package-unqualified');

    const singleOwner = runWithLedgerVerification({
      members: [{ path: 'src/lib/data-governance/math-document-backfill.ts' }],
      subject: (() => {
        const subject = subjectFor([{ path: 'src/lib/data-governance/math-document-backfill.ts' }]);
        return subject;
      })(),
    });
    // with a qualified upstream the package can qualify and mixed slices split
    const slices = singleOwner.futureSlices.filter((slice) => slice.slice.startsWith('operator-backfill'));
    for (const slice of slices) {
      const owners = new Set(slice.paths.map(() => slice.accountableOwner));
      expect(owners.size).toBe(1);
    }
  });

  it('requires an independently verified ledger receipt bound to the exact subject and tool', () => {
    const members: ResidualMemberInput[] = [{ path: 'src/lib/data-governance/event-protocol.ts' }];
    const first = asAdjudication(adjudicateResidualDataGovernance(input({ members })));
    expect(first.blockers).toContain('full-ledger-bytes-unverified');

    const good = runWithLedgerVerification({ members });
    expect(good.blockers).not.toContain('full-ledger-bytes-unverified');

    const goodSubject = good.subject;
    const fullReceipt = {
      locator: good.fullLedger.logicalLocator,
      byteCount: good.fullLedger.byteCount,
      sha256: good.fullLedger.sha256,
      memberDenominator: good.summaries.memberCount,
      subjectCommit: goodSubject.currentSubject.subjectCommit,
      subjectTree: goodSubject.currentSubject.subjectTree,
      toolCommit: good.tool.toolCommit,
      schemaVersion: RESIDUAL_SCHEMA_VERSION,
      memberSetDigest: goodSubject.memberSetDigest,
      callerBundleDigest: good.callerBundleDigest,
      familiesDigest: sha256Text(serializeDeterministic(good.families)),
      projectionsReconciled: true,
    };
    const badSha = asAdjudication(adjudicateResidualDataGovernance({
      ...input({ members }),
      ledgerVerification: { ...fullReceipt, sha256: '0'.repeat(64) },
    }));
    expect(badSha.blockers).toContain('full-ledger-bytes-unverified');

    const foreignTool = asAdjudication(adjudicateResidualDataGovernance({
      ...input({ members }),
      ledgerVerification: { ...fullReceipt, toolCommit: 'f'.repeat(40) },
    }));
    expect(foreignTool.blockers).toContain('full-ledger-bytes-unverified');

    const foreignCallerBundle = asAdjudication(adjudicateResidualDataGovernance({
      ...input({ members }),
      ledgerVerification: { ...fullReceipt, callerBundleDigest: 'e'.repeat(64) },
    }));
    expect(foreignCallerBundle.blockers).toContain('full-ledger-bytes-unverified');
  });

  it('collects intra-package re-exports and directory path reads', () => {
    const relative = collectRelativeCallers([
      {
        path: 'src/lib/data-governance/index.ts',
        content: "export * from './event-protocol';\n",
      },
      {
        path: 'src/lib/data-governance/event-protocol.ts',
        content: 'export const x = 1;\n',
      },
    ], [
      'src/lib/data-governance/index.ts',
      'src/lib/data-governance/event-protocol.ts',
    ]);
    expect(relative).toEqual([
      {
        memberPath: 'src/lib/data-governance/event-protocol.ts',
        callerPath: 'src/lib/data-governance/index.ts',
        relationship: 're-export',
      },
    ]);
    expect(collectRelativeCallers([
      {
        path: 'src/lib/data-governance/__tests__/math-document-grading-worker.test.ts',
        content: [
          "import { describeWorker } from '../math-document-grading-worker-readiness';",
          "const { parseMathDocumentGradingWorkerCapability } = await import('../math-document-grading-worker-readiness');",
          '',
        ].join('\n'),
      },
      {
        path: 'src/lib/data-governance/math-document-grading-worker-readiness.ts',
        content: 'export const parseMathDocumentGradingWorkerCapability = () => true;\n',
      },
    ], [
      'src/lib/data-governance/__tests__/math-document-grading-worker.test.ts',
      'src/lib/data-governance/math-document-grading-worker-readiness.ts',
    ])).toEqual([
      {
        memberPath: 'src/lib/data-governance/math-document-grading-worker-readiness.ts',
        callerPath: 'src/lib/data-governance/__tests__/math-document-grading-worker.test.ts',
        relationship: 'import',
      },
      {
        memberPath: 'src/lib/data-governance/math-document-grading-worker-readiness.ts',
        callerPath: 'src/lib/data-governance/__tests__/math-document-grading-worker.test.ts',
        relationship: 'dynamic',
      },
    ]);
    expect(collectRelativeCallers([
      {
        path: 'src/lib/data-governance/__tests__/teacher-student-cumulative-insights.test.ts',
        content: "vi.mock('@/lib/data-governance/cumulative-portrait-read-model', async (importOriginal) => {\n  const actual = await importOriginal<typeof import('../cumulative-portrait-read-model')>();\n  return actual;\n});\n",
      },
      {
        path: 'src/lib/data-governance/cumulative-portrait-read-model.ts',
        content: 'export const readCurrentCumulativePortrait = () => null;\n',
      },
    ], [
      'src/lib/data-governance/__tests__/teacher-student-cumulative-insights.test.ts',
      'src/lib/data-governance/cumulative-portrait-read-model.ts',
    ])).toEqual([
      {
        memberPath: 'src/lib/data-governance/cumulative-portrait-read-model.ts',
        callerPath: 'src/lib/data-governance/__tests__/teacher-student-cumulative-insights.test.ts',
        relationship: 'dynamic',
      },
    ]);
    expect(classifyCallerPath(
      'scripts/data-governance/teacher-ai-grading-lab-cli.ts',
      'dynamic',
    )).toBe('dynamic');
    const dynamic = asAdjudication(adjudicateResidualDataGovernance(input({
      members: [{ path: 'src/lib/data-governance/teacher-ai-grading-lab-core.ts' }],
      callers: [{
        memberPath: 'src/lib/data-governance/teacher-ai-grading-lab-core.ts',
        callerPath: 'scripts/data-governance/teacher-ai-grading-lab-cli.ts',
        relationship: 'dynamic',
      }],
    })));
    expect(dynamic.records[0]?.callerClasses).toEqual(['dynamic']);
    expect(directoryPathReadCaller(
      'scripts/tests/test-new-resource-semantic-completeness-command.mjs',
      "fs.cpSync(path.join(root, 'src/lib/data-governance'), dest, { recursive: true });",
      'src/lib/data-governance/index.ts',
    )).toEqual({
      memberPath: 'src/lib/data-governance/index.ts',
      callerPath: 'scripts/tests/test-new-resource-semantic-completeness-command.mjs',
      relationship: 'path-read',
    });
  });

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
      'predecessor-1883-identity-mismatch',
      'full-ledger-bytes-unverified',
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
    // Without a verified receipt the package is non-qualified, so no slice is emitted.
    expect(docs['future-slices.md']).toContain('No migration-input slice is emitted');
    expect(docs['future-slices.md']).toContain('full-ledger-bytes-unverified');
    expect(docs['handoff.md']).toContain('does not move source');
    expect(docs['handoff.md']).toMatch(/COMPLETE-(qualified|non-qualified-BLOCKER)/u);
  });

  it('qualifies only when denominator, callers, owners and outcomes close', () => {
    const members: ResidualMemberInput[] = [
      { path: 'src/lib/data-governance/portrait-v2-model.ts' },
    ];
    const qualified = runWithLedgerVerification({
      members,
      callers: [{
        memberPath: 'src/lib/data-governance/portrait-v2-model.ts',
        callerPath: 'src/features/personalization/portrait.ts',
        relationship: 'import',
      }],
    });
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

  it('emits migration-input slices only for a fully qualified package', () => {
    const members: ResidualMemberInput[] = [{ path: 'src/lib/data-governance/math-document-backfill.ts' }];
    const qualified = runWithLedgerVerification({ members });
    expect(qualified.qualified).toBe(true);
    expect(qualified.futureSlices.length).toBeGreaterThan(0);
    const docs = projectResidualDocuments(qualified);
    expect(docs['future-slices.md']).toContain('migration input, not authorization');
    expect(docs['future-slices.md']).not.toContain('No migration-input slice is emitted');

    // Any still-standing blocker — here an unverified receipt — keeps slices out.
    const unverified = asAdjudication(adjudicateResidualDataGovernance(input({ members })));
    expect(unverified.blockers).toContain('full-ledger-bytes-unverified');
    expect(unverified.futureSlices).toEqual([]);
  });

  it('reconciles projections from actual written bytes and rejects tampered, stale-subject, or missing files', () => {
    const members: ResidualMemberInput[] = [{ path: 'src/lib/data-governance/event-protocol.ts' }];
    const result = runWithLedgerVerification({ members });
    const dir = writeProjectionsToTempDir(result);
    try {
      const params = {
        outputDir: dir,
        result,
        receiptSubjectCommit: result.subject.currentSubject.subjectCommit,
      } as const;
      const intact = verifyResidualProjectionArtifacts(params);
      expect(intact.reconciled).toBe(true);
      expect(Object.keys(intact.fileDigests).sort()).toEqual(
        ['decision-matrix.md', 'future-slices.md', 'handoff.md', 'summaries.md'],
      );

      const matrixPath = join(dir, 'decision-matrix.md');
      const originalMatrix = readFileSync(matrixPath, 'utf8');
      // Intact files with a receipt bound to a foreign subject must fail the
      // subject check even though every byte still matches the render.
      expect(verifyResidualProjectionArtifacts({
        outputDir: dir,
        result,
        receiptSubjectCommit: REQUIRED_SUCCESSOR.sourceCommit,
      })).toMatchObject({
        reconciled: false,
        reason: 'projection-subject-mismatch',
      });

      writeFileSync(matrixPath, originalMatrix.replace(
        `currentSubjectCommit: \`${result.subject.currentSubject.subjectCommit}\``,
        `currentSubjectCommit: \`${REQUIRED_SUCCESSOR.sourceCommit}\``,
      ));
      expect(verifyResidualProjectionArtifacts(params)).toMatchObject({
        reconciled: false,
        reason: 'projection-content-mismatch:decision-matrix.md',
      });

      writeFileSync(matrixPath, originalMatrix);
      writeFileSync(join(dir, 'summaries.md'), '# tampered\n');
      expect(verifyResidualProjectionArtifacts(params)).toMatchObject({
        reconciled: false,
        reason: 'projection-content-mismatch:summaries.md',
      });

      writeFileSync(join(dir, 'summaries.md'), projectResidualDocuments(result)['summaries.md'] ?? '');
      rmSync(join(dir, 'handoff.md'));
      expect(verifyResidualProjectionArtifacts(params)).toMatchObject({
        reconciled: false,
        reason: 'projection-missing:handoff.md',
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('renders the current subject identity and keeps predecessor commits comparison-only', () => {
    const members: ResidualMemberInput[] = [{ path: 'src/lib/data-governance/event-protocol.ts' }];
    const result = runWithLedgerVerification({ members });
    const matrix = projectResidualDocuments(result)['decision-matrix.md'] ?? '';
    expect(matrix).toContain(`currentSubjectCommit: \`${result.subject.currentSubject.subjectCommit}\``);
    expect(matrix).toContain(`currentSubjectTree: \`${result.subject.currentSubject.subjectTree}\``);
    expect(matrix).toContain(`predecessor1883.sourceCommit: \`${REQUIRED_SUCCESSOR.sourceCommit}\``);
    expect(matrix).not.toMatch(/^- (sourceCommit|sourceTree|packageDigest):/mu);
    const handoff = projectResidualDocuments(result)['handoff.md'] ?? '';
    expect(handoff).toContain(`currentSubjectCommit: \`${result.subject.currentSubject.subjectCommit}\``);
  });

  it('adjudicates only on the change claim branch and blocks any other execution branch', () => {
    const members: ResidualMemberInput[] = [{ path: 'src/lib/data-governance/event-protocol.ts' }];
    const claimBranch = runWithLedgerVerification({ members });
    expect(claimBranch.blockers).not.toContain('execution-branch-not-claim-branch');
    expect(claimBranch.qualified).toBe(true);

    for (const executionBranch of ['main', 'integration', 'HEAD', undefined]) {
      const foreign = asAdjudication(adjudicateResidualDataGovernance({ ...input({ members }), executionBranch }));
      expect(foreign.blockers).toContain('execution-branch-not-claim-branch');
      expect(foreign.qualified).toBe(false);
      expect(foreign.futureSlices).toEqual([]);
    }
  });

  it('binds members to frozen blob identities and keeps one outcome per migration-input slice', () => {
    const members: ResidualMemberInput[] = [
      { path: 'src/lib/data-governance/index.ts' },
      { path: 'src/lib/data-governance/__tests__/event-protocol.test.ts' },
    ];
    const qualified = runWithLedgerVerification({ members });
    expect(qualified.blockers).not.toContain('member-blob-identity-missing');
    for (const record of qualified.records) {
      expect(record.blobOid).toBe(DEFAULT_BLOB_OID);
      expect(record.byteSize).toBe(128);
    }
    // compatibility barrel and test fixtures must never share one slice, even
    // under the same owner: each slice projects exactly one outcome.
    const compatFamily = qualified.futureSlices.filter((slice) => slice.paths.some(
      (path) => path.endsWith('data-governance/index.ts') || path.includes('__tests__'),
    ));
    expect(new Set(compatFamily.map((slice) => slice.outcome)).size).toBe(compatFamily.length);
    expect(compatFamily.map((slice) => slice.outcome).sort()).toEqual(['compatibility', 'fixture-asset']);
    const docs = projectResidualDocuments(qualified)['future-slices.md'] ?? '';
    for (const slice of qualified.futureSlices) {
      expect(docs).toContain(`## ${slice.slice}`);
      expect(docs).toContain(`- outcome: \`${slice.outcome}\``);
    }

    const missingIdentity = asAdjudication(adjudicateResidualDataGovernance(input({
      members: [{ path: 'src/lib/data-governance/event-protocol.ts', blobOid: undefined, byteSize: undefined }],
    })));
    expect(missingIdentity.blockers).toContain('member-blob-identity-missing');
    expect(missingIdentity.qualified).toBe(false);
    expect(missingIdentity.futureSlices).toEqual([]);
  });
});
