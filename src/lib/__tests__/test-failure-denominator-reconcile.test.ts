import { describe, expect, it } from 'vitest';

import { successorPackageDigest } from '@/lib/architecture-census/post-convergence';
import { privacyViolation } from '@/lib/architecture-census/privacy';
import { serializeDeterministic } from '@/lib/architecture-census/serialize';
import {
  POST_CONVERGENCE_COMMAND_SCOPE,
  POST_CONVERGENCE_OUTPUT_DIR,
  POST_CONVERGENCE_SCHEMA_VERSION,
  type PostConvergenceEnvelope,
} from '@/lib/architecture-census/types';
import { REQUIRED_BASELINE } from '@/lib/architecture-charter';
import {
  COMMAND_CONTRACTS,
  REQUIRED_CHARTER,
  compactPackageDigest,
  coordinationGateFailures,
  createPlannedDisposition,
  createToolIdentity,
  discoverTests,
  investigateCurrentDenominator,
  isDefaultMandatory,
  loadSuccessorSubject,
  projectCompactPackage,
  reprojectCompactPackage,
  validatePlannedDisposition,
  type CoordinationGate,
  type InvestigationFs,
  type LaneExecutionInput,
  type SubjectIdentity,
  type ToolIdentity,
} from '@/lib/architecture-test-commands';

const SUBJECT_COMMIT = '1'.repeat(40);
const SUBJECT_TREE = '2'.repeat(40);
const TOOL_COMMIT = '3'.repeat(40);
const TOOL_TREE = '4'.repeat(40);
const CAPTURE_ID = 'ab'.repeat(32);
const DIGEST = 'cd'.repeat(32);
const GATE: CoordinationGate = { issueClosed: true, statusArchived: true, blockedByResolved: true };

const ROOTS = [
  'src/lib/__tests__/math.test.ts',
  'src/app/api/health/__tests__/route.test.ts',
  'src/lib/__tests__/db.integration.test.ts',
  'tests/platform-entrypoints.spec.ts',
  'scripts/tests/test-commercial-ui-governance.ts',
  'scripts/tests/smoke-test.mjs',
  'scripts/knowledge-governance/input-inventory/__tests__/inventory.test.ts',
  'course-content/tests/test_export_handout_pdf.py',
  'rust/control-engine/tests/destroyer_hifi.rs',
  'src/lib/__tests__/test-command-contracts.test.ts',
  'scripts/tests/test-arena-home-entry.mjs',
  'scripts/tests/test-arena-routes.mjs',
];

function envelope(overrides: Partial<PostConvergenceEnvelope> = {}): PostConvergenceEnvelope {
  const draft = {
    schemaVersion: POST_CONVERGENCE_SCHEMA_VERSION,
    successorCaptureId: CAPTURE_ID,
    status: 'qualified-for-investigation',
    statusEvidence: [{ stage: 'qualified-for-investigation', evidence: 'fixture' }],
    captureIdentity: {
      sourceCommit: SUBJECT_COMMIT,
      sourceTree: SUBJECT_TREE,
      commitTime: '2026-09-03T00:00:00Z',
      nodeVersion: 'v22.0.0',
      npmVersion: '10.0.0',
      typescriptVersion: '5.8.3',
    },
    originIntegrationCommit: SUBJECT_COMMIT,
    commandScope: POST_CONVERGENCE_COMMAND_SCOPE,
    toolVersions: { nodeVersion: 'v22.0.0' },
    schemaVersions: { censusCore: 'act-architecture-census/v1' },
    predecessorBaseline: {
      schemaVersion: REQUIRED_BASELINE.schemaVersion,
      sourceCommit: REQUIRED_BASELINE.sourceCommit,
      sourceTree: REQUIRED_BASELINE.sourceTree,
      censusCoreSha256: REQUIRED_BASELINE.censusCoreSha256,
      receiptSchemaVersion: REQUIRED_BASELINE.receiptSchemaVersion,
      receiptIds: [...REQUIRED_BASELINE.receiptIds],
    },
    predecessorCurrentHead: {
      schemaVersion: 'act-architecture-current-head-delta/v1',
      sourceCommit: '5'.repeat(40),
      sourceTree: '6'.repeat(40),
      packageSha256: 'ef'.repeat(32),
    },
    successorCoreSha256: DIGEST,
    inventoryKindSet: [],
    predecessorKindSet: [],
    materialLayers: [],
    layerReconciliation: { trackedFileCount: 0, layerAssignedCount: 0, unassignedCount: 0 },
    denominatorSlices: [],
    ownerResidueTotals: { total: 0, observation: 0, ambiguous: 0, unresolved: 0 },
    hotspotTotals: { limit: 50, ranked: 0, unresolvedMetrics: 0 },
    payloadClassTotals: { duplicateBlobCount: 0, classes: [], unresolvedCount: 0 },
    frozenReceiptIds: [],
    handoff: [],
    artifacts: [],
    digestScope: 'fixture',
    packageDigest: '',
    ...overrides,
  } as PostConvergenceEnvelope;
  return { ...draft, packageDigest: successorPackageDigest(draft) };
}

