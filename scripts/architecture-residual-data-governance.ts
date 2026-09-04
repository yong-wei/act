#!/usr/bin/env tsx
/**
 * Current residual Data Governance owner/outcome requalification (#1917).
 *
 * Runs on a clean implementation HEAD. Freezes the claim-time origin/integration
 * commit/tree as an adjudication subject independent from the #1876/#1883
 * predecessor identities (comparison-only), requires the upstream payload
 * eligibility change (#1916) to be archived, rebuilds the complete current
 * src/lib/data-governance member and caller denominator, writes the full ledger
 * as an external artifact, independently verifies its bytes, and emits compact
 * decision outputs under residual-data-governance/current/. Action-neutral:
 * no file moves, no import rewrites, no compatibility retirement.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { privacyViolation } from '../src/lib/architecture-census/privacy';
import { serializeDeterministic, sha256Text } from '../src/lib/architecture-census/serialize';
import { isMixedWorktree } from '../src/lib/architecture-census/identity';
import {
  PREDECESSOR_1883,
  REQUIRED_SUCCESSOR,
  RESIDUAL_CLAIM_BRANCH,
  RESIDUAL_SCHEMA_VERSION,
  UPSTREAM_PAYLOAD_CHANGE,
  adjudicateResidualDataGovernance,
  buildMemberReferenceTokens,
  buildResidualCompactPackage,
  collectRelativeCallers,
  directoryPathReadCaller,
  extractModuleSpecifiers,
  loadPredecessorComparison,
  loadUpstreamPayloadEvidence,
  memberSetDigest,
  projectResidualDocuments,
  resolveModuleSpecifier,
  resolveResidualCurrentSubject,
  textReferencesMember,
  reconcileResidualDecisionPackage,
  verifyResidualDecisionPackage,
  verifyResidualLedgerArtifact,
  type Issue1876Snapshot,
  type ResidualAdjudication,
  type ResidualAdjudicationInput,
  type ResidualCallerInput,
  type ResidualMemberInput,
  type ResidualPackageVerification,
  type ResidualRunSnapshot,
} from '../src/lib/architecture-charter/residual-data-governance';

const OUTPUT_DIR = 'docs/architecture/modular-monolith/post-convergence/residual-data-governance/current';
const TOOL_FILES = [
  'src/lib/architecture-charter/residual-data-governance.ts',
  'scripts/architecture-residual-data-governance.ts',
];

function git(args: string[]): string {
  // The whole-repo caller grep alone emits ~31MB; a buffer overflow here would
  // be swallowed into an empty caller denominator, so keep ample headroom.
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }).trim();
}

function ghIssueSnapshot(number: number): { state: string; labels: string[]; blockedBy: { number: number; state: string }[] } {
  const payload = JSON.parse(execFileSync('gh', [
    'api',
    'graphql',
    '-f',
    `query={ repository(owner:"yong-wei", name:"act") { issue(number:${number}) { number state labels(first:20) { nodes { name } } blockedBy(first:20) { nodes { number state } } } } }`,
  ], { encoding: 'utf8' })) as {
    data: {
      repository: {
        issue: {
          state: string;
          labels: { nodes: { name: string }[] };
          blockedBy: { nodes: { number: number; state: string }[] };
        };
      };
    };
  };
  const issue = payload.data.repository.issue;
  return {
    state: issue.state,
    labels: issue.labels.nodes.map((node) => node.name),
    blockedBy: issue.blockedBy.nodes,
  };
}

function loadMembers(subjectCommit: string, subjectTree: string): ResidualMemberInput[] {
  // `ls-tree -l -z` binds every member to its frozen-subject blob identity and
  // byte size (task 2.1); `-z` keeps unicode paths unquoted.
  return git(['ls-tree', '-r', '-l', '-z', subjectCommit, '--', 'src/lib/data-governance'])
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const tabIndex = entry.indexOf('\t');
      if (tabIndex < 0) throw new Error(`member-entry-unparseable:${entry.slice(0, 40)}`);
      const path = entry.slice(tabIndex + 1);
      const fields = entry.slice(0, tabIndex).trim().split(/\s+/u);
      const [mode, type, blobOid, size] = fields;
      if (!/^100(644|755)$/u.test(mode ?? '')
        || type !== 'blob' || !blobOid || !/^[0-9a-f]{40}$/iu.test(blobOid) || size === undefined || size === '-') {
        throw new Error(`member-blob-identity-unreadable:${path}`);
      }
      return { path, blobOid, byteSize: Number(size), currentOwnerEvidence: [`sourceTree:${subjectTree}`] };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function gitGrep(pattern: string, subjectCommit: string): string {
  try {
    return git([
      'grep',
      '-E',
      pattern,
      subjectCommit,
      '--',
      '*.ts',
      '*.tsx',
      '*.mts',
      '*.cts',
      '*.mjs',
      '*.cjs',
      '*.js',
      '*.md',
      '*.json',
      '*.jsonl',
    ]);
  } catch {
    return '';
  }
}

function parseGrepLine(line: string): { callerPath: string; text: string } | null {
  const first = line.indexOf(':');
  if (first < 0) return null;
  const rest = line.slice(first + 1);
  const second = rest.indexOf(':');
  if (second < 0) return null;
  return { callerPath: rest.slice(0, second), text: rest.slice(second + 1) };
}

function loadMemberFiles(members: readonly ResidualMemberInput[], subjectCommit: string): { path: string; content: string }[] {
  return members
    .filter((member) => member.path.endsWith('.ts') || member.path.endsWith('.tsx') || member.path.endsWith('.js'))
    .map((member) => ({
      path: member.path,
      content: git(['show', `${subjectCommit}:${member.path}`]),
    }));
}

function loadCallers(members: readonly ResidualMemberInput[], subjectCommit: string): ResidualCallerInput[] {
  const memberPaths = members.map((member) => member.path);
  const memberPathSet = new Set(memberPaths);
  const barrel = 'src/lib/data-governance/index.ts';
  // Code files are attributed by resolving actual module specifiers (relative
  // or `@/` alias) against the frozen member set; text references in docs,
  // JSON, and JSONL still use boundary-aware token matching.
  const tokens = buildMemberReferenceTokens(memberPaths);
  const importGrep = gitGrep('(^|[^A-Za-z0-9_])(from|require|import)[[:space:]]*\\(?[\'"]', subjectCommit);
  const textGrep = [gitGrep('lib/data-governance/', subjectCommit), gitGrep('src/lib/data-governance', subjectCommit)].join('\n');
  const callers: ResidualCallerInput[] = [];
  const seen = new Set<string>();
  const add = (caller: ResidualCallerInput): void => {
    const key = `${caller.memberPath}|${caller.callerPath}|${caller.relationship}`;
    if (seen.has(key) || caller.callerPath === caller.memberPath) return;
    seen.add(key);
    callers.push(caller);
  };
  const classify = (callerPath: string, text: string): string => callerPath.startsWith('openspec/changes/archive/')
    ? 'historical'
    : callerPath.startsWith('openspec/') || callerPath.startsWith('docs/')
      ? 'documentation'
      : /export .* from/u.test(text)
        ? 're-export'
        : /import\s*\(/u.test(text)
          ? 'dynamic'
          : text.includes('cpSync') || text.includes('readFile') || text.includes('path.join')
            ? 'path-read'
            : 'import';
  for (const line of importGrep.split('\n')) {
    const parsed = parseGrepLine(line);
    if (!parsed) continue;
    const { callerPath, text } = parsed;
    if (!callerPath || !/\.(?:ts|tsx|mts|cts|mjs|cjs|js)$/u.test(callerPath)) continue;
    for (const specifier of extractModuleSpecifiers(text)) {
      const memberPath = resolveModuleSpecifier(callerPath, specifier, memberPathSet);
      if (memberPath) add({ memberPath, callerPath, relationship: classify(callerPath, text) });
    }
  }
  for (const line of textGrep.split('\n')) {
    const parsed = parseGrepLine(line);
    if (!parsed) continue;
    const { callerPath, text } = parsed;
    if (!callerPath) continue;
    const directory = directoryPathReadCaller(callerPath, text, barrel);
    if (directory && memberPaths.includes(barrel)) add(directory);
    for (const [memberPath, variants] of tokens) {
      if (!variants.some((token) => textReferencesMember(text, token))) continue;
      add({ memberPath, callerPath, relationship: classify(callerPath, text) });
    }
  }
  for (const caller of collectRelativeCallers(loadMemberFiles(members, subjectCommit), memberPaths)) add(caller);
  return callers.sort((left, right) => (
    left.memberPath.localeCompare(right.memberPath)
    || left.callerPath.localeCompare(right.callerPath)
    || left.relationship.localeCompare(right.relationship)
  ));
}

function verifyOwnerResidue(): void {
  const text = readFileSync(join(process.cwd(), 'docs/architecture/modular-monolith/post-convergence/owner-residue.md'), 'utf8');
  const digest = sha256Text(text);
  if (digest !== REQUIRED_SUCCESSOR.ownerResidueSha256) {
    throw new Error(`owner-residue-digest-mismatch:${digest}`);
  }
}

function toolIdentity(): { toolCommit: string; toolTree: string; entryBundleDigest: string } {
  const dirtyTool = git(['status', '--porcelain', '--', ...TOOL_FILES]);
  if (dirtyTool.length > 0) throw new Error(`tool-dirty:${dirtyTool}`);
  const commit = git(['rev-parse', 'HEAD']);
  const files = Object.fromEntries(TOOL_FILES.map((path) => [path, git(['show', `${commit}:${path}`])]));
  return {
    toolCommit: commit,
    toolTree: git(['rev-parse', `${commit}^{tree}`]),
    entryBundleDigest: sha256Text(serializeDeterministic(files)),
  };
}

const repoRoot = process.cwd();

// 0. Execution-checkpoint guards: this adjudicator may only run on its own
//    claim branch (= change id) with a clean work tree. Detached HEAD, `main`,
//    `integration`, or any other named branch is rejected before any input is
//    read, so a foreign branch HEAD can never become the tool identity.
const currentBranch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
if (currentBranch !== RESIDUAL_CLAIM_BRANCH) {
  process.stderr.write(`execution-branch-rejected:${currentBranch}\n`);
  process.exit(2);
}
// Dirty-source observes everything except this tool's own output surfaces: a
// rerun naturally sees its previous projections as modified, and their
// integrity is enforced by the byte-level projection verification instead.
const worktreeDirty = git([
  'status', '--porcelain', '--', ':/',
  `:(exclude)${OUTPUT_DIR}`,
  ':(exclude)artifacts/architecture-census',
]).length > 0;

// 1. Freeze the claim-time current subject (independent from #1876/#1883 history).
//    RESIDUAL_SUBJECT_COMMIT pins an explicit frozen commit so any consumer can
//    deterministically replay the ledger of an already-published package; when
//    replaying, the moving-ref drift guard is skipped by design.
execFileSync('git', ['-C', repoRoot, 'fetch', 'origin', 'integration'], { stdio: 'ignore' });
const subjectOverride = process.env.RESIDUAL_SUBJECT_COMMIT ?? '';
const replayPinnedSubject = /^[0-9a-f]{40}$/iu.test(subjectOverride);
if (replayPinnedSubject) {
  execFileSync('git', ['-C', repoRoot, 'cat-file', '-e', `${subjectOverride}^{commit}`], { stdio: 'ignore' });
}
const currentSubject: { baseBranch: 'origin/integration'; subjectCommit: string; subjectTree: string } = replayPinnedSubject
  ? {
    baseBranch: 'origin/integration',
    subjectCommit: subjectOverride,
    subjectTree: git(['rev-parse', `${subjectOverride}^{tree}`]),
  }
  : resolveResidualCurrentSubject(repoRoot);

// 2. Native dependency gate: the upstream payload-eligibility change must be archived.
const upstreamIssue = ghIssueSnapshot(UPSTREAM_PAYLOAD_CHANGE.issue);
if (String(upstreamIssue.state).toUpperCase() !== 'CLOSED' || !upstreamIssue.labels.includes('status:archived')) {
  process.stderr.write(`upstream-payload-change-not-archived:${UPSTREAM_PAYLOAD_CHANGE.issue}:${upstreamIssue.state}:${upstreamIssue.labels.join(',')}\n`);
  process.exit(2);
}
// Task 1.1: the upstream dependency must also have its native blockedBy
// relationships resolved before this adjudication may consume it.
const openUpstreamBlockers = upstreamIssue.blockedBy.filter((item) => String(item.state).toUpperCase() !== 'CLOSED');
if (openUpstreamBlockers.length > 0) {
  process.stderr.write(`upstream-payload-blockedBy-unresolved:${UPSTREAM_PAYLOAD_CHANGE.issue}:${openUpstreamBlockers.map((item) => item.number).join(',')}\n`);
  process.exit(2);
}
const upstreamPayload = { ...loadUpstreamPayloadEvidence(repoRoot), closed: true, archived: true };
const predecessor = loadPredecessorComparison(repoRoot);

// 3. Read-only comparison evidence: every consumed archived/upstream byte is
//    snapshotted and re-verified before publication, not just the indexes.
const upstreamIndexRaw = readFileSync(join(repoRoot, UPSTREAM_PAYLOAD_CHANGE.compactIndexLocator), 'utf8');
const upstreamInventoryLocator = (JSON.parse(upstreamIndexRaw) as {
  inventoryVerification?: { locator?: string };
}).inventoryVerification?.locator ?? 'artifacts/architecture-census/unknown/payload-classification-inventory.ndjson';
const readOnlyInputs = [
  ['owner-residue.md', join(repoRoot, 'docs/architecture/modular-monolith/post-convergence/owner-residue.md')],
  ['upstream-index.json', join(repoRoot, UPSTREAM_PAYLOAD_CHANGE.compactIndexLocator)],
  ['upstream-summary.md', join(repoRoot, 'docs/architecture/repository-payload-classification/current/summary.md')],
  ['upstream-unresolved.md', join(repoRoot, 'docs/architecture/repository-payload-classification/current/unresolved.md')],
  ['upstream-inventory.ndjson', join(repoRoot, upstreamInventoryLocator)],
  ['predecessor-index.json', join(repoRoot, PREDECESSOR_1883.compactIndexLocator)],
] as const;
const readOnlySnapshots = readOnlyInputs.map(([name, path]) => [name, sha256Text(readFileSync(path, 'utf8'))] as const);

// 4. Current member and caller closure over the frozen subject.
const members = loadMembers(currentSubject.subjectCommit, currentSubject.subjectTree);
const callers = loadCallers(members, currentSubject.subjectCommit);
const tool = toolIdentity();

// Claim-time execution snapshot, frozen once and published inside the package
// so the verifier can replay the exact adjudication from the ledger bytes.
const run: ResidualRunSnapshot = {
  gate: { number: 1876, ...ghIssueSnapshot(1876) },
  executionBranch: currentBranch,
  dirtySource: worktreeDirty,
  mixedSource: isMixedWorktree(repoRoot),
};

function adjudicate(ledgerVerification: ResidualAdjudicationInput['ledgerVerification']): ResidualAdjudication {
  const result = adjudicateResidualDataGovernance({
    gate: run.gate,
    subject: {
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
      fullInventoryBytesVerified: false,
      currentSubject,
      upstreamPayload,
      predecessor1883: predecessor,
    },
    tool: {
      toolCommit: tool.toolCommit,
      toolTree: tool.toolTree,
      schemaVersion: RESIDUAL_SCHEMA_VERSION,
      toolVersions: {
        nodeVersion: process.version,
        npmVersion: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(),
      },
      entryBundleDigest: tool.entryBundleDigest,
    },
    members,
    callers,
    ledgerVerification,
    dirtySource: run.dirtySource,
    mixedSource: run.mixedSource,
    executionBranch: run.executionBranch,
    predecessorDisposition: new Map(predecessor.memberDisposition.map((entry) => [
      entry.path,
      { owner: entry.owner, outcome: entry.outcome },
    ])),
  });
  if (result.kind === 'parent-coordination-gate-rejection') {
    process.stderr.write(`${JSON.stringify(result)}\n`);
    process.exit(2);
  }
  return result;
}

// 5. First pass writes the external full ledger, then an independent read-and-hash
//    receipt gates the compact decision package.
const firstPass = adjudicate(null);
const ledgerDir = join(repoRoot, 'artifacts/architecture-census', currentSubject.subjectCommit);
mkdirSync(ledgerDir, { recursive: true });
const ledgerPath = join(ledgerDir, 'residual-data-governance-ledger.ndjson');
writeFileSync(ledgerPath, firstPass.ledgerBody);
const ledgerReceipt = verifyResidualLedgerArtifact({
  ledgerAbsolutePath: ledgerPath,
  expectedLocator: firstPass.fullLedger.logicalLocator,
  expectedSha256: firstPass.fullLedger.sha256,
  expectedByteCount: firstPass.fullLedger.byteCount,
  expectedMemberDenominator: firstPass.summaries.memberCount,
  projectionsReconciled: false,
});
if ('error' in ledgerReceipt) {
  process.stderr.write(`ledger-verification:${ledgerReceipt.error}\n`);
  process.exit(1);
}

const outDir = join(repoRoot, OUTPUT_DIR);
mkdirSync(outDir, { recursive: true });

/**
 * Post guards: the subject must not have drifted (re-fetched, not just
 * rev-parsed — a pinned replay skips the moving-ref check by definition) and
 * every consumed read-only byte must still hash to its snapshot. Invoked both
 * before generation begins and again at the publication boundary, after the
 * fixed-point loop, so drift during generation fails closed before the final
 * package is written.
 */
