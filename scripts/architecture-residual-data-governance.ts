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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { privacyViolation } from '../src/lib/architecture-census/privacy';
import { serializeDeterministic, sha256Text } from '../src/lib/architecture-census/serialize';
import { isMixedWorktree } from '../src/lib/architecture-census/identity';
import {
  PREDECESSOR_1883,
  REQUIRED_SUCCESSOR,
  RESIDUAL_SCHEMA_VERSION,
  UPSTREAM_PAYLOAD_CHANGE,
  adjudicateResidualDataGovernance,
  collectRelativeCallers,
  directoryPathReadCaller,
  loadPredecessorComparison,
  loadUpstreamPayloadEvidence,
  memberSetDigest,
  projectResidualDocuments,
  resolveResidualCurrentSubject,
  verifyResidualLedgerArtifact,
  verifyResidualProjectionArtifacts,
  type Issue1876Snapshot,
  type ResidualAdjudication,
  type ResidualAdjudicationInput,
  type ResidualCallerInput,
  type ResidualMemberInput,
  type ResidualProjectionVerification,
} from '../src/lib/architecture-charter/residual-data-governance';

const OUTPUT_DIR = 'docs/architecture/modular-monolith/post-convergence/residual-data-governance/current';
const TOOL_FILES = [
  'src/lib/architecture-charter/residual-data-governance.ts',
  'scripts/architecture-residual-data-governance.ts',
];

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
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
  return git(['ls-tree', '-r', '--name-only', '-z', subjectCommit, '--', 'src/lib/data-governance'])
    .split('\0')
    .filter(Boolean)
    .sort()
    .map((path) => ({ path, currentOwnerEvidence: [`sourceTree:${subjectTree}`] }));
}