function fsFor(pack: PostConvergenceEnvelope, extras: Record<string, string> = {}): InvestigationFs {
  const files = new Map<string, string>([
    [`${POST_CONVERGENCE_OUTPUT_DIR}/baseline.json`, serializeDeterministic(pack)],
    ...Object.entries(extras),
  ]);
  return {
    exists: (path) => files.has(path),
    readText: (path) => {
      const content = files.get(path);
      if (content === undefined) throw new Error(`missing:${path}`);
      return content;
    },
  };
}

function subjectFrom(pack: PostConvergenceEnvelope): SubjectIdentity {
  return {
    successorCaptureId: pack.successorCaptureId,
    sourceCommit: pack.captureIdentity.sourceCommit,
    sourceTree: pack.captureIdentity.sourceTree,
    packageDigest: pack.packageDigest,
    schemaVersion: pack.schemaVersion,
    status: pack.status,
  };
}

function tool(subject: SubjectIdentity): ToolIdentity {
  return createToolIdentity({
    toolCommit: TOOL_COMMIT,
    toolTree: TOOL_TREE,
    subject,
    entryBundleDigest: DIGEST,
  });
}

function discovery(paths = ROOTS) {
  return discoverTests({
    paths,
    sourceCommit: SUBJECT_COMMIT,
    sourceTree: SUBJECT_TREE,
    charterSha256: REQUIRED_CHARTER.sha256,
  });
}

function pass(command: LaneExecutionInput['command'], extra: Partial<LaneExecutionInput> = {}): LaneExecutionInput {
  return {
    command,
    exitStatus: 0,
    passed: 1,
    failed: 0,
    skipped: [],
    unhandledErrors: 0,
    failures: [],
    ...extra,
  };
}

function allPassing(extra: Partial<Record<LaneExecutionInput['command'], Partial<LaneExecutionInput>>> = {}): LaneExecutionInput[] {
  return COMMAND_CONTRACTS.map((command) => pass(command.id, extra[command.id]));
}

function run(options: {
  readonly pack?: PostConvergenceEnvelope;
  readonly gate?: CoordinationGate | null;
  readonly paths?: readonly string[];
  readonly executions?: readonly LaneExecutionInput[];
  readonly extras?: Record<string, string>;
} = {}) {
  const pack = options.pack ?? envelope();
  const subject = subjectFrom(pack);
  return investigateCurrentDenominator({
    repoRoot: '/repo',
    gate: options.gate === undefined ? GATE : options.gate,
    tool: tool(subject),
    discovery: discoverTests({
      paths: options.paths ?? ROOTS,
      sourceCommit: subject.sourceCommit,
      sourceTree: subject.sourceTree,
      charterSha256: REQUIRED_CHARTER.sha256,
    }),
    executions: options.executions ?? allPassing(),
    fs: fsFor(pack, options.extras),
  });
}