function runPostGuards(revokeOnFailure = false): void {
  const fail = (message: string): never => {
    if (revokeOnFailure) {
      // A drift detected after publication invalidates the written package:
      // revoke every output so no unverified revision remains consumable.
      for (const name of ['index.json', 'decision-matrix.md', 'summaries.md', 'future-slices.md', 'handoff.md']) {
        try {
          rmSync(join(outDir, name));
        } catch {
          // already absent
        }
      }
    }
    process.stderr.write(`${message}\n`);
    process.exit(1);
  };
  if (!replayPinnedSubject) {
    // A fetch or rev-parse failure leaves the subject unverifiable — the same
    // fail-closed (and revoking) path as a confirmed drift.
    try {
      execFileSync('git', ['-C', repoRoot, 'fetch', 'origin', 'integration'], { stdio: 'ignore' });
      const subjectCommitAfter = git(['rev-parse', 'origin/integration^{commit}']);
      if (subjectCommitAfter !== currentSubject.subjectCommit) fail('subject-drifted-during-run');
    } catch {
      fail('subject-drift-check-unavailable');
    }
  }
  for (const [name, path] of readOnlyInputs) {
    const before = readOnlySnapshots.find(([snapshotName]) => snapshotName === name)?.[1];
    if (!before) continue;
    // An unreadable input is indistinguishable from a replaced one: both are
    // drift, and both must revoke already-published outputs.
    let currentDigest: string;
    try {
      currentDigest = sha256Text(readFileSync(path, 'utf8'));
    } catch {
      fail(`read-only-input-mutated:${name}`);
    }
    if (currentDigest !== before) fail(`read-only-input-mutated:${name}`);
  }
}
runPostGuards();