function gitGrep(pattern: string, subjectCommit: string): string {
  try {
    return git([
      'grep',
      '-F',
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
  const barrel = 'src/lib/data-governance/index.ts';
  const tokens = new Map<string, string[]>();
  for (const path of memberPaths) {
    const relative = path.replace(/^src\/lib\//u, '');
    for (const token of [path, relative]) {
      const bucket = tokens.get(token) ?? [];
      bucket.push(path);
      tokens.set(token, bucket);
    }
  }
  const grep = [gitGrep('lib/data-governance/', subjectCommit), gitGrep('src/lib/data-governance', subjectCommit)].join('\n');
  const callers: ResidualCallerInput[] = [];
  const seen = new Set<string>();
  const add = (caller: ResidualCallerInput): void => {
    const key = `${caller.memberPath}|${caller.callerPath}|${caller.relationship}`;
    if (seen.has(key) || caller.callerPath === caller.memberPath) return;
    seen.add(key);
    callers.push(caller);
  };
  for (const line of grep.split('\n')) {
    const parsed = parseGrepLine(line);
    if (!parsed) continue;
    const { callerPath, text } = parsed;
    if (!callerPath) continue;
    const directory = directoryPathReadCaller(callerPath, text, barrel);
    if (directory && memberPaths.includes(barrel)) add(directory);
    const hits = new Set<string>();
    for (const [token, paths] of tokens) {
      if (!text.includes(token)) continue;
      for (const path of paths) hits.add(path);
    }
    for (const memberPath of hits) {
      const relationship = callerPath.startsWith('openspec/changes/archive/')
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
      add({ memberPath, callerPath, relationship });
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

// 0. Execution-checkpoint guards: a real branch (not detached) and a clean work
//    tree are required before any adjudication input is read.
const currentBranch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
if (currentBranch === 'HEAD') {
  process.stderr.write('detached-worktree-rejected\n');
  process.exit(2);
}
const worktreeDirty = git(['status', '--porcelain']).length > 0;

// 1. Freeze the claim-time current subject (independent from #1876/#1883 history).
execFileSync('git', ['-C', repoRoot, 'fetch', 'origin', 'integration'], { stdio: 'ignore' });
const currentSubject = resolveResidualCurrentSubject(repoRoot);

// 2. Native dependency gate: the upstream payload-eligibility change must be archived.
const upstreamIssue = ghIssueSnapshot(UPSTREAM_PAYLOAD_CHANGE.issue);
if (String(upstreamIssue.state).toUpperCase() !== 'CLOSED' || !upstreamIssue.labels.includes('status:archived')) {
  process.stderr.write(`upstream-payload-change-not-archived:${UPSTREAM_PAYLOAD_CHANGE.issue}:${upstreamIssue.state}:${upstreamIssue.labels.join(',')}\n`);
  process.exit(2);
}
const upstreamPayload = { ...loadUpstreamPayloadEvidence(repoRoot), closed: true, archived: true };
const predecessor = loadPredecessorComparison(repoRoot);

// 3. Read-only comparison evidence: the archived #1883 identity must stay byte-stable.
const readOnlyInputs = [
  ['owner-residue.md', join(repoRoot, 'docs/architecture/modular-monolith/post-convergence/owner-residue.md')],
  ['upstream-index.json', join(repoRoot, UPSTREAM_PAYLOAD_CHANGE.compactIndexLocator)],
  ['predecessor-index.json', join(repoRoot, PREDECESSOR_1883.compactIndexLocator)],
] as const;
const readOnlySnapshots = readOnlyInputs.map(([name, path]) => [name, sha256Text(readFileSync(path, 'utf8'))] as const);

// 4. Current member and caller closure over the frozen subject.
const members = loadMembers(currentSubject.subjectCommit, currentSubject.subjectTree);
const callers = loadCallers(members, currentSubject.subjectCommit);
const tool = toolIdentity();

function adjudicate(ledgerVerification: ResidualAdjudicationInput['ledgerVerification']): ResidualAdjudication {
  const result = adjudicateResidualDataGovernance({
    gate: { number: 1876, ...ghIssueSnapshot(1876) },
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
    dirtySource: worktreeDirty,
    mixedSource: isMixedWorktree(repoRoot),
  });
  if (result.kind === 'parent-coordination-gate-rejection') {
    process.stderr.write(`${JSON.stringify(result)}\n`);
    process.exit(2);
  }
  return result;
}

// 5. First pass writes the external full ledger, then an independent read-and-hash
//    receipt gates the final compact decision package.
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

/** Writes one adjudication's compact projections, then reconciles the actual on-disk bytes. */
function writeProjectionArtifacts(result: ResidualAdjudication): ResidualProjectionVerification {
  for (const [name, content] of Object.entries(projectResidualDocuments(result))) {
    const normalized = content.replace(/\n+$/u, '\n');
    const violation = privacyViolation(normalized);
    if (violation) throw new Error(`privacy:${violation}:${name}`);
    writeFileSync(join(outDir, name), normalized);
  }
  const verification = verifyResidualProjectionArtifacts({
    outputDir: outDir,
    result,
    receiptSubjectCommit: ledgerReceipt.subjectCommit,
  });
  if (!verification.reconciled) {
    process.stderr.write(`projection-verification:${verification.reason}\n`);
    process.exit(1);
  }
  return verification;
}

// 6. Provisional projections from the still-unverified first pass are written and
//    byte-reconciled, so the receipt's projectionsReconciled flag carries a real
//    check result instead of an unconditional claim.
const provisionalVerification = writeProjectionArtifacts(firstPass);
const receipt = { ...ledgerReceipt, projectionsReconciled: provisionalVerification.reconciled };
const result = adjudicate(receipt);

// 7. Post guards run BEFORE the final projection is published, so a drifted
//    run never leaves an apparently-qualified migration input behind.
const subjectCommitAfter = git(['rev-parse', 'origin/integration^{commit}']);
if (subjectCommitAfter !== currentSubject.subjectCommit) {
  process.stderr.write('subject-drifted-during-run\n');
  process.exit(1);
}
for (const [name, path] of readOnlyInputs) {
  const before = readOnlySnapshots.find(([snapshotName]) => snapshotName === name)?.[1];
  if (before && sha256Text(readFileSync(path, 'utf8')) !== before) {
    process.stderr.write(`read-only-input-mutated:${name}\n`);
    process.exit(1);
  }
}

// 8. Final projections are re-reconciled against the final adjudication; the
//    compact index is written only after every receipt claim it embeds is true.
const finalVerification = writeProjectionArtifacts(result);
const compact = serializeDeterministic({
  schemaVersion: result.schemaVersion,
  qualified: result.qualified,
  blockers: result.blockers,
  subject: result.subject,
  tool: result.tool,
  summaries: result.summaries,
  families: result.families,
  futureSlices: result.futureSlices,
  fullLedger: result.fullLedger,
  ledgerVerification: receipt,
  projectionVerification: {
    reconciled: finalVerification.reconciled,
    fileDigests: finalVerification.fileDigests,
  },
  decisionIdentity: result.decisionIdentity,
});
const compactPrivacy = privacyViolation(compact);
if (compactPrivacy) throw new Error(`privacy:${compactPrivacy}:index.json`);
const compactPath = join(outDir, 'index.json');
writeFileSync(compactPath, compact);
if (readFileSync(compactPath, 'utf8') !== compact) {
  process.stderr.write('index-write-verification-failed\n');
  process.exit(1);
}

process.stdout.write(`${result.qualified ? 'qualified' : 'blocker'} ${result.decisionIdentity} members=${result.summaries.memberCount} unresolved=${result.summaries.unresolvedCount} subject=${currentSubject.subjectCommit.slice(0, 12)} blockers=${result.blockers.join(',') || 'none'}\n`);