describe('current clean-head failure denominator', () => {
  it('blocks investigation when the A coordination gate is unresolved', () => {
    expect(coordinationGateFailures(null).some((item) => item.code === 'a-gate-unverified')).toBe(true);
    const output = run({ gate: { issueClosed: false, statusArchived: false, blockedByResolved: false } });
    expect(output.compact).toBeNull();
    expect(output.failures.map((item) => item.code)).toEqual(expect.arrayContaining([
      'a-gate-issue-open',
      'a-gate-not-archived',
      'a-gate-blocked-by-unresolved',
    ]));
  });

  it('loads a consumable successor subject and rejects required-baseline or digest drift', () => {
    const pack = envelope();
    const loaded = loadSuccessorSubject('/repo', { fs: fsFor(pack) });
    expect(loaded.failures).toEqual([]);
    expect(loaded.subject.successorCaptureId).toBe(CAPTURE_ID);
    expect(loaded.subject.sourceCommit).not.toBe(REQUIRED_BASELINE.sourceCommit);
    expect(loaded.subject.status).toBe('qualified-for-investigation');

    const drifted = envelope();
    const broken = { ...drifted, packageDigest: '00'.repeat(32) };
    const failed = loadSuccessorSubject('/repo', { fs: fsFor(broken) });
    expect(failed.failures.some((item) => item.code === 'successor-package-digest-mismatch')).toBe(true);

    const asBaseline = envelope({
      captureIdentity: {
        sourceCommit: REQUIRED_BASELINE.sourceCommit,
        sourceTree: REQUIRED_BASELINE.sourceTree,
        commitTime: '2026-09-03T00:00:00Z',
        nodeVersion: 'v22.0.0',
        npmVersion: '10.0.0',
        typescriptVersion: '5.8.3',
      },
    });
    const baselineLoad = loadSuccessorSubject('/repo', { fs: fsFor(asBaseline) });
    expect(baselineLoad.failures.some((item) => item.code === 'successor-must-not-be-required-baseline')).toBe(true);
  });

  it('records distinct tool identity and fail-closes on subject/tool drift', () => {
    const subject = subjectFrom(envelope());
    const recorded = tool(subject);
    expect(recorded.equalToSubject).toBe(false);
    const output = run({
      executions: allPassing(),
    });
    expect(output.compact?.tool.toolCommit).toBe(TOOL_COMMIT);
    expect(output.compact?.subject.sourceCommit).toBe(SUBJECT_COMMIT);
    expect(output.compact?.tool.equalToSubject).toBe(false);

    const pack = envelope();
    const drifted = investigateCurrentDenominator({
      repoRoot: '/repo',
      gate: GATE,
      tool: tool(subjectFrom(pack)),
      discovery: discoverTests({
        paths: ROOTS,
        sourceCommit: '9'.repeat(40),
        sourceTree: SUBJECT_TREE,
        charterSha256: REQUIRED_CHARTER.sha256,
      }),
      executions: allPassing(),
      fs: fsFor(pack),
    });
    expect(drifted.failures.some((item) => item.code === 'discovery-subject-drift')).toBe(true);
  });

  it('closes the discovered universe bidirectionally and keeps unresolved items visible', () => {
    const closed = discovery(ROOTS);
    expect(closed.totals.discovered).toBe(closed.totals.classified + closed.totals.excluded);
    expect(closed.totals.unresolved).toBe(0);

    const open = run({ paths: [...ROOTS, 'vendor/orphan.test.ts'] });
    expect(open.discovery.unresolved.some((item) => item.identity === 'vendor/orphan.test.ts')).toBe(true);
    expect(open.compact?.universeClosure.unresolved).toBeGreaterThan(0);
    expect(open.compact?.defaultConclusion).toBe('non-clean');
  });

  it('keeps default PR clean isolated from non-default unit, nightly, and release blockers', () => {
    const output = run({
      executions: allPassing({
        'test:unit': {
          exitStatus: 1,
          passed: 0,
          failed: 1,
          failures: [{
            testIdentity: 'src/lib/__tests__/math.test.ts::red',
            failureStage: 'assertion',
            errorClass: 'assertion-failure',
            errorSummary: 'expected 1 to equal 2',
          }],
        },
        'test:nightly': {
          exitStatus: 1,
          passed: 0,
          failed: 0,
          unavailable: {
            responseClass: 'nightly-not-run',
            resolutionCondition: 'execute-the-registered-nightly-lane',
            owner: 'platform',
          },
        },
        'test:release': {
          exitStatus: 1,
          passed: 0,
          failed: 1,
          failures: [],
        },
      }),
    });
    expect(isDefaultMandatory('test')).toBe(true);
    expect(isDefaultMandatory('test:unit')).toBe(false);
    expect(output.compact?.defaultConclusion).toBe('clean');
    expect(output.compact?.lanes.find((lane) => lane.lane === 'unit')?.status).toBe('non-clean');
    expect(output.compact?.lanes.find((lane) => lane.lane === 'nightly')?.status).toBe('BLOCKED');
    expect(output.compact?.lanes.find((lane) => lane.lane === 'release')?.status).toBe('non-clean');
    expect(output.compact?.nonDefaultConclusions.some((item) => item.lane === 'nightly' && item.status === 'BLOCKED')).toBe(true);
    expect(output.dispositions.some((item) => item.disposition === 'FIX' && item.lane === 'unit')).toBe(true);
    expect(output.dispositions.some((item) => item.disposition === 'QUARANTINE' && item.subtype === 'release-input')).toBe(true);
    expect(output.dispositions.some((item) => item.disposition === 'BLOCKED' && item.blockedReason === 'external-blocker')).toBe(true);
  });

  it('emits a non-clean default package when a default mandatory fingerprint remains', () => {
    const output = run({
      executions: allPassing({
        test: {
          exitStatus: 1,
          passed: 0,
          failed: 1,
          failures: [{
            testIdentity: 'scripts/tests/smoke-test.mjs::smoke',
            failureStage: 'assertion',
            errorClass: 'assertion-failure',
            errorSummary: 'smoke failed',
          }],
        },
      }),
    });
    expect(output.compact?.defaultConclusion).toBe('non-clean');
    expect(output.compact?.lanes.find((lane) => lane.lane === 'default')?.status).toBe('non-clean');
  });

  it('re-projects a compact package byte-identically and separates measurements from result cores', () => {
    const first = run({
      executions: allPassing({
        test: { capturedAt: '2026-09-03T00:00:00.000Z' },
      }),
    });
    const second = run({
      executions: allPassing({
        test: { capturedAt: '2026-09-03T00:00:01.000Z' },
      }),
    });
    expect(first.compact).not.toBeNull();
    const replayed = reprojectCompactPackage(first.compact!);
    expect(compactPackageDigest(replayed)).toBe(first.compact!.packageDigest);
    expect(projectCompactPackage(first.compact!)).toBe(projectCompactPackage(replayed));
    expect(first.resultCores[0]?.fingerprints).toEqual(second.resultCores[0]?.fingerprints);
    expect(first.measurementReceipts.find((item) => item.command === 'test')?.receiptId)
      .not.toBe(second.measurementReceipts.find((item) => item.command === 'test')?.receiptId);
    expect(privacyViolation(projectCompactPackage(first.compact!))).toBeNull();
  });

  it('rejects privacy leaks and forbidden planned dispositions', () => {
    const leaked = run({
      executions: allPassing({
        'test:unit': {
          exitStatus: 1,
          passed: 0,
          failed: 1,
          failures: [{
            testIdentity: 'src/lib/__tests__/math.test.ts::red',
            failureStage: 'assertion',
            errorClass: 'assertion-failure',
            errorSummary: 'failed at /Users/YW/secret/repo/file.ts',
          }],
        },
      }),
    });
    expect(leaked.failures.some((item) => item.code.includes('absolute-path') || item.code.includes('privacy'))).toBe(true);

    const forbidden = validatePlannedDisposition(createPlannedDisposition({
      command: 'test:unit',
      testIdentity: 'src/lib/__tests__/math.test.ts::red',
      failureStage: 'assertion',
      errorClass: 'assertion-failure',
      errorSummary: 'expected mismatch',
      artifactIdentity: 'test:unit:red',
      subject: subjectFrom(envelope()),
      tool: tool(subjectFrom(envelope())),
      disposition: 'FIX',
      rootCauseEvidenceLocator: 'failure:red',
      closureCondition: 'the focused command passes without this fingerprint',
    }));
    expect(forbidden).toEqual([]);
    expect(validatePlannedDisposition({
      ...createPlannedDisposition({
        command: 'test:unit',
        testIdentity: 'src/lib/__tests__/math.test.ts::red',
        failureStage: 'assertion',
        errorClass: 'assertion-failure',
        errorSummary: 'expected mismatch',
        artifactIdentity: 'test:unit:red',
        subject: subjectFrom(envelope()),
        tool: tool(subjectFrom(envelope())),
        disposition: 'FIX',
        rootCauseEvidenceLocator: 'failure:red',
        closureCondition: 'the focused command passes without this fingerprint',
      }),
      disposition: 'accepted',
    }).some((item) => item.code === 'planned-disposition-forbidden')).toBe(true);
  });

  it('requires quarantine expiry/named non-default lane and does not execute dispositions', () => {
    const record = createPlannedDisposition({
      command: 'test:release',
      testIdentity: 'qualification-manifest',
      failureStage: 'input',
      errorClass: 'release-input-missing',
      errorSummary: 'missing manifest',
      artifactIdentity: 'test:release:manifest',
      subject: subjectFrom(envelope()),
      tool: tool(subjectFrom(envelope())),
      disposition: 'QUARANTINE',
      subtype: 'release-input',
      namedLane: 'release',
      expiry: 'until-release-manifest-is-supplied',
      migrationCondition: 'qualify-in-release-lane',
      rootCauseEvidenceLocator: 'release:qualification-manifest',
      closureCondition: 'test:release validates a current qualification manifest',
    });
    expect(validatePlannedDisposition(record)).toEqual([]);
    expect(validatePlannedDisposition({ ...record, expiry: '' }).some((item) => item.code === 'planned-quarantine-expiry-missing')).toBe(true);
    expect(validatePlannedDisposition({ ...record, namedLane: 'default' }).some((item) => item.code === 'planned-quarantine-default-lane')).toBe(true);
    expect(record.closureCondition.includes('validates')).toBe(true);
  });
});