/** Writes one adjudication round's full package: projections plus the index. */
function writeRoundPackage(
  result: ResidualAdjudication,
  flag: boolean,
  verification: ResidualPackageVerification,
): void {
  for (const [name, content] of Object.entries(projectResidualDocuments(result))) {
    const normalized = content.replace(/\n+$/u, '\n');
    const violation = privacyViolation(normalized);
    if (violation) throw new Error(`privacy:${violation}:${name}`);
    writeFileSync(join(outDir, name), normalized);
  }
  const compact = buildResidualCompactPackage({
    result,
    receipt: { ...ledgerReceipt, projectionsReconciled: flag },
    run,
    projectionVerification: verification,
  });
  const compactPrivacy = privacyViolation(compact);
  if (compactPrivacy) throw new Error(`privacy:${compactPrivacy}:index.json`);
  writeFileSync(join(outDir, 'index.json'), compact);
}

/** Content-level reconciliation of the whole on-disk package against the ledger bytes. */
function reconcileRoundPackage(): ResidualPackageVerification {
  return reconcileResidualDecisionPackage({ outputDir: outDir, ledgerAbsolutePath: ledgerPath });
}

// 6. Fixed-point convergence: each round publishes its full package, which is
//    then re-adjudicated from the ledger bytes and compared byte-for-byte. The
//    receipt flag may only be published as true when the package generated
//    under it re-derives exactly, so the receipt always describes the final
//    artifacts on disk.
let receiptFlag = false;
let result = adjudicate({ ...ledgerReceipt, projectionsReconciled: receiptFlag });
writeRoundPackage(result, receiptFlag, { reconciled: false, fileDigests: {} });
let verification = reconcileRoundPackage();
if (verification.reconciled !== receiptFlag) {
  receiptFlag = verification.reconciled;
  result = adjudicate({ ...ledgerReceipt, projectionsReconciled: receiptFlag });
  writeRoundPackage(result, receiptFlag, { reconciled: false, fileDigests: {} });
  verification = reconcileRoundPackage();
  if (verification.reconciled !== receiptFlag) {
    process.stderr.write(`projection-fixed-point-unreachable:${verification.reason}\n`);
    process.exit(1);
  }
}
// Publication boundary: re-run every guard after generation so drift during
// the fixed-point loop fails closed before the final package is written.
runPostGuards();
// Publish the final index embedding the verification computed against exactly
// these final bytes, then confirm the recorded claim is backed.
writeRoundPackage(result, receiptFlag, verification);
const finalVerification = verifyResidualDecisionPackage({ outputDir: outDir, ledgerAbsolutePath: ledgerPath });
if (!finalVerification.reconciled) {
  process.stderr.write(`final-package-unverified:${finalVerification.reason}\n`);
  process.exit(1);
}
// Post-publication drift check closes the write-window TOCTOU: if any consumed
// input moved while the five artifacts were being written, revoke them all.
runPostGuards(true);

process.stdout.write(`${result.qualified ? 'qualified' : 'blocker'} ${result.decisionIdentity} members=${result.summaries.memberCount} unresolved=${result.summaries.unresolvedCount} subject=${currentSubject.subjectCommit.slice(0, 12)} blockers=${result.blockers.join(',') || 'none'}\n`);
